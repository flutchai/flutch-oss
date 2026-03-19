import { loadContextNode } from "./load-context.node";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { SalesState } from "../sales.annotations";

type State = typeof SalesState.State;

function makeState(overrides: Partial<State> = {}): State {
  return {
    messages: [],
    generation: null,
    systemPrompt: "",
    leadProfile: {},
    topicsMap: {},
    calculatorData: undefined,
    attachments: {},
    ...overrides,
  };
}

const topicsDef = [
  {
    name: "budget",
    label: "Budget",
    description: "Budget range",
    extractionHint: "Look for amounts",
    required: true,
  },
  {
    name: "timeline",
    label: "Timeline",
    description: "Project timeline",
    extractionHint: "Look for dates",
    required: false,
  },
];

describe("loadContextNode", () => {
  it("initializes topicsMap with not_explored for all topics in config", async () => {
    const state = makeState({ messages: [] });
    const config = { configurable: { graphSettings: { topics: topicsDef } } };

    const result = await loadContextNode(state, config as any);

    expect(result.topicsMap).toEqual({
      budget: { status: "not_explored" },
      timeline: { status: "not_explored" },
    });
  });

  it("returns empty topicsMap when no topics in config", async () => {
    const state = makeState({ messages: [] });
    const config = { configurable: { graphSettings: {} } };

    const result = await loadContextNode(state, config as any);
    expect(result.topicsMap).toEqual({});
  });

  it("extracts lead profile from first HumanMessage metadata", async () => {
    const firstMsg = new HumanMessage({ content: "Hi" });
    (firstMsg as any).additional_kwargs = {
      metadata: { name: "Иван", email: "ivan@test.com", company: "Стройка" },
    };
    const state = makeState({ messages: [firstMsg] });
    const config = { configurable: { graphSettings: { topics: [] } } };

    const result = await loadContextNode(state, config as any);

    expect(result.leadProfile).toEqual({
      name: "Иван",
      email: "ivan@test.com",
      company: "Стройка",
    });
  });

  it("extracts calculatorData from first message metadata", async () => {
    const firstMsg = new HumanMessage({ content: "Hi" });
    (firstMsg as any).additional_kwargs = {
      metadata: { calculatorData: { area: "200", pitch: "30" } },
    };
    const state = makeState({ messages: [firstMsg] });
    const config = { configurable: { graphSettings: { topics: [] } } };

    const result = await loadContextNode(state, config as any);

    expect(result.calculatorData).toEqual({ area: "200", pitch: "30" });
  });

  it("returns empty leadProfile and no calculatorData when metadata is absent", async () => {
    const firstMsg = new HumanMessage({ content: "Hi" });
    const state = makeState({ messages: [firstMsg] });
    const config = { configurable: { graphSettings: { topics: [] } } };

    const result = await loadContextNode(state, config as any);

    expect(result.leadProfile).toEqual({ name: undefined, email: undefined, company: undefined });
    expect(result.calculatorData).toBeUndefined();
  });

  it("skips profile extraction when first message is not HumanMessage", async () => {
    const firstMsg = new AIMessage({ content: "Hello, I'm the agent" });
    const state = makeState({ messages: [firstMsg] });
    const config = { configurable: { graphSettings: { topics: [] } } };

    const result = await loadContextNode(state, config as any);

    expect(result.leadProfile).toEqual({});
    expect(result.calculatorData).toBeUndefined();
  });

  it("returns empty leadProfile when messages array is empty", async () => {
    const state = makeState({ messages: [] });
    const config = { configurable: { graphSettings: { topics: [] } } };

    const result = await loadContextNode(state, config as any);
    expect(result.leadProfile).toEqual({});
  });

  it("handles missing configurable gracefully", async () => {
    const state = makeState({ messages: [] });
    const result = await loadContextNode(state, {} as any);

    expect(result.topicsMap).toEqual({});
    expect(result.leadProfile).toEqual({});
  });
});
