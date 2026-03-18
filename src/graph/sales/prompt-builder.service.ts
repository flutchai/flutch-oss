import { Injectable, Logger } from "@nestjs/common";
import {
  ISalesGraphSettings,
  ILeadProfile,
  ITopicEntry,
  IQualificationTopic,
} from "./sales.types";

@Injectable()
export class PromptBuilderService {
  private readonly logger = new Logger(PromptBuilderService.name);

  build(
    settings: ISalesGraphSettings,
    leadProfile: ILeadProfile,
    topicsMap: Record<string, ITopicEntry>,
    calculatorData?: Record<string, any>,
  ): string {
    const sections: string[] = [];

    // Core prompt template
    sections.push(settings.prompt.template);

    // Methodology
    if (settings.prompt.methodology) {
      sections.push(settings.prompt.methodology);
    }

    // Guidelines
    if (settings.prompt.guidelines?.length) {
      sections.push("Rules:");
      for (const g of settings.prompt.guidelines) {
        sections.push(`- ${g}`);
      }
    }

    // Lead profile
    sections.push(this.buildLeadSection(leadProfile));

    // Calculator data
    if (calculatorData && Object.keys(calculatorData).length > 0) {
      sections.push(this.buildCalculatorSection(calculatorData));
    }

    // Topics map
    sections.push(this.buildTopicsSection(settings.topics, topicsMap));

    return sections.join("\n\n");
  }

  private buildLeadSection(profile: ILeadProfile): string {
    const lines = ["── About the customer ──"];
    if (profile.name) lines.push(`Name: ${profile.name}`);
    if (profile.company) lines.push(`Company: ${profile.company}`);
    if (profile.email) lines.push(`Email: ${profile.email}`);
    if (!profile.name && !profile.company && !profile.email) {
      lines.push("No customer data available yet.");
    }
    return lines.join("\n");
  }

  private buildCalculatorSection(data: Record<string, any>): string {
    const lines = ["── Calculator data ──"];
    for (const [key, value] of Object.entries(data)) {
      lines.push(`  ${key}: ${value}`);
    }
    return lines.join("\n");
  }

  private buildTopicsSection(
    topicsDef: IQualificationTopic[],
    topicsMap: Record<string, ITopicEntry>,
  ): string {
    const lines = ["── Conversation map ──"];

    const explored: string[] = [];
    const unexploredRequired: string[] = [];
    const unexploredOptional: string[] = [];

    for (const topic of topicsDef) {
      const entry = topicsMap[topic.name];
      const status = entry?.status ?? "not_explored";

      if (status === "explored") {
        explored.push(`  ✅ ${topic.label}${entry?.details ? `: ${entry.details}` : ""}`);
      } else if (status === "partially") {
        explored.push(`  🔄 ${topic.label} (partially)${entry?.details ? `: ${entry.details}` : ""}`);
      } else {
        const line = `  ☐ ${topic.label} — ${topic.description}`;
        if (topic.required) {
          unexploredRequired.push(line);
        } else {
          unexploredOptional.push(line);
        }
      }
    }

    if (explored.length) {
      lines.push("Explored topics:");
      lines.push(...explored);
    }

    if (unexploredRequired.length) {
      lines.push("\nUnexplored topics (required):");
      lines.push(...unexploredRequired);
    }

    if (unexploredOptional.length) {
      lines.push("\nUnexplored topics (optional):");
      lines.push(...unexploredOptional);
    }

    lines.push(
      "\nNaturally explore the unexplored topics through conversation.",
      "Don't ask questions in a list — lead a dialogue.",
    );

    return lines.join("\n");
  }
}
