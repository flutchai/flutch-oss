# Changelog

## 0.8.0-alpha.1

### Breaking Changes

- **`ModelConfig` replaces flat model settings** — `modelId`, `temperature`, `maxTokens` replaced by unified `ModelConfig` object (`{ provider, modelName, temperature?, maxTokens?, tools? }`) across conversation, extraction, and safety configs
- **Multi-provider CRM config** — single `provider` field replaced by per-provider objects (`twenty`, `jobber`, `zoho`) with `enabled` flag and `_credentials`; only one provider active at a time
- **`availableTools` removed from conversation config** — tools now live inside `ModelConfig.tools`
- **`enrichmentTools` replaced by `enrichmentAgent`** — enrichment now calls a sub-agent via `call_agent` instead of executing MCP tools directly

### Changed

- **CRM contact flow: find → upsert** — first contact creates/finds via upsert tool instead of find, ensuring CRM record exists from first turn
- **Extraction fires only when needed** — skipped when no missing qualification fields or no `crmId`
- **Credential resolution cascade** — new `getProviderCredentials` helper looks up credentials from sibling tool configs, then falls back to per-provider `_credentials`
- Config schema uses new widget types: `modelConfig`, `credentials`, `oauth`, `agentSelector`
- `parseMcpResult` simplified — expects standard JSON instead of regex-based extraction from text
- Upgrade `@flutchai/flutch-sdk` to `0.2.17`

### Added

- `getActiveCrmProvider()` — finds first enabled CRM provider from config
- `buildCreateArgs()` — builds provider-specific create/upsert arguments with name resolution
- `buildEnrichmentQuery()` — generates natural language query from contact fields for enrichment agent
- Zoho `get` tool (`zoho_get_contact`) and Jobber `upsert` tool (`jobber_upsert_client`) in CRM tool map

### Fixed

- Simple graph builder now correctly unpacks `ModelConfig` object for model initialization

## 0.7.5

### Changed

- **Shared PostgreSQL pool** — extracted `PgPoolModule` (global) that creates a single `pg.Pool` singleton from `POSTGRES_*` env vars; `KmsModule` and `CheckpointerService` now share this pool instead of each creating their own
- **`CheckpointerService`** — removed `DATABASE_URL` dependency; now injects `PG_POOL_TOKEN` from `PgPoolModule`; pool lifecycle (shutdown) managed centrally by `PgPoolModule`
- **`KmsModule`** — removed own pool creation and `onApplicationShutdown`; uses `getSharedPool()` to receive the shared instance
- **`AppModule`** — imports `PgPoolModule.forRoot()` before other modules to ensure pool is ready

## 0.7.4

### Fixed

- **CheckpointerService** — strip `sslmode` query param from `DATABASE_URL` before passing to `pg.Pool`; managed databases (Railway, Supabase) often include `sslmode=require` in the URL which conflicts with the explicit `ssl` object, causing connection errors

## 0.7.3

### Fixed

- **CheckpointerService SSL** — `PostgresSaver` now uses an explicit `pg.Pool` with `POSTGRES_SSL=true` support (`rejectUnauthorized: false`); previously `fromConnString` created an internal pool with no SSL, causing connection failures on managed PostgreSQL (Railway, RDS, Supabase)

## 0.7.2

### Fixed

- **Standalone mode model routing** — `ModelFactory` and `ModelConfigFetcher` no longer override provider base URLs when `FLUTCH_API_TOKEN` is not set; LangChain now hits native provider APIs (`api.openai.com`, `api.anthropic.com`, `api.mistral.ai`) directly in standalone deployments instead of always routing to the Flutch Gateway
- **KmsModule PostgreSQL SSL** — `POSTGRES_SSL=true` support added to `KmsModule` pool configuration (same pattern as `CheckpointerService`)

## 0.7.1

### Added

- **Mistral AI support** — new `"mistral"` provider in `ModelFactory`; auto-detected from model name (`mistral-*`, `mixtral-*`); routes through Flutch Gateway via `serverURL`
- **`FLUTCH_API_TOKEN`** — unified platform token for Flutch Gateway; when set, replaces per-provider keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`) for all providers
- **PostgreSQL SSL** — `POSTGRES_SSL=true` env var enables SSL with `rejectUnauthorized: false` (for managed/cloud Postgres)

### Changed

- Upgrade `@flutchai/flutch-sdk` to `0.2.15`
- Add `@langchain/mistralai ^1.0.7` dependency

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
