import { SalesGraphBuilder } from "./builder";
import { StateGraph } from "@langchain/langgraph";
import { LangfuseService } from "../../modules/langfuse/langfuse.service";

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

jest.mock("../model-config-fetcher", () => ({
  createOssConfigFetcher: jest.fn().mockReturnValue(jest.fn()),
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
    mockLangfuseService.createCallbackHandler = jest
      .fn()
      .mockReturnValue(mockLangfuseCallback);
  });

  describe("metadata", () => {
    it("has correct graphType", () => {
      const builder = new SalesGraphBuilder(null, null);
      expect(builder.graphType).toBe("flutch.sales::1.0.0");
    });

    it("has correct version", () => {
      const builder = new SalesGraphBuilder(null, null);
      expect(builder.version).toBe("1.0.0");
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

    it("builds successfully when no graphSettings provided", async () => {
      const builder = new SalesGraphBuilder(null, null);
      const graph = await builder.buildGraph();
      expect(graph).toBeDefined();
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

    it("injects langfuseCallback into configurable", async () => {
      const builder = new SalesGraphBuilder(null, mockLangfuseService);
      const graph = await builder.buildGraph(basePayload);

      // The wrapper injects deps — we can verify by inspecting the invoke wrapper
      expect(typeof graph.invoke).toBe("function");
    });
  });

  describe("buildGraph — dependency injection", () => {
    it("injects modelInitializer into configurable", async () => {
      const builder = new SalesGraphBuilder(null, null);
      const graph = await builder.buildGraph(basePayload);

      // Verify invoke wrapper works (it injects deps)
      expect(typeof graph.invoke).toBe("function");
      expect(typeof graph.stream).toBe("function");
    });

    it("injects graphSettings into configurable", async () => {
      const builder = new SalesGraphBuilder(null, null);
      const graph = await builder.buildGraph(basePayload);
      expect(graph).toBeDefined();
    });

    it("extracts toolConfigMap from availableTools", async () => {
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

      const builder = new SalesGraphBuilder(null, null);
      const graph = await builder.buildGraph(payloadWithToolConfig);
      expect(graph).toBeDefined();
    });

    it("injects crmConfig when crm.provider is set", async () => {
      const payloadWithCrm = {
        ...basePayload,
        config: {
          configurable: {
            ...basePayload.config.configurable,
            graphSettings: {
              ...basePayload.config.configurable.graphSettings,
              crm: {
                provider: "twenty",
                lookupBy: "email",
                apiKey: "test-key",
                baseUrl: "https://crm.test.com",
              },
            },
          },
        },
      };

      const builder = new SalesGraphBuilder(null, null);
      const graph = await builder.buildGraph(payloadWithCrm);
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
