import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { IStepConfig } from "./sales.types";

/** Name of the transition tool — used to identify it in exec_tools */
export const ADVANCE_STEP_TOOL_NAME = "advance_step";

/**
 * Build a dynamic advance_step tool whose schema matches the current step's fields.
 * The LLM calls this tool when it has gathered enough info for the current step.
 *
 * The actual state transition logic is handled in exec_tools, not here.
 * This tool definition only provides the schema and description for the LLM.
 */
export function buildAdvanceStepTool(step: IStepConfig): DynamicStructuredTool {
  const fieldEntries: Record<string, z.ZodTypeAny> = {};

  for (const field of step.fields) {
    fieldEntries[field.name] = z.string().optional().describe(field.description);
  }

  const schema = z.object(fieldEntries);

  const requiredNames = step.fields.filter(f => f.required).map(f => f.name);

  const requiredNote =
    requiredNames.length > 0 ? ` Required fields: ${requiredNames.join(", ")}.` : "";

  // Cast to any to avoid TS2589 (excessively deep type instantiation with dynamic Zod schema)
  return new DynamicStructuredTool({
    name: ADVANCE_STEP_TOOL_NAME,
    description:
      `Record the information gathered in the "${step.name}" step and advance to the next step.` +
      ` Call this when you have collected enough information from the customer.` +
      requiredNote,
    schema,
    func: async () => {
      // This function is never actually called — exec_tools intercepts advance_step
      // and handles it locally. This is just a placeholder for the tool definition.
      return "Step transition handled by exec_tools";
    },
  } as any);
}

/**
 * Validate that all required fields for the step are present and non-empty.
 * Returns list of missing required field names.
 */
export function validateRequiredFields(step: IStepConfig, data: Record<string, any>): string[] {
  const missing: string[] = [];
  for (const field of step.fields) {
    if (field.required) {
      const value = data[field.name];
      if (value == null || (typeof value === "string" && value.trim() === "")) {
        missing.push(field.name);
      }
    }
  }
  return missing;
}
