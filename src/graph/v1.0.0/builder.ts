import { Injectable, Inject, Logger } from "@nestjs/common";
import { AbstractGraphBuilder, IGraphEngine, IGraphRequestPayload } from "@flutchai/flutch-sdk";
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";

const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
});

/**
 * Generic agent graph v1.0.0
 * Replace this with your vertical-specific logic
 */
@Injectable()
export class AgentV1Builder extends AbstractGraphBuilder<"1.0.0"> {
  readonly version = "1.0.0" as const;
  protected readonly logger = new Logger(AgentV1Builder.name);

  constructor(
    @Inject("GRAPH_ENGINE")
    private readonly engine: IGraphEngine
  ) {
    super();
  }

  get graphType(): string {
    return "flutch.agent::1.0.0";
  }

  async buildGraph(_payload?: IGraphRequestPayload): Promise<any> {
    this.logger.debug("Building agent graph v1.0.0");

    const workflow = new StateGraph(AgentState).addNode("agent", async state => {
      // TODO: implement agent logic
      const lastMessage = state.messages[state.messages.length - 1];
      return {
        messages: [new AIMessage(`Echo: ${lastMessage.content}`)],
      };
    });

    workflow.addEdge(START, "agent");
    workflow.addEdge("agent", END);

    return workflow.compile();
  }
}
