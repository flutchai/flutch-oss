import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { CheckpointerService } from "./checkpointer.service";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

jest.mock("@langchain/langgraph-checkpoint-postgres", () => ({
  PostgresSaver: {
    fromConnString: jest.fn(),
  },
}));

const mockSaver = {
  setup: jest.fn().mockResolvedValue(undefined),
};

describe("CheckpointerService", () => {
  let service: CheckpointerService;

  beforeEach(async () => {
    (PostgresSaver.fromConnString as jest.Mock).mockReturnValue(mockSaver);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckpointerService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue("postgresql://localhost:5432/test"),
          },
        },
      ],
    }).compile();

    service = module.get<CheckpointerService>(CheckpointerService);
  });

  afterEach(() => jest.clearAllMocks());

  describe("constructor", () => {
    it("creates PostgresSaver from DATABASE_URL", () => {
      expect(PostgresSaver.fromConnString).toHaveBeenCalledWith(
        "postgresql://localhost:5432/test",
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
      (PostgresSaver.fromConnString as jest.Mock).mockClear();
      expect(
        () =>
          new CheckpointerService({
            getOrThrow: jest.fn().mockImplementation(() => {
              throw new Error("DATABASE_URL is not defined");
            }),
          } as any)
      ).toThrow("DATABASE_URL is not defined");
    });

    it("propagates setup() errors", async () => {
      mockSaver.setup.mockRejectedValueOnce(new Error("DB connection failed"));
      await expect(service.onModuleInit()).rejects.toThrow("DB connection failed");
    });
  });
});
