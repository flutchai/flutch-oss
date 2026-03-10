import { AgentV1Builder } from "./builder";
import * as modelFactory from "./model.factory";

jest.mock("./model.factory", () => ({
  createModel: jest.fn().mockReturnValue({
    invoke: jest.fn().mockResolvedValue({ content: "test response" }),
  }),
}));

describe("AgentV1Builder", () => {
  let builder: AgentV1Builder;

  beforeEach(() => {
    jest.clearAllMocks();
    builder = new AgentV1Builder();
  });

  it("should have correct graphType", () => {
    expect(builder.graphType).toBe("flutch.agent::1.0.0");
  });

  it("should have correct version", () => {
    expect(builder.version).toBe("1.0.0");
  });

  it("should build a compiled graph", async () => {
    const graph = await builder.buildGraph({
      requestId: "req-1",
      input: "hello",
      config: {
        configurable: {
          thread_id: "agent:user",
          graphSettings: { model: "gpt-4o-mini" },
        },
      },
    } as any);

    expect(graph).toBeDefined();
    expect(modelFactory.createModel).toHaveBeenCalledWith({ model: "gpt-4o-mini" });
  });

  it("should build graph without payload using defaults", async () => {
    const graph = await builder.buildGraph();
    expect(graph).toBeDefined();
    expect(modelFactory.createModel).toHaveBeenCalledWith({});
  });
});
