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
    reducer: (_x, y) => ({ ..._x, ...y }),
    default: () => ({}),
  }),
  attachments: Annotation<Record<string, IGraphAttachment>>({
    reducer: (_x, y) => ({ ..._x, ...y }),
    default: () => ({}),
  }),
});
