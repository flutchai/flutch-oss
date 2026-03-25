# Changelog

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
