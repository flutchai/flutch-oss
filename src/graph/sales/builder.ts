import { Injectable, Logger, Inject, Optional } from "@nestjs/common";
import {
  AbstractGraphBuilder,
  IGraphRequestPayload,
  McpRuntimeHttpClient,
  ModelInitializer,
} from "@flutchai/flutch-sdk";
import { StateGraph, START, END } from "@langchain/langgraph";
import { SalesState } from "./sales.annotations";
import { ISalesGraphSettings } from "./sales.types";
import { createOssConfigFetcher } from "../model-config-fetcher";
import { CHECKPOINTER } from "../../modules/checkpointer/checkpointer.service";
import { LangfuseService } from "../../modules/langfuse/langfuse.service";
import {
  loadContextNode,
  generateNode,
  shouldUseTools,
  execToolsNode,
  saveContextNode,
} from "./nodes";

/**
 * Sales agent graph — consultative sales with structured qualification.
 * graphType: flutch.sales::1.0.0
 *
 * Flow: load_context → generate ⇄ exec_tools → save_context
 */
@Injectable()
export class SalesGraphBuilder extends AbstractGraphBuilder<"1.0.0"> {
  readonly version = "1.0.0" as const;
  protected readonly logger = new Logger(SalesGraphBuilder.name);
  private readonly mcpClient: McpRuntimeHttpClient;
  private readonly modelInitializer: ModelInitializer;

  constructor(
    @Optional() @Inject(CHECKPOINTER) private readonly checkpointer: any,
    @Optional() private readonly langfuseService: LangfuseService | null,
  ) {
    super();
    this.mcpClient = new McpRuntimeHttpClient();
    this.modelInitializer = new ModelInitializer(createOssConfigFetcher());
  }

  get graphType(): string {
    return "flutch.sales::1.0.0";
  }

  private extractToolSettings(graphSettings: ISalesGraphSettings): {
    toolNames: string[];
    toolConfigMap: Record<string, any>;
  } {
    const rawTools = graphSettings.availableTools ?? [];

    const toolNames: string[] = [];
    const toolConfigMap: Record<string, any> = {};

    for (const tool of rawTools) {
      if (typeof tool === "string") {
        toolNames.push(tool);
        continue;
      }

      if (!tool?.name) continue;
      if (tool.enabled === false) continue;

      toolNames.push(tool.name);

      if (tool.config && typeof tool.config === "object") {
        toolConfigMap[tool.name] = tool.config;
      }
    }

    return { toolNames, toolConfigMap };
  }

  async buildGraph(payload?: IGraphRequestPayload): Promise<any> {
    const graphSettings: ISalesGraphSettings =
      (payload?.config?.configurable?.graphSettings as ISalesGraphSettings) ??
      {};

    this.logger.debug(
      `Building sales graph model=${graphSettings.modelId ?? "gpt-4o-mini"}`,
    );

    // Extract tool configs for exec-tools node (enriched args)
    const { toolConfigMap } = this.extractToolSettings(graphSettings);

    // Create Langfuse callback (applied lazily in generate node)
    const ctx = payload?.config?.configurable;
    const langfuseCallback =
      this.langfuseService?.createCallbackHandler({
        userId: ctx?.context?.userId ?? "anonymous",
        agentId: ctx?.context?.agentId ?? "unknown",
        threadId: ctx?.thread_id ?? "no-thread",
      }) ?? null;

    // Build the graph
    const workflow = new StateGraph(SalesState)
      .addNode("load_context", loadContextNode)
      .addNode("generate", generateNode)
      .addNode("exec_tools", execToolsNode)
      .addNode("save_context", saveContextNode);

    workflow.addEdge(START, "load_context");
    workflow.addEdge("load_context", "generate");

    workflow.addConditionalEdges("generate", shouldUseTools, {
      exec_tools: "exec_tools",
      save_context: "save_context",
    });
    workflow.addEdge("exec_tools", "generate");

    workflow.addEdge("save_context", END);

    // Compile
    const compiled = workflow.compile({
      checkpointer: this.checkpointer ?? undefined,
    });

    // Inject runtime dependencies into compiled graph config
    const modelInitializer = this.modelInitializer;
    const mcpClient = this.mcpClient;
    const systemPrompt = graphSettings.systemPrompt;

    const crmConfig = graphSettings.crm?.provider
      ? graphSettings.crm
      : undefined;

    const injectDeps = (config?: any) => ({
      ...config,
      configurable: {
        ...config?.configurable,
        modelInitializer,
        mcpClient,
        toolConfigs: toolConfigMap,
        systemPrompt,
        langfuseCallback,
        graphSettings,
        crmConfig,
      },
    });

    const originalInvoke = compiled.invoke.bind(compiled);
    compiled.invoke = async (input: any, config?: any) =>
      originalInvoke(input, injectDeps(config));

    const originalStream = compiled.stream.bind(compiled);
    compiled.stream = async (input: any, config?: any) =>
      originalStream(input, injectDeps(config));

    return compiled;
  }
}
