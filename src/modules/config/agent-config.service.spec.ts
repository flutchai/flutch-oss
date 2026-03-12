import * as fs from "fs";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
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
        imports: [HttpModule],
        providers: [
          AgentConfigService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => (key === "CONFIG_MODE" ? "local" : undefined)),
            },
          },
        ],
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
        imports: [HttpModule],
        providers: [
          AgentConfigService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === "CONFIG_MODE") return "platform";
                if (key === "API_URL") return "https://api.flutch.ai";
                if (key === "INTERNAL_API_TOKEN") return "test-token";
                return undefined;
              }),
            },
          },
        ],
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
          imports: [HttpModule],
          providers: [
            AgentConfigService,
            {
              provide: ConfigService,
              useValue: {
                get: jest.fn((key: string) => (key === "CONFIG_MODE" ? "local" : undefined)),
              },
            },
          ],
        })
          .compile()
          .then(m => m.get<AgentConfigService>(AgentConfigService))
      ).rejects.toThrow(SyntaxError);

      fsMock.mockRestore();
      readMock.mockRestore();
    });
  });

  describe("platform mode startup validation", () => {
    async function buildService(env: Record<string, string>) {
      const module = await Test.createTestingModule({
        imports: [HttpModule],
        providers: [
          AgentConfigService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => env[key]),
            },
          },
        ],
      }).compile();
      return module.get<AgentConfigService>(AgentConfigService);
    }

    it("should throw when API_URL is missing in platform mode", async () => {
      await expect(
        buildService({ CONFIG_MODE: "platform", INTERNAL_API_TOKEN: "tok" })
      ).rejects.toThrow("API_URL is required when CONFIG_MODE=platform");
    });

    it("should throw when INTERNAL_API_TOKEN is missing in platform mode", async () => {
      await expect(
        buildService({ CONFIG_MODE: "platform", API_URL: "https://api.flutch.ai" })
      ).rejects.toThrow("INTERNAL_API_TOKEN is required when CONFIG_MODE=platform");
    });
  });

  describe("resolveByWidgetKey", () => {
    let service: AgentConfigService;
    let httpService: HttpService;

    const agentWithWidget = {
      agentId: "roofing-agent",
      graphType: "flutch.agent",
      graphSettings: { model: "gpt-4o-mini" },
      platforms: { widget: { widgetKey: "wk_roofing_abc123" } },
    };

    describe("local mode", () => {
      beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
          imports: [HttpModule],
          providers: [
            AgentConfigService,
            {
              provide: ConfigService,
              useValue: {
                get: jest.fn((key: string) => (key === "CONFIG_MODE" ? "local" : undefined)),
              },
            },
          ],
        }).compile();

        service = module.get<AgentConfigService>(AgentConfigService);
        (service as any).localConfigs = { "roofing-agent": agentWithWidget };
      });

      it("returns agent config when widgetKey matches", async () => {
        const result = await service.resolveByWidgetKey("wk_roofing_abc123");
        expect(result.agentId).toBe("roofing-agent");
      });

      it("throws NotFoundException when widgetKey does not match any agent", async () => {
        await expect(service.resolveByWidgetKey("wk_unknown")).rejects.toThrow(NotFoundException);
      });
    });

    describe("platform mode", () => {
      beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
          imports: [HttpModule],
          providers: [
            AgentConfigService,
            {
              provide: ConfigService,
              useValue: {
                get: jest.fn((key: string) => {
                  if (key === "CONFIG_MODE") return "platform";
                  if (key === "API_URL") return "https://api.flutch.ai";
                  if (key === "INTERNAL_API_TOKEN") return "test-token";
                  return undefined;
                }),
              },
            },
          ],
        }).compile();

        service = module.get<AgentConfigService>(AgentConfigService);
        httpService = module.get<HttpService>(HttpService);
      });

      it("fetches agent from platform by widgetKey", async () => {
        const getSpy = jest
          .spyOn(httpService, "get")
          .mockReturnValue(of({ data: agentWithWidget } as any));

        const result = await service.resolveByWidgetKey("wk_roofing_abc123");

        expect(getSpy).toHaveBeenCalledWith(
          "https://api.flutch.ai/agents/by-widget-key/wk_roofing_abc123",
          expect.objectContaining({ headers: { Authorization: "Bearer test-token" } })
        );
        expect(result.agentId).toBe("roofing-agent");
      });

      it("throws NotFoundException when platform returns error", async () => {
        jest.spyOn(httpService, "get").mockReturnValue(throwError(() => new Error("not found")));

        await expect(service.resolveByWidgetKey("wk_unknown")).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe("invalid CONFIG_MODE", () => {
    it("should throw on invalid CONFIG_MODE value", async () => {
      await expect(
        Test.createTestingModule({
          imports: [HttpModule],
          providers: [
            AgentConfigService,
            {
              provide: ConfigService,
              useValue: {
                get: jest.fn(() => "cloud"),
              },
            },
          ],
        })
          .compile()
          .then(m => m.get<AgentConfigService>(AgentConfigService))
      ).rejects.toThrow('Invalid CONFIG_MODE="cloud"');
    });
  });
});
