# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
