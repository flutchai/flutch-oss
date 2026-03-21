import { generateNode, shouldUseTools } from "./generate.node";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { SalesState } from "../sales.annotations";

type State = typeof SalesState.State;

function makeState(overrides: Partial<State> = {}): State {
  return {
    messages: [new HumanMessage("hello")],
    text: "",
    contactData: {},
    attachments: {},
    ...overrides,
  };
}

const mockAiResponse = new AIMessage({
  content: "Here is my response",
  tool_calls: [],
});
const mockModel = {
  invoke: jest.fn().mockResolvedValue(mockAiResponse),
};

const mockModelInitializer = {
  initializeChatModel: jest.fn().mockResolvedValue(mockModel),
};

function makeConfig(overrides: Record<string, any> = {}) {
  return {
    configurable: {
      modelInitializer: mockModelInitializer,
      graphSettings: { modelId: "gpt-4o-mini" },
      ...overrides,
    },
  } as any;
}

describe("generateNode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockModel.invoke.mockResolvedValue(mockAiResponse);
    mockModelInitializer.initializeChatModel.mockResolvedValue(mockModel);
  });

  it("returns text and appends to messages", async () => {
    const state = makeState();
    const result = await generateNode(state, makeConfig());

    expect(result.messages).toEqual([mockAiResponse]);
    expect(result.text).toBe("Here is my response");
  });

  it("throws when modelInitializer is not in config", async () => {
    const state = makeState();
    const config = { configurable: {} };

    await expect(generateNode(state, config as any)).rejects.toThrow(
      "GenerateNode: modelInitializer not found in config.configurable",
    );
  });

  it("calls initializeChatModel with correct params from graphSettings", async () => {
    const state = makeState();
    const config = makeConfig({
      graphSettings: {
        modelId: "claude-3-haiku",
        temperature: 0.5,
        maxTokens: 1024,
        availableTools: [{ name: "kb_search", enabled: true }],
      },
    });

    await generateNode(state, config);

    expect(mockModelInitializer.initializeChatModel).toHaveBeenCalledWith({
      modelId: "claude-3-haiku",
      temperature: 0.5,
      maxTokens: 1024,
      toolsConfig: [{ toolName: "kb_search", enabled: true, config: undefined }],
    });
  });

  it("defaults modelId to gpt-4o-mini when not in graphSettings", async () => {
    const state = makeState();
    const config = makeConfig({ graphSettings: {} });

    await generateNode(state, config);

    expect(mockModelInitializer.initializeChatModel).toHaveBeenCalledWith(
      expect.objectContaining({ modelId: "gpt-4o-mini" }),
    );
  });

  it("prepends SystemMessage when systemPrompt is set", async () => {
    const { SystemMessage } = await import("@langchain/core/messages");
    const state = makeState();
    const config = makeConfig({ systemPrompt: "Be helpful." });

    await generateNode(state, config);

    const calls = mockModel.invoke.mock.calls[0];
    const messages = calls[0];
    expect(messages[0]).toBeInstanceOf(SystemMessage);
    expect((messages[0] as any).content).toBe("Be helpful.");
  });

  it("does not prepend SystemMessage when systemPrompt is empty", async () => {
    const state = makeState();
    const config = makeConfig({ systemPrompt: "" });

    await generateNode(state, config);

    const calls = mockModel.invoke.mock.calls[0];
    const messages = calls[0];
    expect(messages[0]).toBeInstanceOf(HumanMessage);
  });

  it("appends contactData to system prompt", async () => {
    const state = makeState({
      contactData: { crmId: "crm-1", name: "Ivan", email: "ivan@test.com" },
    });
    const config = makeConfig({ systemPrompt: "You are a sales agent." });

    await generateNode(state, config);

    const calls = mockModel.invoke.mock.calls[0];
    const systemMsg = calls[0][0];
    expect(systemMsg.content).toContain("About the customer");
    expect(systemMsg.content).toContain("name: Ivan");
    expect(systemMsg.content).toContain("email: ivan@test.com");
    // crmId should not appear in the prompt
    expect(systemMsg.content).not.toContain("crmId");
  });

  it("includes all state messages in model call", async () => {
    const msgs = [
      new HumanMessage("msg1"),
      new AIMessage("msg2"),
      new HumanMessage("msg3"),
    ];
    const state = makeState({ messages: msgs });

    await generateNode(state, makeConfig());

    const calls = mockModel.invoke.mock.calls[0];
    const passedMessages = calls[0];
    expect(passedMessages).toHaveLength(3);
  });

  it("applies langfuseCallback via withConfig when present", async () => {
    const mockCallbackModel = {
      invoke: jest.fn().mockResolvedValue(mockAiResponse),
    };
    const mockModelWithConfig = {
      ...mockModel,
      withConfig: jest.fn().mockReturnValue(mockCallbackModel),
    };
    mockModelInitializer.initializeChatModel.mockResolvedValue(
      mockModelWithConfig,
    );

    const langfuseCallback = { name: "langfuse" };
    const state = makeState();
    const config = makeConfig({ langfuseCallback });

    await generateNode(state, config);

    expect(mockModelWithConfig.withConfig).toHaveBeenCalledWith({
      callbacks: [langfuseCallback],
    });
    expect(mockCallbackModel.invoke).toHaveBeenCalled();
  });

  it("handles string tools in availableTools", async () => {
    const state = makeState();
    const config = makeConfig({
      graphSettings: {
        modelId: "gpt-4o-mini",
        availableTools: ["kb_search", "web_search"],
      },
    });

    await generateNode(state, config);

    expect(mockModelInitializer.initializeChatModel).toHaveBeenCalledWith(
      expect.objectContaining({
        toolsConfig: [
          { toolName: "kb_search", enabled: true },
          { toolName: "web_search", enabled: true },
        ],
      }),
    );
  });
});

describe("shouldUseTools", () => {
  it("returns 'save_context' when last message has no tool calls", () => {
    const lastMsg = new AIMessage({ content: "response", tool_calls: [] });
    const state = makeState({ messages: [new HumanMessage("hi"), lastMsg] });
    expect(shouldUseTools(state)).toBe("save_context");
  });

  it("returns 'exec_tools' when last message has tool calls", () => {
    const aiMsg = new AIMessage({ content: "", tool_calls: [] });
    (aiMsg as any).tool_calls = [
      { id: "tc1", name: "some_tool", args: {} },
    ];
    const state = makeState({ messages: [new HumanMessage("hi"), aiMsg] });
    expect(shouldUseTools(state)).toBe("exec_tools");
  });
});
