import {
  buildAdvanceStepTool,
  validateRequiredFields,
  ADVANCE_STEP_TOOL_NAME,
} from "./transition-tool";
import { IStepConfig } from "./sales.types";

const sampleStep: IStepConfig = {
  id: "company",
  name: "Company Discovery",
  prompt: "Gather company info",
  fields: [
    { name: "companyName", description: "Company name", required: true },
    { name: "companySize", description: "Size", required: false },
    { name: "industry", description: "Industry", required: false },
  ],
  tools: [],
};

describe("ADVANCE_STEP_TOOL_NAME", () => {
  it("equals 'advance_step'", () => {
    expect(ADVANCE_STEP_TOOL_NAME).toBe("advance_step");
  });
});

describe("buildAdvanceStepTool", () => {
  it("returns a tool with correct name", () => {
    const tool = buildAdvanceStepTool(sampleStep);
    expect(tool.name).toBe("advance_step");
  });

  it("includes step name in description", () => {
    const tool = buildAdvanceStepTool(sampleStep);
    expect(tool.description).toContain("Company Discovery");
  });

  it("mentions required fields in description", () => {
    const tool = buildAdvanceStepTool(sampleStep);
    expect(tool.description).toContain("companyName");
  });

  it("has schema with all step fields", () => {
    const tool = buildAdvanceStepTool(sampleStep);
    const schema = tool.schema as any;
    expect(schema.shape).toHaveProperty("companyName");
    expect(schema.shape).toHaveProperty("companySize");
    expect(schema.shape).toHaveProperty("industry");
  });

  it("func returns placeholder string", async () => {
    const tool = buildAdvanceStepTool(sampleStep);
    const result = await tool.func({});
    expect(result).toContain("exec_tools");
  });
});

describe("validateRequiredFields", () => {
  it("returns empty array when all required fields present", () => {
    const missing = validateRequiredFields(sampleStep, { companyName: "Acme" });
    expect(missing).toEqual([]);
  });

  it("returns missing required field names", () => {
    const missing = validateRequiredFields(sampleStep, { industry: "Tech" });
    expect(missing).toEqual(["companyName"]);
  });

  it("considers empty string as missing", () => {
    const missing = validateRequiredFields(sampleStep, { companyName: "" });
    expect(missing).toEqual(["companyName"]);
  });

  it("considers whitespace-only string as missing", () => {
    const missing = validateRequiredFields(sampleStep, { companyName: "   " });
    expect(missing).toEqual(["companyName"]);
  });

  it("considers null as missing", () => {
    const missing = validateRequiredFields(sampleStep, { companyName: null });
    expect(missing).toEqual(["companyName"]);
  });

  it("considers undefined as missing", () => {
    const missing = validateRequiredFields(sampleStep, {});
    expect(missing).toEqual(["companyName"]);
  });

  it("ignores optional fields", () => {
    const missing = validateRequiredFields(sampleStep, { companyName: "Acme" });
    expect(missing).not.toContain("companySize");
    expect(missing).not.toContain("industry");
  });

  it("returns empty for step with no required fields", () => {
    const optionalStep: IStepConfig = {
      id: "greeting",
      name: "Greeting",
      prompt: "Greet",
      fields: [{ name: "reason", description: "Why", required: false }],
      tools: [],
    };
    const missing = validateRequiredFields(optionalStep, {});
    expect(missing).toEqual([]);
  });
});
