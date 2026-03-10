import { Controller, Post, Body, Res, Logger, Inject } from "@nestjs/common";
import { Response } from "express";
import { IGraphService } from "@flutchai/flutch-sdk";
import { EngineService } from "./engine.service";
import { AgentStreamDto } from "./engine.dto";

/**
 * Agent Engine controller.
 *
 * POST /agent/stream    — accepts agentId + userId + input, streams SSE response.
 * POST /agent/generate  — accepts agentId + userId + input, returns sync response.
 *
 * The original POST /stream from SDK stays untouched (backward compatibility).
 */
@Controller("agent")
export class EngineController {
  private readonly logger = new Logger(EngineController.name);

  constructor(
    @Inject("GRAPH_SERVICE")
    private readonly graphService: IGraphService,
    private readonly engineService: EngineService
  ) {}

  @Post("stream")
  async streamAnswer(@Body() dto: AgentStreamDto, @Res() res: Response): Promise<void> {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      const payload = await this.engineService.buildPayload(dto);

      this.logger.debug(
        `Starting agent stream: agentId=${dto.agentId} requestId=${payload.requestId}`
      );

      const result = await this.graphService.streamAnswer(payload, (chunk: string) => {
        res.write(`event: stream_event\n`);
        res.write(`data: ${chunk}\n\n`);
      });

      res.write(`event: final\n`);
      res.write(`data: ${JSON.stringify(result)}\n\n`);
      res.end();
    } catch (error) {
      this.logger.error(`Agent stream failed: ${error.message}`);
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ message: error.message })}\n\n`);
      res.end();
    }
  }

  @Post("generate")
  async generateAnswer(@Body() dto: AgentStreamDto) {
    try {
      const payload = await this.engineService.buildPayload(dto);
      return await this.graphService.generateAnswer(payload);
    } catch (error) {
      this.logger.error(`Agent generate failed: ${error.message}`);
      throw error;
    }
  }
}
