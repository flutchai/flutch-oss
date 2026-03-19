import { generateNode, shouldUseTools } from "./generate.node";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
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

const mockAiResponse = new AIMessage({ content: "Sales response", tool_calls: [] });

const mockModel = {
  invoke: jest.fn().mockResolvedValue(mockAiResponse),
};

describe("generateNode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockModel.invoke.mockResolvedValue(mockAiResponse);
  });

  it("throws when salesModel is not in config", async () => {
    const state = makeState();
    await expect(generateNode(state, { configurable: {} } as any)).rejects.toThrow(
      "GenerateNode: salesModel not found in config.configurable",
    );
  });

  it("returns messages and text", async () => {
    const state = makeState();
    const result = await generateNode(state, {
      configurable: { salesModel: mockModel },
    } as any);

    expect(result.messages).toEqual([mockAiResponse]);
    expect(result.text).toBe("Sales response");
  });

  it("text is empty string when response content is not string", async () => {
    mockModel.invoke.mockResolvedValue(new AIMessage({ content: [{ type: "text", text: "x" }] }));
    const state = makeState();
    const result = await generateNode(state, {
      configurable: { salesModel: mockModel },
    } as any);

    expect(result.text).toBe("");
  });

  it("prepends SystemMessage when systemPrompt is in config", async () => {
    const state = makeState();
    await generateNode(state, {
      configurable: { salesModel: mockModel, systemPrompt: "You are a sales agent." },
    } as any);

    const [firstMsg] = mockModel.invoke.mock.calls[0][0];
    expect(firstMsg).toBeInstanceOf(SystemMessage);
    expect((firstMsg as SystemMessage).content).toBe("You are a sales agent.");
  });

  it("does not prepend SystemMessage when systemPrompt is absent", async () => {
    const state = makeState();
    await generateNode(state, {
      configurable: { salesModel: mockModel },
    } as any);

    const [firstMsg] = mockModel.invoke.mock.calls[0][0];
    expect(firstMsg).toBeInstanceOf(HumanMessage);
  });

  it("appends contactData to system prompt when contactData has fields", async () => {
    const state = makeState({
      contactData: { name: "Иван", email: "ivan@test.com" },
    });
    await generateNode(state, {
      configurable: {
        salesModel: mockModel,
        systemPrompt: "Base prompt.",
      },
    } as any);

    const [firstMsg] = mockModel.invoke.mock.calls[0][0];
    const content = (firstMsg as SystemMessage).content as string;
    expect(content).toContain("Base prompt.");
    expect(content).toContain("── About the customer ──");
    expect(content).toContain("name: Иван");
    expect(content).toContain("email: ivan@test.com");
  });

  it("does not append contact section when contactData is empty", async () => {
    const state = makeState({ contactData: {} });
    await generateNode(state, {
      configurable: { salesModel: mockModel, systemPrompt: "Base prompt." },
    } as any);

    const [firstMsg] = mockModel.invoke.mock.calls[0][0];
    const content = (firstMsg as SystemMessage).content as string;
    expect(content).toBe("Base prompt.");
  });

  it("does not append contact section when only crmId in contactData", async () => {
    const state = makeState({ contactData: { crmId: "crm-1" } });
    await generateNode(state, {
      configurable: { salesModel: mockModel, systemPrompt: "Base prompt." },
    } as any);

    const [firstMsg] = mockModel.invoke.mock.calls[0][0];
    const content = (firstMsg as SystemMessage).content as string;
    expect(content).toBe("Base prompt.");
  });

  it("filters out null/empty contact fields from prompt", async () => {
    const state = makeState({
      contactData: { name: "Иван", email: null, phone: "" },
    });
    await generateNode(state, {
      configurable: { salesModel: mockModel, systemPrompt: "Prompt." },
    } as any);

    const [firstMsg] = mockModel.invoke.mock.calls[0][0];
    const content = (firstMsg as SystemMessage).content as string;
    expect(content).toContain("name: Иван");
    expect(content).not.toContain("email");
    expect(content).not.toContain("phone");
  });

  it("includes all state messages in model call", async () => {
    const msgs = [new HumanMessage("q1"), new AIMessage("a1"), new HumanMessage("q2")];
    const state = makeState({ messages: msgs });
    await generateNode(state, {
      configurable: { salesModel: mockModel },
    } as any);

    const passed = mockModel.invoke.mock.calls[0][0];
    expect(passed).toHaveLength(3);
  });

  it("serializes object contact fields as JSON", async () => {
    const state = makeState({
      contactData: { preferences: { roofType: "metal" } },
    });
    await generateNode(state, {
      configurable: { salesModel: mockModel, systemPrompt: "Prompt." },
    } as any);

    const [firstMsg] = mockModel.invoke.mock.calls[0][0];
    const content = (firstMsg as SystemMessage).content as string;
    expect(content).toContain('{"roofType":"metal"}');
  });
});

describe("shouldUseTools", () => {
  it("returns 'save_context' when messages is empty", () => {
    const state = makeState({ messages: [] });
    expect(shouldUseTools(state)).toBe("save_context");
  });

  it("returns 'save_context' when last message has no tool calls", () => {
    const state = makeState({
      messages: [new AIMessage({ content: "response", tool_calls: [] })],
    });
    expect(shouldUseTools(state)).toBe("save_context");
  });

  it("returns 'exec_tools' when last message has tool calls", () => {
    const aiMsg = new AIMessage({ content: "" });
    (aiMsg as any).tool_calls = [{ id: "tc1", name: "roof_calculator", args: {} }];
    const state = makeState({ messages: [aiMsg] });
    expect(shouldUseTools(state)).toBe("exec_tools");
  });
});
