import { Injectable, Logger } from "@nestjs/common";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import { IQualificationTopic, ITopicEntry } from "./sales.types";

const EXTRACTION_SYSTEM_PROMPT = `You are an analytical assistant. Analyze the conversation and determine the status of each topic.

Rules:
- "not_explored" — the topic has NOT been discussed at all
- "partially" — the topic was touched on but not fully explored
- "explored" — the topic was thoroughly discussed, the customer provided specific details
- For "details" — briefly note what exactly was learned (1-2 sentences). Only facts from the conversation.
- Do NOT make assumptions. If the topic was not discussed — mark it as "not_explored".
- Respond ONLY with valid JSON matching the schema.`;

@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);

  buildJsonSchema(topics: IQualificationTopic[]): Record<string, any> {
    const properties: Record<string, any> = {};
    for (const topic of topics) {
      properties[topic.name] = {
        type: "object",
        description: `${topic.label}. Extraction hint: ${topic.extractionHint}`,
        properties: {
          status: {
            type: "string",
            enum: ["not_explored", "partially", "explored"],
          },
          details: {
            type: ["string", "null"],
            description: "What was learned about this topic. Null if not explored.",
          },
        },
        required: ["status"],
      };
    }

    return {
      type: "object",
      properties,
      required: topics.map((t) => t.name),
    };
  }

  async extract(
    model: BaseChatModel,
    messages: BaseMessage[],
    topics: IQualificationTopic[],
    currentTopicsMap: Record<string, ITopicEntry>,
  ): Promise<Record<string, ITopicEntry>> {
    const schema = this.buildJsonSchema(topics);

    const topicsList = topics
      .map((t) => `- ${t.name}: ${t.label} — ${t.extractionHint}`)
      .join("\n");

    const extractionMessages = [
      new SystemMessage(EXTRACTION_SYSTEM_PROMPT),
      ...messages,
      new HumanMessage(
        `Analyze the conversation above. For each topic, determine its status.\n\nTopics:\n${topicsList}\n\nRespond with JSON matching this schema:\n${JSON.stringify(schema, null, 2)}`,
      ),
    ];

    try {
      const response = await model.invoke(extractionMessages);
      const content =
        typeof response.content === "string"
          ? response.content
          : JSON.stringify(response.content);

      const parsed = this.parseJson(content);
      if (!parsed) {
        this.logger.warn("Failed to parse extraction response, keeping current topicsMap");
        return currentTopicsMap;
      }

      return this.mergeTopicsMap(currentTopicsMap, parsed);
    } catch (error) {
      this.logger.error(`Extraction failed: ${error.message}`);
      return currentTopicsMap;
    }
  }

  private parseJson(text: string): Record<string, any> | null {
    try {
      // Try direct parse
      return JSON.parse(text);
    } catch {
      // Try to extract JSON from markdown code block
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        try {
          return JSON.parse(match[1].trim());
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  /**
   * Merge extraction results with current topicsMap.
   * Never downgrade "explored" back to a lower status.
   */
  private mergeTopicsMap(
    current: Record<string, ITopicEntry>,
    extracted: Record<string, any>,
  ): Record<string, ITopicEntry> {
    const statusRank: Record<string, number> = {
      not_explored: 0,
      partially: 1,
      explored: 2,
    };

    const result = { ...current };

    for (const [key, value] of Object.entries(extracted)) {
      if (!value || typeof value !== "object") continue;

      const currentEntry = result[key];
      const currentRank = statusRank[currentEntry?.status ?? "not_explored"] ?? 0;
      const newRank = statusRank[value.status] ?? 0;

      if (newRank >= currentRank) {
        result[key] = {
          status: value.status,
          details: value.details ?? currentEntry?.details,
        };
      } else if (value.details && !currentEntry?.details) {
        // Keep higher status but add details if they were missing
        result[key] = {
          ...currentEntry,
          details: value.details,
        };
      }
    }

    return result;
  }
}
