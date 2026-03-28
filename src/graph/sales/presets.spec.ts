import { resolveSteps } from "./presets";

describe("resolveSteps", () => {
  it("returns b2b_bant steps for preset", () => {
    const steps = resolveSteps("b2b_bant");
    expect(steps).toHaveLength(4);
    expect(steps.map(s => s.id)).toEqual(["greeting", "company", "needs", "budget"]);
  });

  it("returns b2c_service steps for preset", () => {
    const steps = resolveSteps("b2c_service");
    expect(steps).toHaveLength(4);
    expect(steps.map(s => s.id)).toEqual(["greeting", "service", "scheduling", "contact"]);
  });

  it("returns empty array for custom preset", () => {
    const steps = resolveSteps("custom");
    expect(steps).toEqual([]);
  });

  it("returns empty array when no preset specified", () => {
    const steps = resolveSteps();
    expect(steps).toEqual([]);
  });

  it("overrides preset with custom steps when provided", () => {
    const custom = [
      {
        id: "custom1",
        name: "Custom",
        prompt: "Do custom thing",
        fields: [{ name: "x", description: "X field", required: true }],
        tools: [],
      },
    ];

    const steps = resolveSteps("b2b_bant", custom);
    expect(steps).toHaveLength(1);
    expect(steps[0].id).toBe("custom1");
  });

  it("uses preset when empty steps array is provided", () => {
    const steps = resolveSteps("b2b_bant", []);
    expect(steps).toHaveLength(4);
  });

  it("each b2b_bant step has required fields", () => {
    const steps = resolveSteps("b2b_bant");
    for (const step of steps) {
      expect(step.id).toBeDefined();
      expect(step.name).toBeDefined();
      expect(step.prompt).toBeDefined();
      expect(Array.isArray(step.fields)).toBe(true);
      expect(Array.isArray(step.tools)).toBe(true);
    }
  });

  it("b2b_bant has correct required fields", () => {
    const steps = resolveSteps("b2b_bant");
    const companyStep = steps.find(s => s.id === "company")!;
    const requiredFields = companyStep.fields.filter(f => f.required).map(f => f.name);
    expect(requiredFields).toContain("companyName");
  });
});
