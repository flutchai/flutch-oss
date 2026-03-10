import { Injectable, Inject, Logger } from "@nestjs/common";
import { IGraphService, IGraphRequestPayload } from "@flutchai/flutch-sdk";
import { AgentConfigService } from "../config/agent-config.service";
import { AgentStreamDto } from "./engine.dto";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class EngineService {
  private readonly logger = new Logger(EngineService.name);

  constructor(
    @Inject("GRAPH_SERVICE")
    private readonly graphService: IGraphService,
    private readonly agentConfigService: AgentConfigService
  ) {}

  async buildPayload(dto: AgentStreamDto): Promise<IGraphRequestPayload> {
    const { agentId, userId, input, requestId, metadata } = dto;

    const context = await this.agentConfigService.resolve(agentId, userId);

    this.logger.debug(`Resolved context for agent "${agentId}": threadId=${context.threadId}`);

    return {
      requestId: requestId ?? uuidv4(),
      input,
      config: {
        configurable: {
          thread_id: context.threadId,
          context: {
            agentId: context.agentId,
            userId: context.userId,
            threadId: context.threadId,
          },
          graphSettings: context.graphSettings,
          metadata: metadata ?? {},
        },
      },
    };
  }
}
