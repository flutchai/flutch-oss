import { Injectable } from "@nestjs/common";
import { AgentConfigService } from "../../config/agent-config.service";

@Injectable()
export class AdminAgentsService {
  constructor(private readonly agentConfigService: AgentConfigService) {}

  getAgents() {
    const configs = this.agentConfigService.getLocalConfigs();
    return Object.values(configs).map(cfg => ({
      id: cfg.agentId,
      graphType: cfg.graphType,
      graphSettings: {
        model: cfg.graphSettings?.model,
        systemPrompt: cfg.graphSettings?.systemPrompt,
        temperature: cfg.graphSettings?.temperature,
      },
      platforms: {
        telegram: cfg.platforms?.telegram
          ? { configured: true, botTokenMasked: maskToken(cfg.platforms.telegram.botToken) }
          : null,
        widget: cfg.platforms?.widget
          ? { configured: true, widgetKey: cfg.platforms.widget.widgetKey }
          : null,
      },
    }));
  }
}

function maskToken(token: string | undefined): string {
  if (!token) return "";
  return token.length > 8 ? `...${token.slice(-4)}` : "****";
}
