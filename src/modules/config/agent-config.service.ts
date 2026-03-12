import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import * as fs from "fs";
import * as path from "path";
import { AgentConfig, ResolvedAgentContext } from "./agent-config.interface";

/**
 * Resolves agent configuration either from local agents.json (standalone mode)
 * or from Flutch Platform (connected mode).
 *
 * Mode is determined by CONFIG_MODE env variable:
 *   - "local"     — reads from agents.json (default)
 *   - "platform"  — fetches from API_URL
 */
@Injectable()
export class AgentConfigService {
  private readonly logger = new Logger(AgentConfigService.name);
  private readonly mode: "local" | "platform";
  private localConfigs: Record<string, AgentConfig> = {};

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService
  ) {
    const raw = this.configService.get<string>("CONFIG_MODE") ?? "local";
    if (raw !== "local" && raw !== "platform") {
      throw new Error(`Invalid CONFIG_MODE="${raw}". Valid values are "local" and "platform".`);
    }
    this.mode = raw;
    this.logger.log(`Config mode: ${this.mode}`);

    if (this.mode === "platform") {
      const apiUrl = this.configService.get<string>("API_URL");
      const token = this.configService.get<string>("INTERNAL_API_TOKEN");
      if (!apiUrl) throw new Error("API_URL is required when CONFIG_MODE=platform");
      if (!token) throw new Error("INTERNAL_API_TOKEN is required when CONFIG_MODE=platform");
    }

    if (this.mode === "local") {
      this.loadLocalConfigs();
    }
  }

  async getConfig(agentId: string): Promise<AgentConfig> {
    return this.mode === "platform" ? this.fetchFromPlatform(agentId) : this.getFromLocal(agentId);
  }

  async resolveByWidgetKey(widgetKey: string): Promise<AgentConfig> {
    if (this.mode === "local") {
      const found = Object.values(this.localConfigs).find(
        (cfg) => cfg.platforms?.widget?.widgetKey === widgetKey,
      );
      if (!found) {
        throw new NotFoundException(`No agent found for widgetKey "${widgetKey}"`);
      }
      return found;
    }

    const apiUrl = this.configService.get<string>("API_URL");
    const token = this.configService.get<string>("INTERNAL_API_TOKEN");

    try {
      const { data } = await firstValueFrom(
        this.httpService.get(`${apiUrl}/agents/by-widget-key/${widgetKey}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      return data;
    } catch (error) {
      this.logger.error(`Failed to resolve agent for widgetKey "${widgetKey}": ${error.message}`);
      throw new NotFoundException(`No agent found for widgetKey "${widgetKey}"`);
    }
  }

  async resolve(agentId: string, userId: string): Promise<ResolvedAgentContext> {
    const agentConfig = await this.getConfig(agentId);

    const threadId = `${agentId}:${userId}`;

    return {
      agentId,
      userId,
      threadId,
      graphType: agentConfig.graphType,
      graphSettings: agentConfig.graphSettings,
    };
  }

  private getFromLocal(agentId: string): AgentConfig {
    const config = this.localConfigs[agentId];
    if (!config) {
      throw new NotFoundException(`Agent "${agentId}" not found in agents.json`);
    }
    return config;
  }

  private async fetchFromPlatform(agentId: string): Promise<AgentConfig> {
    const apiUrl = this.configService.get<string>("API_URL");
    const token = this.configService.get<string>("INTERNAL_API_TOKEN");

    try {
      const { data } = await firstValueFrom(
        this.httpService.get(`${apiUrl}/agents/${agentId}/config`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      );
      return data;
    } catch (error) {
      this.logger.error(`Failed to fetch agent config for "${agentId}": ${error.message}`);
      throw new NotFoundException(`Agent "${agentId}" not found on platform`);
    }
  }

  private loadLocalConfigs(): void {
    const configPath = path.resolve(process.cwd(), "agents.json");

    if (!fs.existsSync(configPath)) {
      this.logger.warn("agents.json not found — no local agents configured");
      return;
    }

    const content = fs.readFileSync(configPath, "utf-8");
    this.localConfigs = JSON.parse(content);
    this.logger.log(`Loaded ${Object.keys(this.localConfigs).length} agent(s) from agents.json`);
  }
}
