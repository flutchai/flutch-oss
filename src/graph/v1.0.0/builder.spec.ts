import { AgentV1Builder } from "./builder";
import * as modelFactory from "./model.factory";
import { StateGraph } from "@langchain/langgraph";

jest.mock("./model.factory", () => ({
  createModel: jest.fn().mockReturnValue({
    invoke: jest.fn().mockResolvedValue({ content: "test response" }),
  }),
}));

// Spy on StateGraph.prototype.compile to capture checkpointer argument
const compileSpy = jest.spyOn(StateGraph.prototype, "compile");

const mockCheckpointer = {
  get: jest.fn(),
  put: jest.fn(),
  list: jest.fn(),
  setup: jest.fn(),
};

const basePayload = {
  requestId: "req-1",
  input: "hello",
  config: {
    configurable: {
      thread_id: "550e8400-e29b-41d4-a716-446655440000",
      graphSettings: { model: "gpt-4o-mini", graphType: "flutch.agent::1.0.0" },
    },
  },
} as any;

describe("AgentV1Builder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("metadata", () => {
    it("has correct graphType", () => {
      const builder = new AgentV1Builder(null);
      expect(builder.graphType).toBe("flutch.agent::1.0.0");
    });

    it("has correct version", () => {
      const builder = new AgentV1Builder(null);
      expect(builder.version).toBe("1.0.0");
    });
  });

  describe("buildGraph — without checkpointer", () => {
    let builder: AgentV1Builder;

    beforeEach(() => {
      builder = new AgentV1Builder(null);
    });

    it("builds a compiled graph", async () => {
      const graph = await builder.buildGraph(basePayload);
      expect(graph).toBeDefined();
    });

    it("compiles without checkpointer when none is injected", async () => {
      await builder.buildGraph(basePayload);
      expect(compileSpy).toHaveBeenCalledWith({ checkpointer: undefined });
    });

    it("uses model from graphSettings", async () => {
      await builder.buildGraph(basePayload);
      expect(modelFactory.createModel).toHaveBeenCalledWith({ model: "gpt-4o-mini", graphType: "flutch.agent::1.0.0" });
    });

    it("applies default model gpt-4o-mini when model is absent", async () => {
      const graph = await builder.buildGraph();
      expect(graph).toBeDefined();
      expect(modelFactory.createModel).toHaveBeenCalledWith({ model: "gpt-4o-mini" });
    });

    it("handles missing payload gracefully", async () => {
      const graph = await builder.buildGraph(undefined);
      expect(graph).toBeDefined();
    });
  });

  describe("buildGraph — with checkpointer", () => {
    let builder: AgentV1Builder;

    beforeEach(() => {
      builder = new AgentV1Builder(mockCheckpointer);
    });

    it("compiles graph with the injected checkpointer", async () => {
      await builder.buildGraph(basePayload);
      expect(compileSpy).toHaveBeenCalledWith({ checkpointer: mockCheckpointer });
    });

    it("still builds a valid graph with checkpointer", async () => {
      const graph = await builder.buildGraph(basePayload);
      expect(graph).toBeDefined();
    });
  });

  describe("buildGraph — systemPrompt handling", () => {
    it("builds graph when systemPrompt is provided", async () => {
      const builder = new AgentV1Builder(null);
      const graph = await builder.buildGraph({
        ...basePayload,
        config: {
          configurable: {
            thread_id: "t-1",
            graphSettings: {
              model: "gpt-4o-mini",
              systemPrompt: "You are a roofing expert.",
            },
          },
        },
      });
      expect(graph).toBeDefined();
    });

    it("builds graph when systemPrompt is absent", async () => {
      const builder = new AgentV1Builder(null);
      const graph = await builder.buildGraph(basePayload);
      expect(graph).toBeDefined();
    });

    it("still passes checkpointer when systemPrompt is set", async () => {
      const builder = new AgentV1Builder(mockCheckpointer);
      await builder.buildGraph({
        ...basePayload,
        config: {
          configurable: {
            thread_id: "t-1",
            graphSettings: { model: "gpt-4o-mini", systemPrompt: "Be helpful." },
          },
        },
      });
      expect(compileSpy).toHaveBeenLastCalledWith({ checkpointer: mockCheckpointer });
    });
  });
});
