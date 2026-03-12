import { Injectable, Logger, Inject, Optional } from "@nestjs/common";
import { AbstractGraphBuilder, IGraphRequestPayload } from "@flutchai/flutch-sdk";
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { BaseMessage, SystemMessage } from "@langchain/core/messages";
import { createModel } from "./model.factory";
import { CHECKPOINTER } from "../../modules/checkpointer/checkpointer.service";

const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
});

/**
 * Generic agent graph v1.0.0
 * Uses LangChain LLM directly from graphSettings — no platform dependency.
 * Replace buildGraph() with your vertical-specific logic when ready.
 */
@Injectable()
export class AgentV1Builder extends AbstractGraphBuilder<"1.0.0"> {
  readonly version = "1.0.0" as const;
  protected readonly logger = new Logger(AgentV1Builder.name);

  constructor(
    @Optional() @Inject(CHECKPOINTER) private readonly checkpointer: any,
  ) {
    super();
  }

  get graphType(): string {
    return "flutch.agent::1.0.0";
  }

  async buildGraph(payload?: IGraphRequestPayload): Promise<any> {
    const graphSettings = payload?.config?.configurable?.graphSettings ?? {};
    const systemPrompt: string | undefined = graphSettings.systemPrompt;
    const modelSettings = { ...graphSettings, model: graphSettings.model ?? "gpt-4o-mini" };

    this.logger.debug(`Building agent graph v1.0.0 model=${modelSettings.model}`);

    const model = createModel(modelSettings);

    const generateNode = async (state: typeof AgentState.State) => {
      const messages: BaseMessage[] = [];
      if (systemPrompt) {
        messages.push(new SystemMessage(systemPrompt));
      }
      messages.push(...state.messages);

      const response = await model.invoke(messages);
      return { messages: [response] };
    };

    const workflow = new StateGraph(AgentState).addNode("generate", generateNode);

    workflow.addEdge(START, "generate");
    workflow.addEdge("generate", END);

    return workflow.compile({ checkpointer: this.checkpointer ?? undefined });
  }
}
