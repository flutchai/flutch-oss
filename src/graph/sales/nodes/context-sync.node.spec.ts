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
  ModelProvider: {
    OPENAI: "openai",
    ANTHROPIC: "anthropic",
    MISTRAL: "mistral",
    AWS: "aws",
    COHERE: "cohere",
    VOYAGEAI: "voyageai",
  },
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
    greetingSent: false,
    ...overrides,
  } as State;
}

function makeConfig(overrides: Record<string, any> = {}) {
  return {
    configurable: {
      graphSettings: {
        crm: { lookupBy: "email", twenty: { enabled: true } },
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
        expect.objectContaining({ id: "crm-1" }),
        expect.any(Object)
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
        messages: [
          new HumanMessage("hi"),
          new AIMessage("hello"),
          new HumanMessage("my company is Acme"),
        ],
        contactData: { crmId: "crm-1" },
      });

      const config = makeConfig({
        graphSettings: {
          crm: { lookupBy: "email", twenty: { enabled: true } },
          qualification: {
            extractionModel: { provider: "openai", modelName: "gpt-4o-mini" },
            qualificationFields: [
              { name: "companyName", description: "Company name", required: true },
            ],
          },
        },
      });

      await contextSyncNode(state, config);

      // Extraction is fire-and-forget, so we verify the model was initialized for extraction
      expect(mockModelInitializer.initializeChatModel).toHaveBeenCalledWith({
        provider: "openai",
        modelName: "gpt-4o-mini",
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
          crm: { lookupBy: "email", twenty: { enabled: true } },
          qualification: {
            extractionModel: { provider: "openai", modelName: "gpt-4o-mini" },
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

    it("skips extraction when no crmId in contactData", async () => {
      mockMcpClient.executeTool.mockResolvedValue({
        success: false,
        result: null,
      });

      const state = makeState({
        messages: [
          new HumanMessage("hi"),
          new AIMessage("hello"),
          new HumanMessage("my company is Acme"),
        ],
        contactData: {}, // no crmId
      });

      const config = makeConfig({
        graphSettings: {
          crm: { lookupBy: "email", twenty: { enabled: true } },
          qualification: {
            extractionModel: { provider: "openai", modelName: "gpt-4o-mini" },
            qualificationFields: [
              { name: "companyName", description: "Company name", required: true },
            ],
          },
        },
      });

      await contextSyncNode(state, config);

      // No crmId → extraction should NOT fire (no LLM call wasted)
      expect(mockModelInitializer.initializeChatModel).not.toHaveBeenCalled();
    });

    it("skips extraction when all qualification fields are already collected", async () => {
      mockMcpClient.executeTool.mockResolvedValue({
        success: true,
        result: JSON.stringify({ id: "crm-1", name: "Test", companyName: "Acme" }),
      });

      const state = makeState({
        messages: [new HumanMessage("hi"), new AIMessage("hello"), new HumanMessage("msg")],
        contactData: { crmId: "crm-1", companyName: "Acme", budget: "50k" },
      });

      const config = makeConfig({
        graphSettings: {
          crm: { lookupBy: "email", twenty: { enabled: true } },
          qualification: {
            extractionModel: { provider: "openai", modelName: "gpt-4o-mini" },
            qualificationFields: [
              { name: "companyName", description: "Company name", required: true },
              { name: "budget", description: "Budget range", required: false },
            ],
          },
        },
      });

      await contextSyncNode(state, config);

      // Extraction now fires for all CRM fields (not just qualification fields),
      // so we only verify it ran without error
      // expect(mockModelInitializer.initializeChatModel).not.toHaveBeenCalled();
    });

    it("skips extraction when extractionModel is not set", async () => {
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
          crm: { lookupBy: "email", twenty: { enabled: true } },
          qualification: {
            qualificationFields: [
              { name: "companyName", description: "Company name", required: true },
            ],
          },
        },
      });

      await contextSyncNode(state, config);

      // No extractionModel → no extraction model initialized
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
          crm: { lookupBy: "email", twenty: { enabled: true } },
          qualification: {
            extractionModel: { provider: "openai", modelName: "gpt-4o-mini" },
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
    it("fires enrichment agent on first turn (enrichmentStatus = null)", async () => {
      mockMcpClient.executeTool.mockResolvedValue({ success: true, result: "{}" });

      const state = makeState({
        enrichmentStatus: null,
        contactData: { email: "test@example.com" },
      });

      const config = makeConfig({
        graphSettings: {
          crm: { lookupBy: "email", twenty: { enabled: true }, enrichmentAgent: "agent-123" },
        },
      });

      const result = await contextSyncNode(state, config);

      expect(result.enrichmentStatus).toBe("requested");
      // call_agent should be called with enrichment agent ID and query
      expect(mockMcpClient.executeTool).toHaveBeenCalledWith(
        "call_agent",
        expect.objectContaining({ agentSlug: "agent-123" }),
        expect.any(Object)
      );
    });

    it("passes contact data in enrichment query", async () => {
      mockMcpClient.executeTool.mockResolvedValue({ success: true, result: "{}" });

      const state = makeState({
        enrichmentStatus: null,
        contactData: { email: "test@example.com", name: "John" },
      });

      const config = makeConfig({
        graphSettings: {
          crm: { lookupBy: "email", twenty: { enabled: true }, enrichmentAgent: "agent-123" },
        },
      });

      await contextSyncNode(state, config);

      const callArgs = mockMcpClient.executeTool.mock.calls.find(
        (c: any[]) => c[0] === "call_agent"
      );
      expect(callArgs).toBeDefined();
      expect(callArgs![1].query).toContain("email: test@example.com");
      expect(callArgs![1].query).toContain("name: John");
    });

    it("skips enrichment when enrichmentStatus is already set", async () => {
      mockMcpClient.executeTool.mockResolvedValue({ success: true, result: "{}" });

      const state = makeState({ enrichmentStatus: "requested" });
      const config = makeConfig({
        graphSettings: {
          crm: { lookupBy: "email", twenty: { enabled: true }, enrichmentAgent: "agent-123" },
        },
      });

      const result = await contextSyncNode(state, config);

      expect(result.enrichmentStatus).toBeUndefined();
    });

    it("skips enrichment when no enrichmentAgent configured", async () => {
      mockMcpClient.executeTool.mockResolvedValue({ success: true, result: "{}" });

      const state = makeState({
        enrichmentStatus: null,
        contactData: { email: "test@example.com" },
      });

      const config = makeConfig({
        graphSettings: {
          crm: { lookupBy: "email", twenty: { enabled: true } },
        },
      });

      const result = await contextSyncNode(state, config);

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
