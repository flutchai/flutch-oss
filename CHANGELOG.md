# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.1] - 2026-03-14

### Added
- CI: `client-tests` job runs Vitest (109 tests) with V8 coverage reporting
- CI: PR coverage comment now has two sections — **Backend** (Jest) and **Client** (Vitest)
- `client/package.json`: `test:cov` script (`vitest run --coverage`)
- `client/vitest.config.ts`: V8 coverage config with `json-summary` reporter
- `client/.gitignore`: ignores `node_modules/`, `dist/`, `coverage/`, `.yarn/` internals
- `client/yarn.lock`: lockfile for reproducible installs

### Changed
- Migrated `client/` from npm to Yarn — `packageManager: yarn@4.5.3`
- Root `package.json` client scripts use `yarn --cwd client` instead of `npm --prefix client`
- `test:all` now runs: backend unit → client → e2e

### Fixed
- `client/package-lock.json` removed from git (project uses Yarn exclusively)
- Added missing `@testing-library/dom` peer dependency for `@testing-library/react`

## [0.5.0] - 2026-03-14

### Fixed
- **Fail-fast config hardening** — removed all silent fallback values for required environment variables across the codebase (follow-up to code review):
  - `AgentConfigService`: `CONFIG_MODE` now uses `getOrThrow` — missing var throws at startup instead of defaulting to `"local"`
  - `DatabaseModule`: all 5 Postgres params (`POSTGRES_HOST/PORT/USER/PASSWORD/DB`) use `getOrThrow`
  - `data-source.ts` (TypeORM CLI): `requireEnv()` helper throws on any missing Postgres var — CLI migrations fail fast
  - `AdminSettingsService`: removed `""` fallbacks for `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `FLUTCH_PLATFORM_URL`, `WEBHOOK_BASE_URL`, `CONFIG_MODE`
  - `LangfuseService`: `LANGFUSE_HOST` no longer defaults to `"localhost"` — URL is built only when both `LANGFUSE_HOST` and `LANGFUSE_PORT` are set
- **Tests**: added `root.controller.spec.ts` covering `serveAdmin()` SPA path resolution, asset serving, and error fallback to `index.html`

## [0.4.0] - 2026-03-14

### Added
- **LangFuse tracing** — `LangfuseService` creates a per-request `CallbackHandler` bound to the LLM via `model.withConfig({ callbacks })`, tagging each trace with `userId`, `agentId`, `threadId`
- `LangfuseModule` — `@Global()` module, auto-registered in `AppModule`
- Flexible `baseUrl` resolution: `LANGFUSE_BASE_URL` (explicit) → `LANGFUSE_HOST:LANGFUSE_PORT` (auto-build) → LangFuse Cloud (fallback)
- `langfuse-langchain` dependency
- LangFuse env vars documented in `.env.example` (`LANGFUSE_ENABLED`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_PORT`, `LANGFUSE_HOST`)

### Changed
- `AgentV1Builder` — injects optional `LangfuseService`, creates callback handler per `buildGraph()` call with full request context

## [0.3.0] - 2026-03-13

### Added
- Mini Admin UI — React + Vite frontend served at `/admin/`
- Desktop layout with collapsible sidebar navigation (Dashboard, Agents, Conversations, Users, Settings)
- Mobile layout at `/admin/m/` with bottom navigation bar; auto-redirect by user-agent
- Mobile-specific pages: MobileDashboard, MobileConversations (cards), MobileUsers (cards), MobileConversationDetail (chat bubbles), MobileUserDetail, MobileAgents, MobileSettings
- Admin backend module: auth (JWT), agents, conversations, users, dashboard stats, settings API
- `AdminUser` entity + migration `202603130000-AddAdminUsers`
- `RootController` — serves admin UI static files
- All UI strings in English; all tested elements use `data-testid` selectors

## [0.2.0] - 2026-03-10

### Added
- `EngineController` — new `POST /agent/stream` and `POST /agent/generate` endpoints that accept `{agentId, userId, input}` instead of raw graph payload
- `EngineService.buildPayload()` — assembles full `IGraphRequestPayload` from resolved agent context
- `AgentConfigService` — resolves agent configuration from local `agents.json` (standalone mode) or Flutch Platform API (connected mode), controlled by `CONFIG_MODE` env variable
- `ModelFactory` (`createModel`) — creates ChatOpenAI or ChatAnthropic instance from `graphSettings`, with automatic provider inference from model name
- `@langchain/openai` and `@langchain/anthropic` as direct dependencies (previously transitive only)
- `agents.example.json` — example agent configuration file for standalone mode
- Full test coverage for `EngineService`, `AgentConfigService`, `ModelFactory`, and `AgentV1Builder`

### Changed
- `AgentV1Builder.buildGraph()` now uses `ModelFactory` and reads `graphSettings` from payload (model, systemPrompt, temperature, maxTokens)
- README: updated configuration section with new env variables and `agents.json` format

## [0.1.0] - 2025-03-10

### Added
- Initial project scaffold based on Flutch SDK
- Generic agent graph v1.0.0 (placeholder for vertical-specific logic)
- Docker Compose stack: engine, MongoDB, Ragflow, Prometheus, Promtail
- ESLint + Prettier configuration
- GitHub Actions CI workflow (lint, format check, tests, build)
