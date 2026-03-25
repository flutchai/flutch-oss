import { Injectable, Logger, Inject, Optional } from "@nestjs/common";
import {
  AbstractGraphBuilder,
  IGraphRequestPayload,
  McpRuntimeHttpClient,
  IGraphAttachment,
  executeToolWithAttachments,
} from "@flutchai/flutch-sdk";
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { AIMessage, BaseMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { createModel } from "../model.factory";
import { CHECKPOINTER } from "../../modules/checkpointer/checkpointer.service";
import { LangfuseService } from "../../modules/langfuse/langfuse.service";

const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  text: Annotation<string>({
    reducer: (_x, y) => y,
    default: () => "",
  }),
  attachments: Annotation<Record<string, IGraphAttachment>>({
    reducer: (_x, y) => ({ ..._x, ...y }),
    default: () => ({}),
  }),
});

/**
 * Simple agent graph — LLM call with optional system prompt and tool support.
 * graphType: flutch.simple::1.0.0
 */
@Injectable()
export class SimpleGraphBuilder extends AbstractGraphBuilder<"1.0.0"> {
  readonly version = "1.0.0" as const;
  protected readonly logger = new Logger(SimpleGraphBuilder.name);
  private readonly mcpClient: McpRuntimeHttpClient;

  constructor(
    @Optional() @Inject(CHECKPOINTER) private readonly checkpointer: any,
    @Optional() private readonly langfuseService: LangfuseService | null
  ) {
    super();
    this.mcpClient = new McpRuntimeHttpClient();
  }

  get graphType(): string {
    return "flutch.simple::1.0.0";
  }

  async buildGraph(payload?: IGraphRequestPayload): Promise<any> {
    const graphSettings = payload?.config?.configurable?.graphSettings ?? {};
    const systemPrompt: string | undefined = graphSettings.systemPrompt;
    const modelSettings = { ...graphSettings, model: graphSettings.model ?? "gpt-4o-mini" };

    this.logger.debug(`Building simple graph model=${modelSettings.model}`);

    const baseModel = createModel(modelSettings);

    const ctx = payload?.config?.configurable;
    const langfuseCallback =
      this.langfuseService?.createCallbackHandler({
        userId: ctx?.context?.userId ?? "anonymous",
        agentId: ctx?.context?.agentId ?? "unknown",
        threadId: ctx?.thread_id ?? "no-thread",
      }) ?? null;

    const model = langfuseCallback
      ? baseModel.withConfig({ callbacks: [langfuseCallback] })
      : baseModel;

    // Bind tools if configured
    const toolsDef = (graphSettings.tools ?? []).filter((t: any) => t.enabled);
    let boundModel = model;

    if (toolsDef.length > 0) {
      try {
        const mcpTools = await this.mcpClient.getTools();
        const enabledToolNames = new Set(toolsDef.map((t: any) => t.name));
        const filteredTools = mcpTools.filter((t: any) => enabledToolNames.has(t.name));

        if (filteredTools.length > 0) {
          boundModel = (model as any).bindTools(filteredTools);
          this.logger.debug(`Bound ${filteredTools.length} tools to model`);
        }
      } catch (error) {
        this.logger.warn(`Failed to bind tools: ${error.message}`);
      }
    }

    const toolConfigs: Record<string, Record<string, any>> = {};
    for (const t of toolsDef) {
      if (t.config) {
        toolConfigs[t.name] = t.config;
      }
    }

    const mcpClient = this.mcpClient;

    const generateNode = async (state: typeof AgentState.State) => {
      const messages: BaseMessage[] = [];
      if (systemPrompt) {
        messages.push(new SystemMessage(systemPrompt));
      }
      messages.push(...state.messages);

      const response = (await boundModel.invoke(messages)) as AIMessage;
      const text = typeof response.content === "string" ? response.content : "";
      return { messages: [response], text };
    };

    const execToolsNode = async (state: typeof AgentState.State, config: any) => {
      try {
        const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
        const toolCalls = lastMessage?.tool_calls ?? [];

        if (toolCalls.length === 0) {
          this.logger.warn("No tool calls found in the last message");
          return {};
        }

        this.logger.log(`Executing ${toolCalls.length} tool calls`);

        // Build execution context with full context extraction
        const context = (config?.configurable as any)?.context ?? ctx?.context;
        const executionContext: Record<string, any> = {};

        if (context?.userId) executionContext.userId = context.userId;
        if (context?.agentId) executionContext.agentId = context.agentId;
        if (context?.threadId || config?.configurable?.thread_id) {
          executionContext.threadId = context?.threadId || config.configurable.thread_id;
        }
        if (context?.messageId) executionContext.messageId = context.messageId;
        if (context?.platform) executionContext.platform = context.platform;
        if (context?.companyId) executionContext.companyId = context.companyId;

        const toolMessages: ToolMessage[] = [];
        const newAttachments: Record<string, IGraphAttachment> = {};

        for (const toolCall of toolCalls) {
          try {
            const toolConfig = toolConfigs[toolCall.name] ?? {};
            const enrichedArgs = { ...toolConfig, ...(toolCall.args ?? {}) };

            // Merge tool-specific config into execution context
            const toolExecutionContext = { ...toolConfig, ...executionContext };

            const result = await executeToolWithAttachments({
              toolCall: {
                id: toolCall.id ?? toolCall.name,
                name: toolCall.name,
                args: toolCall.args ?? {},
              },
              mcpClient,
              enrichedArgs,
              executionContext: toolExecutionContext,
              config,
              attachments: { ...state.attachments, ...newAttachments },
              logger: this.logger,
            });

            toolMessages.push(result.toolMessage);
            if (result.attachment) {
              newAttachments[result.attachment.key] = result.attachment.value;
            }

            this.logger.log(`Tool ${toolCall.name} executed successfully`);
          } catch (toolError) {
            this.logger.error(`Error executing tool ${toolCall.name}:`, toolError);
            toolMessages.push(
              new ToolMessage({
                content: JSON.stringify({
                  error: toolError instanceof Error ? toolError.message : "Tool execution failed",
                  tool: toolCall.name,
                }),
                tool_call_id: toolCall.id ?? toolCall.name,
                name: toolCall.name,
              })
            );
          }
        }

        return {
          messages: toolMessages,
          ...(Object.keys(newAttachments).length > 0 ? { attachments: newAttachments } : {}),
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Error in execToolsNode: ${errorMessage}`);
        throw error;
      }
    };

    const shouldUseTools = (state: typeof AgentState.State): "exec_tools" | "__end__" => {
      const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
      const toolCalls = lastMessage?.tool_calls ?? [];
      return toolCalls.length > 0 ? "exec_tools" : "__end__";
    };

    const workflow = new StateGraph(AgentState)
      .addNode("generate", generateNode)
      .addNode("exec_tools", execToolsNode);

    workflow.addEdge(START, "generate");
    workflow.addConditionalEdges("generate", shouldUseTools, {
      exec_tools: "exec_tools",
      __end__: END,
    });
    workflow.addEdge("exec_tools", "generate");

    return workflow.compile({ checkpointer: this.checkpointer ?? undefined });
  }
}
