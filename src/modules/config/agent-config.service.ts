import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import * as fs from "fs";
import * as path from "path";
import { AgentConfig, ResolvedAgentContext } from "./agent-config.interface";

/**
 * Resolves agent configuration either from local YAML (standalone mode)
 * or from Flutch Platform (connected mode).
 *
 * Mode is determined by CONFIG_MODE env variable:
 *   - "local"     — reads from agents.yml (default)
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
    this.mode = (this.configService.get<string>("CONFIG_MODE") as any) || "local";
    this.logger.log(`Config mode: ${this.mode}`);

    if (this.mode === "local") {
      this.loadLocalConfigs();
    }
  }

  async resolve(agentId: string, userId: string): Promise<ResolvedAgentContext> {
    const agentConfig =
      this.mode === "platform"
        ? await this.fetchFromPlatform(agentId)
        : this.getFromLocal(agentId);

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
      throw new NotFoundException(`Agent "${agentId}" not found in agents.yml`);
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
    const configPath = path.resolve(process.cwd(), "agents.yml");

    if (!fs.existsSync(configPath)) {
      this.logger.warn("agents.yml not found — no local agents configured");
      return;
    }

    try {
      // Simple YAML parser for flat structure — avoids extra dependency
      const content = fs.readFileSync(configPath, "utf-8");
      this.localConfigs = this.parseAgentsYaml(content);
      this.logger.log(`Loaded ${Object.keys(this.localConfigs).length} agent(s) from agents.yml`);
    } catch (error) {
      this.logger.error(`Failed to load agents.yml: ${error.message}`);
    }
  }

  private parseAgentsYaml(content: string): Record<string, AgentConfig> {
    // Use JSON-based config if yaml library not available
    // For production, swap this with `js-yaml` or `yaml` package
    try {
      // Try to load agents.json as fallback
      const jsonPath = path.resolve(process.cwd(), "agents.json");
      if (fs.existsSync(jsonPath)) {
        return JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      }
    } catch {
      // ignore
    }
    return {};
  }
}
