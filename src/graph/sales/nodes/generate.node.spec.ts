import { generateNode, shouldUseTools } from "./generate.node";
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

const mockAiResponse = new AIMessage({ content: "Here is my response", tool_calls: [] });
const mockModel = {
  invoke: jest.fn().mockResolvedValue(mockAiResponse),
};

describe("generateNode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockModel.invoke.mockResolvedValue(mockAiResponse);
  });

  it("returns generation and appends to messages", async () => {
    const state = makeState();
    const config = { configurable: { __salesModel: mockModel } };

    const result = await generateNode(state, config as any);

    expect(result.generation).toBe(mockAiResponse);
    expect(result.messages).toEqual([mockAiResponse]);
  });

  it("throws when __salesModel is not in config", async () => {
    const state = makeState();
    const config = { configurable: {} };

    await expect(generateNode(state, config as any)).rejects.toThrow(
      "GenerateNode: __salesModel not found in config.configurable",
    );
  });

  it("prepends SystemMessage when systemPrompt is set", async () => {
    const { SystemMessage } = await import("@langchain/core/messages");
    const state = makeState({ systemPrompt: "Be a helpful agent." });
    const config = { configurable: { __salesModel: mockModel } };

    await generateNode(state, config as any);

    const calls = mockModel.invoke.mock.calls[0];
    const messages = calls[0];
    expect(messages[0]).toBeInstanceOf(SystemMessage);
    expect((messages[0] as any).content).toBe("Be a helpful agent.");
  });

  it("does not prepend SystemMessage when systemPrompt is empty", async () => {
    const { SystemMessage } = await import("@langchain/core/messages");
    const state = makeState({ systemPrompt: "" });
    const config = { configurable: { __salesModel: mockModel } };

    await generateNode(state, config as any);

    const calls = mockModel.invoke.mock.calls[0];
    const messages = calls[0];
    expect(messages[0]).toBeInstanceOf(HumanMessage);
  });

  it("includes all state messages in model call", async () => {
    const msgs = [new HumanMessage("msg1"), new AIMessage("msg2"), new HumanMessage("msg3")];
    const state = makeState({ messages: msgs });
    const config = { configurable: { __salesModel: mockModel } };

    await generateNode(state, config as any);

    const calls = mockModel.invoke.mock.calls[0];
    const passedMessages = calls[0];
    expect(passedMessages).toHaveLength(3);
  });
});

describe("shouldUseTools", () => {
  it("returns 'extract' when generation is null", () => {
    const state = makeState({ generation: null });
    expect(shouldUseTools(state)).toBe("extract");
  });

  it("returns 'extract' when generation has no tool calls", () => {
    const state = makeState({
      generation: new AIMessage({ content: "response", tool_calls: [] }),
    });
    expect(shouldUseTools(state)).toBe("extract");
  });

  it("returns 'exec_tools' when generation has tool calls", () => {
    const aiMsg = new AIMessage({ content: "", tool_calls: [] });
    (aiMsg as any).tool_calls = [{ id: "tc1", name: "roof_calculator", args: {} }];
    const state = makeState({ generation: aiMsg });
    expect(shouldUseTools(state)).toBe("exec_tools");
  });
});
