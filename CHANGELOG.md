# Changelog

## 0.7.0

### Breaking Changes

- **Sales graph v2** (`flutch.sales::2.0.0`) — graph version bumped from `1.0.0` to `2.0.0`; existing checkpoints are incompatible
- Remove standalone node files — all node logic now lives as class methods in `builder.ts`
- `ISalesConfigurable` now extends SDK's `IGraphConfigurable` instead of defining its own fields
- **`graphSettings` restructured** into nested groups: `conversation`, `crm`, `qualification`, `safety` — flat config no longer supported

### Added

- **Field-based qualification checklist** — `qualificationFields` array replaces rigid step system; AI collects fields naturally in conversation
- **Async extraction** (fire-and-forget) — cheap model extracts qualification data from conversation and writes to CRM every turn
- **Message windowing** — `conversation.messageWindowSize` controls how many messages are sent to LLM (default 50)
- `requestMetadata` state channel — extracted once from first message metadata
- `enrichmentTools` moved into CRM config group
- `contactFieldsWhitelist` — controls which CRM fields are visible to AI in system prompt
- Jobber CRM provider support
- `input_sanitize` node for prompt injection detection
- Lazy model initialization via `ModelInitializer` (cached per modelId)

### Removed

- Step-based qualification system (`presets.ts`, `transition-tool.ts`, `advance_step` tool, `IStepConfig`, `QualificationPreset`)
- Lead scoring (`ILeadScore`, `scoreAndHandoff`)
- Output guardrail node
- Auto-handoff (`autoHandoff`, `handoffWebhookUrl`)
- State channels: `currentStep`, `steps`, `qualificationData`, `leadScore`
- `ISalesContext` — replaced by SDK's `BaseGraphContext`

### Refactored

- Simplified 4-node graph: `context_sync → input_sanitize → generate ⇄ exec_tools → END`
- CRM = source of truth; `contactData` reducer changed from merge to replace (full reload each turn)
- Config schema grouped: `conversation` (model, prompt, tools), `crm` (provider, enrichment), `qualification` (fields, extraction), `safety` (sanitization)
- Graph builder receives `McpRuntimeHttpClient` and `ModelInitializer` via DI
- Move CRM credentials (`apiKey`, `baseUrl`) from graph config to `toolConfigs[toolName]._credentials`
- Split sales graph types into dedicated `sales.types.ts`

### Dependencies

- Upgrade `@flutchai/flutch-sdk` to `0.2.14`
- Add peer dependencies now required by SDK: `prom-client`, `mongoose`, `@nestjs/mongoose`, `@nestjs/terminus`, `@willsoto/nestjs-prometheus`

### Tests

- 77 sales graph tests across 6 suites
- Full coverage for context-sync, generate, exec-tools, input-sanitize, builder, routing

## 0.7.0-alpha.3

### Breaking Changes

- **Sales graph v2** (`flutch.sales::2.0.0`) — graph version bumped from `1.0.0` to `2.0.0`; existing checkpoints are incompatible
- Remove standalone node files — all node logic now lives as class methods in `builder.ts`
- `ISalesConfigurable` now extends SDK's `IGraphConfigurable` instead of defining its own fields
- **`graphSettings` restructured** into nested groups: `conversation`, `crm`, `qualification`, `safety` — flat config no longer supported

### Removed

- Step-based qualification system (`presets.ts`, `transition-tool.ts`, `advance_step` tool, `IStepConfig`, `QualificationPreset`)
- Lead scoring (`ILeadScore`, `scoreAndHandoff`)
- Output guardrail node
- Auto-handoff (`autoHandoff`, `handoffWebhookUrl`)
- State channels: `currentStep`, `steps`, `qualificationData`, `leadScore`
- `ISalesContext` — replaced by SDK's `BaseGraphContext`

### Added

- **Field-based qualification checklist** — `qualificationFields` array replaces rigid step system; AI collects fields naturally in conversation
- **Async extraction** (fire-and-forget) — cheap model extracts qualification data from conversation and writes to CRM every turn
- **Message windowing** — `conversation.messageWindowSize` controls how many messages are sent to LLM (default 50)
- `requestMetadata` state channel — extracted once from first message metadata
- `enrichmentTools` moved into CRM config group
- `contactFieldsWhitelist` — controls which CRM fields are visible to AI in system prompt
- Jobber CRM provider support
- `input_sanitize` node for prompt injection detection

### Refactored

- Simplified 4-node graph: `context_sync → input_sanitize → generate ⇄ exec_tools → END`
- CRM = source of truth; `contactData` reducer changed from merge to replace (full reload each turn)
- Config schema grouped: `conversation` (model, prompt, tools), `crm` (provider, enrichment), `qualification` (fields, extraction), `safety` (sanitization)
- Graph builder receives `McpRuntimeHttpClient` and `ModelInitializer` via DI

### Tests

- 77 sales graph tests across 6 suites
- Full coverage for context-sync (CRM load, extraction, enrichment), generate (windowing, qualification prompt), exec-tools, input-sanitize, builder, routing

## 0.7.0-alpha.2

### Refactored

- Move CRM credentials (`apiKey`, `baseUrl`) from graph config to `toolConfigs[toolName]._credentials`, aligning with MCP Runtime convention
- Remove `buildCrmCredentials` helper — nodes now read credentials directly from `toolConfigs`
- Remove `apiKey` / `baseUrl` from `ICrmConfig` interface and `config-schema-sales.json`

### Added

- Split sales graph types into dedicated `sales.types.ts`
- Lazy model initialization via `ModelInitializer` (cached per modelId)

### Chores

- Add `.claude/` and `docker-compose.twenty.yml` to `.gitignore`

## 0.7.0-alpha.1

- Initial sales graph with CRM integration (Twenty, Zoho)
- MCP Runtime tool execution with attachments
- Load/save context nodes for contact lookup and upsert
- Knowledge base admin module with search indexing
