import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { HttpModule } from "@nestjs/axios";
import { NotFoundException } from "@nestjs/common";
import { AgentConfigService } from "./agent-config.service";

describe("AgentConfigService", () => {
  let service: AgentConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        HttpModule,
      ],
      providers: [AgentConfigService],
    }).compile();

    service = module.get<AgentConfigService>(AgentConfigService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should throw NotFoundException for unknown agentId in local mode", async () => {
    await expect(service.resolve("unknown-agent", "user-1")).rejects.toThrow(
      NotFoundException
    );
  });

  it("should return resolved context with correct threadId format", async () => {
    // Inject a local config manually
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
  });
});
