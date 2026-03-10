import { AgentV1Builder } from "./builder";

const mockEngine = {
  invokeGraph: jest.fn(),
};

describe("AgentV1Builder", () => {
  let builder: AgentV1Builder;

  beforeEach(() => {
    builder = new AgentV1Builder(mockEngine as any);
  });

  it("should have correct graphType", () => {
    expect(builder.graphType).toBe("flutch.agent::1.0.0");
  });

  it("should have correct version", () => {
    expect(builder.version).toBe("1.0.0");
  });

  it("should build a compiled graph", async () => {
    const graph = await builder.buildGraph();
    expect(graph).toBeDefined();
  });
});
