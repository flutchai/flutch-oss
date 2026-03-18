import { createModel } from "./model.factory";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";

jest.mock("@langchain/openai", () => ({
  ChatOpenAI: jest.fn().mockImplementation(opts => ({ ...opts, _type: "openai" })),
}));

jest.mock("@langchain/anthropic", () => ({
  ChatAnthropic: jest.fn().mockImplementation(opts => ({ ...opts, _type: "anthropic" })),
}));

const MockChatOpenAI = ChatOpenAI as jest.MockedClass<typeof ChatOpenAI>;
const MockChatAnthropic = ChatAnthropic as jest.MockedClass<typeof ChatAnthropic>;

describe("createModel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create ChatOpenAI for gpt models", () => {
    createModel({ model: "gpt-4o-mini" });
    expect(MockChatOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ modelName: "gpt-4o-mini" })
    );
  });

  it("should create ChatAnthropic for claude models", () => {
    createModel({ model: "claude-3-5-sonnet-20241022" });
    expect(MockChatAnthropic).toHaveBeenCalledWith(
      expect.objectContaining({ modelName: "claude-3-5-sonnet-20241022" })
    );
  });

  it("should use explicit provider over inferred one", () => {
    createModel({ model: "gpt-4o", provider: "anthropic" });
    expect(MockChatAnthropic).toHaveBeenCalledWith(
      expect.objectContaining({ modelName: "gpt-4o" })
    );
  });

  it("should apply custom temperature", () => {
    createModel({ model: "gpt-4o", temperature: 0.2 });
    expect(MockChatOpenAI).toHaveBeenCalledWith(expect.objectContaining({ temperature: 0.2 }));
  });

  it("should apply custom maxTokens", () => {
    createModel({ model: "gpt-4o", maxTokens: 512 });
    expect(MockChatOpenAI).toHaveBeenCalledWith(expect.objectContaining({ maxTokens: 512 }));
  });

  it("should use default temperature 0.7 when not specified", () => {
    createModel({ model: "gpt-4o-mini" });
    expect(MockChatOpenAI).toHaveBeenCalledWith(expect.objectContaining({ temperature: 0.7 }));
  });

  it("should use default maxTokens 2048 when not specified", () => {
    createModel({ model: "gpt-4o-mini" });
    expect(MockChatOpenAI).toHaveBeenCalledWith(expect.objectContaining({ maxTokens: 2048 }));
  });

  it("should fall back to openai for unknown model prefix", () => {
    createModel({ model: "some-unknown-model" });
    expect(MockChatOpenAI).toHaveBeenCalled();
  });
});
