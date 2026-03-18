# Flutch OSS

Standalone on-premise agent engine built on [Flutch SDK](https://www.npmjs.com/package/@flutchai/flutch-sdk) and LangGraph.

Deploy AI agents on your own infrastructure — clients own the code and data.

## What this is

Flutch OSS is a self-hosted agent runtime that lets you run AI agents on your own servers. Unlike a SaaS solution, everything runs in your environment: the agent engine, knowledge base, and all data stay with you.

The agent graph (business logic) is pluggable — swap it out for your specific vertical without changing the infrastructure.

## How it works

```
User → Platform Connector → Agent Engine (LangGraph) → Tools / Knowledge Base
                                      ↕
                            Flutch Platform (optional)
                            connected mode: threads, users, config
```

Two modes:
- **Standalone** — fully local, no external dependencies
- **Connected** — links to Flutch Platform for thread management, user auth, and analytics

## Stack

| Component | Technology |
|-----------|-----------|
| Agent Engine | NestJS + LangGraph |
| Database | PostgreSQL 16 + pgvector |
| Knowledge Base | pgvector |
| Tracing | LangFuse (optional) |
| Monitoring | Prometheus + Promtail |
| Admin UI | React + Vite (served at `/admin/`) |

## Getting started

### Requirements

- Docker and Docker Compose
- Node.js 20+
- Yarn 4.5+

### Run with Docker Compose

```bash
cp .env.example .env
# Fill in your API keys and secrets

docker compose up
```

Engine available at `http://localhost:3000`.
Admin UI available at `http://localhost:3000/admin/`.

### Pull from GHCR

A pre-built image is published to GitHub Container Registry on every release:

```bash
docker pull ghcr.io/flutchai/flutch-oss:latest
```

### Local development

```bash
yarn install
cp .env.example .env
yarn dev
```

## Configuration

### Environment variables

Copy `.env.example` to `.env` and fill in the values.

**Core**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CONFIG_MODE` | Yes | — | Agent config source: `local` (agents.json) or `platform` (Flutch API) |
| `OPENAI_API_KEY` | * | — | OpenAI API key (required for GPT models) |
| `ANTHROPIC_API_KEY` | * | — | Anthropic API key (required for Claude models) |
| `GOOGLE_API_KEY` | * | — | Google API key (required for Gemini models) |
| `PORT` | No | `3000` | HTTP port the engine listens on |

\* At least one LLM key is required, depending on the models you configure.

**PostgreSQL**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_HOST` | Yes | — | PostgreSQL host |
| `POSTGRES_PORT` | Yes | — | PostgreSQL port |
| `POSTGRES_USER` | Yes | — | PostgreSQL user |
| `POSTGRES_PASSWORD` | Yes | — | PostgreSQL password |
| `POSTGRES_DB` | Yes | — | PostgreSQL database name |

**Admin UI**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADMIN_PASSWORD` | Yes | — | Bootstrap password — invalidated after first login |
| `ADMIN_JWT_SECRET` | Yes | — | Secret key for JWT signing |
| `WEBHOOK_BASE_URL` | Yes | — | Public base URL of this server (used for Telegram webhook registration) |

**Flutch Platform (connected mode)**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_URL` | connected mode | — | Flutch Platform base URL |
| `INTERNAL_API_TOKEN` | connected mode | — | Bearer token for Flutch Platform auth |

**Telegram Platform Connector**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN_<AGENTID>` | No | — | Per-agent Telegram bot token. Replace `<AGENTID>` with the agent ID in uppercase with dashes converted to underscores (e.g. `TELEGRAM_BOT_TOKEN_ROOFING_AGENT`) |
| `TELEGRAM_WEBHOOK_SECRET` | No | — | Optional secret token for webhook verification |

**LangFuse tracing (optional)**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LANGFUSE_ENABLED` | No | `false` | Enable LangFuse tracing |
| `LANGFUSE_PUBLIC_KEY` | No | — | LangFuse public key |
| `LANGFUSE_SECRET_KEY` | No | — | LangFuse secret key |
| `LANGFUSE_BASE_URL` | No | — | Explicit LangFuse URL (overrides host+port) |
| `LANGFUSE_HOST` | No | — | LangFuse host (used with `LANGFUSE_PORT`) |
| `LANGFUSE_PORT` | No | — | LangFuse port (used with `LANGFUSE_HOST`) |

**Monitoring**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LOKI_URL` | No | — | Loki push endpoint for Promtail |

### Agent configuration (agents.json)

In `local` mode (default), the engine reads agent configs from `agents.json` in the working directory.

Copy the example and edit it:

```bash
cp agents.example.json agents.json
```

File format — a flat map of `agentId → config`:

```json
{
  "my-agent": {
    "agentId": "my-agent",
    "graphType": "flutch.agent",
    "graphSettings": {
      "model": "gpt-4o-mini",
      "systemPrompt": "You are a helpful assistant.",
      "temperature": 0.7,
      "maxTokens": 2048
    }
  },
  "claude-agent": {
    "agentId": "claude-agent",
    "graphType": "flutch.agent",
    "graphSettings": {
      "model": "claude-3-5-sonnet-20241022",
      "systemPrompt": "You are a concise assistant.",
      "temperature": 0.5
    }
  }
}
```

**graphSettings fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | Yes | Model name, e.g. `gpt-4o-mini`, `claude-3-5-sonnet-20241022` |
| `provider` | `openai` \| `anthropic` \| `google` | No | Inferred from model name if omitted |
| `systemPrompt` | string | No | System prompt prepended to every conversation |
| `temperature` | number | No | Sampling temperature (default: `0.7`) |
| `maxTokens` | number | No | Max output tokens (default: `2048`) |

## Admin UI

A built-in admin UI is served at `/admin/`. It provides:

- **Dashboard** — overview stats
- **Agents** — list and inspect configured agents
- **Conversations** — browse conversation history
- **Users** — manage users
- **Knowledge Bases** — create and manage knowledge bases; add, edit, and publish articles for vector search
- **Settings** — configure platform URL, API keys, and webhook base URL

The UI is responsive — a mobile-optimized layout is available at `/admin/m/` and is served automatically based on user-agent.

**First login**: use the `ADMIN_PASSWORD` from your `.env`. You will be prompted to set a new password immediately after.

## Knowledge Base

Knowledge bases store articles indexed with pgvector for semantic search. Articles are automatically indexed when published and removed from the index when unpublished or deleted.

Manage knowledge bases via the Admin UI or the API at `/admin/api/knowledge-bases`.

## Platform Connectors

### Telegram

Register a Telegram bot token per agent using the `TELEGRAM_BOT_TOKEN_<AGENTID>` env variable. Telegram will call the webhook at `{WEBHOOK_BASE_URL}/platform/telegram/{agentId}`.

## Customizing the agent graph

Agent logic lives in `src/graph/v1.0.0/builder.ts`. Replace the placeholder with your domain-specific graph:

```typescript
export class AgentV1Builder extends AbstractGraphBuilder<"1.0.0"> {
  async buildGraph(): Promise<any> {
    const workflow = new StateGraph(AgentState)
      .addNode("your_node", yourNode.execute.bind(yourNode));

    workflow.addEdge(START, "your_node");
    workflow.addEdge("your_node", END);

    return workflow.compile();
  }
}
```

## Development

This project uses **Yarn** as its package manager. Do not use `npm` or `npx` — they will create a `package-lock.json` which is not committed.

```bash
yarn dev          # start with watch
yarn test         # run backend unit tests
yarn test:cov     # run backend tests with coverage
yarn test:all     # run backend + client + e2e tests
yarn lint         # lint
yarn format       # format code
yarn build        # production build
```

## License

MIT
