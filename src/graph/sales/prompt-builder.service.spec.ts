import { PromptBuilderService } from "./prompt-builder.service";
import { ISalesGraphSettings, ILeadProfile, ITopicEntry } from "./sales.types";

const baseSettings: ISalesGraphSettings = {
  prompt: {
    template: "You are a sales assistant.",
    methodology: "Use SPIN selling.",
    guidelines: ["Be polite", "Ask open-ended questions"],
  },
  topics: [
    {
      name: "budget",
      label: "Budget",
      description: "Client budget range",
      extractionHint: "Money amounts",
      required: true,
    },
    {
      name: "timeline",
      label: "Timeline",
      description: "Project timeline",
      extractionHint: "Dates or deadlines",
      required: false,
    },
  ],
  tools: [],
  extraction: { modelId: "gpt-4o-mini", runEvery: 1 },
  llm: { modelId: "gpt-4o-mini" },
  crm: { provider: "none" },
};

const emptyProfile: ILeadProfile = {};
const fullProfile: ILeadProfile = {
  name: "Иван Петров",
  email: "ivan@example.com",
  company: "ООО Стройка",
};

const emptyTopicsMap: Record<string, ITopicEntry> = {
  budget: { status: "not_explored" },
  timeline: { status: "not_explored" },
};

describe("PromptBuilderService", () => {
  let service: PromptBuilderService;

  beforeEach(() => {
    service = new PromptBuilderService();
  });

  describe("build — sections", () => {
    it("includes the template at the start", () => {
      const result = service.build(baseSettings, fullProfile, emptyTopicsMap);
      expect(result).toContain("You are a sales assistant.");
    });

    it("includes methodology when provided", () => {
      const result = service.build(baseSettings, fullProfile, emptyTopicsMap);
      expect(result).toContain("Use SPIN selling.");
    });

    it("omits methodology section when not provided", () => {
      const settings = {
        ...baseSettings,
        prompt: { ...baseSettings.prompt, methodology: undefined },
      };
      const result = service.build(settings, fullProfile, emptyTopicsMap);
      expect(result).not.toContain("Use SPIN selling.");
    });

    it("includes guidelines prefixed with dash", () => {
      const result = service.build(baseSettings, fullProfile, emptyTopicsMap);
      expect(result).toContain("Rules:");
      expect(result).toContain("- Be polite");
      expect(result).toContain("- Ask open-ended questions");
    });

    it("omits rules section when guidelines is empty", () => {
      const settings = {
        ...baseSettings,
        prompt: { ...baseSettings.prompt, guidelines: [] },
      };
      const result = service.build(settings, fullProfile, emptyTopicsMap);
      expect(result).not.toContain("Rules:");
    });

    it("includes calculator data section when provided", () => {
      const result = service.build(baseSettings, fullProfile, emptyTopicsMap, {
        area: "200 m²",
        pitch: "30°",
      });
      expect(result).toContain("── Calculator data ──");
      expect(result).toContain("area: 200 m²");
      expect(result).toContain("pitch: 30°");
    });

    it("omits calculator section when calculatorData is empty object", () => {
      const result = service.build(baseSettings, fullProfile, emptyTopicsMap, {});
      expect(result).not.toContain("── Calculator data ──");
    });

    it("omits calculator section when calculatorData is undefined", () => {
      const result = service.build(baseSettings, fullProfile, emptyTopicsMap);
      expect(result).not.toContain("── Calculator data ──");
    });

    it("joins sections with double newline", () => {
      const result = service.build(baseSettings, fullProfile, emptyTopicsMap);
      expect(result).toContain("\n\n");
    });
  });

  describe("build — lead section", () => {
    it("includes name, company, email when present", () => {
      const result = service.build(baseSettings, fullProfile, emptyTopicsMap);
      expect(result).toContain("── About the customer ──");
      expect(result).toContain("Name: Иван Петров");
      expect(result).toContain("Email: ivan@example.com");
      expect(result).toContain("Company: ООО Стройка");
    });

    it("shows fallback text when profile is empty", () => {
      const result = service.build(baseSettings, emptyProfile, emptyTopicsMap);
      expect(result).toContain("No customer data available yet.");
    });

    it("shows only available fields when profile is partial", () => {
      const result = service.build(baseSettings, { name: "Иван" }, emptyTopicsMap);
      expect(result).toContain("Name: Иван");
      expect(result).not.toContain("Email:");
      expect(result).not.toContain("Company:");
    });
  });

  describe("build — topics section", () => {
    it("shows explored topics with ✅", () => {
      const topicsMap: Record<string, ITopicEntry> = {
        budget: { status: "explored", details: "50k budget confirmed" },
        timeline: { status: "not_explored" },
      };
      const result = service.build(baseSettings, emptyProfile, topicsMap);
      expect(result).toContain("✅ Budget: 50k budget confirmed");
    });

    it("shows partially explored topics with 🔄", () => {
      const topicsMap: Record<string, ITopicEntry> = {
        budget: { status: "partially", details: "Some budget info" },
        timeline: { status: "not_explored" },
      };
      const result = service.build(baseSettings, emptyProfile, topicsMap);
      expect(result).toContain("🔄 Budget (partially): Some budget info");
    });

    it("shows explored without details when details absent", () => {
      const topicsMap: Record<string, ITopicEntry> = {
        budget: { status: "explored" },
        timeline: { status: "not_explored" },
      };
      const result = service.build(baseSettings, emptyProfile, topicsMap);
      expect(result).toContain("✅ Budget");
      expect(result).not.toContain("✅ Budget:");
    });

    it("shows required unexplored topics in required section", () => {
      const result = service.build(baseSettings, emptyProfile, emptyTopicsMap);
      expect(result).toContain("Unexplored topics (required):");
      expect(result).toContain("☐ Budget — Client budget range");
    });

    it("shows optional unexplored topics in optional section", () => {
      const result = service.build(baseSettings, emptyProfile, emptyTopicsMap);
      expect(result).toContain("Unexplored topics (optional):");
      expect(result).toContain("☐ Timeline — Project timeline");
    });

    it("omits explored section when no topics explored", () => {
      const result = service.build(baseSettings, emptyProfile, emptyTopicsMap);
      expect(result).not.toContain("Explored topics:");
    });

    it("omits required section when all required topics explored", () => {
      const topicsMap: Record<string, ITopicEntry> = {
        budget: { status: "explored" },
        timeline: { status: "not_explored" },
      };
      const result = service.build(baseSettings, emptyProfile, topicsMap);
      expect(result).not.toContain("Unexplored topics (required):");
    });

    it("includes dialogue instructions at end of topics section", () => {
      const result = service.build(baseSettings, emptyProfile, emptyTopicsMap);
      expect(result).toContain("Naturally explore the unexplored topics through conversation.");
      expect(result).toContain("Don't ask questions in a list — lead a dialogue.");
    });

    it("handles missing topic entry (defaults to not_explored)", () => {
      // topicsMap has no entries at all
      const result = service.build(baseSettings, emptyProfile, {});
      expect(result).toContain("☐ Budget");
      expect(result).toContain("☐ Timeline");
    });
  });
});
