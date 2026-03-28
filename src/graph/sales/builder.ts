import { Injectable, Logger, Inject, Optional } from "@nestjs/common";
import { z } from "zod";
import {
  AbstractGraphBuilder,
  IGraphRequestPayload,
  McpRuntimeHttpClient,
  ModelInitializer,
  executeToolWithAttachments,
  IGraphAttachment,
} from "@flutchai/flutch-sdk";
import type { IAgentToolConfig } from "@flutchai/flutch-sdk";
import { StateGraph, START, END, interrupt } from "@langchain/langgraph";
import { AIMessage, BaseMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { SalesState } from "./sales.annotations";
import {
  IContactData,
  ILeadScore,
  ISalesGraphSettings,
  ISalesToolConfig,
  IStepConfig,
  QualificationOutcome,
  SalesRunnableConfig,
  extractToolConfigs,
} from "./sales.types";
import { resolveSteps } from "./presets";
import {
  buildAdvanceStepTool,
  ADVANCE_STEP_TOOL_NAME,
  validateRequiredFields,
} from "./transition-tool";
import {
  filterSystemFields,
  getCrmToolName,
  parseMcpResult,
  buildLookupArgs,
} from "./crm.constants";
import { CHECKPOINTER } from "../../modules/checkpointer/checkpointer.service";
import { LangfuseService } from "../../modules/langfuse/langfuse.service";

/**
 * Sales agent graph v2 — step-based lead qualification with CRM sync.
 * graphType: flutch.sales::2.0.0
 *
 * Flow: context_sync → generate ⇄ exec_tools → END
 */
@Injectable()
export class SalesGraphBuilder extends AbstractGraphBuilder<"2.0.0"> {
  readonly version = "2.0.0" as const;
  protected readonly logger = new Logger(SalesGraphBuilder.name);
  private readonly mcpClient: McpRuntimeHttpClient;
  private readonly modelInitializer: ModelInitializer;

  constructor(
    @Optional() @Inject(CHECKPOINTER) private readonly checkpointer: any,
    @Optional() private readonly langfuseService: LangfuseService | null,
    mcpClient: McpRuntimeHttpClient,
    modelInitializer: ModelInitializer
  ) {
    super();
    this.mcpClient = mcpClient;
    this.modelInitializer = modelInitializer;
  }

  get graphType(): string {
    return "flutch.sales::2.0.0";
  }

  // ══════════════════════════════════════════════════════════════
  //  Node: context_sync — CRM load, save, enrichment
  // ══════════════════════════════════════════════════════════════

  private async contextSyncNode(
    state: typeof SalesState.State,
    config: SalesRunnableConfig
  ): Promise<Partial<typeof SalesState.State>> {
    const graphSettings = config?.configurable?.graphSettings;
    const crmConfig = graphSettings?.crm;
    const toolConfigs = extractToolConfigs(graphSettings);

    const updates: Partial<typeof SalesState.State> = {};

    // ── 1. Load contact from CRM ──
    if (crmConfig?.provider && this.mcpClient) {
      const loadedContact = await this.loadContact(state, config);
      if (loadedContact && Object.keys(loadedContact).length > 0) {
        updates.contactData = loadedContact;
      }
    }

    // ── 2. Save qualificationData to CRM ──
    if (crmConfig?.provider && this.mcpClient) {
      const contactData = updates.contactData ?? state.contactData;
      await this.saveQualificationData(state, contactData, config);
    }

    // ── 3. Enrichment (first turn only) ──
    if (state.enrichmentStatus === null) {
      const rawEnrichment = graphSettings?.enrichmentTools ?? [];
      const enabledTools = resolveEnrichmentTools(rawEnrichment);
      if (enabledTools.length > 0 && this.mcpClient) {
        this.fireEnrichment(enabledTools, state, config);
        updates.enrichmentStatus = "requested";
      }
    }

    return updates;
  }

  private async loadContact(
    state: typeof SalesState.State,
    config: SalesRunnableConfig
  ): Promise<IContactData | null> {
    const graphSettings = config?.configurable?.graphSettings;
    const crmConfig = graphSettings?.crm;
    const toolConfigs = extractToolConfigs(graphSettings);
    const context = config?.configurable?.context;

    if (!crmConfig?.provider || !this.mcpClient) return null;

    if (state.contactData?.crmId) {
      return this.loadContactById(state.contactData.crmId, crmConfig, toolConfigs);
    }

    const lookupValue = extractLookupValue(state, crmConfig.lookupBy, context);
    if (!lookupValue) {
      this.logger.debug(`context_sync: no ${crmConfig.lookupBy} found, skipping CRM lookup`);
      return extractContactFromMetadata(state);
    }

    try {
      const toolName = getCrmToolName(crmConfig.provider, "find");
      const toolConfig = toolConfigs[toolName] ?? {};
      const lookupParams = buildLookupArgs(crmConfig.provider, crmConfig.lookupBy, lookupValue);

      this.logger.debug(
        `Looking up contact by ${crmConfig.lookupBy}=${lookupValue} via ${toolName}`
      );

      const result = await this.mcpClient.executeTool(toolName, {
        ...lookupParams,
        ...toolConfig,
      });

      if (!result.success || !result.result) {
        this.logger.debug("Contact not found in CRM, using metadata only");
        return extractContactFromMetadata(state);
      }

      const parsed = parseMcpResult(result.result);
      const raw = Array.isArray(parsed) ? parsed[0] : parsed;

      if (!raw || !raw.id) {
        this.logger.debug("No matching contact in CRM, using metadata only");
        return extractContactFromMetadata(state);
      }

      const crmId = raw.id;
      const filtered = filterSystemFields(raw);

      this.logger.log(`Loaded contact ${crmId} from ${crmConfig.provider}`);
      return { crmId, ...filtered };
    } catch (error) {
      this.logger.warn(`CRM lookup failed: ${error instanceof Error ? error.message : error}`);
      return extractContactFromMetadata(state);
    }
  }

  private async loadContactById(
    crmId: string,
    crmConfig: { provider: string },
    toolConfigs: Record<string, any>
  ): Promise<IContactData | null> {
    try {
      const toolName = getCrmToolName(crmConfig.provider, "get");
      const toolConfig = toolConfigs[toolName] ?? {};

      this.logger.debug(`Refreshing contact ${crmId} via ${toolName}`);

      const result = await this.mcpClient.executeTool(toolName, {
        id: crmId,
        ...toolConfig,
      });

      if (!result.success || !result.result) return null;

      const parsed = parseMcpResult(result.result);
      const raw = Array.isArray(parsed) ? parsed[0] : parsed;
      if (!raw) return null;

      const filtered = filterSystemFields(raw);
      return { crmId, ...filtered };
    } catch (error) {
      this.logger.warn(
        `CRM refresh failed for ${crmId}: ${error instanceof Error ? error.message : error}`
      );
      return null;
    }
  }

  private async saveQualificationData(
    state: typeof SalesState.State,
    contactData: IContactData | undefined,
    config: SalesRunnableConfig
  ): Promise<void> {
    const graphSettings = config?.configurable?.graphSettings;
    const crmConfig = graphSettings?.crm;
    const toolConfigs = extractToolConfigs(graphSettings);

    if (!crmConfig?.provider || !this.mcpClient) return;

    const qualData = state.qualificationData;
    if (!qualData || Object.keys(qualData).length === 0) return;

    const flatFields: Record<string, any> = {};
    for (const stepData of Object.values(qualData)) {
      for (const [key, value] of Object.entries(stepData)) {
        if (value != null && value !== "") {
          flatFields[key] = value;
        }
      }
    }

    if (Object.keys(flatFields).length === 0) return;

    const dataToWrite = filterSystemFields(flatFields);
    if (Object.keys(dataToWrite).length === 0) return;

    try {
      const crmId = contactData?.crmId;

      if (crmId) {
        const toolName = getCrmToolName(crmConfig.provider, "update");
        const toolConfig = toolConfigs[toolName] ?? {};
        this.logger.debug(`Updating contact ${crmId} with qualification data via ${toolName}`);

        await this.mcpClient.executeTool(toolName, {
          id: crmId,
          ...dataToWrite,
          ...toolConfig,
        });

        this.logger.log(`Updated contact ${crmId} in ${crmConfig.provider}`);
      } else {
        const toolName = getCrmToolName(crmConfig.provider, "create");
        const toolConfig = toolConfigs[toolName] ?? {};
        this.logger.debug(`Creating new contact with qualification data via ${toolName}`);

        const result = await this.mcpClient.executeTool(toolName, {
          ...dataToWrite,
          ...toolConfig,
        });

        if (result.success && result.result) {
          const parsed = parseMcpResult(result.result);
          const newId = parsed?.id;
          if (newId) {
            this.logger.log(`Created contact ${newId} in ${crmConfig.provider}`);
          }
        }
      }
    } catch (error) {
      this.logger.warn(`CRM save failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  private fireEnrichment(
    enrichmentTools: { name: string; config?: Record<string, any> }[],
    state: typeof SalesState.State,
    config: SalesRunnableConfig
  ): void {
    const toolConfigs = extractToolConfigs(config?.configurable?.graphSettings);
    const contactData = state.contactData ?? {};

    this.logger.log(`Firing ${enrichmentTools.length} enrichment tool(s) async`);

    for (const tool of enrichmentTools) {
      const globalConfig = toolConfigs[tool.name] ?? {};
      const enrichmentArgs: Record<string, any> = { ...globalConfig, ...tool.config };
      if (contactData.email) enrichmentArgs.email = contactData.email;
      if (contactData.companyName) enrichmentArgs.companyName = contactData.companyName;
      if (contactData.phone) enrichmentArgs.phone = contactData.phone;

      this.mcpClient
        .executeTool(tool.name, enrichmentArgs)
        .then(() => this.logger.log(`Enrichment tool ${tool.name} completed`))
        .catch((err: any) =>
          this.logger.warn(
            `Enrichment tool ${tool.name} failed: ${err instanceof Error ? err.message : err}`
          )
        );
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  Node: generate — step-aware LLM with transition tool
  // ══════════════════════════════════════════════════════════════

  private async generateNode(
    state: typeof SalesState.State,
    config: SalesRunnableConfig,
    langfuseCallback?: any
  ): Promise<Partial<typeof SalesState.State>> {
    const graphSettings = config?.configurable?.graphSettings ?? {};
    const steps = state.steps;
    const currentStep = state.currentStep;

    // ── All steps completed → scoring ──
    if (steps.length > 0 && currentStep >= steps.length) {
      return await this.scoreAndHandoff(state, config, langfuseCallback);
    }

    // ── Build model ──
    const modelId = graphSettings.modelId ?? "gpt-4o-mini";
    const temperature = graphSettings.temperature;
    const maxTokens = graphSettings.maxTokens;

    const stepConfig = steps.length > 0 ? steps[currentStep] : null;
    const toolsConfig = buildToolsConfig(graphSettings.availableTools, stepConfig?.tools);

    let model = await this.modelInitializer.initializeChatModel({
      modelId,
      temperature,
      maxTokens,
      toolsConfig,
    });

    if (langfuseCallback) {
      model = (model as any).withConfig({ callbacks: [langfuseCallback] });
    }

    // ── Bind advance_step tool (if in step mode) ──
    if (stepConfig) {
      const advanceStepTool = buildAdvanceStepTool(stepConfig);
      if ((model as any).bindTools) {
        model = (model as any).bindTools([advanceStepTool], { parallel_tool_calls: false });
      }
    }

    // ── Build system prompt ──
    const systemPrompt = buildStepAwarePrompt(
      graphSettings.systemPrompt,
      state.contactData,
      state.qualificationData,
      stepConfig
        ? {
            name: stepConfig.name,
            prompt: stepConfig.prompt,
            index: currentStep,
            total: steps.length,
          }
        : null
    );

    const messages: BaseMessage[] = [];
    if (systemPrompt) {
      messages.push(new SystemMessage(systemPrompt));
    }
    messages.push(...state.messages);

    this.logger.debug(
      `Generating response (${messages.length} msgs, model=${modelId}` +
        (stepConfig ? `, step=${stepConfig.id} [${currentStep + 1}/${steps.length}]` : "") +
        ")"
    );

    const response = (await model.invoke(messages, config)) as AIMessage;
    const text = typeof response.content === "string" ? response.content : "";

    return { messages: [response], text };
  }

  private async scoreAndHandoff(
    state: typeof SalesState.State,
    config: SalesRunnableConfig,
    langfuseCallback?: any
  ): Promise<Partial<typeof SalesState.State>> {
    const graphSettings = config?.configurable?.graphSettings ?? {};
    const modelId = graphSettings.modelId ?? "gpt-4o-mini";

    let model = await this.modelInitializer.initializeChatModel({
      modelId,
      temperature: 0,
    });

    if (langfuseCallback) {
      model = (model as any).withConfig({ callbacks: [langfuseCallback] });
    }

    const scoringModel = (model as any).withStructuredOutput
      ? (model as any).withStructuredOutput(LeadScoreSchema)
      : model;

    const qualDataSummary = Object.entries(state.qualificationData)
      .map(([stepId, data]) => `${stepId}: ${JSON.stringify(data)}`)
      .join("\n");

    const contactSummary = state.contactData
      ? Object.entries(state.contactData)
          .filter(([k, v]) => k !== "crmId" && v != null && v !== "")
          .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
          .join("\n")
      : "No contact data";

    const scoringPrompt = `You are a lead scoring expert. Based on the qualification data below, provide a lead score.

── Contact Data ──
${contactSummary}

── Qualification Data ──
${qualDataSummary}

Score the lead from 0-100 and classify as:
- "qualified" (score >= 70): Ready for sales handoff
- "nurture" (score 30-69): Needs more engagement
- "disqualified" (score < 30): Not a fit

Provide clear reasons for your assessment.`;

    this.logger.debug("Scoring lead...");

    try {
      const scoreResult = await scoringModel.invoke([new SystemMessage(scoringPrompt)], config);

      let leadScore: ILeadScore;

      if (scoreResult && typeof scoreResult === "object" && "score" in scoreResult) {
        leadScore = {
          score: scoreResult.score,
          outcome: scoreResult.outcome as QualificationOutcome,
          reasons: scoreResult.reasons ?? [],
          scoredAt: new Date().toISOString(),
        };
      } else {
        this.logger.warn("Scoring model did not return structured output, using default");
        leadScore = {
          score: 50,
          outcome: "nurture",
          reasons: ["Scoring model returned unstructured response"],
          scoredAt: new Date().toISOString(),
        };
      }

      this.logger.log(`Lead scored: ${leadScore.score} → ${leadScore.outcome}`);

      const autoHandoff = graphSettings.autoHandoff ?? true;

      if (!autoHandoff && leadScore.outcome === "qualified") {
        interrupt({
          type: "handoff_approval",
          leadScore,
          contactData: state.contactData,
          qualificationData: state.qualificationData,
          message: `Lead scored ${leadScore.score}/100 (${leadScore.outcome}). Approve handoff?`,
        });
      }

      const closingModel = await this.modelInitializer.initializeChatModel({
        modelId,
        temperature: 0.7,
      });

      if (langfuseCallback) {
        (closingModel as any).withConfig?.({ callbacks: [langfuseCallback] });
      }

      const basePrompt = graphSettings.systemPrompt ?? "";
      const closingMessages: BaseMessage[] = [
        new SystemMessage(
          `${basePrompt}\n\nThe qualification is complete. The lead is "${leadScore.outcome}". ` +
            `Provide a warm closing message. If qualified, mention that a team member will follow up. ` +
            `If nurture, offer to stay in touch. Keep it brief and natural.`
        ),
        ...state.messages,
      ];

      const closingResponse = (await closingModel.invoke(closingMessages, config)) as AIMessage;
      const text = typeof closingResponse.content === "string" ? closingResponse.content : "";

      return { messages: [closingResponse], text, leadScore };
    } catch (error) {
      this.logger.error(`Scoring failed: ${error instanceof Error ? error.message : error}`);
      return {
        leadScore: {
          score: 0,
          outcome: "nurture",
          reasons: [`Scoring failed: ${error instanceof Error ? error.message : String(error)}`],
          scoredAt: new Date().toISOString(),
        },
      };
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  Node: exec_tools — MCP tools + advance_step
  // ══════════════════════════════════════════════════════════════

  private async execToolsNode(
    state: typeof SalesState.State,
    config: SalesRunnableConfig
  ): Promise<Partial<typeof SalesState.State>> {
    try {
      const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
      const toolCalls = lastMessage?.tool_calls ?? [];

      if (toolCalls.length === 0) {
        this.logger.warn("No tool calls found in the last message");
        return {};
      }

      this.logger.log(`Executing ${toolCalls.length} tool calls`);

      const graphSettings = config?.configurable?.graphSettings;
      const toolConfigs = extractToolConfigs(graphSettings);

      const context = config?.configurable?.context;
      const executionContext: Record<string, any> = {};

      if (context?.userId) executionContext.userId = context.userId;
      if (context?.agentId) executionContext.agentId = context.agentId;
      if (context?.threadId || config?.configurable?.thread_id) {
        executionContext.threadId = context?.threadId || config?.configurable?.thread_id;
      }
      if (context?.messageId) executionContext.messageId = context.messageId;
      if (context?.platform) executionContext.platform = context.platform;
      if (context?.companyId) executionContext.companyId = context.companyId;

      const toolMessages: ToolMessage[] = [];
      const newAttachments: Record<string, IGraphAttachment> = {};

      let stepAdvanced = false;
      let newQualificationData: Record<string, Record<string, any>> = {};

      for (const toolCall of toolCalls) {
        // ── Handle advance_step locally ──
        if (toolCall.name === ADVANCE_STEP_TOOL_NAME) {
          const result = handleAdvanceStep(state, toolCall, stepAdvanced);
          toolMessages.push(result.toolMessage);

          if (result.advanced) {
            stepAdvanced = true;
            newQualificationData = {
              ...newQualificationData,
              ...result.qualificationData,
            };
          }
          continue;
        }

        // ── Handle MCP tools ──
        if (!this.mcpClient) {
          toolMessages.push(
            new ToolMessage({
              content: JSON.stringify({
                error: `Tool "${toolCall.name}" is not available in this configuration.`,
                tool: toolCall.name,
              }),
              tool_call_id: toolCall.id ?? toolCall.name,
              name: toolCall.name,
            })
          );
          continue;
        }

        try {
          const toolConfig = toolConfigs[toolCall.name] ?? {};
          const enrichedArgs = { ...toolConfig, ...(toolCall.args ?? {}) };
          const toolExecutionContext = { ...toolConfig, ...executionContext };

          this.logger.debug(
            `Executing tool: ${toolCall.name} with enriched args: ${JSON.stringify(enrichedArgs)}`
          );

          const result = await executeToolWithAttachments({
            toolCall: {
              id: toolCall.id ?? toolCall.name,
              name: toolCall.name,
              args: toolCall.args ?? {},
            },
            mcpClient: this.mcpClient,
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

      const updates: Partial<typeof SalesState.State> = {
        messages: toolMessages,
      };

      if (Object.keys(newAttachments).length > 0) {
        updates.attachments = newAttachments;
      }

      if (stepAdvanced) {
        updates.currentStep = state.currentStep + 1;
        updates.qualificationData = newQualificationData;
      }

      return updates;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error in execToolsNode: ${errorMessage}`);
      throw error;
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  Build graph
  // ══════════════════════════════════════════════════════════════

  async buildGraph(payload?: IGraphRequestPayload): Promise<any> {
    const graphSettings: ISalesGraphSettings =
      (payload?.config?.configurable?.graphSettings as ISalesGraphSettings) ?? {};

    this.logger.debug(
      `Building sales graph v2 model=${graphSettings.modelId ?? "gpt-4o-mini"} preset=${graphSettings.preset ?? "custom"}`
    );

    // Resolve qualification steps from preset + overrides
    const resolvedSteps: IStepConfig[] = resolveSteps(graphSettings.preset, graphSettings.steps);

    // Create Langfuse callback (per-build, captured via closure)
    const ctx = payload?.config?.configurable;
    const langfuseCallback =
      this.langfuseService?.createCallbackHandler({
        userId: ctx?.context?.userId ?? "anonymous",
        agentId: ctx?.context?.agentId ?? "unknown",
        threadId: ctx?.thread_id ?? "no-thread",
      }) ?? null;

    // ── Build the graph ──
    const workflow = new StateGraph(SalesState)
      .addNode("context_sync", this.contextSyncNode.bind(this))
      .addNode("generate", (state: any, config: any) =>
        this.generateNode(state, config, langfuseCallback)
      )
      .addNode("exec_tools", this.execToolsNode.bind(this));

    workflow.addEdge(START, "context_sync");
    workflow.addEdge("context_sync", "generate");

    workflow.addConditionalEdges("generate", shouldUseTools, {
      exec_tools: "exec_tools",
      __end__: END,
    });
    workflow.addEdge("exec_tools", "generate");

    // Compile with interrupt support
    const compiled = workflow.compile({
      checkpointer: this.checkpointer ?? undefined,
    });

    // Wrap invoke/stream to inject resolved steps into initial state
    const originalInvoke = compiled.invoke.bind(compiled);
    compiled.invoke = async (input: any, config?: any) => {
      const enrichedInput = injectStepsToInput(input, resolvedSteps);
      return originalInvoke(enrichedInput, config);
    };

    const originalStream = compiled.stream.bind(compiled);
    compiled.stream = async (input: any, config?: any) => {
      const enrichedInput = injectStepsToInput(input, resolvedSteps);
      return originalStream(enrichedInput, config);
    };

    return compiled;
  }
}

// ══════════════════════════════════════════════════════════════
//  Standalone helpers (no class instance needed)
// ══════════════════════════════════════════════════════════════

const LeadScoreSchema = z.object({
  score: z.number().min(0).max(100).describe("Lead quality score 0-100"),
  outcome: z
    .enum(["qualified", "nurture", "disqualified"])
    .describe("qualified = ready for sales, nurture = needs more time, disqualified = not a fit"),
  reasons: z.array(z.string()).describe("Key reasons for the score"),
});

/** Routing function: check if the generation contains tool calls. */
export function shouldUseTools(state: typeof SalesState.State): "exec_tools" | "__end__" {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  const toolCalls = lastMessage?.tool_calls ?? [];
  return toolCalls.length > 0 ? "exec_tools" : "__end__";
}

/** Build tool config for model initialization. Merges global tools with step-specific tools. */
function buildToolsConfig(
  availableTools?: (string | ISalesToolConfig)[],
  stepTools?: string[]
): IAgentToolConfig[] | undefined {
  const configs: IAgentToolConfig[] = [];

  if (availableTools) {
    for (const tool of availableTools) {
      if (typeof tool === "string") {
        configs.push({ toolName: tool, enabled: true });
      } else if (tool?.name && tool.enabled !== false) {
        configs.push({ toolName: tool.name, enabled: true, config: tool.config });
      }
    }
  }

  if (stepTools) {
    const existing = new Set(configs.map(c => c.toolName));
    for (const toolName of stepTools) {
      if (!existing.has(toolName)) {
        configs.push({ toolName, enabled: true });
      }
    }
  }

  return configs.length > 0 ? configs : undefined;
}

/** Build system prompt with step context, contact data, and qualification progress. */
function buildStepAwarePrompt(
  basePrompt: string | undefined,
  contactData: IContactData | undefined,
  qualificationData: Record<string, Record<string, any>>,
  currentStep: { name: string; prompt: string; index: number; total: number } | null
): string | undefined {
  const parts: string[] = [];

  if (basePrompt) {
    parts.push(basePrompt);
  }

  if (contactData && Object.keys(contactData).length > 0) {
    const { crmId, ...fields } = contactData;
    const contactLines = Object.entries(fields)
      .filter(([, v]) => v != null && v !== "")
      .map(([k, v]) => `  ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
      .join("\n");

    if (contactLines) {
      parts.push(`── About the customer ──\n${contactLines}`);
    }
  }

  if (qualificationData && Object.keys(qualificationData).length > 0) {
    const progressLines = Object.entries(qualificationData)
      .map(([stepId, data]) => {
        const fields = Object.entries(data)
          .filter(([, v]) => v != null && v !== "")
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ");
        return `  ${stepId}: ${fields}`;
      })
      .join("\n");

    if (progressLines) {
      parts.push(`── Gathered so far ──\n${progressLines}`);
    }
  }

  if (currentStep) {
    parts.push(
      `── Current step: ${currentStep.name} (${currentStep.index + 1}/${currentStep.total}) ──\n` +
        currentStep.prompt
    );
  }

  return parts.length > 0 ? parts.join("\n\n") : undefined;
}

/** Handle advance_step tool call locally (not via MCP). */
interface AdvanceStepResult {
  toolMessage: ToolMessage;
  advanced: boolean;
  qualificationData?: Record<string, Record<string, any>>;
}

function handleAdvanceStep(
  state: typeof SalesState.State,
  toolCall: { id?: string; name: string; args?: Record<string, any> },
  alreadyAdvanced: boolean
): AdvanceStepResult {
  const logger = new Logger("ExecToolsNode");
  const toolCallId = toolCall.id ?? toolCall.name;
  const data = toolCall.args ?? {};

  if (alreadyAdvanced) {
    return {
      toolMessage: new ToolMessage({
        content: "Step already advanced in this turn. Continue the conversation.",
        tool_call_id: toolCallId,
        name: ADVANCE_STEP_TOOL_NAME,
      }),
      advanced: false,
    };
  }

  const steps = state.steps;
  const currentIdx = state.currentStep;

  if (!steps || steps.length === 0 || currentIdx >= steps.length) {
    return {
      toolMessage: new ToolMessage({
        content: "No active step to advance. All steps are completed.",
        tool_call_id: toolCallId,
        name: ADVANCE_STEP_TOOL_NAME,
      }),
      advanced: false,
    };
  }

  const currentStep = steps[currentIdx];
  const missing = validateRequiredFields(currentStep, data);

  if (missing.length > 0) {
    logger.debug(`advance_step: missing required fields: ${missing.join(", ")}`);
    return {
      toolMessage: new ToolMessage({
        content:
          `Cannot advance — missing required information: ${missing.join(", ")}. ` +
          `Please gather this information from the customer before advancing.`,
        tool_call_id: toolCallId,
        name: ADVANCE_STEP_TOOL_NAME,
      }),
      advanced: false,
    };
  }

  const stepId = currentStep.id;
  const qualificationData = { [stepId]: data };

  const nextIdx = currentIdx + 1;
  const isLast = nextIdx >= steps.length;

  logger.log(
    `Step "${currentStep.name}" completed (${currentIdx + 1}/${steps.length}).` +
      (isLast ? " All steps done — ready for scoring." : ` Next: "${steps[nextIdx].name}"`)
  );

  return {
    toolMessage: new ToolMessage({
      content: isLast
        ? `Step "${currentStep.name}" completed. All qualification steps are done. Proceed to scoring.`
        : `Step "${currentStep.name}" completed. Moving to: "${steps[nextIdx].name}".`,
      tool_call_id: toolCallId,
      name: ADVANCE_STEP_TOOL_NAME,
    }),
    advanced: true,
    qualificationData,
  };
}

function extractLookupValue(
  state: typeof SalesState.State,
  lookupBy: string,
  context?: Record<string, any>
): string | undefined {
  if (context?.[lookupBy]) {
    return context[lookupBy];
  }

  const firstMsg = state.messages[0];
  const metadata =
    (firstMsg as any)?.additional_kwargs?.metadata ??
    (firstMsg as any)?.kwargs?.additional_kwargs?.metadata;

  if (metadata?.[lookupBy]) {
    return metadata[lookupBy];
  }

  return undefined;
}

function extractContactFromMetadata(state: typeof SalesState.State): IContactData {
  const firstMsg = state.messages[0];
  const metadata =
    (firstMsg as any)?.additional_kwargs?.metadata ??
    (firstMsg as any)?.kwargs?.additional_kwargs?.metadata;

  if (!metadata) return {};

  const { calculatorData, ...contactFields } = metadata;
  return contactFields;
}

/** Normalize enrichmentTools from toolSelector format to {name, config}[]. Filters out disabled tools. */
function resolveEnrichmentTools(
  raw: (string | ISalesToolConfig)[]
): { name: string; config?: Record<string, any> }[] {
  const result: { name: string; config?: Record<string, any> }[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      result.push({ name: item });
    } else if (item?.name && item.enabled !== false) {
      result.push({ name: item.name, config: item.config });
    }
  }
  return result;
}

function injectStepsToInput(input: any, resolvedSteps: IStepConfig[]): any {
  if (!input || typeof input !== "object") {
    return { steps: resolvedSteps };
  }

  if (input.steps && input.steps.length > 0) {
    return input;
  }

  return { ...input, steps: resolvedSteps };
}
