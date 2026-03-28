import { SalesGraphBuilder, shouldUseTools } from "../builder";
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
    currentStep: 0,
    steps: [],
    qualificationData: {},
    leadScore: null,
    enrichmentStatus: null,
    ...overrides,
  };
}

function makeConfig(overrides: Record<string, any> = {}) {
  const { graphSettings: gsOverride, ...rest } = overrides;
  return {
    configurable: {
      graphSettings: { modelId: "gpt-4o-mini", ...gsOverride },
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

  it("returns text and appends to messages (no steps)", async () => {
    const state = makeState();
    const result = await generateNode(state, makeConfig());

    expect(result.messages).toEqual([mockAiResponse]);
    expect(result.text).toBe("Here is my response");
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
      expect.objectContaining({ modelId: "gpt-4o-mini" })
    );
  });

  it("prepends SystemMessage when systemPrompt is set", async () => {
    const { SystemMessage } = await import("@langchain/core/messages");
    const state = makeState();
    const config = makeConfig({ graphSettings: { systemPrompt: "Be helpful." } });

    await generateNode(state, config);

    const calls = mockModel.invoke.mock.calls[0];
    const messages = calls[0];
    expect(messages[0]).toBeInstanceOf(SystemMessage);
    expect((messages[0] as any).content).toBe("Be helpful.");
  });

  it("does not prepend SystemMessage when systemPrompt is empty", async () => {
    const state = makeState();
    const config = makeConfig({ graphSettings: { systemPrompt: "" } });

    await generateNode(state, config);

    const calls = mockModel.invoke.mock.calls[0];
    const messages = calls[0];
    expect(messages[0]).toBeInstanceOf(HumanMessage);
  });

  it("appends contactData to system prompt", async () => {
    const state = makeState({
      contactData: { crmId: "crm-1", name: "Ivan", email: "ivan@test.com" },
    });
    const config = makeConfig({ graphSettings: { systemPrompt: "You are a sales agent." } });

    await generateNode(state, config);

    const calls = mockModel.invoke.mock.calls[0];
    const systemMsg = calls[0][0];
    expect(systemMsg.content).toContain("About the customer");
    expect(systemMsg.content).toContain("name: Ivan");
    expect(systemMsg.content).toContain("email: ivan@test.com");
    expect(systemMsg.content).not.toContain("crmId");
  });

  it("includes all state messages in model call", async () => {
    const msgs = [new HumanMessage("msg1"), new AIMessage("msg2"), new HumanMessage("msg3")];
    const state = makeState({ messages: msgs });

    await generateNode(state, makeConfig());

    const calls = mockModel.invoke.mock.calls[0];
    const passedMessages = calls[0];
    expect(passedMessages).toHaveLength(3);
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
      })
    );
  });

  describe("step-aware generation", () => {
    const sampleSteps = [
      {
        id: "greeting",
        name: "Greeting",
        prompt: "Welcome the customer",
        fields: [{ name: "reason", description: "Why they reached out", required: false }],
        tools: [],
      },
      {
        id: "company",
        name: "Company",
        prompt: "Gather company info",
        fields: [{ name: "companyName", description: "Company name", required: true }],
        tools: ["crm_search"],
      },
    ];

    it("includes step prompt in system message", async () => {
      const state = makeState({ steps: sampleSteps, currentStep: 0 });
      const config = makeConfig({ graphSettings: { systemPrompt: "Base prompt." } });

      await generateNode(state, config);

      const systemMsg = mockModel.invoke.mock.calls[0][0][0];
      expect(systemMsg.content).toContain("Current step: Greeting");
      expect(systemMsg.content).toContain("Welcome the customer");
    });

    it("binds advance_step tool when in step mode", async () => {
      const state = makeState({ steps: sampleSteps, currentStep: 0 });
      const config = makeConfig();

      await generateNode(state, config);

      expect(mockModel.bindTools).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ name: "advance_step" })]),
        { parallel_tool_calls: false }
      );
    });

    it("does not bind advance_step when no steps", async () => {
      const state = makeState({ steps: [], currentStep: 0 });
      const config = makeConfig();

      await generateNode(state, config);

      expect(mockModel.bindTools).not.toHaveBeenCalled();
    });

    it("includes qualification progress in system prompt", async () => {
      const state = makeState({
        steps: sampleSteps,
        currentStep: 1,
        qualificationData: { greeting: { reason: "Looking for CRM" } },
      });
      const config = makeConfig({ graphSettings: { systemPrompt: "Base." } });

      await generateNode(state, config);

      const systemMsg = mockModel.invoke.mock.calls[0][0][0];
      expect(systemMsg.content).toContain("Gathered so far");
      expect(systemMsg.content).toContain("reason: Looking for CRM");
      expect(systemMsg.content).toContain("Current step: Company (2/2)");
    });

    it("includes step-specific tools in toolsConfig", async () => {
      const state = makeState({ steps: sampleSteps, currentStep: 1 });
      const config = makeConfig({
        graphSettings: {
          modelId: "gpt-4o-mini",
          availableTools: ["kb_search"],
        },
      });

      await generateNode(state, config);

      expect(mockModelInitializer.initializeChatModel).toHaveBeenCalledWith(
        expect.objectContaining({
          toolsConfig: expect.arrayContaining([
            { toolName: "kb_search", enabled: true },
            { toolName: "crm_search", enabled: true },
          ]),
        })
      );
    });
  });

  describe("scoring (all steps completed)", () => {
    const sampleSteps = [
      {
        id: "greeting",
        name: "Greeting",
        prompt: "Welcome",
        fields: [],
        tools: [],
      },
    ];

    it("triggers scoring when currentStep >= steps.length", async () => {
      const scoringResponse = { score: 85, outcome: "qualified", reasons: ["Good fit"] };
      const closingAiMsg = new AIMessage({ content: "Thank you!", tool_calls: [] });

      mockModelInitializer.initializeChatModel
        .mockResolvedValueOnce({
          invoke: jest.fn().mockResolvedValue(scoringResponse),
          withStructuredOutput: jest.fn().mockReturnValue({
            invoke: jest.fn().mockResolvedValue(scoringResponse),
          }),
          withConfig: jest.fn().mockReturnThis(),
        })
        .mockResolvedValueOnce({
          invoke: jest.fn().mockResolvedValue(closingAiMsg),
          withConfig: jest.fn().mockReturnThis(),
        });

      const state = makeState({
        steps: sampleSteps,
        currentStep: 1,
        qualificationData: { greeting: { reason: "Need CRM" } },
        contactData: { name: "Test User" },
      });
      const config = makeConfig();

      const result = await generateNode(state, config);

      expect(result.leadScore).toBeDefined();
      expect(result.leadScore!.score).toBe(85);
      expect(result.leadScore!.outcome).toBe("qualified");
    });
  });
});

describe("shouldUseTools", () => {
  it("returns '__end__' when last message has no tool calls", () => {
    const lastMsg = new AIMessage({ content: "response", tool_calls: [] });
    const state = makeState({ messages: [new HumanMessage("hi"), lastMsg] });
    expect(shouldUseTools(state)).toBe("__end__");
  });

  it("returns 'exec_tools' when last message has tool calls", () => {
    const aiMsg = new AIMessage({ content: "", tool_calls: [] });
    (aiMsg as any).tool_calls = [{ id: "tc1", name: "some_tool", args: {} }];
    const state = makeState({ messages: [new HumanMessage("hi"), aiMsg] });
    expect(shouldUseTools(state)).toBe("exec_tools");
  });
});
