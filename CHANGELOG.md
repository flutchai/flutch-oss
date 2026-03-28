# Changelog

## 0.7.0-alpha.3

### Breaking Changes

- **Sales graph v2** (`flutch.sales::2.0.0`) — graph version bumped from `1.0.0` to `2.0.0`; existing checkpoints are incompatible
- Remove standalone node files (`load-context.node.ts`, `save-context.node.ts`, `generate.node.ts`, `exec-tools.node.ts`) — all node logic now lives as class methods in `builder.ts`
- `ISalesConfigurable` now extends SDK's `IGraphConfigurable` instead of defining its own fields

### Added

- **Step-based qualification flow** with configurable steps, fields, and per-step tool access
- Qualification presets (`b2b_bant`, `b2c_service`, `custom`) via new `presets.ts` with `resolveSteps()`
- `advance_step` transition tool — LLM calls it to move between qualification steps; validates required fields before advancing
- Lead scoring (`ILeadScore`) with `qualified` / `nurture` / `disqualified` outcomes
- New state channels: `currentStep`, `steps`, `qualificationData`, `leadScore`, `enrichmentStatus`
- Async lead enrichment on first message via `enrichmentTools` setting
- Auto-handoff support (`autoHandoff`, `handoffWebhookUrl`) for qualified leads
- Jobber CRM provider support (`jobber_list_clients`, `jobber_get_client`, `jobber_create_client`, `jobber_update_client`)
- `config-schema-sales.json` extended with `preset`, `steps`, `enrichmentTools`, `autoHandoff`, `handoffWebhookUrl`

### Refactored

- Merge `context_sync` node (load + save + enrichment) into a single graph node, replacing separate `load_context` → `save_context` flow
- Graph builder now receives `McpRuntimeHttpClient` and `ModelInitializer` via DI (constructor injection) instead of creating them internally
- `extractToolConfigs()` utility moved to `sales.types.ts`
- `ISalesContext` extends SDK's `BaseGraphContext` with `email` / `phone` lookup fields

### Tests

- Rewrite builder, generate, and exec-tools specs for v2 architecture
- Add `presets.spec.ts` and `transition-tool.spec.ts` for new modules
- Add `context-sync.node.spec.ts` for merged context sync node

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
