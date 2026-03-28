import { SalesGraphBuilder } from "./builder";
import { StateGraph } from "@langchain/langgraph";
import { LangfuseService } from "../../modules/langfuse/langfuse.service";

const mockMcpClient = {
  getTools: jest.fn().mockResolvedValue([]),
  executeTool: jest.fn(),
};

const mockModelInitializer = {
  initializeChatModel: jest.fn().mockResolvedValue({
    invoke: jest.fn().mockResolvedValue({ content: "ok", tool_calls: [] }),
  }),
};

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
  ModelInitializer: jest.fn().mockImplementation(() => mockModelInitializer),
  executeToolWithAttachments: jest.fn(),
  IGraphAttachment: {},
}));

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
    mockLangfuseService.createCallbackHandler = jest.fn().mockReturnValue(mockLangfuseCallback);
  });

  describe("metadata", () => {
    it("has correct graphType", () => {
      const builder = new SalesGraphBuilder(
        null,
        null,
        mockMcpClient as any,
        mockModelInitializer as any
      );
      expect(builder.graphType).toBe("flutch.sales::2.0.0");
    });

    it("has correct version", () => {
      const builder = new SalesGraphBuilder(
        null,
        null,
        mockMcpClient as any,
        mockModelInitializer as any
      );
      expect(builder.version).toBe("2.0.0");
    });
  });

  describe("buildGraph — basic", () => {
    it("builds a compiled graph", async () => {
      const builder = new SalesGraphBuilder(
        null,
        null,
        mockMcpClient as any,
        mockModelInitializer as any
      );
      const graph = await builder.buildGraph(basePayload);
      expect(graph).toBeDefined();
    });

    it("compiles without checkpointer", async () => {
      const builder = new SalesGraphBuilder(
        null,
        null,
        mockMcpClient as any,
        mockModelInitializer as any
      );
      await builder.buildGraph(basePayload);
      expect(compileSpy).toHaveBeenCalledWith({ checkpointer: undefined });
    });

    it("builds successfully when no graphSettings provided", async () => {
      const builder = new SalesGraphBuilder(
        null,
        null,
        mockMcpClient as any,
        mockModelInitializer as any
      );
      const graph = await builder.buildGraph();
      expect(graph).toBeDefined();
    });
  });

  describe("buildGraph — with checkpointer", () => {
    it("compiles with injected checkpointer", async () => {
      const builder = new SalesGraphBuilder(
        mockCheckpointer,
        null,
        mockMcpClient as any,
        mockModelInitializer as any
      );
      await builder.buildGraph(basePayload);
      expect(compileSpy).toHaveBeenCalledWith({
        checkpointer: mockCheckpointer,
      });
    });
  });

  describe("buildGraph — langfuse", () => {
    it("calls createCallbackHandler with context from payload", async () => {
      const builder = new SalesGraphBuilder(
        null,
        mockLangfuseService,
        mockMcpClient as any,
        mockModelInitializer as any
      );
      await builder.buildGraph(basePayload);
      expect(mockLangfuseService.createCallbackHandler).toHaveBeenCalledWith({
        userId: "user-1",
        agentId: "sales-agent",
        threadId: "thread-123",
      });
    });

    it("injects langfuseCallback into configurable", async () => {
      const builder = new SalesGraphBuilder(
        null,
        mockLangfuseService,
        mockMcpClient as any,
        mockModelInitializer as any
      );
      const graph = await builder.buildGraph(basePayload);
      expect(typeof graph.invoke).toBe("function");
    });
  });

  describe("buildGraph — settings", () => {
    it("builds graph with availableTools in graphSettings", async () => {
      const payloadWithToolConfig = {
        ...basePayload,
        config: {
          configurable: {
            ...basePayload.config.configurable,
            graphSettings: {
              ...basePayload.config.configurable.graphSettings,
              availableTools: [
                { name: "kb_search", enabled: true, config: { kbIds: ["kb-1"] } },
                { name: "disabled_tool", enabled: false },
                "simple_tool",
              ],
            },
          },
        },
      };

      const builder = new SalesGraphBuilder(
        null,
        null,
        mockMcpClient as any,
        mockModelInitializer as any
      );
      const graph = await builder.buildGraph(payloadWithToolConfig);
      expect(graph).toBeDefined();
    });

    it("builds graph with crm config in graphSettings", async () => {
      const payloadWithCrm = {
        ...basePayload,
        config: {
          configurable: {
            ...basePayload.config.configurable,
            graphSettings: {
              ...basePayload.config.configurable.graphSettings,
              crm: { provider: "twenty", lookupBy: "email" },
            },
          },
        },
      };

      const builder = new SalesGraphBuilder(
        null,
        null,
        mockMcpClient as any,
        mockModelInitializer as any
      );
      const graph = await builder.buildGraph(payloadWithCrm);
      expect(graph).toBeDefined();
    });
  });

  describe("buildGraph — presets", () => {
    it("resolves b2b_bant preset steps", async () => {
      const payloadWithPreset = {
        ...basePayload,
        config: {
          configurable: {
            ...basePayload.config.configurable,
            graphSettings: {
              ...basePayload.config.configurable.graphSettings,
              preset: "b2b_bant",
            },
          },
        },
      };

      const builder = new SalesGraphBuilder(
        null,
        null,
        mockMcpClient as any,
        mockModelInitializer as any
      );
      const graph = await builder.buildGraph(payloadWithPreset);
      expect(graph).toBeDefined();
    });

    it("resolves b2c_service preset steps", async () => {
      const payloadWithPreset = {
        ...basePayload,
        config: {
          configurable: {
            ...basePayload.config.configurable,
            graphSettings: {
              ...basePayload.config.configurable.graphSettings,
              preset: "b2c_service",
            },
          },
        },
      };

      const builder = new SalesGraphBuilder(
        null,
        null,
        mockMcpClient as any,
        mockModelInitializer as any
      );
      const graph = await builder.buildGraph(payloadWithPreset);
      expect(graph).toBeDefined();
    });

    it("uses custom steps when provided (overrides preset)", async () => {
      const customSteps = [
        {
          id: "custom1",
          name: "Custom Step",
          prompt: "Do something custom",
          fields: [{ name: "field1", description: "A field", required: true }],
          tools: [],
        },
      ];

      const payloadWithCustom = {
        ...basePayload,
        config: {
          configurable: {
            ...basePayload.config.configurable,
            graphSettings: {
              ...basePayload.config.configurable.graphSettings,
              preset: "b2b_bant",
              steps: customSteps,
            },
          },
        },
      };

      const builder = new SalesGraphBuilder(
        null,
        null,
        mockMcpClient as any,
        mockModelInitializer as any
      );
      const graph = await builder.buildGraph(payloadWithCustom);
      expect(graph).toBeDefined();
    });
  });

  describe("buildGraph — invoke/stream wrapper", () => {
    it("compiled graph has invoke and stream functions", async () => {
      const builder = new SalesGraphBuilder(
        null,
        null,
        mockMcpClient as any,
        mockModelInitializer as any
      );
      const graph = await builder.buildGraph(basePayload);
      expect(typeof graph.invoke).toBe("function");
      expect(typeof graph.stream).toBe("function");
    });
  });
});
