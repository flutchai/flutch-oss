import { Test, TestingModule } from "@nestjs/testing";
import { EngineController } from "./engine.controller";
import { EngineService } from "./engine.service";
import { AgentStreamDto } from "./engine.dto";

const mockPayload = {
  requestId: "req-1",
  input: "hello",
  config: {
    configurable: {
      thread_id: "my-agent:user-1",
      context: { agentId: "my-agent", userId: "user-1", threadId: "my-agent:user-1" },
      graphSettings: { model: "gpt-4o-mini" },
      metadata: {},
    },
  },
};

const mockDto: AgentStreamDto = {
  agentId: "my-agent",
  userId: "user-1",
  input: "hello",
};

function mockResponse() {
  return {
    setHeader: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
  } as any;
}

describe("EngineController", () => {
  let controller: EngineController;
  let engineService: jest.Mocked<EngineService>;
  let graphService: { streamAnswer: jest.Mock; generateAnswer: jest.Mock };

  beforeEach(async () => {
    graphService = {
      streamAnswer: jest.fn().mockResolvedValue({ answer: "hi" }),
      generateAnswer: jest.fn().mockResolvedValue({ answer: "hi" }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EngineController],
      providers: [
        {
          provide: "GRAPH_SERVICE",
          useValue: graphService,
        },
        {
          provide: EngineService,
          useValue: {
            buildPayload: jest.fn().mockResolvedValue(mockPayload),
          },
        },
      ],
    }).compile();

    controller = module.get<EngineController>(EngineController);
    engineService = module.get(EngineService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("POST /agent/stream", () => {
    it("should set SSE headers", async () => {
      const res = mockResponse();
      await controller.streamAnswer(mockDto, res);

      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/event-stream");
      expect(res.setHeader).toHaveBeenCalledWith("Transfer-Encoding", "chunked");
      expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-cache");
      expect(res.setHeader).toHaveBeenCalledWith("Connection", "keep-alive");
    });

    it("should call buildPayload with the dto", async () => {
      const res = mockResponse();
      await controller.streamAnswer(mockDto, res);

      expect(engineService.buildPayload).toHaveBeenCalledWith(mockDto);
    });

    it("should call graphService.streamAnswer with built payload", async () => {
      const res = mockResponse();
      await controller.streamAnswer(mockDto, res);

      expect(graphService.streamAnswer).toHaveBeenCalledWith(mockPayload, expect.any(Function));
    });

    it("should write stream_event chunks via callback", async () => {
      const res = mockResponse();
      graphService.streamAnswer.mockImplementation(async (_payload, cb) => {
        cb("chunk-1");
        cb("chunk-2");
        return { answer: "done" };
      });

      await controller.streamAnswer(mockDto, res);

      expect(res.write).toHaveBeenCalledWith("event: stream_event\n");
      expect(res.write).toHaveBeenCalledWith("data: chunk-1\n\n");
      expect(res.write).toHaveBeenCalledWith("data: chunk-2\n\n");
    });

    it("should write final event with result and end response", async () => {
      const res = mockResponse();
      await controller.streamAnswer(mockDto, res);

      expect(res.write).toHaveBeenCalledWith("event: final\n");
      expect(res.write).toHaveBeenCalledWith(`data: ${JSON.stringify({ answer: "hi" })}\n\n`);
      expect(res.end).toHaveBeenCalled();
    });

    it("should write error event and end response on failure", async () => {
      const res = mockResponse();
      graphService.streamAnswer.mockRejectedValue(new Error("graph exploded"));

      await controller.streamAnswer(mockDto, res);

      expect(res.write).toHaveBeenCalledWith("event: error\n");
      expect(res.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify({ message: "graph exploded" })}\n\n`
      );
      expect(res.end).toHaveBeenCalled();
    });

    it("should still end response when buildPayload throws", async () => {
      const res = mockResponse();
      (engineService.buildPayload as jest.Mock).mockRejectedValue(new Error("agent not found"));

      await controller.streamAnswer(mockDto, res);

      expect(res.write).toHaveBeenCalledWith("event: error\n");
      expect(res.end).toHaveBeenCalled();
    });
  });

  describe("POST /agent/generate", () => {
    it("should call buildPayload with the dto", async () => {
      await controller.generateAnswer(mockDto);
      expect(engineService.buildPayload).toHaveBeenCalledWith(mockDto);
    });

    it("should call graphService.generateAnswer with built payload", async () => {
      await controller.generateAnswer(mockDto);
      expect(graphService.generateAnswer).toHaveBeenCalledWith(mockPayload);
    });

    it("should return result from graphService.generateAnswer", async () => {
      graphService.generateAnswer.mockResolvedValue({ answer: "final answer" });
      const result = await controller.generateAnswer(mockDto);
      expect(result).toEqual({ answer: "final answer" });
    });
  });
});
