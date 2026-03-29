import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { CheckpointerService } from "./checkpointer.service";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { Pool } from "pg";

const mockSaver = { setup: jest.fn().mockResolvedValue(undefined) };

jest.mock("@langchain/langgraph-checkpoint-postgres", () => ({
  PostgresSaver: jest.fn().mockImplementation(() => mockSaver),
}));

jest.mock("pg", () => ({
  Pool: jest.fn().mockImplementation(() => ({ end: jest.fn() })),
}));

const DATABASE_URL = "postgresql://localhost:5432/test";
const DATABASE_URL_WITH_SSLMODE = "postgresql://localhost:5432/test?sslmode=require";

function makeConfigService(ssl?: string, url = DATABASE_URL) {
  return {
    getOrThrow: jest.fn().mockReturnValue(url),
    get: jest.fn().mockImplementation((key: string) => (key === "POSTGRES_SSL" ? ssl : undefined)),
  };
}

describe("CheckpointerService", () => {
  let service: CheckpointerService;

  beforeEach(async () => {
    jest.clearAllMocks();
    (mockSaver.setup as jest.Mock).mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckpointerService,
        { provide: ConfigService, useValue: makeConfigService() },
      ],
    }).compile();

    service = module.get<CheckpointerService>(CheckpointerService);
  });

  describe("constructor", () => {
    it("creates Pool from DATABASE_URL without SSL by default", () => {
      expect(Pool).toHaveBeenCalledWith({
        connectionString: DATABASE_URL,
        ssl: false,
      });
    });

    it("creates Pool with SSL when POSTGRES_SSL=true", async () => {
      jest.clearAllMocks();
      const module = await Test.createTestingModule({
        providers: [
          CheckpointerService,
          { provide: ConfigService, useValue: makeConfigService("true") },
        ],
      }).compile();
      module.get<CheckpointerService>(CheckpointerService);
      expect(Pool).toHaveBeenCalledWith({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      });
    });

    it("strips sslmode query param from DATABASE_URL", async () => {
      jest.clearAllMocks();
      const module = await Test.createTestingModule({
        providers: [
          CheckpointerService,
          { provide: ConfigService, useValue: makeConfigService("true", DATABASE_URL_WITH_SSLMODE) },
        ],
      }).compile();
      module.get<CheckpointerService>(CheckpointerService);
      const [{ connectionString }] = (Pool as unknown as jest.Mock).mock.calls.at(-1);
      expect(connectionString).not.toContain("sslmode");
    });

    it("creates PostgresSaver with pool and schema", () => {
      expect(PostgresSaver).toHaveBeenCalledWith(
        expect.anything(),
        undefined,
        { schema: "public" }
      );
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
    it("throws if DATABASE_URL is not configured", () => {
      expect(
        () =>
          new CheckpointerService({
            getOrThrow: jest.fn().mockImplementation(() => {
              throw new Error("DATABASE_URL is not defined");
            }),
            get: jest.fn(),
          } as any)
      ).toThrow("DATABASE_URL is not defined");
    });

    it("propagates setup() errors", async () => {
      mockSaver.setup.mockRejectedValueOnce(new Error("DB connection failed"));
      await expect(service.onModuleInit()).rejects.toThrow("DB connection failed");
    });
  });
});
