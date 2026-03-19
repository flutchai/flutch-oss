import { loadContextNode } from "./load-context.node";
import { HumanMessage } from "@langchain/core/messages";
import { SalesState } from "../sales.annotations";

type State = typeof SalesState.State;

function makeState(overrides: Partial<State> = {}): State {
  return {
    messages: [],
    text: "",
    contactData: {},
    attachments: {},
    ...overrides,
  };
}

const mockMcpClient = {
  executeTool: jest.fn(),
};

describe("loadContextNode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("skips CRM lookup when no crmConfig", async () => {
    const state = makeState();
    const config = { configurable: {} };

    const result = await loadContextNode(state, config as any);
    expect(result).toEqual({});
  });

  it("skips CRM lookup when no mcpClient", async () => {
    const state = makeState();
    const config = {
      configurable: {
        crmConfig: { provider: "twenty", lookupBy: "email" },
      },
    };

    const result = await loadContextNode(state, config as any);
    expect(result).toEqual({});
  });

  it("skips CRM lookup when no lookup value found", async () => {
    const state = makeState({ messages: [new HumanMessage("hi")] });
    const config = {
      configurable: {
        crmConfig: { provider: "twenty", lookupBy: "email" },
        mcpClient: mockMcpClient,
      },
    };

    const result = await loadContextNode(state, config as any);
    expect(result).toEqual({});
  });

  it("extracts lookup value from context", async () => {
    mockMcpClient.executeTool.mockResolvedValue({
      success: true,
      result: { id: "crm-1", name: "Ivan", email: "ivan@test.com", createdAt: "2026-01-01" },
    });

    const state = makeState({ messages: [new HumanMessage("hi")] });
    const config = {
      configurable: {
        crmConfig: { provider: "twenty", lookupBy: "email" },
        mcpClient: mockMcpClient,
        context: { email: "ivan@test.com" },
      },
    };

    const result = await loadContextNode(state, config as any);

    expect(mockMcpClient.executeTool).toHaveBeenCalledWith(
      "twenty_find_person",
      { email: "ivan@test.com" },
    );
    expect(result.contactData).toEqual({
      crmId: "crm-1",
      name: "Ivan",
      email: "ivan@test.com",
    });
    // System fields should be filtered out
    expect(result.contactData?.createdAt).toBeUndefined();
  });

  it("extracts lookup value from first message metadata", async () => {
    mockMcpClient.executeTool.mockResolvedValue({
      success: true,
      result: { id: "crm-2", name: "Maria", email: "maria@co.com" },
    });

    const firstMsg = new HumanMessage({ content: "Hi" });
    (firstMsg as any).additional_kwargs = {
      metadata: { email: "maria@co.com", name: "Maria" },
    };
    const state = makeState({ messages: [firstMsg] });
    const config = {
      configurable: {
        crmConfig: { provider: "twenty", lookupBy: "email" },
        mcpClient: mockMcpClient,
      },
    };

    const result = await loadContextNode(state, config as any);

    expect(mockMcpClient.executeTool).toHaveBeenCalledWith(
      "twenty_find_person",
      { email: "maria@co.com" },
    );
    expect(result.contactData?.crmId).toBe("crm-2");
  });

  it("falls back to metadata when CRM returns not found", async () => {
    mockMcpClient.executeTool.mockResolvedValue({
      success: false,
      error: "Not found",
    });

    const firstMsg = new HumanMessage({ content: "Hi" });
    (firstMsg as any).additional_kwargs = {
      metadata: {
        email: "new@test.com",
        name: "New User",
        calculatorData: { area: 200 },
      },
    };
    const state = makeState({ messages: [firstMsg] });
    const config = {
      configurable: {
        crmConfig: { provider: "twenty", lookupBy: "email" },
        mcpClient: mockMcpClient,
      },
    };

    const result = await loadContextNode(state, config as any);

    // Should extract from metadata without calculatorData
    expect(result.contactData).toEqual({
      email: "new@test.com",
      name: "New User",
    });
  });

  it("falls back to metadata when CRM call throws", async () => {
    mockMcpClient.executeTool.mockRejectedValue(new Error("CRM unreachable"));

    const firstMsg = new HumanMessage({ content: "Hi" });
    (firstMsg as any).additional_kwargs = {
      metadata: { email: "user@test.com", name: "User" },
    };
    const state = makeState({ messages: [firstMsg] });
    const config = {
      configurable: {
        crmConfig: { provider: "twenty", lookupBy: "email" },
        mcpClient: mockMcpClient,
      },
    };

    const result = await loadContextNode(state, config as any);
    expect(result.contactData).toEqual({ email: "user@test.com", name: "User" });
  });

  it("uses zoho tool name when provider is zoho", async () => {
    mockMcpClient.executeTool.mockResolvedValue({
      success: true,
      result: { id: "z-1", First_Name: "Ivan", Email: "ivan@zoho.com" },
    });

    const state = makeState({ messages: [new HumanMessage("hi")] });
    const config = {
      configurable: {
        crmConfig: { provider: "zoho", lookupBy: "email" },
        mcpClient: mockMcpClient,
        context: { email: "ivan@zoho.com" },
      },
    };

    await loadContextNode(state, config as any);

    expect(mockMcpClient.executeTool).toHaveBeenCalledWith(
      "zoho_search_contacts",
      { email: "ivan@zoho.com" },
    );
  });
});
