import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import { IGraphAttachment } from "@flutchai/flutch-sdk";
import { IContactData } from "./sales.types";

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
    reducer: (_x, y) => y,
    default: () => ({}),
  }),
  attachments: Annotation<Record<string, IGraphAttachment>>({
    reducer: (_x, y) => ({ ..._x, ...y }),
    default: () => ({}),
  }),
  /** Enrichment status — null means not started, "requested" means fired */
  enrichmentStatus: Annotation<"requested" | null>({
    reducer: (_x, y) => y,
    default: () => null,
  }),
  /** Request metadata from the platform (email, phone, custom fields). Extracted once from first message. */
  requestMetadata: Annotation<Record<string, any>>({
    reducer: (x, y) => (Object.keys(y).length > 0 ? y : x),
    default: () => ({}),
  }),
  /** Whether the agent has already sent a greeting. Persisted to survive message windowing. */
  greetingSent: Annotation<boolean>({
    reducer: (_x, y) => y,
    default: () => false,
  }),
});
