import { SalesGraphBuilder } from "../builder";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { SalesState } from "../sales.annotations";

const mockMcpClient = {
  getTools: jest.fn().mockResolvedValue([]),
  executeTool: jest.fn(),
};

const mockStructuredModel = {
  invoke: jest.fn().mockResolvedValue({ companyName: "Acme", budget: null }),
  withStructuredOutput: jest.fn().mockReturnThis(),
};

const mockModelInitializer = {
  initializeChatModel: jest.fn().mockResolvedValue(mockStructuredModel),
};

jest.mock("@flutchai/flutch-sdk", () => ({
  AbstractGraphBuilder: class {
    constructor() {}
  },
  McpRuntimeHttpClient: jest.fn().mockImplementation(() => mockMcpClient),
  ModelInitializer: jest.fn().mockImplementation(() => mockModelInitializer),
  executeToolWithAttachments: jest.fn(),
  IGraphAttachment: {},
}));

jest.mock("../../../modules/langfuse/langfuse.service", () => ({
  LangfuseService: jest.fn(),
}));

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

function makeConfig(overrides: Record<string, any> = {}) {
  return {
    configurable: {
      graphSettings: {
        crm: { provider: "twenty", lookupBy: "email" },
        ...overrides.graphSettings,
      },
      context: { email: "test@example.com", ...overrides.context },
      ...overrides,
    },
  } as any;
}

function createBuilder(): SalesGraphBuilder {
  return new SalesGraphBuilder(null, null, mockMcpClient as any, mockModelInitializer as any);
}

function getContextSyncNode(builder: SalesGraphBuilder) {
  return (builder as any).contextSyncNode.bind(builder);
}

describe("contextSyncNode", () => {
  let builder: SalesGraphBuilder;
  let contextSyncNode: (state: State, config: any) => Promise<Partial<State>>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStructuredModel.invoke.mockResolvedValue({ companyName: "Acme", budget: null });
    mockStructuredModel.withStructuredOutput.mockReturnThis();
    mockModelInitializer.initializeChatModel.mockResolvedValue(mockStructuredModel);
    builder = createBuilder();
    contextSyncNode = getContextSyncNode(builder);
  });

  describe("CRM load", () => {
    it("loads contact from CRM when provider is configured", async () => {
      mockMcpClient.executeTool.mockResolvedValue({
        success: true,
        result: JSON.stringify([{ id: "crm-1", name: "Test User", email: "test@example.com" }]),
      });

      const msgWithMeta = new HumanMessage({
        content: "hello",
        additional_kwargs: { metadata: { email: "test@example.com" } },
      });
      const state = makeState({ messages: [msgWithMeta] });
      const result = await contextSyncNode(state, makeConfig());

      expect(result.contactData).toBeDefined();
      expect(result.contactData?.crmId).toBe("crm-1");
      expect(result.contactData?.name).toBe("Test User");
    });

    it("returns empty when CRM lookup finds no contact", async () => {
      mockMcpClient.executeTool.mockResolvedValue({
        success: false,
        result: null,
      });

      const msgWithMeta = new HumanMessage({
        content: "hello",
        additional_kwargs: { metadata: { email: "test@example.com" } },
      });
      const state = makeState({ messages: [msgWithMeta] });
      const result = await contextSyncNode(state, makeConfig());

      // No contact found → falls back to extractContactFromMetadata
      expect(result.contactData).toBeDefined();
    });

    it("refreshes by crmId when already known", async () => {
      mockMcpClient.executeTool.mockResolvedValue({
        success: true,
        result: JSON.stringify({ id: "crm-1", name: "Updated Name" }),
      });

      const state = makeState({ contactData: { crmId: "crm-1" } });
      const result = await contextSyncNode(state, makeConfig());

      expect(mockMcpClient.executeTool).toHaveBeenCalledWith(
        "twenty_get_person",
        expect.objectContaining({ id: "crm-1" })
      );
    });

    it("handles CRM lookup errors gracefully", async () => {
      mockMcpClient.executeTool.mockRejectedValue(new Error("CRM down"));

      const msgWithMeta = new HumanMessage({
        content: "hello",
        additional_kwargs: { metadata: { email: "test@example.com" } },
      });
      const state = makeState({ messages: [msgWithMeta] });
      const result = await contextSyncNode(state, makeConfig());

      // CRM error → falls back to metadata, does not crash
      expect(result.contactData).toBeDefined();
      expect(result.contactData?.crmId).toBeUndefined();
    });
  });

  describe("extraction (fire-and-forget)", () => {
    it("fires extraction when conditions are met", async () => {
      // CRM load returns contact
      mockMcpClient.executeTool.mockResolvedValue({
        success: true,
        result: JSON.stringify({ id: "crm-1", name: "Test" }),
      });

      const state = makeState({
        messages: [new HumanMessage("hi"), new AIMessage("hello"), new HumanMessage("my company is Acme")],
        contactData: { crmId: "crm-1" },
      });

      const config = makeConfig({
        graphSettings: {
          crm: { provider: "twenty", lookupBy: "email" },
          qualification: {
            extractionModelId: "gpt-4o-mini",
            qualificationFields: [
              { name: "companyName", description: "Company name", required: true },
            ],
          },
        },
      });

      await contextSyncNode(state, config);

      // Extraction is fire-and-forget, so we verify the model was initialized for extraction
      expect(mockModelInitializer.initializeChatModel).toHaveBeenCalledWith({
        modelId: "gpt-4o-mini",
        temperature: 0,
      });
    });

    it("skips extraction on first message (messages.length <= 1)", async () => {
      mockMcpClient.executeTool.mockResolvedValue({
        success: true,
        result: JSON.stringify({ id: "crm-1", name: "Test" }),
      });

      const state = makeState({
        messages: [new HumanMessage("hi")],
        contactData: { crmId: "crm-1" },
      });

      const config = makeConfig({
        graphSettings: {
          crm: { provider: "twenty", lookupBy: "email" },
          qualification: {
            extractionModelId: "gpt-4o-mini",
            qualificationFields: [
              { name: "companyName", description: "Company name", required: true },
            ],
          },
        },
      });

      await contextSyncNode(state, config);

      // Model should NOT be initialized for extraction on first message
      expect(mockModelInitializer.initializeChatModel).not.toHaveBeenCalled();
    });

    it("skips extraction when extractionModelId is not set", async () => {
      mockMcpClient.executeTool.mockResolvedValue({
        success: true,
        result: JSON.stringify({ id: "crm-1", name: "Test" }),
      });

      const state = makeState({
        messages: [new HumanMessage("hi"), new AIMessage("hello"), new HumanMessage("msg")],
        contactData: { crmId: "crm-1" },
      });

      const config = makeConfig({
        graphSettings: {
          crm: { provider: "twenty", lookupBy: "email" },
          qualification: {
            qualificationFields: [
              { name: "companyName", description: "Company name", required: true },
            ],
          },
        },
      });

      await contextSyncNode(state, config);

      // No extractionModelId → no extraction model initialized
      expect(mockModelInitializer.initializeChatModel).not.toHaveBeenCalled();
    });

    it("does not block context_sync when extraction errors", async () => {
      mockMcpClient.executeTool.mockResolvedValue({
        success: true,
        result: JSON.stringify({ id: "crm-1", name: "Test" }),
      });

      // Make the extraction model throw
      mockModelInitializer.initializeChatModel.mockRejectedValue(new Error("Model unavailable"));

      const state = makeState({
        messages: [new HumanMessage("hi"), new AIMessage("hello"), new HumanMessage("msg")],
        contactData: { crmId: "crm-1" },
      });

      const config = makeConfig({
        graphSettings: {
          crm: { provider: "twenty", lookupBy: "email" },
          qualification: {
            extractionModelId: "gpt-4o-mini",
            qualificationFields: [
              { name: "companyName", description: "Company name", required: true },
            ],
          },
        },
      });

      // Should NOT throw — extraction is fire-and-forget
      const result = await contextSyncNode(state, config);
      expect(result).toBeDefined();
    });
  });

  describe("enrichment", () => {
    it("fires enrichment tools on first turn (enrichmentStatus = null)", async () => {
      mockMcpClient.executeTool.mockResolvedValue({ success: true, result: "{}" });

      const state = makeState({
        enrichmentStatus: null,
        contactData: { email: "test@example.com" },
      });

      const config = makeConfig({
        graphSettings: {
          crm: { provider: "twenty", lookupBy: "email", enrichmentTools: ["clearbit_lookup", { name: "research_agent", enabled: true }] },
        },
      });

      const result = await contextSyncNode(state, config);

      expect(result.enrichmentStatus).toBe("requested");
    });

    it("skips enrichment when enrichmentStatus is already set", async () => {
      mockMcpClient.executeTool.mockResolvedValue({ success: true, result: "{}" });

      const state = makeState({ enrichmentStatus: "requested" });
      const config = makeConfig({
        graphSettings: {
          crm: { provider: "twenty", lookupBy: "email", enrichmentTools: [{ name: "clearbit_lookup", enabled: true }] },
        },
      });

      const result = await contextSyncNode(state, config);

      expect(result.enrichmentStatus).toBeUndefined();
    });

    it("filters out disabled enrichment tools", async () => {
      mockMcpClient.executeTool.mockResolvedValue({ success: true, result: "{}" });

      const state = makeState({
        enrichmentStatus: null,
        contactData: { email: "test@example.com" },
      });

      const config = makeConfig({
        graphSettings: {
          crm: {
            provider: "twenty",
            lookupBy: "email",
            enrichmentTools: [{ name: "disabled_tool", enabled: false }],
          },
        },
      });

      const result = await contextSyncNode(state, config);

      // All tools disabled → no enrichment fired
      expect(result.enrichmentStatus).toBeUndefined();
    });
  });

  describe("no CRM configured", () => {
    it("returns empty updates when no CRM provider", async () => {
      const state = makeState();
      const config = { configurable: { graphSettings: {} } } as any;

      const result = await contextSyncNode(state, config);

      expect(result).toEqual({});
      expect(mockMcpClient.executeTool).not.toHaveBeenCalled();
    });
  });
});
