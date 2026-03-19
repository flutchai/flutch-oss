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

  it("only writes writeFields when configured", async () => {
    mockMcpClient.executeTool.mockResolvedValue({ success: true });

    const state = makeState({
      contactData: {
        crmId: "crm-1",
        name: "Ivan",
        email: "ivan@test.com",
        phone: "+123",
        notes: "Some notes",
      },
    });
    const config = {
      configurable: {
        crmConfig: {
          provider: "twenty",
          lookupBy: "email",
          writeFields: ["name", "notes"],
        },
        mcpClient: mockMcpClient,
      },
    };

    await saveContextNode(state, config as any);

    expect(mockMcpClient.executeTool).toHaveBeenCalledWith(
      "twenty_update_person",
      { id: "crm-1", name: "Ivan", notes: "Some notes" },
    );
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
