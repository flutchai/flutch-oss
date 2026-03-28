import { SalesGraphBuilder } from "../builder";
import { HumanMessage } from "@langchain/core/messages";
import { SalesState } from "../sales.annotations";

const mockMcpClient = {
  getTools: jest.fn().mockResolvedValue([]),
  executeTool: jest.fn(),
};

jest.mock("@flutchai/flutch-sdk", () => ({
  AbstractGraphBuilder: class {
    constructor() {}
  },
  McpRuntimeHttpClient: jest.fn().mockImplementation(() => mockMcpClient),
  ModelInitializer: jest.fn().mockImplementation(() => ({
    initializeChatModel: jest.fn(),
  })),
  executeToolWithAttachments: jest.fn(),
  IGraphAttachment: {},
}));

jest.mock("../../../modules/langfuse/langfuse.service", () => ({
  LangfuseService: jest.fn(),
}));

const mockModelInitializer = {
  initializeChatModel: jest.fn(),
};

type State = typeof SalesState.State;

function makeState(overrides: Partial<State> = {}): State {
  return {
    messages: [new HumanMessage("hello")],
    text: "",
    contactData: {},
    attachments: {},
    currentStep: 0,
    steps: [],
    qualificationData: {},
    leadScore: null,
    enrichmentStatus: null,
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
    builder = createBuilder();
    contextSyncNode = getContextSyncNode(builder);
  });

  describe("CRM load", () => {
    it("loads contact from CRM when provider is configured", async () => {
      mockMcpClient.executeTool.mockResolvedValue({
        success: true,
        result: JSON.stringify([{ id: "crm-1", name: "Test User", email: "test@example.com" }]),
      });

      const state = makeState();
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

      const state = makeState();
      const result = await contextSyncNode(state, makeConfig());

      // No contact found → contactData not updated (preserves existing state)
      expect(result.contactData).toBeUndefined();
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

      const state = makeState();
      const result = await contextSyncNode(state, makeConfig());

      // CRM error → does not crash, contactData not updated
      expect(result.contactData).toBeUndefined();
    });
  });

  describe("CRM save (qualificationData)", () => {
    it("saves qualificationData to CRM when crmId exists", async () => {
      // First call: loadContact refresh
      mockMcpClient.executeTool
        .mockResolvedValueOnce({
          success: true,
          result: JSON.stringify({ id: "crm-1", name: "Test" }),
        })
        // Second call: update
        .mockResolvedValueOnce({ success: true });

      const state = makeState({
        contactData: { crmId: "crm-1" },
        qualificationData: { greeting: { reason: "Need CRM" } },
      });

      await contextSyncNode(state, makeConfig());

      expect(mockMcpClient.executeTool).toHaveBeenCalledWith(
        "twenty_update_person",
        expect.objectContaining({ id: "crm-1", reason: "Need CRM" })
      );
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
          crm: { provider: "twenty", lookupBy: "email" },
          enrichmentTools: ["clearbit_lookup", { name: "research_agent", enabled: true }],
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
          crm: { provider: "twenty", lookupBy: "email" },
          enrichmentTools: [{ name: "clearbit_lookup", enabled: true }],
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
          crm: { provider: "twenty", lookupBy: "email" },
          enrichmentTools: [
            { name: "disabled_tool", enabled: false },
          ],
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
