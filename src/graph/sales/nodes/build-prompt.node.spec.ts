import { buildPromptNode } from "./build-prompt.node";
import { SalesState } from "../sales.annotations";
import { HumanMessage } from "@langchain/core/messages";

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

const minimalSettings = {
  prompt: {
    template: "You are a roofing sales agent.",
    guidelines: [],
  },
  topics: [],
  tools: [],
  extraction: {},
  llm: { modelId: "gpt-4o-mini" },
  crm: { provider: "none" },
};

describe("buildPromptNode", () => {
  it("returns systemPrompt built from settings", async () => {
    const state = makeState({ leadProfile: { name: "Иван" }, topicsMap: {} });
    const config = { configurable: { graphSettings: minimalSettings } };

    const result = await buildPromptNode(state, config as any);

    expect(result.systemPrompt).toContain("You are a roofing sales agent.");
  });

  it("includes lead profile in system prompt", async () => {
    const state = makeState({
      leadProfile: { name: "Иван", email: "ivan@test.com" },
      topicsMap: {},
    });
    const config = { configurable: { graphSettings: minimalSettings } };

    const result = await buildPromptNode(state, config as any);

    expect(result.systemPrompt).toContain("Иван");
  });

  it("returns empty systemPrompt when no prompt template in settings", async () => {
    const state = makeState();
    const config = { configurable: { graphSettings: {} } };

    const result = await buildPromptNode(state, config as any);

    expect(result.systemPrompt).toBe("");
  });

  it("returns empty systemPrompt when graphSettings is undefined", async () => {
    const state = makeState();
    const config = { configurable: {} };

    const result = await buildPromptNode(state, config as any);

    expect(result.systemPrompt).toBe("");
  });

  it("includes calculator data in prompt when available", async () => {
    const state = makeState({
      leadProfile: {},
      topicsMap: {},
      calculatorData: { area: "200 m²" },
    });
    const config = { configurable: { graphSettings: minimalSettings } };

    const result = await buildPromptNode(state, config as any);

    expect(result.systemPrompt).toContain("200 m²");
  });

  it("includes topics map status in prompt", async () => {
    const settingsWithTopics = {
      ...minimalSettings,
      topics: [
        {
          name: "budget",
          label: "Budget",
          description: "Client budget",
          extractionHint: "Money",
          required: true,
        },
      ],
    };
    const state = makeState({
      leadProfile: {},
      topicsMap: { budget: { status: "explored", details: "50k" } },
    });
    const config = { configurable: { graphSettings: settingsWithTopics } };

    const result = await buildPromptNode(state, config as any);

    expect(result.systemPrompt).toContain("Budget");
  });
});
