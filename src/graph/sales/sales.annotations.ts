import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import { IGraphAttachment } from "@flutchai/flutch-sdk";
import { IContactData, ILeadScore, IStepConfig } from "./sales.types";

export const SalesState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  text: Annotation<string>({
    reducer: (_x, y) => y,
    default: () => "",
  }),
  contactData: Annotation<IContactData>({
    reducer: (_x, y) => ({ ..._x, ...y }),
    default: () => ({}),
  }),
  attachments: Annotation<Record<string, IGraphAttachment>>({
    reducer: (_x, y) => ({ ..._x, ...y }),
    default: () => ({}),
  }),
  /** Current qualification step index */
  currentStep: Annotation<number>({
    reducer: (_x, y) => y,
    default: () => 0,
  }),
  /** Step configs loaded from preset on first invocation */
  steps: Annotation<IStepConfig[]>({
    reducer: (_x, y) => y,
    default: () => [],
  }),
  /** Extracted qualification data keyed by step id */
  qualificationData: Annotation<Record<string, Record<string, any>>>({
    reducer: (_x, y) => {
      const merged = { ..._x };
      for (const [key, val] of Object.entries(y)) {
        merged[key] = { ...merged[key], ...val };
      }
      return merged;
    },
    default: () => ({}),
  }),
  /** Lead score — set after all steps complete */
  leadScore: Annotation<ILeadScore | null>({
    reducer: (_x, y) => y,
    default: () => null,
  }),
  /** Enrichment status — null means not started, "requested" means fired */
  enrichmentStatus: Annotation<"requested" | null>({
    reducer: (_x, y) => y,
    default: () => null,
  }),
});
