import { ExtractionService } from "./extraction.service";
import { IQualificationTopic, ITopicEntry } from "./sales.types";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

const mockTopics: IQualificationTopic[] = [
  {
    name: "budget",
    label: "Budget",
    description: "Client budget range",
    extractionHint: "Look for money amounts or ranges",
    required: true,
  },
  {
    name: "timeline",
    label: "Timeline",
    description: "Project timeline",
    extractionHint: "Look for dates or deadlines",
    required: false,
  },
];

function makeModel(responseContent: string): BaseChatModel {
  return {
    invoke: jest.fn().mockResolvedValue({ content: responseContent }),
  } as unknown as BaseChatModel;
}

describe("ExtractionService", () => {
  let service: ExtractionService;

  beforeEach(() => {
    service = new ExtractionService();
  });

  describe("buildJsonSchema", () => {
    it("builds schema with all topic names as required", () => {
      const schema = service.buildJsonSchema(mockTopics);
      expect(schema.type).toBe("object");
      expect(schema.required).toEqual(["budget", "timeline"]);
    });

    it("includes status enum and details for each topic property", () => {
      const schema = service.buildJsonSchema(mockTopics);
      const budget = schema.properties.budget;
      expect(budget.type).toBe("object");
      expect(budget.properties.status.enum).toEqual(["not_explored", "partially", "explored"]);
      expect(budget.properties.details).toBeDefined();
      expect(budget.required).toEqual(["status"]);
    });

    it("includes label and extractionHint in description", () => {
      const schema = service.buildJsonSchema(mockTopics);
      expect(schema.properties.budget.description).toContain("Budget");
      expect(schema.properties.budget.description).toContain("Look for money amounts");
    });

    it("returns empty required array for empty topics", () => {
      const schema = service.buildJsonSchema([]);
      expect(schema.required).toEqual([]);
      expect(schema.properties).toEqual({});
    });
  });

  describe("extract", () => {
    const messages = [new HumanMessage("My budget is around $50k")];
    const currentMap: Record<string, ITopicEntry> = {
      budget: { status: "not_explored" },
      timeline: { status: "not_explored" },
    };

    it("returns updated topicsMap when model responds with valid JSON", async () => {
      const responseJson = JSON.stringify({
        budget: { status: "explored", details: "Client has $50k budget" },
        timeline: { status: "not_explored", details: null },
      });
      const model = makeModel(responseJson);

      const result = await service.extract(model, messages, mockTopics, currentMap);

      expect(result.budget.status).toBe("explored");
      expect(result.budget.details).toBe("Client has $50k budget");
      expect(result.timeline.status).toBe("not_explored");
    });

    it("returns updated topicsMap when model responds with JSON in markdown code block", async () => {
      const responseJson = `Here is the analysis:\n\`\`\`json\n${JSON.stringify({
        budget: { status: "partially", details: "Mentioned some budget" },
        timeline: { status: "not_explored" },
      })}\n\`\`\``;
      const model = makeModel(responseJson);

      const result = await service.extract(model, messages, mockTopics, currentMap);

      expect(result.budget.status).toBe("partially");
    });

    it("returns currentTopicsMap when model response is not parseable", async () => {
      const model = makeModel("Sorry, I cannot analyze this.");
      const result = await service.extract(model, messages, mockTopics, currentMap);
      expect(result).toEqual(currentMap);
    });

    it("returns currentTopicsMap when model throws", async () => {
      const model = {
        invoke: jest.fn().mockRejectedValue(new Error("Model error")),
      } as unknown as BaseChatModel;

      const result = await service.extract(model, messages, mockTopics, currentMap);
      expect(result).toEqual(currentMap);
    });

    it("handles non-string content by stringifying it (null content → fallback)", async () => {
      const model = {
        invoke: jest.fn().mockResolvedValue({
          content: null,
        }),
      } as unknown as BaseChatModel;

      const result = await service.extract(model, messages, mockTopics, currentMap);
      // null stringifies to "null" which parses as null → falsy → fallback to currentMap
      expect(result).toEqual(currentMap);
    });
  });

  describe("mergeTopicsMap (via extract)", () => {
    it("never downgrades explored status", async () => {
      const exploredMap: Record<string, ITopicEntry> = {
        budget: { status: "explored", details: "Already explored" },
        timeline: { status: "not_explored" },
      };
      // Model tries to downgrade budget to "partially"
      const responseJson = JSON.stringify({
        budget: { status: "partially", details: "New partial info" },
        timeline: { status: "explored", details: "Q3 deadline" },
      });
      const model = makeModel(responseJson);

      const result = await service.extract(model, [], mockTopics, exploredMap);

      // budget should stay explored
      expect(result.budget.status).toBe("explored");
      // timeline can be upgraded
      expect(result.timeline.status).toBe("explored");
    });

    it("never downgrades partially to not_explored", async () => {
      const partialMap: Record<string, ITopicEntry> = {
        budget: { status: "partially", details: "Some info" },
        timeline: { status: "not_explored" },
      };
      const responseJson = JSON.stringify({
        budget: { status: "not_explored" },
        timeline: { status: "not_explored" },
      });
      const model = makeModel(responseJson);

      const result = await service.extract(model, [], mockTopics, partialMap);
      expect(result.budget.status).toBe("partially");
    });

    it("adds details from new extraction to entry that had no details", async () => {
      const mapNoDetails: Record<string, ITopicEntry> = {
        budget: { status: "explored" },
        timeline: { status: "not_explored" },
      };
      // Model tries to downgrade but provides details
      const responseJson = JSON.stringify({
        budget: { status: "partially", details: "Budget is $50k" },
        timeline: { status: "not_explored" },
      });
      const model = makeModel(responseJson);

      const result = await service.extract(model, [], mockTopics, mapNoDetails);
      // Status stays explored, but details get added
      expect(result.budget.status).toBe("explored");
      expect(result.budget.details).toBe("Budget is $50k");
    });

    it("ignores non-object values in extracted response", async () => {
      const responseJson = JSON.stringify({
        budget: "invalid",
        timeline: null,
      });
      const model = makeModel(responseJson);
      const currentMap: Record<string, ITopicEntry> = {
        budget: { status: "not_explored" },
        timeline: { status: "partially" },
      };

      const result = await service.extract(model, [], mockTopics, currentMap);
      expect(result.budget.status).toBe("not_explored");
      expect(result.timeline.status).toBe("partially");
    });
  });
});
