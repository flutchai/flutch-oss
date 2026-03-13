import {
  Controller,
  Post,
  Param,
  Body,
  Headers,
  Logger,
  HttpCode,
  ForbiddenException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { TelegramConnectorService } from "./telegram-connector.service";
import { TelegramUpdate } from "./telegram.types";

/**
 * Receives webhook updates from Telegram Bot API.
 *
 * Telegram sends POST requests to: /public/tg/webhook/:agentId
 *
 * Always responds with HTTP 200 (even on errors) to prevent Telegram
 * from retrying failed updates endlessly.
 *
 * Optional secret verification: set TELEGRAM_WEBHOOK_SECRET env var and
 * pass the same value as the `secret_token` param when calling setWebhook.
 */
@ApiTags("Telegram Webhook")
@Controller("public/tg")
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);

  constructor(
    private readonly telegramConnectorService: TelegramConnectorService,
    private readonly configService: ConfigService
  ) {}

  @Post("webhook/:agentId")
  @HttpCode(200)
  @ApiOperation({ summary: "Receive Telegram Bot API webhook update" })
  @ApiResponse({
    status: 200,
    description: "Update processed (always 200 to prevent Telegram retries)",
  })
  @ApiResponse({ status: 403, description: "Invalid webhook secret" })
  async handleWebhook(
    @Param("agentId") agentId: string,
    @Body() update: TelegramUpdate,
    @Headers("x-telegram-bot-api-secret-token") secretHeader?: string
  ): Promise<void> {
    const secret = this.configService.get<string>("TELEGRAM_WEBHOOK_SECRET");
    if (secret && secretHeader !== secret) {
      this.logger.warn(`Rejected webhook for agent "${agentId}": invalid secret`);
      throw new ForbiddenException("Invalid webhook secret");
    }

    try {
      await this.telegramConnectorService.handleUpdate(agentId, update);
    } catch (error) {
      // Always return 200 to Telegram to prevent infinite retries
      this.logger.error(`Error handling update for agent "${agentId}": ${error.message}`);
    }
  }
}
