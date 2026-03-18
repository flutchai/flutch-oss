import { Annotation } from "@langchain/langgraph";
import { AIMessage, BaseMessage } from "@langchain/core/messages";
import { IGraphAttachment } from "@flutchai/flutch-sdk";
import { ILeadProfile, ITopicEntry } from "./sales.types";

export const SalesState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  generation: Annotation<AIMessage | null>({
    reducer: (_x, y) => y,
    default: () => null,
  }),
  systemPrompt: Annotation<string>({
    reducer: (_x, y) => y,
    default: () => "",
  }),
  leadProfile: Annotation<ILeadProfile>({
    reducer: (_x, y) => ({ ..._x, ...y }),
    default: () => ({}),
  }),
  topicsMap: Annotation<Record<string, ITopicEntry>>({
    reducer: (_x, y) => ({ ..._x, ...y }),
    default: () => ({}),
  }),
  calculatorData: Annotation<Record<string, any> | undefined>({
    reducer: (_x, y) => y ?? _x,
    default: () => undefined,
  }),
  attachments: Annotation<Record<string, IGraphAttachment>>({
    reducer: (_x, y) => ({ ..._x, ...y }),
    default: () => ({}),
  }),
});
