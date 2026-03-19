import { execToolsNode } from "./exec-tools.node";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { SalesState } from "../sales.annotations";

jest.mock("@flutchai/flutch-sdk", () => ({
  McpRuntimeHttpClient: jest.fn(),
  executeToolWithAttachments: jest.fn(),
  IGraphAttachment: {},
}));

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

function makeAIMessageWithTools(
  toolCalls: Array<{ id: string; name: string; args: Record<string, any> }>,
): AIMessage {
  const msg = new AIMessage({ content: "", tool_calls: [] });
  (msg as any).tool_calls = toolCalls;
  return msg;
}

describe("execToolsNode", () => {
  let executeToolWithAttachments: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    const sdk = require("@flutchai/flutch-sdk");
    executeToolWithAttachments = sdk.executeToolWithAttachments as jest.Mock;
  });

  it("returns empty messages when generation is null", async () => {
    const state = makeState({ generation: null });
    const result = await execToolsNode(state, {} as any);
    expect(result).toEqual({ messages: [] });
  });

  it("returns empty object when tool_calls is empty", async () => {
    const generation = new AIMessage({ content: "response", tool_calls: [] });
    const state = makeState({ generation });
    const result = await execToolsNode(state, { configurable: {} } as any);
    expect(result).toEqual({});
  });

  it("returns error ToolMessage when mcpClient is not in config", async () => {
    const generation = makeAIMessageWithTools([
      { id: "tc1", name: "roof_calculator", args: { area: 200 } },
    ]);
    const state = makeState({ generation });
    const config = { configurable: {} };

    const result = await execToolsNode(state, config as any);

    expect(result.messages).toHaveLength(1);
    const msg = result.messages![0] as ToolMessage;
    expect(msg).toBeInstanceOf(ToolMessage);
    const content = JSON.parse(msg.content as string);
    expect(content.error).toContain("roof_calculator");
  });

  it("executes tool calls via mcpClient and returns tool messages", async () => {
    const mockToolMessage = new ToolMessage({
      content: JSON.stringify({ result: "200 sq m calculated" }),
      tool_call_id: "tc1",
      name: "roof_calculator",
    });

    executeToolWithAttachments.mockResolvedValue({
      toolMessage: mockToolMessage,
      attachment: null,
    });

    const generation = makeAIMessageWithTools([
      { id: "tc1", name: "roof_calculator", args: { area: 200 } },
    ]);
    const state = makeState({ generation });
    const mockMcpClient = { executeTool: jest.fn() };
    const config = {
      configurable: {
        __mcpClient: mockMcpClient,
        __toolConfigs: { roof_calculator: { apiKey: "xyz" } },
        context: { userId: "user-1", agentId: "agent-1" },
        thread_id: "thread-1",
      },
    };

    const result = await execToolsNode(state, config as any);

    expect(executeToolWithAttachments).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCall: expect.objectContaining({ name: "roof_calculator" }),
        mcpClient: mockMcpClient,
      }),
    );
    expect(result.messages).toHaveLength(1);
    expect(result.messages![0]).toBe(mockToolMessage);
  });

  it("returns error ToolMessage when tool execution throws", async () => {
    executeToolWithAttachments.mockRejectedValue(new Error("Tool execution failed"));

    const generation = makeAIMessageWithTools([
      { id: "tc1", name: "roof_calculator", args: {} },
    ]);
    const state = makeState({ generation });
    const mockMcpClient = { executeTool: jest.fn() };
    const config = {
      configurable: {
        __mcpClient: mockMcpClient,
        __toolConfigs: {},
      },
    };

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

    const generation = makeAIMessageWithTools([
      { id: "tc1", name: "pdf_tool", args: {} },
    ]);
    const state = makeState({ generation });
    const config = {
      configurable: {
        __mcpClient: {},
        __toolConfigs: {},
      },
    };

    const result = await execToolsNode(state, config as any);

    expect(result.attachments).toBeDefined();
    expect(result.attachments!["pdf_attachment"]).toEqual({
      url: "http://example.com/file.pdf",
      type: "pdf",
    });
  });

  it("does not include attachments key when no attachments returned", async () => {
    const mockToolMessage = new ToolMessage({
      content: "result",
      tool_call_id: "tc1",
      name: "simple_tool",
    });

    executeToolWithAttachments.mockResolvedValue({
      toolMessage: mockToolMessage,
      attachment: null,
    });

    const generation = makeAIMessageWithTools([
      { id: "tc1", name: "simple_tool", args: {} },
    ]);
    const state = makeState({ generation });
    const config = { configurable: { __mcpClient: {}, __toolConfigs: {} } };

    const result = await execToolsNode(state, config as any);

    expect(result.attachments).toBeUndefined();
  });

  it("handles multiple tool calls in sequence", async () => {
    const toolMsg1 = new ToolMessage({ content: "result1", tool_call_id: "tc1", name: "tool1" });
    const toolMsg2 = new ToolMessage({ content: "result2", tool_call_id: "tc2", name: "tool2" });

    executeToolWithAttachments
      .mockResolvedValueOnce({ toolMessage: toolMsg1, attachment: null })
      .mockResolvedValueOnce({ toolMessage: toolMsg2, attachment: null });

    const generation = makeAIMessageWithTools([
      { id: "tc1", name: "tool1", args: {} },
      { id: "tc2", name: "tool2", args: {} },
    ]);
    const state = makeState({ generation });
    const config = { configurable: { __mcpClient: {}, __toolConfigs: {} } };

    const result = await execToolsNode(state, config as any);

    expect(result.messages).toHaveLength(2);
  });

  it("uses tool name as tool_call_id fallback when id is missing", async () => {
    const mockToolMessage = new ToolMessage({
      content: "result",
      tool_call_id: "tool_no_id",
      name: "tool_no_id",
    });
    executeToolWithAttachments.mockResolvedValue({
      toolMessage: mockToolMessage,
      attachment: null,
    });

    const generation = makeAIMessageWithTools([
      { id: undefined as any, name: "tool_no_id", args: {} },
    ]);
    const state = makeState({ generation });
    const config = { configurable: { __mcpClient: {}, __toolConfigs: {} } };

    const result = await execToolsNode(state, config as any);

    expect(result.messages).toHaveLength(1);
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

    const generation = makeAIMessageWithTools([
      { id: "tc1", name: "crm_tool", args: {} },
    ]);
    const state = makeState({ generation });
    const config = {
      configurable: {
        __mcpClient: {},
        __toolConfigs: {},
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
