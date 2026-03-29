import { SimpleGraphBuilder } from "./builder";
import * as modelFactory from "../model.factory";
import { StateGraph } from "@langchain/langgraph";
import { LangfuseService } from "../../modules/langfuse/langfuse.service";

jest.mock("../model.factory", () => ({
  createModel: jest.fn(),
}));

jest.mock("langfuse-langchain", () => ({
  CallbackHandler: jest.fn().mockImplementation(() => ({ _type: "langfuse-callback" })),
}));

const mockMcpClient = {
  getTools: jest.fn().mockResolvedValue([]),
  executeTool: jest.fn(),
};

const mockModel: any = {
  invoke: jest.fn().mockResolvedValue({ content: "test response" }),
  withConfig: jest.fn(),
};

// Spy on StateGraph.prototype.compile to capture checkpointer argument
const compileSpy = jest.spyOn(StateGraph.prototype, "compile");

const mockCheckpointer = {
  get: jest.fn(),
  put: jest.fn(),
  list: jest.fn(),
  setup: jest.fn(),
};

const mockLangfuseCallback = { name: "langfuse-callback" };

const mockLangfuseService = {
  isEnabled: jest.fn().mockReturnValue(true),
  createCallbackHandler: jest.fn().mockReturnValue(mockLangfuseCallback),
} as unknown as LangfuseService;

const disabledLangfuseService = {
  isEnabled: jest.fn().mockReturnValue(false),
  createCallbackHandler: jest.fn().mockReturnValue(null),
} as unknown as LangfuseService;

const basePayload = {
  requestId: "req-1",
  input: "hello",
  config: {
    configurable: {
      thread_id: "550e8400-e29b-41d4-a716-446655440000",
      context: { userId: "user-1", agentId: "roofing-agent", companyId: "co-1" },
      graphSettings: { model: "gpt-4o-mini", graphType: "flutch.simple::1.0.0" },
    },
  },
} as any;

describe("SimpleGraphBuilder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockModel.withConfig.mockReturnValue(mockModel);
    (modelFactory.createModel as jest.Mock).mockReturnValue(mockModel);
    mockLangfuseService.createCallbackHandler = jest.fn().mockReturnValue(mockLangfuseCallback);
  });

  describe("metadata", () => {
    it("has correct graphType", () => {
      const builder = new SimpleGraphBuilder(null, null, mockMcpClient as any);
      expect(builder.graphType).toBe("flutch.simple::1.0.0");
    });

    it("has correct version", () => {
      const builder = new SimpleGraphBuilder(null, null, mockMcpClient as any);
      expect(builder.version).toBe("1.0.0");
    });
  });

  describe("buildGraph — without checkpointer, without langfuse", () => {
    let builder: SimpleGraphBuilder;

    beforeEach(() => {
      builder = new SimpleGraphBuilder(null, null, mockMcpClient as any);
    });

    it("builds a compiled graph", async () => {
      const graph = await builder.buildGraph(basePayload);
      expect(graph).toBeDefined();
    });

    it("compiles without checkpointer", async () => {
      await builder.buildGraph(basePayload);
      expect(compileSpy).toHaveBeenCalledWith({ checkpointer: undefined });
    });

    it("uses model from graphSettings", async () => {
      await builder.buildGraph(basePayload);
      expect(modelFactory.createModel).toHaveBeenCalledWith({
        model: "gpt-4o-mini",
        graphType: "flutch.simple::1.0.0",
      });
    });

    it("applies default model gpt-4o-mini when model is absent", async () => {
      const graph = await builder.buildGraph();
      expect(graph).toBeDefined();
      expect(modelFactory.createModel).toHaveBeenCalledWith({ model: "gpt-4o-mini" });
    });

    it("does not call withConfig when langfuse is disabled", async () => {
      await builder.buildGraph(basePayload);
      expect(mockModel.withConfig).not.toHaveBeenCalled();
    });
  });

  describe("buildGraph — with checkpointer", () => {
    it("compiles graph with the injected checkpointer", async () => {
      const builder = new SimpleGraphBuilder(mockCheckpointer, null, mockMcpClient as any);
      await builder.buildGraph(basePayload);
      expect(compileSpy).toHaveBeenCalledWith({ checkpointer: mockCheckpointer });
    });
  });

  describe("buildGraph — with LangFuse enabled", () => {
    let builder: SimpleGraphBuilder;

    beforeEach(() => {
      builder = new SimpleGraphBuilder(null, mockLangfuseService, mockMcpClient as any);
    });

    it("calls createCallbackHandler with context from payload", async () => {
      await builder.buildGraph(basePayload);
      expect(mockLangfuseService.createCallbackHandler).toHaveBeenCalledWith({
        userId: "user-1",
        agentId: "roofing-agent",
        threadId: "550e8400-e29b-41d4-a716-446655440000",
      });
    });

    it("binds callback to model via withConfig", async () => {
      await builder.buildGraph(basePayload);
      expect(mockModel.withConfig).toHaveBeenCalledWith({
        callbacks: [mockLangfuseCallback],
      });
    });

    it("falls back to anonymous context when payload has no context", async () => {
      const payloadNoCtx = {
        requestId: "req-2",
        input: "hi",
        config: { configurable: { thread_id: "t-1", graphSettings: {} } },
      } as any;
      await builder.buildGraph(payloadNoCtx);
      expect(mockLangfuseService.createCallbackHandler).toHaveBeenCalledWith({
        userId: "anonymous",
        agentId: "unknown",
        threadId: "t-1",
      });
    });
  });

  describe("buildGraph — with LangFuse disabled", () => {
    it("does not bind callbacks when langfuse returns null handler", async () => {
      const builder = new SimpleGraphBuilder(null, disabledLangfuseService, mockMcpClient as any);
      await builder.buildGraph(basePayload);
      expect(mockModel.withConfig).not.toHaveBeenCalled();
    });
  });

  describe("buildGraph — checkpointer + langfuse together", () => {
    it("passes both checkpointer and langfuse callback", async () => {
      const builder = new SimpleGraphBuilder(
        mockCheckpointer,
        mockLangfuseService,
        mockMcpClient as any
      );
      await builder.buildGraph(basePayload);
      expect(compileSpy).toHaveBeenCalledWith({ checkpointer: mockCheckpointer });
      expect(mockModel.withConfig).toHaveBeenCalledWith({ callbacks: [mockLangfuseCallback] });
    });
  });

  describe("buildGraph — systemPrompt handling", () => {
    it("builds graph when systemPrompt is provided", async () => {
      const builder = new SimpleGraphBuilder(null, null, mockMcpClient as any);
      const graph = await builder.buildGraph({
        ...basePayload,
        config: {
          configurable: {
            thread_id: "t-1",
            graphSettings: { model: "gpt-4o-mini", systemPrompt: "You are a roofing expert." },
          },
        },
      });
      expect(graph).toBeDefined();
    });
  });

  describe("generateNode — graph invocation", () => {
    it("returns text from model response", async () => {
      const { HumanMessage } = await import("@langchain/core/messages");
      const builder = new SimpleGraphBuilder(null, null, mockMcpClient as any);
      const graph = await builder.buildGraph(basePayload);
      const result = await graph.invoke({ messages: [new HumanMessage("hello")] });
      expect(result.text).toBe("test response");
    });

    it("prepends SystemMessage when systemPrompt is set", async () => {
      const { HumanMessage } = await import("@langchain/core/messages");
      const builder = new SimpleGraphBuilder(null, null, mockMcpClient as any);
      const graph = await builder.buildGraph({
        ...basePayload,
        config: {
          configurable: {
            thread_id: "t-1",
            graphSettings: { model: "gpt-4o-mini", systemPrompt: "Be a roofing expert." },
          },
        },
      });
      const result = await graph.invoke({ messages: [new HumanMessage("hello")] });
      expect(result.text).toBe("test response");
    });
  });
});
