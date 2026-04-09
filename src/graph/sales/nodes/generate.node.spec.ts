import { SalesGraphBuilder, routeAfterInputSanitize, routeAfterGenerate } from "../builder";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { SalesState } from "../sales.annotations";

const mockAiResponse = new AIMessage({
  content: "Here is my response",
  tool_calls: [],
});
const mockModel = {
  invoke: jest.fn().mockResolvedValue(mockAiResponse),
  bindTools: jest.fn().mockReturnThis(),
};

const mockModelInitializer = {
  initializeChatModel: jest.fn().mockResolvedValue(mockModel),
};

jest.mock("../../../modules/langfuse/langfuse.service", () => ({
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
  ModelInitializer: jest.fn().mockImplementation(() => mockModelInitializer),
  executeToolWithAttachments: jest.fn(),
  IGraphAttachment: {},
  ModelProvider: {
    OPENAI: "openai",
    ANTHROPIC: "anthropic",
    MISTRAL: "mistral",
    AWS: "aws",
    COHERE: "cohere",
    VOYAGEAI: "voyageai",
  },
}));

const mockMcpClient = {
  getTools: jest.fn().mockResolvedValue([]),
  executeTool: jest.fn(),
};

type State = typeof SalesState.State;

function makeState(overrides: Partial<State> = {}): State {
  return {
    messages: [new HumanMessage("hello")],
    text: "",
    contactData: {},
    attachments: {},
    enrichmentStatus: null,
    requestMetadata: {},
    greetingSent: false,
    ...overrides,
  } as State;
}

function makeConfig(overrides: Record<string, any> = {}) {
  const { graphSettings: gsOverride, ...rest } = overrides;
  return {
    configurable: {
      graphSettings: {
        conversation: { model: { provider: "openai", modelName: "gpt-4o-mini" } },
        ...gsOverride,
      },
      ...rest,
    },
  } as any;
}

function createBuilder(): SalesGraphBuilder {
  return new SalesGraphBuilder(null, null, mockMcpClient as any, mockModelInitializer as any);
}

function getGenerateNode(builder: SalesGraphBuilder) {
  return (builder as any).generateNode.bind(builder);
}

describe("generateNode", () => {
  let builder: SalesGraphBuilder;
  let generateNode: (state: State, config: any, langfuseCallback?: any) => Promise<Partial<State>>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockModel.invoke.mockResolvedValue(mockAiResponse);
    mockModel.bindTools.mockReturnValue(mockModel);
    mockModelInitializer.initializeChatModel.mockResolvedValue(mockModel);
    builder = createBuilder();
    generateNode = getGenerateNode(builder);
  });

  it("returns text and appends to messages", async () => {
    const state = makeState();
    const result = await generateNode(state, makeConfig());

    expect(result.messages).toEqual([mockAiResponse]);
    expect(result.text).toBe("Here is my response");
  });

  it("calls initializeChatModel with correct ModelConfig from graphSettings", async () => {
    const state = makeState();
    const config = makeConfig({
      graphSettings: {
        conversation: {
          model: {
            provider: "anthropic",
            modelName: "claude-3-haiku",
            temperature: 0.5,
            maxTokens: 1024,
            tools: [{ name: "kb_search", enabled: true }],
          },
        },
      },
    });

    await generateNode(state, config);

    expect(mockModelInitializer.initializeChatModel).toHaveBeenCalledWith({
      provider: "anthropic",
      modelName: "claude-3-haiku",
      temperature: 0.5,
      maxTokens: 1024,
      tools: [{ name: "kb_search", enabled: true }],
    });
  });

  it("defaults model to openai gpt-4o-mini when not in graphSettings", async () => {
    const state = makeState();
    const config = makeConfig({ graphSettings: {} });

    await generateNode(state, config);

    expect(mockModelInitializer.initializeChatModel).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "openai", modelName: "gpt-4o-mini" })
    );
  });

  it("prepends SystemMessage when systemPrompt is set", async () => {
    const { SystemMessage } = await import("@langchain/core/messages");
    const state = makeState();
    const config = makeConfig({ graphSettings: { conversation: { systemPrompt: "Be helpful." } } });

    await generateNode(state, config);

    const calls = mockModel.invoke.mock.calls[0];
    const messages = calls[0];
    expect(messages[0]).toBeInstanceOf(SystemMessage);
    expect((messages[0] as any).content).toContain("Be helpful.");
  });

  it("still prepends SystemMessage with greeting even when systemPrompt is empty", async () => {
    const { SystemMessage } = await import("@langchain/core/messages");
    const state = makeState();
    const config = makeConfig({ graphSettings: { conversation: { systemPrompt: "" } } });

    await generateNode(state, config);

    const calls = mockModel.invoke.mock.calls[0];
    const messages = calls[0];
    // Greeting instruction is always injected as a SystemMessage
    expect(messages[0]).toBeInstanceOf(SystemMessage);
    expect((messages[0] as any).content).toContain("first message");
  });

  it("appends whitelisted contactData to system prompt (defaults)", async () => {
    const state = makeState({
      contactData: { crmId: "crm-1", name: "Ivan", email: "ivan@test.com", company: "Acme" },
    });
    const config = makeConfig({
      graphSettings: { conversation: { systemPrompt: "You are a sales agent." } },
    });

    await generateNode(state, config);

    const calls = mockModel.invoke.mock.calls[0];
    const systemMsg = calls[0][0];
    expect(systemMsg.content).toContain("About the customer");
    expect(systemMsg.content).toContain("name: Ivan");
    expect(systemMsg.content).toContain("company: Acme");
    // email is NOT in default whitelist
    expect(systemMsg.content).not.toContain("email");
    expect(systemMsg.content).not.toContain("crmId");
  });

  it("uses custom contactFieldsWhitelist from config", async () => {
    const state = makeState({
      contactData: { crmId: "crm-1", name: "Ivan", email: "ivan@test.com", phone: "+123" },
    });
    const config = makeConfig({
      graphSettings: {
        conversation: { systemPrompt: "You are a sales agent." },
        qualification: { contactFieldsWhitelist: ["email"] },
      },
    });

    await generateNode(state, config);

    const calls = mockModel.invoke.mock.calls[0];
    const systemMsg = calls[0][0];
    expect(systemMsg.content).toContain("email: ivan@test.com");
    // name and phone are NOT in custom whitelist
    expect(systemMsg.content).not.toContain("name: Ivan");
    expect(systemMsg.content).not.toContain("phone");
    expect(systemMsg.content).not.toContain("crmId");
  });

  it("includes all state messages in model call", async () => {
    const msgs = [new HumanMessage("msg1"), new AIMessage("msg2"), new HumanMessage("msg3")];
    const state = makeState({ messages: msgs });

    await generateNode(state, makeConfig());

    const calls = mockModel.invoke.mock.calls[0];
    const passedMessages = calls[0];
    // 3 user messages + 1 system message (greeting)
    expect(passedMessages).toHaveLength(4);
  });

  it("applies langfuseCallback via withConfig when present", async () => {
    const mockCallbackModel = {
      invoke: jest.fn().mockResolvedValue(mockAiResponse),
      bindTools: jest.fn().mockReturnThis(),
    };
    const mockModelWithConfig = {
      ...mockModel,
      withConfig: jest.fn().mockReturnValue(mockCallbackModel),
    };
    mockModelInitializer.initializeChatModel.mockResolvedValue(mockModelWithConfig);

    const langfuseCallback = { name: "langfuse" };
    const state = makeState();

    await generateNode(state, makeConfig(), langfuseCallback);

    expect(mockModelWithConfig.withConfig).toHaveBeenCalledWith({
      callbacks: [langfuseCallback],
    });
    expect(mockCallbackModel.invoke).toHaveBeenCalled();
  });

  it("passes tools from model config to initializeChatModel", async () => {
    const state = makeState();
    const config = makeConfig({
      graphSettings: {
        conversation: {
          model: {
            provider: "openai",
            modelName: "gpt-4o-mini",
            tools: ["kb_search", "web_search"],
          },
        },
      },
    });

    await generateNode(state, config);

    expect(mockModelInitializer.initializeChatModel).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: ["kb_search", "web_search"],
      })
    );
  });

  describe("message windowing", () => {
    it("applies messageWindowSize to limit messages sent to model", async () => {
      const msgs = Array.from({ length: 100 }, (_, i) =>
        i % 2 === 0 ? new HumanMessage(`msg-${i}`) : new AIMessage(`reply-${i}`)
      );
      const state = makeState({ messages: msgs });
      const config = makeConfig({ graphSettings: { conversation: { messageWindowSize: 10 } } });

      await generateNode(state, config);

      const calls = mockModel.invoke.mock.calls[0];
      const passedMessages = calls[0];
      // greeting system message + 10 windowed messages
      expect(passedMessages).toHaveLength(11);
    });

    it("defaults to 50 messages when messageWindowSize not set", async () => {
      const msgs = Array.from({ length: 60 }, (_, i) =>
        i % 2 === 0 ? new HumanMessage(`msg-${i}`) : new AIMessage(`reply-${i}`)
      );
      const state = makeState({ messages: msgs });
      const config = makeConfig({ graphSettings: {} });

      await generateNode(state, config);

      const calls = mockModel.invoke.mock.calls[0];
      const passedMessages = calls[0];
      // greeting system message + 50 windowed messages
      expect(passedMessages).toHaveLength(51);
    });
  });

  describe("qualification fields in prompt", () => {
    it("includes missing qualification fields in system prompt", async () => {
      const state = makeState({ contactData: { crmId: "crm-1", name: "Ivan" } });
      const config = makeConfig({
        graphSettings: {
          conversation: { systemPrompt: "You are a sales agent." },
          qualification: {
            qualificationFields: [
              { name: "companyName", description: "Company name", required: true },
              { name: "budget", description: "Budget range", required: false },
            ],
          },
        },
      });

      await generateNode(state, config);

      const systemMsg = mockModel.invoke.mock.calls[0][0][0];
      expect(systemMsg.content).toContain("Still need to collect");
      expect(systemMsg.content).toContain("companyName (required)");
      expect(systemMsg.content).toContain("budget");
    });

    it("does not show collected fields in missing list", async () => {
      const state = makeState({
        contactData: { crmId: "crm-1", companyName: "Acme", budget: "50k" },
      });
      const config = makeConfig({
        graphSettings: {
          conversation: { systemPrompt: "You are a sales agent." },
          qualification: {
            qualificationFields: [
              { name: "companyName", description: "Company name", required: true },
              { name: "budget", description: "Budget range", required: false },
              { name: "painPoints", description: "Main challenges", required: false },
            ],
          },
        },
      });

      await generateNode(state, config);

      const systemMsg = mockModel.invoke.mock.calls[0][0][0];
      // companyName and budget already collected — should not be in "Still need to collect"
      expect(systemMsg.content).not.toContain("companyName (required)");
      expect(systemMsg.content).not.toContain("budget —");
      // painPoints still missing
      expect(systemMsg.content).toContain("painPoints");
    });

    it("omits qualification section when no fields configured", async () => {
      const state = makeState();
      const config = makeConfig({
        graphSettings: {
          conversation: { systemPrompt: "You are a sales agent." },
          qualification: { qualificationFields: [] },
        },
      });

      await generateNode(state, config);

      const systemMsg = mockModel.invoke.mock.calls[0][0][0];
      expect(systemMsg.content).not.toContain("Still need to collect");
    });
  });
});

describe("routeAfterInputSanitize", () => {
  it("returns '__end__' when last message is AIMessage (blocked)", () => {
    const state = makeState({
      messages: [new HumanMessage("hi"), new AIMessage("Blocked")],
    });
    expect(routeAfterInputSanitize(state)).toBe("__end__");
  });

  it("returns 'generate' when last message is HumanMessage (passed)", () => {
    const state = makeState({ messages: [new HumanMessage("hello")] });
    expect(routeAfterInputSanitize(state)).toBe("generate");
  });
});

describe("routeAfterGenerate", () => {
  it("returns 'exec_tools' when last message has tool calls", () => {
    const aiMsg = new AIMessage({ content: "", tool_calls: [] });
    (aiMsg as any).tool_calls = [{ id: "tc1", name: "some_tool", args: {} }];
    const state = makeState({ messages: [new HumanMessage("hi"), aiMsg] });
    expect(routeAfterGenerate(state)).toBe("exec_tools");
  });

  it("returns '__end__' when last message has no tool calls", () => {
    const state = makeState({
      messages: [new HumanMessage("hi"), new AIMessage({ content: "response", tool_calls: [] })],
    });
    expect(routeAfterGenerate(state)).toBe("__end__");
  });
});
