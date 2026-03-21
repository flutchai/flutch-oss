import { saveContextNode } from "./save-context.node";
import { HumanMessage } from "@langchain/core/messages";
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

const mockMcpClient = {
  executeTool: jest.fn(),
};

describe("saveContextNode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("skips when no crmConfig", async () => {
    const state = makeState({ contactData: { name: "Ivan" } });
    const result = await saveContextNode(state, { configurable: {} } as any);
    expect(result).toEqual({});
  });

  it("skips when no contactData", async () => {
    const state = makeState({ contactData: {} });
    const config = {
      configurable: {
        crmConfig: { provider: "twenty", lookupBy: "email" },
        mcpClient: mockMcpClient,
      },
    };
    const result = await saveContextNode(state, config as any);
    expect(result).toEqual({});
  });

  it("updates existing contact when crmId is present", async () => {
    mockMcpClient.executeTool.mockResolvedValue({ success: true });

    const state = makeState({
      contactData: { crmId: "crm-1", name: "Ivan", email: "ivan@test.com" },
    });
    const config = {
      configurable: {
        crmConfig: { provider: "twenty", lookupBy: "email" },
        mcpClient: mockMcpClient,
      },
    };

    const result = await saveContextNode(state, config as any);

    expect(mockMcpClient.executeTool).toHaveBeenCalledWith(
      "twenty_update_person",
      { id: "crm-1", name: "Ivan", email: "ivan@test.com" },
    );
    expect(result).toEqual({});
  });

  it("creates new contact when no crmId", async () => {
    mockMcpClient.executeTool.mockResolvedValue({
      success: true,
      result: { id: "new-crm-id" },
    });

    const state = makeState({
      contactData: { name: "New User", email: "new@test.com" },
    });
    const config = {
      configurable: {
        crmConfig: { provider: "twenty", lookupBy: "email" },
        mcpClient: mockMcpClient,
      },
    };

    const result = await saveContextNode(state, config as any);

    expect(mockMcpClient.executeTool).toHaveBeenCalledWith(
      "twenty_create_person",
      { name: "New User", email: "new@test.com" },
    );
    expect(result.contactData?.crmId).toBe("new-crm-id");
  });

  it("handles CRM save failure gracefully", async () => {
    mockMcpClient.executeTool.mockRejectedValue(new Error("CRM down"));

    const state = makeState({
      contactData: { crmId: "crm-1", name: "Ivan" },
    });
    const config = {
      configurable: {
        crmConfig: { provider: "twenty", lookupBy: "email" },
        mcpClient: mockMcpClient,
      },
    };

    const result = await saveContextNode(state, config as any);
    expect(result).toEqual({});
  });

  it("passes _credentials in update call when apiKey is set", async () => {
    mockMcpClient.executeTool.mockResolvedValue({ success: true });

    const state = makeState({
      contactData: { crmId: "crm-1", name: "Ivan" },
    });
    const config = {
      configurable: {
        crmConfig: {
          provider: "twenty",
          lookupBy: "email",
          apiKey: "agent-key",
          baseUrl: "http://crm.local",
        },
        mcpClient: mockMcpClient,
      },
    };

    await saveContextNode(state, config as any);

    expect(mockMcpClient.executeTool).toHaveBeenCalledWith(
      "twenty_update_person",
      {
        id: "crm-1",
        name: "Ivan",
        _credentials: { apiKey: "agent-key", baseUrl: "http://crm.local" },
      },
    );
  });

  it("passes _credentials in create call when apiKey is set", async () => {
    mockMcpClient.executeTool.mockResolvedValue({
      success: true,
      result: { id: "new-id" },
    });

    const state = makeState({
      contactData: { name: "New" },
    });
    const config = {
      configurable: {
        crmConfig: {
          provider: "twenty",
          lookupBy: "email",
          apiKey: "agent-key",
        },
        mcpClient: mockMcpClient,
      },
    };

    await saveContextNode(state, config as any);

    expect(mockMcpClient.executeTool).toHaveBeenCalledWith(
      "twenty_create_person",
      {
        name: "New",
        _credentials: { apiKey: "agent-key" },
      },
    );
  });

  it("parses text-based create result from MCP", async () => {
    mockMcpClient.executeTool.mockResolvedValue({
      success: true,
      result: '✅ Created person: New User\n\n{"id": "text-crm-id", "name": {"firstName": "New", "lastName": "User"}}',
    });

    const state = makeState({
      contactData: { firstName: "New", lastName: "User", email: "new@test.com" },
    });
    const config = {
      configurable: {
        crmConfig: { provider: "twenty", lookupBy: "email" },
        mcpClient: mockMcpClient,
      },
    };

    const result = await saveContextNode(state, config as any);
    expect(result.contactData?.crmId).toBe("text-crm-id");
  });

  it("uses zoho tool name when provider is zoho", async () => {
    mockMcpClient.executeTool.mockResolvedValue({ success: true });

    const state = makeState({
      contactData: { crmId: "z-1", First_Name: "Ivan" },
    });
    const config = {
      configurable: {
        crmConfig: { provider: "zoho", lookupBy: "email" },
        mcpClient: mockMcpClient,
      },
    };

    await saveContextNode(state, config as any);

    expect(mockMcpClient.executeTool).toHaveBeenCalledWith(
      "zoho_update_contact",
      { id: "z-1", First_Name: "Ivan" },
    );
  });
});
