import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";

@Injectable()
export class TelegramApiClient {
  private readonly logger = new Logger(TelegramApiClient.name);
  private readonly baseUrl = "https://api.telegram.org";

  constructor(private readonly httpService: HttpService) {}

  async sendMessage(botToken: string, chatId: number, text: string): Promise<void> {
    const url = `${this.baseUrl}/bot${botToken}/sendMessage`;
    try {
      await firstValueFrom(
        this.httpService.post(url, { chat_id: chatId, text, parse_mode: "HTML" })
      );
      this.logger.debug(`Sent message to chat ${chatId}`);
    } catch (error) {
      this.logger.error(`Failed to send message to chat ${chatId}: ${error.message}`);
      throw error;
    }
  }
}
