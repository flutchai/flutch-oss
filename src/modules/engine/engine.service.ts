import { Injectable, Logger } from "@nestjs/common";
import { IGraphRequestPayload } from "@flutchai/flutch-sdk";
import { HumanMessage } from "@langchain/core/messages";
import { AgentConfigService } from "../config/agent-config.service";
import { AgentStreamDto } from "./engine.dto";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class EngineService {
  private readonly logger = new Logger(EngineService.name);

  constructor(private readonly agentConfigService: AgentConfigService) {}

  async buildPayload(dto: AgentStreamDto): Promise<IGraphRequestPayload> {
    const { agentId, userId, input, requestId, metadata } = dto;

    const context = await this.agentConfigService.resolve(agentId, userId);

    this.logger.debug(`Resolved context for agent "${agentId}": threadId=${context.threadId}`);

    const graphInput =
      typeof input === "string" ? { messages: [new HumanMessage(input)] } : input;

    return {
      requestId: requestId ?? uuidv4(),
      input: graphInput,
      config: {
        configurable: {
          thread_id: context.threadId,
          context: {
            agentId: context.agentId,
            userId: context.userId,
            threadId: context.threadId,
          },
          graphSettings: { ...context.graphSettings, graphType: context.graphType },
          metadata: metadata ?? {},
        },
      },
    };
  }
}
