import { SalesGraphBuilder } from "../builder";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { SalesState } from "../sales.annotations";

jest.mock("@flutchai/flutch-sdk", () => ({
  AbstractGraphBuilder: class {
    constructor() {}
  },
  McpRuntimeHttpClient: jest.fn().mockImplementation(() => ({
    getTools: jest.fn().mockResolvedValue([]),
    executeTool: jest.fn(),
  })),
  ModelInitializer: jest.fn().mockImplementation(() => ({
    initializeChatModel: jest.fn(),
  })),
  executeToolWithAttachments: jest.fn(),
  IGraphAttachment: {},
}));

jest.mock("../../../modules/langfuse/langfuse.service", () => ({
  LangfuseService: jest.fn(),
}));

const mockMcpClient = {
  getTools: jest.fn().mockResolvedValue([]),
  executeTool: jest.fn(),
};

const mockModelInitializer = {
  initializeChatModel: jest.fn(),
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
    ...overrides,
  };
}

function makeAIMessageWithTools(
  toolCalls: Array<{ id: string; name: string; args: Record<string, any> }>
): AIMessage {
  const msg = new AIMessage({ content: "", tool_calls: [] });
  (msg as any).tool_calls = toolCalls;
  return msg;
}

function createBuilder(): SalesGraphBuilder {
  return new SalesGraphBuilder(null, null, mockMcpClient as any, mockModelInitializer as any);
}

function getExecToolsNode(builder: SalesGraphBuilder) {
  return (builder as any).execToolsNode.bind(builder);
}

describe("execToolsNode", () => {
  let executeToolWithAttachments: jest.Mock;
  let builder: SalesGraphBuilder;
  let execToolsNode: (state: State, config: any) => Promise<Partial<State>>;

  beforeEach(() => {
    jest.clearAllMocks();
    const sdk = require("@flutchai/flutch-sdk");
    executeToolWithAttachments = sdk.executeToolWithAttachments as jest.Mock;
    builder = createBuilder();
    execToolsNode = getExecToolsNode(builder);
  });

  it("returns empty object when no tool calls in last message", async () => {
    const lastMsg = new AIMessage({ content: "response", tool_calls: [] });
    const state = makeState({ messages: [new HumanMessage("hi"), lastMsg] });
    const result = await execToolsNode(state, { configurable: {} } as any);
    expect(result).toEqual({});
  });

  it("executes tool calls via mcpClient and returns tool messages", async () => {
    const mockToolMessage = new ToolMessage({
      content: JSON.stringify({ result: "found 3 articles" }),
      tool_call_id: "tc1",
      name: "kb_search",
    });

    executeToolWithAttachments.mockResolvedValue({
      toolMessage: mockToolMessage,
      attachment: null,
    });

    const generation = makeAIMessageWithTools([
      { id: "tc1", name: "kb_search", args: { query: "pricing" } },
    ]);
    const state = makeState({ messages: [new HumanMessage("hi"), generation] });
    const config = {
      configurable: {
        graphSettings: {
          conversation: {
            availableTools: [{ name: "kb_search", enabled: true, config: { kbIds: ["kb-1"] } }],
          },
        },
        context: { userId: "user-1", agentId: "agent-1" },
        thread_id: "thread-1",
      },
    };

    const result = await execToolsNode(state, config as any);

    expect(executeToolWithAttachments).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCall: expect.objectContaining({ name: "kb_search" }),
      })
    );
    expect(result.messages).toHaveLength(1);
    expect(result.messages![0]).toBe(mockToolMessage);
  });

  it("returns error ToolMessage when tool execution throws", async () => {
    executeToolWithAttachments.mockRejectedValue(new Error("Tool execution failed"));

    const generation = makeAIMessageWithTools([{ id: "tc1", name: "kb_search", args: {} }]);
    const state = makeState({ messages: [new HumanMessage("hi"), generation] });
    const config = { configurable: {} };

    const result = await execToolsNode(state, config as any);

    expect(result.messages).toHaveLength(1);
    const content = JSON.parse((result.messages![0] as ToolMessage).content as string);
    expect(content.error).toBe("Tool execution failed");
  });

  it("collects attachments from tool results", async () => {
    const mockToolMessage = new ToolMessage({
      content: "result",
      tool_call_id: "tc1",
      name: "pdf_tool",
    });

    executeToolWithAttachments.mockResolvedValue({
      toolMessage: mockToolMessage,
      attachment: {
        key: "pdf_attachment",
        value: { url: "http://example.com/file.pdf", type: "pdf" },
      },
    });

    const generation = makeAIMessageWithTools([{ id: "tc1", name: "pdf_tool", args: {} }]);
    const state = makeState({ messages: [new HumanMessage("hi"), generation] });
    const config = { configurable: {} };

    const result = await execToolsNode(state, config as any);

    expect(result.attachments).toBeDefined();
    expect(result.attachments!["pdf_attachment"]).toEqual({
      url: "http://example.com/file.pdf",
      type: "pdf",
    });
  });

  it("builds execution context from config.configurable.context", async () => {
    const mockToolMessage = new ToolMessage({
      content: "result",
      tool_call_id: "tc1",
      name: "crm_tool",
    });
    executeToolWithAttachments.mockResolvedValue({
      toolMessage: mockToolMessage,
      attachment: null,
    });

    const generation = makeAIMessageWithTools([{ id: "tc1", name: "crm_tool", args: {} }]);
    const state = makeState({ messages: [new HumanMessage("hi"), generation] });
    const config = {
      configurable: {
        context: {
          userId: "user-123",
          agentId: "agent-456",
          companyId: "company-789",
          platform: "telegram",
          messageId: "msg-1",
        },
        thread_id: "thread-abc",
      },
    };

    await execToolsNode(state, config as any);

    const callArg = executeToolWithAttachments.mock.calls[0][0];
    expect(callArg.executionContext.userId).toBe("user-123");
    expect(callArg.executionContext.agentId).toBe("agent-456");
    expect(callArg.executionContext.companyId).toBe("company-789");
    expect(callArg.executionContext.platform).toBe("telegram");
    expect(callArg.executionContext.threadId).toBe("thread-abc");
  });
});
