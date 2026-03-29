import { Test, TestingModule } from "@nestjs/testing";
import { CheckpointerService, CHECKPOINTER } from "./checkpointer.service";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { PG_POOL_TOKEN } from "../pg-pool/pg-pool.module";

const mockSaver = { setup: jest.fn().mockResolvedValue(undefined) };

jest.mock("@langchain/langgraph-checkpoint-postgres", () => ({
  PostgresSaver: jest.fn().mockImplementation(() => mockSaver),
}));

const mockPool = { end: jest.fn() };

async function buildModule() {
  return Test.createTestingModule({
    providers: [
      CheckpointerService,
      { provide: PG_POOL_TOKEN, useValue: mockPool },
    ],
  }).compile();
}

describe("CheckpointerService", () => {
  let service: CheckpointerService;

  beforeEach(async () => {
    jest.clearAllMocks();
    (mockSaver.setup as jest.Mock).mockResolvedValue(undefined);
    const module: TestingModule = await buildModule();
    service = module.get<CheckpointerService>(CheckpointerService);
  });

  describe("constructor", () => {
    it("creates PostgresSaver with injected pool and schema", () => {
      expect(PostgresSaver).toHaveBeenCalledWith(mockPool, undefined, { schema: "public" });
    });

    it("exposes saver instance", () => {
      expect(service.saver).toBe(mockSaver);
    });
  });

  describe("onModuleInit", () => {
    it("calls setup() to create checkpointer tables", async () => {
      await service.onModuleInit();
      expect(mockSaver.setup).toHaveBeenCalledTimes(1);
    });

    it("can be called multiple times safely", async () => {
      await service.onModuleInit();
      await service.onModuleInit();
      expect(mockSaver.setup).toHaveBeenCalledTimes(2);
    });
  });

  describe("error handling", () => {
    it("propagates setup() errors", async () => {
      mockSaver.setup.mockRejectedValueOnce(new Error("DB connection failed"));
      await expect(service.onModuleInit()).rejects.toThrow("DB connection failed");
    });
  });
});
