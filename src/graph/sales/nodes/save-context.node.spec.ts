import { saveContextNode } from "./save-context.node";
import { HumanMessage } from "@langchain/core/messages";
import { SalesState } from "../sales.annotations";

jest.mock("@flutchai/flutch-sdk", () => ({
  McpRuntimeHttpClient: jest.fn(),
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

const twentyCrmConfig = {
  provider: "twenty" as const,
  lookupBy: "email" as const,
};

function makeMcpClient() {
  return { executeTool: jest.fn().mockResolvedValue({ success: true, result: { id: "crm-1" } }) };
}

describe("saveContextNode", () => {
  it("returns {} when no crmConfig", async () => {
    const state = makeState({ contactData: { name: "Иван" } });
    const result = await saveContextNode(state, { configurable: {} } as any);
    expect(result).toEqual({});
  });

  it("returns {} when no mcpClient", async () => {
    const state = makeState({ contactData: { name: "Иван" } });
    const result = await saveContextNode(state, {
      configurable: { crmConfig: twentyCrmConfig },
    } as any);
    expect(result).toEqual({});
  });

  it("returns {} when contactData is empty", async () => {
    const state = makeState({ contactData: {} });
    const result = await saveContextNode(state, {
      configurable: { crmConfig: twentyCrmConfig, mcpClient: makeMcpClient() },
    } as any);
    expect(result).toEqual({});
  });

  it("calls update tool when crmId is present", async () => {
    const mcpClient = makeMcpClient();
    const state = makeState({
      contactData: { crmId: "crm-42", name: "Иван", email: "ivan@test.com" },
    });

    const result = await saveContextNode(state, {
      configurable: { crmConfig: twentyCrmConfig, mcpClient },
    } as any);

    expect(mcpClient.executeTool).toHaveBeenCalledWith("twenty_update_person", {
      id: "crm-42",
      name: "Иван",
      email: "ivan@test.com",
    });
    expect(result).toEqual({});
  });

  it("calls create tool and returns contactData with crmId when no crmId present", async () => {
    const mcpClient = makeMcpClient();
    const state = makeState({
      contactData: { name: "Новый", email: "new@test.com" },
    });

    const result = await saveContextNode(state, {
      configurable: { crmConfig: twentyCrmConfig, mcpClient },
    } as any);

    expect(mcpClient.executeTool).toHaveBeenCalledWith("twenty_create_person", {
      name: "Новый",
      email: "new@test.com",
    });
    expect(result.contactData).toEqual({
      name: "Новый",
      email: "new@test.com",
      crmId: "crm-1",
    });
  });

  it("returns {} when create returns no id", async () => {
    const mcpClient = {
      executeTool: jest.fn().mockResolvedValue({ success: true, result: {} }),
    };
    const state = makeState({ contactData: { name: "Новый" } });

    const result = await saveContextNode(state, {
      configurable: { crmConfig: twentyCrmConfig, mcpClient },
    } as any);

    expect(result).toEqual({});
  });

  it("filters by writeFields when configured", async () => {
    const mcpClient = makeMcpClient();
    const crmConfig = { ...twentyCrmConfig, writeFields: ["email"] };
    const state = makeState({
      contactData: { name: "Иван", email: "ivan@test.com", phone: "+7999" },
    });

    await saveContextNode(state, {
      configurable: { crmConfig, mcpClient },
    } as any);

    expect(mcpClient.executeTool).toHaveBeenCalledWith("twenty_create_person", {
      email: "ivan@test.com",
      // name and phone excluded by writeFields
    });
  });

  it("filters system fields when no writeFields configured", async () => {
    const mcpClient = makeMcpClient();
    const state = makeState({
      contactData: {
        name: "Иван",
        createdAt: "2024-01-01",
        __typename: "Person",
        avatarUrl: "http://...",
      },
    });

    await saveContextNode(state, {
      configurable: { crmConfig: twentyCrmConfig, mcpClient },
    } as any);

    expect(mcpClient.executeTool).toHaveBeenCalledWith("twenty_create_person", {
      name: "Иван",
      // system fields filtered
    });
  });

  it("returns {} when no fields to write after filtering", async () => {
    const mcpClient = makeMcpClient();
    // All fields are system fields
    const state = makeState({
      contactData: { createdAt: "2024", __typename: "Person" },
    });

    const result = await saveContextNode(state, {
      configurable: { crmConfig: twentyCrmConfig, mcpClient },
    } as any);

    expect(mcpClient.executeTool).not.toHaveBeenCalled();
    expect(result).toEqual({});
  });

  it("returns {} when writeFields config has fields not in contactData", async () => {
    const mcpClient = makeMcpClient();
    const crmConfig = { ...twentyCrmConfig, writeFields: ["phone"] };
    const state = makeState({
      contactData: { name: "Иван" }, // phone not present
    });

    const result = await saveContextNode(state, {
      configurable: { crmConfig, mcpClient },
    } as any);

    expect(mcpClient.executeTool).not.toHaveBeenCalled();
    expect(result).toEqual({});
  });

  it("returns {} when mcpClient.executeTool throws", async () => {
    const mcpClient = {
      executeTool: jest.fn().mockRejectedValue(new Error("CRM error")),
    };
    const state = makeState({
      contactData: { name: "Иван", email: "ivan@test.com" },
    });

    const result = await saveContextNode(state, {
      configurable: { crmConfig: twentyCrmConfig, mcpClient },
    } as any);

    expect(result).toEqual({});
  });

  it("uses correct tool names for zoho", async () => {
    const mcpClient = makeMcpClient();
    const zohoCrmConfig = { provider: "zoho" as const, lookupBy: "email" as const };
    const state = makeState({ contactData: { Last_Name: "Петров" } });

    await saveContextNode(state, {
      configurable: { crmConfig: zohoCrmConfig, mcpClient },
    } as any);

    expect(mcpClient.executeTool).toHaveBeenCalledWith(
      "zoho_create_contact",
      expect.any(Object),
    );
  });

  it("calls update (not create) when crmId is present, passing id", async () => {
    const mcpClient = { executeTool: jest.fn().mockResolvedValue({ success: true }) };
    const state = makeState({
      contactData: { crmId: "z-99", Last_Name: "Петров" },
    });

    await saveContextNode(state, {
      configurable: {
        crmConfig: { provider: "zoho" as const, lookupBy: "email" as const },
        mcpClient,
      },
    } as any);

    expect(mcpClient.executeTool).toHaveBeenCalledWith("zoho_update_contact", {
      id: "z-99",
      Last_Name: "Петров",
    });
  });
});
