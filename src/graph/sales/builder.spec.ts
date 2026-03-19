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
  invoke: jest.fn().mockResolvedValue({ content: "response", tool_calls: [] }),
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

const mockLangfuseCallback = { name: "langfuse-cb" };

const mockLangfuseService = {
  createCallbackHandler: jest.fn().mockReturnValue(mockLangfuseCallback),
} as unknown as LangfuseService;

const disabledLangfuseService = {
  createCallbackHandler: jest.fn().mockReturnValue(null),
} as unknown as LangfuseService;

const basePayload = {
  requestId: "req-1",
  input: "hello",
  config: {
    configurable: {
      thread_id: "thread-123",
      context: { userId: "u1", agentId: "a1", companyId: "c1" },
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
    it("builds and returns a compiled graph", async () => {
      const builder = new SalesGraphBuilder(null, null);
      const graph = await builder.buildGraph(basePayload);
      expect(graph).toBeDefined();
      expect(typeof graph.invoke).toBe("function");
      expect(typeof graph.stream).toBe("function");
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

    it("defaults to gpt-4o-mini when no graphSettings", async () => {
      const builder = new SalesGraphBuilder(null, null);
      await builder.buildGraph();
      expect(modelFactory.createModel).toHaveBeenCalledWith(
        expect.objectContaining({ model: "gpt-4o-mini" }),
      );
    });

    it("passes temperature and maxTokens to createModel", async () => {
      const builder = new SalesGraphBuilder(null, null);
      await builder.buildGraph({
        ...basePayload,
        config: {
          configurable: {
            graphSettings: { modelId: "gpt-4o", temperature: 0.3, maxTokens: 1024 },
          },
        },
      } as any);
      expect(modelFactory.createModel).toHaveBeenCalledWith({
        model: "gpt-4o",
        temperature: 0.3,
        maxTokens: 1024,
      });
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
        userId: "u1",
        agentId: "a1",
        threadId: "thread-123",
      });
    });

    it("binds callback via withConfig", async () => {
      const builder = new SalesGraphBuilder(null, mockLangfuseService);
      await builder.buildGraph(basePayload);
      expect(mockModel.withConfig).toHaveBeenCalledWith({
        callbacks: [mockLangfuseCallback],
      });
    });

    it("falls back to anonymous when no context in payload", async () => {
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

  describe("buildGraph — tool binding (string tools)", () => {
    it("binds string-named tools found in mcpClient", async () => {
      const { McpRuntimeHttpClient } = require("@flutchai/flutch-sdk");
      McpRuntimeHttpClient.mockImplementation(() => ({
        getTools: jest.fn().mockResolvedValue([{ name: "roof_calc" }, { name: "other" }]),
      }));

      const builder = new SalesGraphBuilder(null, null);
      await builder.buildGraph({
        ...basePayload,
        config: {
          configurable: {
            graphSettings: { availableTools: ["roof_calc"] },
          },
        },
      } as any);

      expect(mockModel.bindTools).toHaveBeenCalledWith([{ name: "roof_calc" }]);
    });

    it("does not bind when string tool not found in mcpClient", async () => {
      const { McpRuntimeHttpClient } = require("@flutchai/flutch-sdk");
      McpRuntimeHttpClient.mockImplementation(() => ({
        getTools: jest.fn().mockResolvedValue([{ name: "other_tool" }]),
      }));

      const builder = new SalesGraphBuilder(null, null);
      await builder.buildGraph({
        ...basePayload,
        config: {
          configurable: { graphSettings: { availableTools: ["roof_calc"] } },
        },
      } as any);

      expect(mockModel.bindTools).not.toHaveBeenCalled();
    });
  });

  describe("buildGraph — tool binding (object tools)", () => {
    it("binds object tools when enabled=true", async () => {
      const { McpRuntimeHttpClient } = require("@flutchai/flutch-sdk");
      McpRuntimeHttpClient.mockImplementation(() => ({
        getTools: jest.fn().mockResolvedValue([{ name: "crm_tool" }]),
      }));

      const builder = new SalesGraphBuilder(null, null);
      await builder.buildGraph({
        ...basePayload,
        config: {
          configurable: {
            graphSettings: {
              availableTools: [{ name: "crm_tool", enabled: true, config: { key: "val" } }],
            },
          },
        },
      } as any);

      expect(mockModel.bindTools).toHaveBeenCalledWith([{ name: "crm_tool" }]);
    });

    it("skips object tools when enabled=false", async () => {
      const { McpRuntimeHttpClient } = require("@flutchai/flutch-sdk");
      McpRuntimeHttpClient.mockImplementation(() => ({
        getTools: jest.fn().mockResolvedValue([{ name: "crm_tool" }]),
      }));

      const builder = new SalesGraphBuilder(null, null);
      await builder.buildGraph({
        ...basePayload,
        config: {
          configurable: {
            graphSettings: {
              availableTools: [{ name: "crm_tool", enabled: false }],
            },
          },
        },
      } as any);

      expect(mockModel.bindTools).not.toHaveBeenCalled();
    });

    it("skips object tools without name", async () => {
      const builder = new SalesGraphBuilder(null, null);
      await builder.buildGraph({
        ...basePayload,
        config: {
          configurable: {
            graphSettings: { availableTools: [{ enabled: true }] },
          },
        },
      } as any);

      expect(mockModel.bindTools).not.toHaveBeenCalled();
    });
  });

  describe("buildGraph — tool binding failures", () => {
    it("continues without tools when getTools throws", async () => {
      const { McpRuntimeHttpClient } = require("@flutchai/flutch-sdk");
      McpRuntimeHttpClient.mockImplementation(() => ({
        getTools: jest.fn().mockRejectedValue(new Error("MCP down")),
      }));

      const builder = new SalesGraphBuilder(null, null);
      const graph = await builder.buildGraph({
        ...basePayload,
        config: {
          configurable: { graphSettings: { availableTools: ["roof_calc"] } },
        },
      } as any);

      expect(graph).toBeDefined();
    });
  });

  describe("buildGraph — invoke/stream inject deps", () => {
    let mockOriginalInvoke: jest.Mock;
    let mockOriginalStream: jest.Mock;

    beforeEach(() => {
      mockOriginalInvoke = jest.fn().mockResolvedValue({});
      mockOriginalStream = jest.fn().mockResolvedValue((async function* () {})());

      // Reset queue before setting up, to avoid bleed from previous tests
      compileSpy.mockReset();
      compileSpy.mockReturnValue({
        invoke: mockOriginalInvoke,
        stream: mockOriginalStream,
      } as any);
    });

    it("injects salesModel into configurable on invoke", async () => {
      const builder = new SalesGraphBuilder(null, null);
      const graph = await builder.buildGraph(basePayload);

      await graph.invoke({}, { configurable: { thread_id: "t1" } });

      const passedConfig = mockOriginalInvoke.mock.calls[0][1];
      expect(passedConfig.configurable.salesModel).toBeDefined();
    });

    it("injects mcpClient and toolConfigs into configurable on invoke", async () => {
      const builder = new SalesGraphBuilder(null, null);
      const graph = await builder.buildGraph(basePayload);

      await graph.invoke({}, {});

      const passedConfig = mockOriginalInvoke.mock.calls[0][1];
      expect(passedConfig.configurable.mcpClient).toBeDefined();
      expect(passedConfig.configurable.toolConfigs).toBeDefined();
    });

    it("injects systemPrompt from graphSettings on invoke", async () => {
      const builder = new SalesGraphBuilder(null, null);
      const graph = await builder.buildGraph(basePayload);

      await graph.invoke({}, {});

      const passedConfig = mockOriginalInvoke.mock.calls[0][1];
      expect(passedConfig.configurable.systemPrompt).toBe("You are a sales agent.");
    });

    it("injects crmConfig from graphSettings on invoke", async () => {
      const crmConfig = { provider: "twenty", lookupBy: "email" };
      const builder = new SalesGraphBuilder(null, null);
      const graph = await builder.buildGraph({
        ...basePayload,
        config: { configurable: { graphSettings: { crm: crmConfig } } },
      } as any);

      await graph.invoke({}, {});

      const passedConfig = mockOriginalInvoke.mock.calls[0][1];
      expect(passedConfig.configurable.crmConfig).toEqual(crmConfig);
    });

    it("injects salesModel into configurable on stream", async () => {
      const builder = new SalesGraphBuilder(null, null);
      const graph = await builder.buildGraph(basePayload);

      await graph.stream({}, { configurable: {} });

      const passedConfig = mockOriginalStream.mock.calls[0][1];
      expect(passedConfig.configurable.salesModel).toBeDefined();
    });

    it("preserves existing configurable keys on invoke", async () => {
      const builder = new SalesGraphBuilder(null, null);
      const graph = await builder.buildGraph(basePayload);

      await graph.invoke({}, { configurable: { thread_id: "my-thread", custom_key: "val" } });

      const passedConfig = mockOriginalInvoke.mock.calls[0][1];
      expect(passedConfig.configurable.thread_id).toBe("my-thread");
      expect(passedConfig.configurable.custom_key).toBe("val");
    });
  });
});
