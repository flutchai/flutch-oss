import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { AgentConfigService } from "../../config/agent-config.service";

@Injectable()
export class AdminSettingsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly agentConfigService: AgentConfigService
  ) {}

  getSettings() {
    const openaiKey = this.configService.get<string>("OPENAI_API_KEY");
    const anthropicKey = this.configService.get<string>("ANTHROPIC_API_KEY");
    const platformUrl = this.configService.get<string>("FLUTCH_PLATFORM_URL");

    return {
      configMode: this.configService.get<string>("CONFIG_MODE"),
      flutchPlatformUrl: platformUrl ? maskUrl(platformUrl) : null,
      openaiKeyMasked: openaiKey ? `sk-...${openaiKey.slice(-4)}` : null,
      anthropicKeyMasked: anthropicKey ? `sk-ant-...${anthropicKey.slice(-4)}` : null,
    };
  }

  async registerWebhook(agentId: string) {
    const config = await this.agentConfigService.getConfig(agentId);
    const botToken = config.platforms?.telegram?.botToken;
    if (!botToken)
      return { success: false, error: "No Telegram bot token configured for this agent" };

    const webhookBase = this.configService.get<string>("WEBHOOK_BASE_URL");
    if (!webhookBase) return { success: false, error: "WEBHOOK_BASE_URL env variable not set" };

    const webhookUrl = `${webhookBase}/public/tg/webhook/${agentId}`;

    try {
      const { data } = await firstValueFrom(
        this.httpService.post(`https://api.telegram.org/bot${botToken}/setWebhook`, {
          url: webhookUrl,
        })
      );
      return { success: data.ok, webhookUrl, description: data.description };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ""}`;
  } catch {
    return "****";
  }
}
