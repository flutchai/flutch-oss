import { IStepConfig, QualificationPreset } from "./sales.types";

const B2B_BANT_STEPS: IStepConfig[] = [
  {
    id: "greeting",
    name: "Greeting",
    prompt: `You are in the greeting phase. Your goals:
1. Welcome the customer warmly
2. Introduce yourself briefly
3. Ask an open-ended question to understand why they reached out

Keep it conversational. Do not ask multiple questions at once.
If you have CRM data about the customer, reference it naturally.
When the customer has shared their reason, call advance_step to move forward.`,
    fields: [{ name: "reason", description: "Why the customer reached out", required: false }],
    tools: [],
  },
  {
    id: "company",
    name: "Company Discovery",
    prompt: `You are gathering company information. Collect through natural conversation:
1. Company name
2. Company size (approximate employees)
3. Industry/vertical
4. Customer's role/title

Ask naturally, not as a checklist. Use information already known from CRM.
When you have the company name at minimum, call advance_step with the gathered data.`,
    fields: [
      { name: "companyName", description: "Company name", required: true },
      {
        name: "companySize",
        description: "Company size (e.g. 1-10, 11-50, 51-200, 201-1000, 1000+)",
        required: false,
      },
      { name: "industry", description: "Industry or vertical", required: false },
      { name: "role", description: "Customer's role or job title", required: false },
    ],
    tools: [],
  },
  {
    id: "needs",
    name: "Needs Assessment",
    prompt: `You are understanding the customer's specific needs. Explore:
1. What challenges or pain points they face
2. What solutions they currently use and what's not working
3. What outcomes they hope to achieve

Listen actively. Ask follow-up questions. Summarize what you heard.
When you understand at least one pain point, call advance_step.`,
    fields: [
      {
        name: "painPoints",
        description: "Key challenges or pain points (comma-separated)",
        required: true,
      },
      {
        name: "currentSolutions",
        description: "Current tools or solutions they use",
        required: false,
      },
      { name: "desiredOutcomes", description: "Desired outcomes", required: false },
    ],
    tools: [],
  },
  {
    id: "budget",
    name: "Budget & Timeline",
    prompt: `You are discussing budget and timeline. Gather:
1. Budget range (even rough)
2. Decision timeline
3. Who else is involved in the decision

Be tactful about budget. Frame it as helping recommend the right solution.
Offer ranges to make it easier. When you have budget info, call advance_step.`,
    fields: [
      {
        name: "budgetRange",
        description: "Budget range (e.g. $1k-5k/mo, $5k-20k/mo)",
        required: true,
      },
      {
        name: "timeline",
        description: "Decision timeline (e.g. this_month, this_quarter, exploring)",
        required: false,
      },
      { name: "decisionMakers", description: "People involved in the decision", required: false },
    ],
    tools: [],
  },
];

const B2C_SERVICE_STEPS: IStepConfig[] = [
  {
    id: "greeting",
    name: "Greeting",
    prompt: `You are in the greeting phase. Your goals:
1. Welcome the customer warmly
2. Ask what service they need help with

Keep it friendly and simple. One question at a time.
When they share what they need, call advance_step.`,
    fields: [{ name: "reason", description: "What service they need", required: false }],
    tools: [],
  },
  {
    id: "service",
    name: "Service Details",
    prompt: `You are gathering details about the service needed:
1. Type of service (e.g. plumbing, landscaping, cleaning)
2. Property type (residential/commercial)
3. Scope and description of the work

Ask clarifying questions to understand the job.
When you know the service type, call advance_step.`,
    fields: [
      { name: "serviceType", description: "Type of service needed", required: true },
      {
        name: "propertyType",
        description: "Property type (residential, commercial)",
        required: false,
      },
      { name: "scopeDescription", description: "Description of work needed", required: false },
    ],
    tools: [],
  },
  {
    id: "scheduling",
    name: "Scheduling",
    prompt: `You are discussing scheduling:
1. When do they need the service (preferred dates/times)
2. How urgent is it
3. Service address/location

Be helpful with scheduling options. When you know urgency, call advance_step.`,
    fields: [
      { name: "preferredDates", description: "Preferred dates or timeframe", required: false },
      {
        name: "urgency",
        description: "Urgency level (emergency, this_week, flexible)",
        required: true,
      },
      { name: "address", description: "Service address or area", required: false },
    ],
    tools: [],
  },
  {
    id: "contact",
    name: "Contact Information",
    prompt: `You are collecting contact information:
1. Full name
2. Phone number
3. Email address

Ask naturally. If info is already known from CRM, confirm it.
When you have the name, call advance_step.`,
    fields: [
      { name: "fullName", description: "Customer's full name", required: true },
      { name: "phone", description: "Phone number", required: false },
      { name: "email", description: "Email address", required: false },
    ],
    tools: [],
  },
];

const PRESET_MAP: Record<QualificationPreset, IStepConfig[]> = {
  b2b_bant: B2B_BANT_STEPS,
  b2c_service: B2C_SERVICE_STEPS,
  custom: [],
};

/**
 * Resolve qualification steps from preset and optional overrides.
 * If explicit steps are provided, they take priority over the preset.
 */
export function resolveSteps(preset?: QualificationPreset, steps?: IStepConfig[]): IStepConfig[] {
  if (steps && steps.length > 0) return steps;
  return PRESET_MAP[preset ?? "custom"] ?? [];
}
