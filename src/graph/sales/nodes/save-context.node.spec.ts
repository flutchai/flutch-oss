import { saveContextNode } from "./save-context.node";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { SalesState } from "../sales.annotations";

type State = typeof SalesState.State;

function makeState(overrides: Partial<State> = {}): State {
  return {
    messages: [new HumanMessage("hello")],
    generation: null,
    systemPrompt: "",
    leadProfile: {},
    topicsMap: {},
    calculatorData: undefined,
    attachments: {},
    ...overrides,
  };
}

describe("saveContextNode", () => {
  it("returns generation from state unchanged", async () => {
    const generation = new AIMessage({ content: "Final response" });
    const state = makeState({ generation });

    const result = await saveContextNode(state, {} as any);

    expect(result.generation).toBe(generation);
  });

  it("returns null generation when state has no generation", async () => {
    const state = makeState({ generation: null });

    const result = await saveContextNode(state, {} as any);

    expect(result.generation).toBeNull();
  });

  it("does not throw when topicsMap is empty", async () => {
    const state = makeState({ topicsMap: {} });

    await expect(saveContextNode(state, {} as any)).resolves.toBeDefined();
  });

  it("handles leadProfile with name for logging", async () => {
    const state = makeState({
      leadProfile: { name: "Иван" },
      topicsMap: {
        budget: { status: "explored" },
        timeline: { status: "not_explored" },
      },
    });

    const result = await saveContextNode(state, {} as any);
    expect(result).toBeDefined();
  });

  it("handles generation with non-string content", async () => {
    const generation = new AIMessage({ content: [{ type: "text", text: "response" }] });
    const state = makeState({ generation });

    const result = await saveContextNode(state, {} as any);
    expect(result.generation).toBe(generation);
  });

  it("handles missing configurable in config", async () => {
    const state = makeState();
    await expect(saveContextNode(state, {} as any)).resolves.toBeDefined();
  });
});
