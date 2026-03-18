import { Injectable, Logger, Inject, Optional } from "@nestjs/common";
import {
  AbstractGraphBuilder,
  IGraphRequestPayload,
  McpRuntimeHttpClient,
} from "@flutchai/flutch-sdk";
import { StateGraph, START, END } from "@langchain/langgraph";
import { SalesState } from "./sales.annotations";
import { ISalesGraphSettings } from "./sales.types";
import { createModel } from "../model.factory";
import { CHECKPOINTER } from "../../modules/checkpointer/checkpointer.service";
import { LangfuseService } from "../../modules/langfuse/langfuse.service";
import {
  loadContextNode,
  buildPromptNode,
  generateNode,
  shouldUseTools,
  execToolsNode,
  extractNode,
  saveContextNode,
} from "./nodes";

/**
 * Sales agent graph — consultative sales with structured qualification.
 * graphType: flutch.agent::sales
 *
 * Flow: load_context → build_prompt → generate ⇄ exec_tools → extract → save_context
 */
@Injectable()
export class SalesGraphBuilder extends AbstractGraphBuilder<"sales"> {
  readonly version = "sales" as const;
  protected readonly logger = new Logger(SalesGraphBuilder.name);
  private readonly mcpClient: McpRuntimeHttpClient;

  constructor(
    @Optional() @Inject(CHECKPOINTER) private readonly checkpointer: any,
    @Optional() private readonly langfuseService: LangfuseService | null,
  ) {
    super();
    this.mcpClient = new McpRuntimeHttpClient();
  }

  get graphType(): string {
    return "flutch.agent::sales";
  }

  async buildGraph(payload?: IGraphRequestPayload): Promise<any> {
    const graphSettings: ISalesGraphSettings =
      payload?.config?.configurable?.graphSettings ?? {};

    const llmSettings = graphSettings.llm ?? { modelId: "gpt-4o-mini" };

    this.logger.debug(
      `Building sales graph model=${llmSettings.modelId}`,
    );

    // Create main LLM model
    const baseModel = createModel({
      model: llmSettings.modelId,
      temperature: llmSettings.temperature ?? 0.7,
      maxTokens: llmSettings.maxTokens ?? 2048,
    });

    // Langfuse tracing
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

    // Bind tools to model if configured
    const toolsDef = (graphSettings.tools ?? []).filter((t) => t.enabled);
    let boundModel = model;

    if (toolsDef.length > 0) {
      try {
        const mcpTools = await this.mcpClient.getTools();
        const enabledToolNames = new Set(toolsDef.map((t) => t.name));
        const filteredTools = mcpTools.filter((t: any) =>
          enabledToolNames.has(t.name),
        );

        if (filteredTools.length > 0) {
          boundModel = (model as any).bindTools(filteredTools);
          this.logger.debug(`Bound ${filteredTools.length} tools to model`);
        }
      } catch (error) {
        this.logger.warn(`Failed to bind tools: ${error.message}`);
      }
    }

    // Build tool configs map for exec_tools node
    const toolConfigs: Record<string, Record<string, any>> = {};
    for (const t of toolsDef) {
      if (t.config) {
        toolConfigs[t.name] = t.config;
      }
    }

    // Build the graph
    const workflow = new StateGraph(SalesState)
      .addNode("load_context", loadContextNode)
      .addNode("build_prompt", buildPromptNode)
      .addNode("generate", generateNode)
      .addNode("exec_tools", execToolsNode)
      .addNode("extract", extractNode)
      .addNode("save_context", saveContextNode);

    // Linear path
    workflow.addEdge(START, "load_context");
    workflow.addEdge("load_context", "build_prompt");
    workflow.addEdge("build_prompt", "generate");

    // Tool loop: generate ⇄ exec_tools
    workflow.addConditionalEdges("generate", shouldUseTools, {
      exec_tools: "exec_tools",
      extract: "extract",
    });
    workflow.addEdge("exec_tools", "generate");

    // Completion
    workflow.addEdge("extract", "save_context");
    workflow.addEdge("save_context", END);

    // Compile with checkpointer
    const compiled = workflow.compile({
      checkpointer: this.checkpointer ?? undefined,
    });

    // Inject runtime dependencies into the compiled graph's config
    const mcpClient = this.mcpClient;
    const originalInvoke = compiled.invoke.bind(compiled);
    compiled.invoke = async (input: any, config?: any) => {
      const enhancedConfig = {
        ...config,
        configurable: {
          ...config?.configurable,
          __salesModel: boundModel,
          __mcpClient: mcpClient,
          __toolConfigs: toolConfigs,
        },
      };
      return originalInvoke(input, enhancedConfig);
    };

    const originalStream = compiled.stream.bind(compiled);
    compiled.stream = async (input: any, config?: any) => {
      const enhancedConfig = {
        ...config,
        configurable: {
          ...config?.configurable,
          __salesModel: boundModel,
          __mcpClient: mcpClient,
          __toolConfigs: toolConfigs,
        },
      };
      return originalStream(input, enhancedConfig);
    };

    return compiled;
  }
}
