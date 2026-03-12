import { Injectable, Inject, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IGraphService, IGraphRequestPayload } from "@flutchai/flutch-sdk";
import { v4 as uuidv4 } from "uuid";
import { AgentConfigService } from "../../config/agent-config.service";
import { ThreadService } from "../thread.service";
import { Platform } from "../../database/entities/thread.entity";
import { MessageDirection } from "../../database/entities/message.entity";
import { TelegramApiClient } from "./telegram-api.client";
import { TelegramUpdate } from "./telegram.types";

@Injectable()
export class TelegramConnectorService {
  private readonly logger = new Logger(TelegramConnectorService.name);

  constructor(
    private readonly agentConfigService: AgentConfigService,
    private readonly threadService: ThreadService,
    private readonly telegramApiClient: TelegramApiClient,
    private readonly configService: ConfigService,
    @Inject("GRAPH_SERVICE") private readonly graphService: IGraphService
  ) {}

  async handleUpdate(agentId: string, update: TelegramUpdate): Promise<void> {
    const message = update.message ?? update.callback_query?.message;
    if (!message) {
      this.logger.debug(`Update ${update.update_id} has no message — skipping`);
      return;
    }

    const chatId = message.chat.id;
    const text = update.message?.text ?? update.callback_query?.data;
    if (!text) {
      this.logger.debug(`Message in chat ${chatId} has no text — skipping`);
      return;
    }

    this.logger.debug(`Handling update from chat ${chatId} for agent "${agentId}"`);

    // Persist: find or create thread, save incoming message
    const thread = await this.threadService.findOrCreate(agentId, String(chatId), Platform.TELEGRAM);
    await this.threadService.saveMessage(thread.id, text, MessageDirection.INCOMING);

    const botToken = await this.resolveBotToken(agentId);
    const context = await this.agentConfigService.resolve(agentId, String(chatId));

    const payload: IGraphRequestPayload = {
      requestId: uuidv4(),
      input: text,
      config: {
        configurable: {
          thread_id: thread.id,
          context: {
            agentId: context.agentId,
            userId: context.userId,
            threadId: thread.id,
          },
          graphSettings: context.graphSettings,
          metadata: { platform: "telegram", chatId },
        },
      },
    };

    const result = await this.graphService.generateAnswer(payload);

    // Persist outgoing message, then send to Telegram
    await this.threadService.saveMessage(thread.id, result.text, MessageDirection.OUTGOING);
    await this.telegramApiClient.sendMessage(botToken, chatId, result.text);
    this.logger.debug(`Replied to chat ${chatId}`);
  }

  private async resolveBotToken(agentId: string): Promise<string> {
    // 1. Per-agent env var: TELEGRAM_BOT_TOKEN_<AGENTID> (dashes → underscores, uppercased)
    const envKey = `TELEGRAM_BOT_TOKEN_${agentId.toUpperCase().replace(/-/g, "_")}`;
    const envToken = this.configService.get<string>(envKey);
    if (envToken) return envToken;

    // 2. agents.json platforms.telegram.botToken
    const config = await this.agentConfigService.getConfig(agentId);
    const token = config.platforms?.telegram?.botToken;
    if (token) return token;

    throw new Error(`No Telegram bot token configured for agent "${agentId}"`);
  }
}
