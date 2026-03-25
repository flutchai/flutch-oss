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

  it("returns raw CRM data with crmId (twenty)", async () => {
    mockMcpClient.executeTool.mockResolvedValue({
      success: true,
      result: [
        {
          id: "crm-1",
          name: { firstName: "Ivan", lastName: "Petrov" },
          emails: { primaryEmail: "ivan@test.com" },
          phones: { primaryPhoneNumber: "" },
          jobTitle: "Engineer",
          city: "Moscow",
          createdAt: "2026-01-01",
        },
      ],
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

    // Should use twenty_list_people with filter
    expect(mockMcpClient.executeTool).toHaveBeenCalledWith("twenty_list_people", {
      filter: JSON.stringify({ emails: { primaryEmail: { eq: "ivan@test.com" } } }),
      limit: 1,
    });
    // Raw CRM structure preserved, system fields filtered
    expect(result.contactData?.crmId).toBe("crm-1");
    expect(result.contactData?.name).toEqual({ firstName: "Ivan", lastName: "Petrov" });
    expect(result.contactData?.emails).toEqual({ primaryEmail: "ivan@test.com" });
    expect(result.contactData?.jobTitle).toBe("Engineer");
    // System fields filtered
    expect(result.contactData?.createdAt).toBeUndefined();
  });

  it("parses text-based MCP result", async () => {
    mockMcpClient.executeTool.mockResolvedValue({
      success: true,
      result:
        'Found 1 person\n\n[{"id": "crm-1", "name": {"firstName": "Ivan", "lastName": ""}, "emails": {"primaryEmail": "ivan@test.com"}, "jobTitle": "CEO", "city": "Moscow"}]',
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

    expect(result.contactData?.crmId).toBe("crm-1");
    expect(result.contactData?.name).toEqual({ firstName: "Ivan", lastName: "" });
    expect(result.contactData?.jobTitle).toBe("CEO");
    expect(result.contactData?.city).toBe("Moscow");
  });

  it("extracts lookup value from first message metadata", async () => {
    mockMcpClient.executeTool.mockResolvedValue({
      success: true,
      result: [
        {
          id: "crm-2",
          name: { firstName: "Maria", lastName: "" },
          emails: { primaryEmail: "maria@co.com" },
        },
      ],
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
      "twenty_list_people",
      expect.objectContaining({
        filter: expect.any(String),
        limit: 1,
      })
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

  it("falls back to metadata when CRM returns empty array", async () => {
    mockMcpClient.executeTool.mockResolvedValue({
      success: true,
      result: "Found 0 people\n\n[]",
    });

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

  it("passes _credentials from toolConfigs", async () => {
    mockMcpClient.executeTool.mockResolvedValue({
      success: true,
      result: [{ id: "crm-1", name: { firstName: "Ivan" }, emails: { primaryEmail: "" } }],
    });

    const state = makeState({ messages: [new HumanMessage("hi")] });
    const config = {
      configurable: {
        crmConfig: { provider: "twenty", lookupBy: "email" },
        mcpClient: mockMcpClient,
        context: { email: "ivan@test.com" },
        toolConfigs: {
          twenty_list_people: {
            _credentials: { apiKey: "test-key", baseUrl: "http://crm.local" },
          },
        },
      },
    };

    await loadContextNode(state, config as any);

    expect(mockMcpClient.executeTool).toHaveBeenCalledWith(
      "twenty_list_people",
      expect.objectContaining({
        _credentials: { apiKey: "test-key", baseUrl: "http://crm.local" },
      })
    );
  });

  it("does not pass _credentials when toolConfigs has no entry", async () => {
    mockMcpClient.executeTool.mockResolvedValue({
      success: true,
      result: [{ id: "crm-1", name: { firstName: "Ivan" }, emails: { primaryEmail: "" } }],
    });

    const state = makeState({ messages: [new HumanMessage("hi")] });
    const config = {
      configurable: {
        crmConfig: { provider: "twenty", lookupBy: "email" },
        mcpClient: mockMcpClient,
        context: { email: "ivan@test.com" },
      },
    };

    await loadContextNode(state, config as any);

    const callArgs = mockMcpClient.executeTool.mock.calls[0][1];
    expect(callArgs._credentials).toBeUndefined();
  });

  it("uses zoho tool name and simple lookup args for zoho", async () => {
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

    // Zoho uses simple lookup args (not filter)
    expect(mockMcpClient.executeTool).toHaveBeenCalledWith("zoho_search_contacts", {
      email: "ivan@zoho.com",
    });
  });
});
