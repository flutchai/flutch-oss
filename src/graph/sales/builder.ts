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
  generateNode,
  shouldUseTools,
  execToolsNode,
  saveContextNode,
} from "./nodes";

/**
 * Sales agent graph — consultative sales with structured qualification.
 * graphType: flutch.agent::sales
 *
 * Flow: load_context → generate ⇄ exec_tools → save_context
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

    const modelId = graphSettings.modelId ?? "gpt-4o-mini";

    this.logger.debug(`Building sales graph model=${modelId}`);

    const baseModel = createModel({
      model: modelId,
      temperature: graphSettings.temperature ?? 0.7,
      maxTokens: graphSettings.maxTokens ?? 2048,
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

    // Bind tools if configured
    const { toolNames, toolConfigMap } =
      this.extractToolSettings(graphSettings);
    let boundModel = model;

    if (toolNames.length > 0) {
      try {
        const mcpTools = await this.mcpClient.getTools();
        const enabledSet = new Set(toolNames);
        const filteredTools = mcpTools.filter((t: any) =>
          enabledSet.has(t.name),
        );

        if (filteredTools.length > 0) {
          boundModel = (model as any).bindTools(filteredTools);
          this.logger.debug(`Bound ${filteredTools.length} tools to model`);
        }
      } catch (error) {
        this.logger.warn(`Failed to bind tools: ${error.message}`);
      }
    }

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
    const mcpClient = this.mcpClient;
    const systemPrompt = graphSettings.systemPrompt;

    const crmConfig = graphSettings.crm;

    const injectDeps = (config?: any) => ({
      ...config,
      configurable: {
        ...config?.configurable,
        salesModel: boundModel,
        mcpClient,
        toolConfigs: toolConfigMap,
        systemPrompt,
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
