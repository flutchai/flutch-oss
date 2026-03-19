import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { SalesState } from "../sales.annotations";

// Mock createModel before importing the node (it's a module-level singleton)
jest.mock("../../model.factory", () => ({
  createModel: jest.fn(),
}));

// Mock ExtractionService
jest.mock("../extraction.service");

type State = typeof SalesState.State;

function makeState(overrides: Partial<State> = {}): State {
  return {
    messages: [new HumanMessage("hello"), new AIMessage("response")],
    generation: null,
    systemPrompt: "",
    leadProfile: {},
    topicsMap: {
      budget: { status: "not_explored" },
      timeline: { status: "not_explored" },
    },
    calculatorData: undefined,
    attachments: {},
    ...overrides,
  };
}

const topicsDef = [
  {
    name: "budget",
    label: "Budget",
    description: "Client budget",
    extractionHint: "Money amounts",
    required: true,
  },
];

describe("extractNode", () => {
  let extractNode: typeof import("./extract.node").extractNode;
  let createModel: jest.Mock;
  let ExtractionService: jest.MockedClass<typeof import("../extraction.service").ExtractionService>;
  let mockExtractFn: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    jest.mock("../../model.factory", () => ({ createModel: jest.fn() }));
    jest.mock("../extraction.service");
  });

  // Fresh import for each test group to reset module-level messageCounters
  async function freshImport() {
    const modelFactory = require("../../model.factory");
    createModel = modelFactory.createModel as jest.Mock;

    const { ExtractionService: ES } = require("../extraction.service");
    ExtractionService = ES;
    mockExtractFn = jest.fn().mockResolvedValue({
      budget: { status: "explored", details: "50k" },
    });
    (ExtractionService as jest.Mock).mockImplementation(() => ({
      extract: mockExtractFn,
    }));

    const mockModel = { invoke: jest.fn() };
    createModel.mockReturnValue(mockModel);

    const { extractNode: fn } = require("./extract.node");
    return fn as typeof import("./extract.node").extractNode;
  }

  it("returns empty object when no topics configured", async () => {
    const fn = await freshImport();
    const state = makeState();
    const config = { configurable: { graphSettings: { topics: [] } } };

    const result = await fn(state, config as any);
    expect(result).toEqual({});
  });

  it("returns empty object when topics is undefined", async () => {
    const fn = await freshImport();
    const state = makeState();
    const config = { configurable: { graphSettings: {} } };

    const result = await fn(state, config as any);
    expect(result).toEqual({});
  });

  it("runs extraction and returns updated topicsMap", async () => {
    const fn = await freshImport();
    const state = makeState();
    const config = {
      configurable: {
        thread_id: "thread-unique-1",
        graphSettings: { topics: topicsDef, extraction: { runEvery: 1 } },
      },
    };

    const result = await fn(state, config as any);
    expect(result.topicsMap).toEqual({ budget: { status: "explored", details: "50k" } });
    expect(mockExtractFn).toHaveBeenCalled();
  });

  it("creates extraction model from graphSettings.extraction.modelId", async () => {
    const fn = await freshImport();
    const state = makeState();
    const config = {
      configurable: {
        thread_id: "thread-unique-2",
        graphSettings: {
          topics: topicsDef,
          extraction: { modelId: "gpt-3.5-turbo", runEvery: 1 },
          llm: { modelId: "gpt-4o" },
        },
      },
    };

    await fn(state, config as any);
    expect(createModel).toHaveBeenCalledWith({
      model: "gpt-3.5-turbo",
      temperature: 0,
      maxTokens: 2048,
    });
  });

  it("falls back to llm.modelId when extraction.modelId is not set", async () => {
    const fn = await freshImport();
    const state = makeState();
    const config = {
      configurable: {
        thread_id: "thread-unique-3",
        graphSettings: {
          topics: topicsDef,
          llm: { modelId: "gpt-4o-mini" },
          extraction: {},
        },
      },
    };

    await fn(state, config as any);
    expect(createModel).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-4o-mini" }),
    );
  });

  it("skips extraction when runEvery=2 and count is odd", async () => {
    const fn = await freshImport();
    const state = makeState();
    const threadId = "thread-runEvery-skip";
    const config = {
      configurable: {
        thread_id: threadId,
        graphSettings: {
          topics: topicsDef,
          extraction: { runEvery: 2 },
        },
      },
    };

    // First call (count=1) — should skip (1 % 2 !== 0)
    const result = await fn(state, config as any);
    expect(result).toEqual({});
    expect(mockExtractFn).not.toHaveBeenCalled();
  });

  it("runs extraction when runEvery=2 and count is even", async () => {
    const fn = await freshImport();
    const state = makeState();
    const threadId = "thread-runEvery-run";
    const config = {
      configurable: {
        thread_id: threadId,
        graphSettings: {
          topics: topicsDef,
          extraction: { runEvery: 2 },
        },
      },
    };

    // First call: count=1 → skip
    await fn(state, config as any);
    // Second call: count=2 → run
    const result = await fn(state, config as any);
    expect(result.topicsMap).toBeDefined();
    expect(mockExtractFn).toHaveBeenCalledTimes(1);
  });

  it("uses 'default' thread_id when not provided in config", async () => {
    const fn = await freshImport();
    const state = makeState();
    const config = {
      configurable: {
        graphSettings: {
          topics: topicsDef,
          extraction: { runEvery: 1 },
        },
      },
    };

    // Should not throw — uses 'default' as thread_id
    const result = await fn(state, config as any);
    expect(result.topicsMap).toBeDefined();
  });
});
