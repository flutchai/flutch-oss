import { Logger } from "@nestjs/common";
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import {
  IGraphAttachment,
  executeToolWithAttachments,
} from "@flutchai/flutch-sdk";
import { SalesState } from "../sales.annotations";
import { SalesRunnableConfig } from "../sales.types";

const logger = new Logger("ExecToolsNode");

/**
 * Executes tool calls from the LLM generation via McpRuntimeHttpClient.
 */
export async function execToolsNode(
  state: typeof SalesState.State,
  config: SalesRunnableConfig,
): Promise<Partial<typeof SalesState.State>> {
  try {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
    const toolCalls = lastMessage?.tool_calls ?? [];

    if (toolCalls.length === 0) {
      logger.warn("No tool calls found in the last message");
      return {};
    }

    logger.log(`Executing ${toolCalls.length} tool calls`);

    const mcpClient = config?.configurable?.mcpClient;
    const toolConfigs = config?.configurable?.toolConfigs ?? {};

    // Build execution context with full context extraction
    const context = config?.configurable?.context;
    const executionContext: Record<string, any> = {};

    if (context?.userId) executionContext.userId = context.userId;
    if (context?.agentId) executionContext.agentId = context.agentId;
    if (context?.threadId || config?.configurable?.thread_id) {
      executionContext.threadId =
        context?.threadId || config?.configurable?.thread_id;
    }
    if (context?.messageId) executionContext.messageId = context.messageId;
    if (context?.platform) executionContext.platform = context.platform;
    if (context?.companyId) executionContext.companyId = context.companyId;

    const toolMessages: ToolMessage[] = [];
    const newAttachments: Record<string, IGraphAttachment> = {};

    for (const toolCall of toolCalls) {
      if (!mcpClient) {
        toolMessages.push(
          new ToolMessage({
            content: JSON.stringify({
              error: `Tool "${toolCall.name}" is not available in this configuration.`,
              tool: toolCall.name,
            }),
            tool_call_id: toolCall.id ?? toolCall.name,
            name: toolCall.name,
          }),
        );
        continue;
      }

      try {
        const toolConfig = toolConfigs[toolCall.name] ?? {};
        const enrichedArgs = { ...toolConfig, ...(toolCall.args ?? {}) };
        const toolExecutionContext = { ...toolConfig, ...executionContext };

        logger.debug(
          `Executing tool: ${toolCall.name} with enriched args: ${JSON.stringify(enrichedArgs)}`,
        );

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
          logger,
        });

        toolMessages.push(result.toolMessage);
        if (result.attachment) {
          newAttachments[result.attachment.key] = result.attachment.value;
        }

        logger.log(`Tool ${toolCall.name} executed successfully`);
      } catch (toolError) {
        logger.error(`Error executing tool ${toolCall.name}:`, toolError);
        toolMessages.push(
          new ToolMessage({
            content: JSON.stringify({
              error:
                toolError instanceof Error
                  ? toolError.message
                  : "Tool execution failed",
              tool: toolCall.name,
            }),
            tool_call_id: toolCall.id ?? toolCall.name,
            name: toolCall.name,
          }),
        );
      }
    }

    return {
      messages: toolMessages,
      ...(Object.keys(newAttachments).length > 0
        ? { attachments: newAttachments }
        : {}),
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    logger.error(`Error in execToolsNode: ${errorMessage}`);
    throw error;
  }
}
