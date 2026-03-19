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
    text: "",
    contactData: {},
    attachments: {},
    ...overrides,
  };
}

function makeAIMessageWithTools(
  toolCalls: Array<{ id: string; name: string; args: Record<string, any> }>,
): AIMessage {
  const msg = new AIMessage({ content: "" });
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

  it("returns {} when last message has no tool calls", async () => {
    const state = makeState({
      messages: [new AIMessage({ content: "response", tool_calls: [] })],
    });
    const result = await execToolsNode(state, { configurable: {} } as any);
    expect(result).toEqual({});
  });

  it("returns {} when messages is empty", async () => {
    const state = makeState({ messages: [] });
    const result = await execToolsNode(state, { configurable: {} } as any);
    expect(result).toEqual({});
  });

  it("returns error ToolMessage when mcpClient is not in config", async () => {
    const aiMsg = makeAIMessageWithTools([{ id: "tc1", name: "roof_calc", args: {} }]);
    const state = makeState({ messages: [aiMsg] });

    const result = await execToolsNode(state, { configurable: {} } as any);

    expect(result.messages).toHaveLength(1);
    const content = JSON.parse((result.messages![0] as ToolMessage).content as string);
    expect(content.error).toContain("roof_calc");
  });

  it("executes tool and returns tool message", async () => {
    const toolMsg = new ToolMessage({
      content: JSON.stringify({ result: "200 sq m" }),
      tool_call_id: "tc1",
      name: "roof_calc",
    });
    executeToolWithAttachments.mockResolvedValue({ toolMessage: toolMsg, attachment: null });

    const aiMsg = makeAIMessageWithTools([{ id: "tc1", name: "roof_calc", args: { area: 200 } }]);
    const state = makeState({ messages: [aiMsg] });
    const mcpClient = { executeTool: jest.fn() };

    const result = await execToolsNode(state, {
      configurable: { mcpClient, toolConfigs: {} },
    } as any);

    expect(result.messages).toHaveLength(1);
    expect(result.messages![0]).toBe(toolMsg);
  });

  it("returns error ToolMessage when tool execution throws", async () => {
    executeToolWithAttachments.mockRejectedValue(new Error("Tool crashed"));

    const aiMsg = makeAIMessageWithTools([{ id: "tc1", name: "roof_calc", args: {} }]);
    const state = makeState({ messages: [aiMsg] });

    const result = await execToolsNode(state, {
      configurable: { mcpClient: {}, toolConfigs: {} },
    } as any);

    const content = JSON.parse((result.messages![0] as ToolMessage).content as string);
    expect(content.error).toBe("Tool crashed");
  });

  it("collects attachments from tool results", async () => {
    const toolMsg = new ToolMessage({ content: "ok", tool_call_id: "tc1", name: "pdf" });
    executeToolWithAttachments.mockResolvedValue({
      toolMessage: toolMsg,
      attachment: {
        key: "pdf_key",
        value: { url: "http://file.pdf", type: "pdf" },
      },
    });

    const aiMsg = makeAIMessageWithTools([{ id: "tc1", name: "pdf", args: {} }]);
    const state = makeState({ messages: [aiMsg] });

    const result = await execToolsNode(state, {
      configurable: { mcpClient: {}, toolConfigs: {} },
    } as any);

    expect(result.attachments?.["pdf_key"]).toEqual({ url: "http://file.pdf", type: "pdf" });
  });

  it("does not include attachments key when no attachments returned", async () => {
    const toolMsg = new ToolMessage({ content: "ok", tool_call_id: "tc1", name: "simple" });
    executeToolWithAttachments.mockResolvedValue({ toolMessage: toolMsg, attachment: null });

    const aiMsg = makeAIMessageWithTools([{ id: "tc1", name: "simple", args: {} }]);
    const state = makeState({ messages: [aiMsg] });

    const result = await execToolsNode(state, {
      configurable: { mcpClient: {}, toolConfigs: {} },
    } as any);

    expect(result.attachments).toBeUndefined();
  });

  it("handles multiple tool calls", async () => {
    const msg1 = new ToolMessage({ content: "r1", tool_call_id: "tc1", name: "t1" });
    const msg2 = new ToolMessage({ content: "r2", tool_call_id: "tc2", name: "t2" });
    executeToolWithAttachments
      .mockResolvedValueOnce({ toolMessage: msg1, attachment: null })
      .mockResolvedValueOnce({ toolMessage: msg2, attachment: null });

    const aiMsg = makeAIMessageWithTools([
      { id: "tc1", name: "t1", args: {} },
      { id: "tc2", name: "t2", args: {} },
    ]);
    const state = makeState({ messages: [aiMsg] });

    const result = await execToolsNode(state, {
      configurable: { mcpClient: {}, toolConfigs: {} },
    } as any);

    expect(result.messages).toHaveLength(2);
  });

  it("uses tool name as fallback when tool id is missing", async () => {
    const toolMsg = new ToolMessage({ content: "ok", tool_call_id: "no_id_tool", name: "no_id_tool" });
    executeToolWithAttachments.mockResolvedValue({ toolMessage: toolMsg, attachment: null });

    const aiMsg = makeAIMessageWithTools([{ id: undefined as any, name: "no_id_tool", args: {} }]);
    const state = makeState({ messages: [aiMsg] });

    const result = await execToolsNode(state, {
      configurable: { mcpClient: {}, toolConfigs: {} },
    } as any);

    expect(result.messages).toHaveLength(1);
  });

  it("builds execution context from config.configurable.context", async () => {
    const toolMsg = new ToolMessage({ content: "ok", tool_call_id: "tc1", name: "crm" });
    executeToolWithAttachments.mockResolvedValue({ toolMessage: toolMsg, attachment: null });

    const aiMsg = makeAIMessageWithTools([{ id: "tc1", name: "crm", args: {} }]);
    const state = makeState({ messages: [aiMsg] });

    await execToolsNode(state, {
      configurable: {
        mcpClient: {},
        toolConfigs: {},
        context: {
          userId: "u1",
          agentId: "a1",
          companyId: "c1",
          platform: "telegram",
          messageId: "m1",
        },
        thread_id: "t1",
      },
    } as any);

    const callArg = executeToolWithAttachments.mock.calls[0][0];
    expect(callArg.executionContext.userId).toBe("u1");
    expect(callArg.executionContext.agentId).toBe("a1");
    expect(callArg.executionContext.companyId).toBe("c1");
    expect(callArg.executionContext.platform).toBe("telegram");
    expect(callArg.executionContext.threadId).toBe("t1");
  });

  it("enriches tool args with toolConfigs", async () => {
    const toolMsg = new ToolMessage({ content: "ok", tool_call_id: "tc1", name: "calc" });
    executeToolWithAttachments.mockResolvedValue({ toolMessage: toolMsg, attachment: null });

    const aiMsg = makeAIMessageWithTools([{ id: "tc1", name: "calc", args: { area: 100 } }]);
    const state = makeState({ messages: [aiMsg] });

    await execToolsNode(state, {
      configurable: {
        mcpClient: {},
        toolConfigs: { calc: { apiKey: "xyz", region: "ru" } },
      },
    } as any);

    const callArg = executeToolWithAttachments.mock.calls[0][0];
    expect(callArg.enrichedArgs).toEqual({ apiKey: "xyz", region: "ru", area: 100 });
  });
});
