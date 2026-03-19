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
  invoke: jest
    .fn()
    .mockResolvedValue({ content: "sales response", tool_calls: [] }),
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

const basePayload = {
  requestId: "req-1",
  input: "hello",
  config: {
    configurable: {
      thread_id: "thread-123",
      context: { userId: "user-1", agentId: "sales-agent", companyId: "co-1" },
      graphSettings: {
        modelId: "gpt-4o-mini",
        temperature: 0.7,
        systemPrompt: "You are a sales agent.",
        availableTools: [],
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
    mockLangfuseService.createCallbackHandler = jest
      .fn()
      .mockReturnValue(mockLangfuseCallback);
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

    it("uses modelId from graphSettings", async () => {
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
      expect(compileSpy).toHaveBeenCalledWith({
        checkpointer: mockCheckpointer,
      });
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
  });

  describe("buildGraph — tool binding", () => {
    it("binds tools when enabled tools are in graphSettings", async () => {
      const { McpRuntimeHttpClient } = require("@flutchai/flutch-sdk");
      const mockMcpTools = [
        { name: "kb_search" },
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
              availableTools: [{ name: "kb_search", enabled: true }],
            },
          },
        },
      };

      const builder = new SalesGraphBuilder(null, null);
      await builder.buildGraph(payloadWithTools);
      expect(mockModel.bindTools).toHaveBeenCalledWith([
        { name: "kb_search" },
      ]);
    });

    it("does not bind tools when no tools are enabled", async () => {
      const builder = new SalesGraphBuilder(null, null);
      await builder.buildGraph(basePayload);
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
              availableTools: [{ name: "kb_search", enabled: true }],
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
    it("compiled graph has invoke and stream functions", async () => {
      const builder = new SalesGraphBuilder(null, null);
      const graph = await builder.buildGraph(basePayload);
      expect(typeof graph.invoke).toBe("function");
      expect(typeof graph.stream).toBe("function");
    });
  });
});
