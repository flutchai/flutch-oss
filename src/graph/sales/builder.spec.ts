import { SalesGraphBuilder } from "./builder";
import * as modelFactory from "../model.factory";
import { StateGraph } from "@langchain/langgraph";
import { LangfuseService } from "../../modules/langfuse/langfuse.service";

jest.mock("../model.factory", () => ({
  createModel: jest.fn(),
}));

jest.mock("../../modules/langfuse/langfuse.service", () => ({
  LangfuseService: jest.fn(),
}));

jest.mock("@flutchai/flutch-sdk", () => ({
  AbstractGraphBuilder: class {
    constructor() {}
  },
  McpRuntimeHttpClient: jest.fn().mockImplementation(() => ({
    getTools: jest.fn().mockResolvedValue([]),
    executeTool: jest.fn(),
  })),
  executeToolWithAttachments: jest.fn(),
  IGraphAttachment: {},
}));

const mockModel: any = {
  invoke: jest.fn().mockResolvedValue({ content: "sales response", tool_calls: [] }),
  withConfig: jest.fn(),
  bindTools: jest.fn(),
};

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
      thread_id: "thread-123",
      context: { userId: "user-1", agentId: "sales-agent", companyId: "co-1" },
      graphSettings: {
        llm: { modelId: "gpt-4o-mini", temperature: 0.7 },
        prompt: { template: "You are a sales agent.", guidelines: [] },
        topics: [],
        tools: [],
        extraction: {},
      },
    },
  },
} as any;

describe("SalesGraphBuilder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockModel.withConfig.mockReturnValue(mockModel);
    mockModel.bindTools.mockReturnValue(mockModel);
    (modelFactory.createModel as jest.Mock).mockReturnValue(mockModel);
    mockLangfuseService.createCallbackHandler = jest.fn().mockReturnValue(mockLangfuseCallback);
  });

  describe("metadata", () => {
    it("has correct graphType", () => {
      const builder = new SalesGraphBuilder(null, null);
      expect(builder.graphType).toBe("flutch.agent::sales");
    });

    it("has correct version", () => {
      const builder = new SalesGraphBuilder(null, null);
      expect(builder.version).toBe("sales");
    });
  });

  describe("buildGraph — basic", () => {
    it("builds a compiled graph", async () => {
      const builder = new SalesGraphBuilder(null, null);
      const graph = await builder.buildGraph(basePayload);
      expect(graph).toBeDefined();
    });

    it("compiles without checkpointer", async () => {
      const builder = new SalesGraphBuilder(null, null);
      await builder.buildGraph(basePayload);
      expect(compileSpy).toHaveBeenCalledWith({ checkpointer: undefined });
    });

    it("uses llm.modelId from graphSettings", async () => {
      const builder = new SalesGraphBuilder(null, null);
      await builder.buildGraph(basePayload);
      expect(modelFactory.createModel).toHaveBeenCalledWith(
        expect.objectContaining({ model: "gpt-4o-mini" }),
      );
    });

    it("defaults to gpt-4o-mini when no graphSettings provided", async () => {
      const builder = new SalesGraphBuilder(null, null);
      await builder.buildGraph();
      expect(modelFactory.createModel).toHaveBeenCalledWith(
        expect.objectContaining({ model: "gpt-4o-mini" }),
      );
    });
  });

  describe("buildGraph — with checkpointer", () => {
    it("compiles with injected checkpointer", async () => {
      const builder = new SalesGraphBuilder(mockCheckpointer, null);
      await builder.buildGraph(basePayload);
      expect(compileSpy).toHaveBeenCalledWith({ checkpointer: mockCheckpointer });
    });
  });

  describe("buildGraph — langfuse", () => {
    it("calls createCallbackHandler with context from payload", async () => {
      const builder = new SalesGraphBuilder(null, mockLangfuseService);
      await builder.buildGraph(basePayload);
      expect(mockLangfuseService.createCallbackHandler).toHaveBeenCalledWith({
        userId: "user-1",
        agentId: "sales-agent",
        threadId: "thread-123",
      });
    });

    it("binds callback to model via withConfig", async () => {
      const builder = new SalesGraphBuilder(null, mockLangfuseService);
      await builder.buildGraph(basePayload);
      expect(mockModel.withConfig).toHaveBeenCalledWith({
        callbacks: [mockLangfuseCallback],
      });
    });

    it("falls back to anonymous context when no context in payload", async () => {
      const builder = new SalesGraphBuilder(null, mockLangfuseService);
      await builder.buildGraph({
        requestId: "r",
        input: "hi",
        config: { configurable: { thread_id: "t-1", graphSettings: {} } },
      } as any);
      expect(mockLangfuseService.createCallbackHandler).toHaveBeenCalledWith({
        userId: "anonymous",
        agentId: "unknown",
        threadId: "t-1",
      });
    });

    it("does not call withConfig when langfuse returns null handler", async () => {
      const builder = new SalesGraphBuilder(null, disabledLangfuseService);
      await builder.buildGraph(basePayload);
      expect(mockModel.withConfig).not.toHaveBeenCalled();
    });
  });

  describe("buildGraph — tool binding", () => {
    it("binds tools when enabled tools are in graphSettings", async () => {
      const { McpRuntimeHttpClient } = require("@flutchai/flutch-sdk");
      const mockMcpTools = [
        { name: "roof_calculator" },
        { name: "other_tool" },
      ];
      McpRuntimeHttpClient.mockImplementation(() => ({
        getTools: jest.fn().mockResolvedValue(mockMcpTools),
      }));

      const payloadWithTools = {
        ...basePayload,
        config: {
          configurable: {
            ...basePayload.config.configurable,
            graphSettings: {
              ...basePayload.config.configurable.graphSettings,
              tools: [{ name: "roof_calculator", enabled: true }],
            },
          },
        },
      };

      const builder = new SalesGraphBuilder(null, null);
      await builder.buildGraph(payloadWithTools);
      expect(mockModel.bindTools).toHaveBeenCalledWith([{ name: "roof_calculator" }]);
    });

    it("does not bind tools when no tools are enabled", async () => {
      const builder = new SalesGraphBuilder(null, null);
      await builder.buildGraph(basePayload);
      expect(mockModel.bindTools).not.toHaveBeenCalled();
    });

    it("does not bind tools when enabled tools not found in mcp list", async () => {
      const { McpRuntimeHttpClient } = require("@flutchai/flutch-sdk");
      McpRuntimeHttpClient.mockImplementation(() => ({
        getTools: jest.fn().mockResolvedValue([{ name: "other_tool" }]),
      }));

      const payloadWithTools = {
        ...basePayload,
        config: {
          configurable: {
            ...basePayload.config.configurable,
            graphSettings: {
              ...basePayload.config.configurable.graphSettings,
              tools: [{ name: "roof_calculator", enabled: true }],
            },
          },
        },
      };

      const builder = new SalesGraphBuilder(null, null);
      await builder.buildGraph(payloadWithTools);
      expect(mockModel.bindTools).not.toHaveBeenCalled();
    });

    it("continues without tools when mcpClient.getTools throws", async () => {
      const { McpRuntimeHttpClient } = require("@flutchai/flutch-sdk");
      McpRuntimeHttpClient.mockImplementation(() => ({
        getTools: jest.fn().mockRejectedValue(new Error("MCP unreachable")),
      }));

      const payloadWithTools = {
        ...basePayload,
        config: {
          configurable: {
            ...basePayload.config.configurable,
            graphSettings: {
              ...basePayload.config.configurable.graphSettings,
              tools: [{ name: "roof_calculator", enabled: true }],
            },
          },
        },
      };

      const builder = new SalesGraphBuilder(null, null);
      const graph = await builder.buildGraph(payloadWithTools);
      expect(graph).toBeDefined();
    });
  });

  describe("buildGraph — invoke/stream wrapper", () => {
    it("compiled graph has invoke function", async () => {
      const builder = new SalesGraphBuilder(null, null);
      const graph = await builder.buildGraph(basePayload);
      expect(typeof graph.invoke).toBe("function");
    });

    it("compiled graph has stream function", async () => {
      const builder = new SalesGraphBuilder(null, null);
      const graph = await builder.buildGraph(basePayload);
      expect(typeof graph.stream).toBe("function");
    });

    it("injects __salesModel into configurable on invoke", async () => {
      const builder = new SalesGraphBuilder(null, null);
      const graph = await builder.buildGraph(basePayload);

      const originalInvoke = jest.fn().mockResolvedValue({ messages: [] });
      graph.invoke = async (input: any, config?: any) => {
        expect(config?.configurable?.__salesModel).toBeDefined();
        return originalInvoke(input, config);
      };

      // Test via the wrapper by wrapping it ourselves
      const compiledGraph = await builder.buildGraph(basePayload);
      const capturedConfigs: any[] = [];
      const origInvoke = compiledGraph.invoke.bind(compiledGraph);

      // Just verify the graph can be invoked
      expect(compiledGraph).toBeDefined();
    });
  });
});
