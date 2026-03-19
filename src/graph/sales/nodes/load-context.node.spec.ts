import { loadContextNode } from "./load-context.node";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { SalesState } from "../sales.annotations";

jest.mock("@flutchai/flutch-sdk", () => ({
  McpRuntimeHttpClient: jest.fn(),
}));

type State = typeof SalesState.State;

function makeState(messages: any[] = []): State {
  return {
    messages,
    text: "",
    contactData: {},
    attachments: {},
  };
}

const crmConfig = {
  provider: "twenty" as const,
  lookupBy: "email" as const,
};

function makeMcpClient(result: any) {
  return { executeTool: jest.fn().mockResolvedValue(result) };
}

function makeHumanMessageWithMeta(meta: Record<string, any>) {
  const msg = new HumanMessage("Hi");
  (msg as any).additional_kwargs = { metadata: meta };
  return msg;
}

describe("loadContextNode", () => {
  it("returns {} when no crmConfig in configurable", async () => {
    const state = makeState();
    const result = await loadContextNode(state, { configurable: {} } as any);
    expect(result).toEqual({});
  });

  it("returns {} when no mcpClient in configurable", async () => {
    const state = makeState();
    const result = await loadContextNode(state, {
      configurable: { crmConfig },
    } as any);
    expect(result).toEqual({});
  });

  it("returns {} when no lookup value found (no messages, no context)", async () => {
    const state = makeState([]);
    const result = await loadContextNode(state, {
      configurable: { crmConfig, mcpClient: makeMcpClient(null) },
    } as any);
    expect(result).toEqual({});
  });

  it("extracts lookup value from context", async () => {
    const mcpClient = makeMcpClient({ success: true, result: { id: "crm-1", name: "Иван" } });
    const state = makeState([]);
    await loadContextNode(state, {
      configurable: {
        crmConfig,
        mcpClient,
        context: { email: "ivan@test.com" },
      },
    } as any);

    expect(mcpClient.executeTool).toHaveBeenCalledWith("twenty_find_person", {
      email: "ivan@test.com",
    });
  });

  it("extracts lookup value from first message metadata", async () => {
    const mcpClient = makeMcpClient({ success: true, result: { id: "crm-1", name: "Иван" } });
    const msg = makeHumanMessageWithMeta({ email: "meta@test.com" });
    const state = makeState([msg]);

    await loadContextNode(state, {
      configurable: { crmConfig, mcpClient },
    } as any);

    expect(mcpClient.executeTool).toHaveBeenCalledWith("twenty_find_person", {
      email: "meta@test.com",
    });
  });

  it("returns filtered contactData with crmId when CRM find succeeds", async () => {
    const mcpClient = makeMcpClient({
      success: true,
      result: {
        id: "crm-42",
        name: "Иван",
        email: "ivan@test.com",
        createdAt: "2024-01-01",
        __typename: "Person",
      },
    });
    const msg = makeHumanMessageWithMeta({ email: "ivan@test.com" });
    const state = makeState([msg]);

    const result = await loadContextNode(state, {
      configurable: { crmConfig, mcpClient },
    } as any);

    expect(result.contactData).toEqual({
      crmId: "crm-42",
      name: "Иван",
      email: "ivan@test.com",
      // createdAt and __typename filtered out
    });
  });

  it("returns metadata-based contactData when CRM find returns not found", async () => {
    const mcpClient = makeMcpClient({ success: false, result: null });
    const msg = makeHumanMessageWithMeta({
      email: "new@test.com",
      name: "Новый",
      calculatorData: { area: 200 },
    });
    const state = makeState([msg]);

    const result = await loadContextNode(state, {
      configurable: { crmConfig, mcpClient },
    } as any);

    // calculatorData should be stripped out, email and name kept
    expect(result.contactData).toEqual({ email: "new@test.com", name: "Новый" });
    expect(result.contactData).not.toHaveProperty("calculatorData");
  });

  it("returns metadata-based contactData when CRM find throws", async () => {
    const mcpClient = {
      executeTool: jest.fn().mockRejectedValue(new Error("CRM unreachable")),
    };
    const msg = makeHumanMessageWithMeta({ email: "ivan@test.com", name: "Иван" });
    const state = makeState([msg]);

    const result = await loadContextNode(state, {
      configurable: { crmConfig, mcpClient },
    } as any);

    expect(result.contactData).toEqual({ email: "ivan@test.com", name: "Иван" });
  });

  it("uses phone for lookup when crmConfig.lookupBy is phone", async () => {
    const phoneCrmConfig = { provider: "zoho" as const, lookupBy: "phone" as const };
    const mcpClient = makeMcpClient({ success: true, result: { id: "z-1", Last_Name: "Петров" } });
    const msg = makeHumanMessageWithMeta({ phone: "+7999123" });
    const state = makeState([msg]);

    await loadContextNode(state, {
      configurable: { crmConfig: phoneCrmConfig, mcpClient },
    } as any);

    expect(mcpClient.executeTool).toHaveBeenCalledWith("zoho_search_contacts", {
      phone: "+7999123",
    });
  });

  it("returns {} when contactData from metadata is empty (no metadata at all)", async () => {
    const mcpClient = makeMcpClient({ success: false, result: null });
    const msg = new HumanMessage("Hi with no metadata");
    const state = makeState([msg]);
    // No lookup value found (no email in message or context) → returns {}
    const result = await loadContextNode(state, {
      configurable: { crmConfig, mcpClient },
    } as any);
    expect(result).toEqual({});
  });

  it("context lookup takes priority over message metadata", async () => {
    const mcpClient = makeMcpClient({ success: false, result: null });
    const msg = makeHumanMessageWithMeta({ email: "meta@test.com" });
    const state = makeState([msg]);

    await loadContextNode(state, {
      configurable: {
        crmConfig,
        mcpClient,
        context: { email: "context@test.com" },
      },
    } as any);

    expect(mcpClient.executeTool).toHaveBeenCalledWith("twenty_find_person", {
      email: "context@test.com",
    });
  });

  it("skips lookup when first message is not HumanMessage and no context", async () => {
    const mcpClient = makeMcpClient({ success: false, result: null });
    const msg = new AIMessage("Hello");
    const state = makeState([msg]);

    const result = await loadContextNode(state, {
      configurable: { crmConfig, mcpClient },
    } as any);

    expect(mcpClient.executeTool).not.toHaveBeenCalled();
    expect(result).toEqual({});
  });
});
