import * as fs from "fs";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { HttpModule } from "@nestjs/axios";
import { HttpService } from "@nestjs/axios";
import { NotFoundException } from "@nestjs/common";
import { of, throwError } from "rxjs";
import { AgentConfigService } from "./agent-config.service";

describe("AgentConfigService", () => {
  describe("local mode (default)", () => {
    let service: AgentConfigService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), HttpModule],
        providers: [AgentConfigService],
      }).compile();

      service = module.get<AgentConfigService>(AgentConfigService);
    });

    it("should be defined", () => {
      expect(service).toBeDefined();
    });

    it("should throw NotFoundException for unknown agentId", async () => {
      await expect(service.resolve("unknown-agent", "user-1")).rejects.toThrow(NotFoundException);
    });

    it("should return resolved context with correct threadId format", async () => {
      (service as any).localConfigs = {
        "test-agent": {
          agentId: "test-agent",
          graphType: "flutch.agent",
          graphSettings: { model: "gpt-4o-mini" },
        },
      };

      const result = await service.resolve("test-agent", "user-42");

      expect(result.agentId).toBe("test-agent");
      expect(result.userId).toBe("user-42");
      expect(result.threadId).toBe("test-agent:user-42");
      expect(result.graphType).toBe("flutch.agent");
      expect(result.graphSettings).toEqual({ model: "gpt-4o-mini" });
    });
  });

  describe("platform mode", () => {
    let service: AgentConfigService;
    let httpService: HttpService;

    const platformConfig = {
      agentId: "roofing-v1",
      graphType: "flutch.agent",
      graphSettings: { model: "gpt-4o", systemPrompt: "You are a roofing expert." },
    };

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            load: [
              () => ({
                CONFIG_MODE: "platform",
                API_URL: "https://api.flutch.ai",
                INTERNAL_API_TOKEN: "test-token",
              }),
            ],
          }),
          HttpModule,
        ],
        providers: [AgentConfigService],
      }).compile();

      service = module.get<AgentConfigService>(AgentConfigService);
      httpService = module.get<HttpService>(HttpService);
    });

    it("should fetch config from platform and return resolved context", async () => {
      jest.spyOn(httpService, "get").mockReturnValue(of({ data: platformConfig } as any));

      const result = await service.resolve("roofing-v1", "user-1");

      expect(result.agentId).toBe("roofing-v1");
      expect(result.threadId).toBe("roofing-v1:user-1");
      expect(result.graphSettings.model).toBe("gpt-4o");
    });

    it("should call platform API with correct URL and auth header", async () => {
      const getSpy = jest
        .spyOn(httpService, "get")
        .mockReturnValue(of({ data: platformConfig } as any));

      await service.resolve("roofing-v1", "user-1");

      expect(getSpy).toHaveBeenCalledWith(
        "https://api.flutch.ai/agents/roofing-v1/config",
        expect.objectContaining({
          headers: { Authorization: "Bearer test-token" },
        })
      );
    });

    it("should throw NotFoundException when platform returns an error", async () => {
      jest.spyOn(httpService, "get").mockReturnValue(throwError(() => new Error("Network error")));

      await expect(service.resolve("roofing-v1", "user-1")).rejects.toThrow(NotFoundException);
    });
  });

  describe("loadLocalConfigs error handling", () => {
    it("should throw when agents.json contains invalid JSON", async () => {
      const fsMock = jest.spyOn(fs, "existsSync").mockReturnValue(true);
      const readMock = jest.spyOn(fs, "readFileSync").mockReturnValue("{ invalid json }" as any);

      await expect(
        Test.createTestingModule({
          imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), HttpModule],
          providers: [AgentConfigService],
        })
          .compile()
          .then(m => m.get<AgentConfigService>(AgentConfigService))
      ).rejects.toThrow(SyntaxError);

      fsMock.mockRestore();
      readMock.mockRestore();
    });
  });

  describe("invalid CONFIG_MODE", () => {
    it("should throw on invalid CONFIG_MODE value", async () => {
      await expect(
        Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({
              isGlobal: true,
              ignoreEnvFile: true,
              load: [() => ({ CONFIG_MODE: "cloud" })],
            }),
            HttpModule,
          ],
          providers: [AgentConfigService],
        })
          .compile()
          .then(m => m.get<AgentConfigService>(AgentConfigService))
      ).rejects.toThrow('Invalid CONFIG_MODE="cloud"');
    });
  });
});
