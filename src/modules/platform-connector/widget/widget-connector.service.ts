import { Injectable, Inject, Logger, BadRequestException } from "@nestjs/common";
import { Response, Request } from "express";
import { IGraphService, IGraphRequestPayload } from "@flutchai/flutch-sdk";
import { v4 as uuidv4 } from "uuid";
import { AgentConfigService } from "../../config/agent-config.service";
import { UserService } from "../user.service";
import { ThreadService } from "../thread.service";
import { Platform } from "../../database/entities/thread.entity";
import { MessageDirection } from "../../database/entities/message.entity";
import { WidgetInitDto, WidgetInitResponse, WidgetMessageDto } from "./widget.types";

@Injectable()
export class WidgetConnectorService {
  private readonly logger = new Logger(WidgetConnectorService.name);

  constructor(
    private readonly agentConfigService: AgentConfigService,
    private readonly userService: UserService,
    private readonly threadService: ThreadService,
    @Inject("GRAPH_SERVICE") private readonly graphService: IGraphService,
  ) {}

  async init(dto: WidgetInitDto): Promise<WidgetInitResponse> {
    const agentConfig = await this.agentConfigService.resolveByWidgetKey(dto.widgetKey);

    const user = await this.userService.findOrCreateByIdentity(
      Platform.WIDGET,
      dto.fingerprint,
    );

    let thread = await this.threadService.findOrCreate(agentConfig.agentId, user, Platform.WIDGET);

    if (dto.threadId && dto.threadId !== thread.id) {
      throw new BadRequestException(
        `threadId "${dto.threadId}" does not belong to this agent/user`,
      );
    }

    return {
      threadId: thread.id,
      sessionToken: uuidv4(),
    };
  }

  async sendMessage(dto: WidgetMessageDto, req: Request, res: Response): Promise<void> {
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();

    let responseEnded = false;
    req.on("close", () => {
      responseEnded = true;
    });

    const writeEvent = (event: string, data: string): void => {
      if (!responseEnded) {
        res.write(`event: ${event}\ndata: ${data}\n\n`);
      }
    };

    try {
      const agentConfig = await this.agentConfigService.resolveByWidgetKey(dto.widgetKey);

      const user = await this.userService.findOrCreateByIdentity(Platform.WIDGET, dto.threadId);
      const thread = await this.threadService.findOrCreate(agentConfig.agentId, user, Platform.WIDGET);

      await this.threadService.saveMessage(thread.id, dto.text, MessageDirection.INCOMING);

      const context = await this.agentConfigService.resolve(agentConfig.agentId, user.id);

      const payload: IGraphRequestPayload = {
        requestId: uuidv4(),
        input: dto.text,
        config: {
          configurable: {
            thread_id: thread.id,
            context: {
              agentId: context.agentId,
              userId: user.id,
              threadId: thread.id,
            },
            graphSettings: context.graphSettings,
            metadata: { platform: "widget" },
          },
        },
      };

      let fullText = "";

      const result = await this.graphService.streamAnswer(
        payload,
        (chunk: string) => {
          fullText += chunk;
          writeEvent("partial", chunk);
        },
      );

      const finalText = result?.text ?? fullText;
      await this.threadService.saveMessage(thread.id, finalText, MessageDirection.OUTGOING);

      writeEvent("final", JSON.stringify({ messageId: uuidv4(), text: finalText }));
      this.logger.debug(`Widget message handled for thread "${thread.id}"`);
    } catch (error) {
      this.logger.error(`Widget stream error: ${error.message}`);
      writeEvent("error", error.message);
    } finally {
      if (!responseEnded) {
        res.end();
      }
    }
  }
}
