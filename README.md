# Flutch OSS

Self-hosted AI agent engine — deploy production-ready agents on your own infrastructure. Built on [LangGraph](https://github.com/langchain-ai/langgraphjs) and [NestJS](https://nestjs.com).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-ghcr.io%2Fflutchai%2Fflutch--oss-blue)](https://ghcr.io/flutchai/flutch-oss)

## Quick start

**Prerequisites:** Docker + Docker Compose

```bash
# 1. Get the project
git clone https://github.com/flutchai/sales-agent
cd sales-agent

# 2. Configure
cp .env.example .env
#    → set OPENAI_API_KEY (or ANTHROPIC_API_KEY)
#    → set ADMIN_PASSWORD and ADMIN_JWT_SECRET

# 3. Configure your agent
cp agents.example.json agents.json
cp mcp-servers.example.json mcp-servers.json
#    → edit agents.json to customize the system prompt

# 4. Start
docker compose up
```

That's it. In ~30 seconds:

| | URL |
|--|--|
| **Agent API** | http://localhost:3000 |
| **Admin UI** | http://localhost:3000/admin |

Send your first message:

```bash
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -d '{"agentId":"roofing-agent","message":{"content":"What shingles should I use for a flat roof?"}}'
```

Or use the CLI:

```bash
npx @flutchai/cli init my-agents   # scaffolds a new project and starts it
```

---

## What's included

| Component | Description |
|-----------|-------------|
| **Agent engine** | NestJS + LangGraph — handles requests, streaming, conversation memory |
| **MCP Runtime** | Tool execution proxy — connects agents to external tools via [MCP](https://modelcontextprotocol.io) |
| **PostgreSQL** | Conversation history, admin data, pgvector for knowledge base |
| **Admin UI** | Manage agents, conversations, knowledge base, users |

**Included agent types:**

| `graphType` | Description |
|-------------|-------------|
| `flutch.simple` | Chat agent with optional tools — good starting point |
| `flutch.sales` | CRM-driven lead qualification with async field extraction |

---

## Agent configuration

Agents are defined in `agents.json`. Each key is the `agentId` you pass in API requests.

```json
{
  "my-agent": {
    "graphType": "flutch.simple",
    "graphSettings": {
      "model": "gpt-4o-mini",
      "systemPrompt": "You are a helpful assistant for an e-commerce store."
    }
  }
}
```

You can define as many agents as you like — they all run in the same process.

**Supported models:** any model from OpenAI, Anthropic, Google, or Mistral. Set the corresponding `*_API_KEY` in `.env`.

**Full agents.json reference:** [agents.example.json](agents.example.json)

---

## Tools (MCP)

The MCP Runtime connects agents to external tools — web search, GitHub, Slack, databases, and more.

Configure which servers to enable in `mcp-servers.json`:

```json
{
  "servers": [
    {
      "name": "web-search",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "tavily-mcp@0.1.4"],
      "env": { "TAVILY_API_KEY": "${TAVILY_API_KEY}" },
      "enabled": true
    }
  ]
}
```

Any npm package implementing the MCP stdio protocol works. Start from `mcp-servers.example.json`.

---

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/generate` | Non-streaming request |
| `POST` | `/stream` | Server-Sent Events streaming |
| `POST` | `/cancel/:requestId` | Cancel in-flight request |
| `GET` | `/graph-types` | List registered agent types |
| `GET` | `/health` | Health check |

### Request body

```json
{
  "agentId": "my-agent",
  "requestId": "req-001",
  "threadId": "user-123-session-1",
  "message": {
    "content": "Hello!",
    "attachments": []
  }
}
```

`threadId` scopes conversation memory — same thread = same conversation history.

---

## Environment variables

Copy `.env.example` to `.env`. Only a few are required to get started:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✓ | PostgreSQL connection string |
| `OPENAI_API_KEY` | ✓* | Required if using GPT models |
| `ANTHROPIC_API_KEY` | ✓* | Required if using Claude models |
| `ADMIN_PASSWORD` | ✓ | Admin UI bootstrap password |
| `ADMIN_JWT_SECRET` | ✓ | Secret for JWT signing (any random string) |
| `MCP_RUNTIME_URL` | | Default: `http://localhost:3004` |
| `CONFIG_MODE` | | `local` (agents.json) or `platform`. Default: `local` |

\* At least one LLM key is required.

---

## Monitoring (optional)

Prometheus and Promtail are included but not started by default. To enable:

```bash
docker compose --profile monitoring up
```

---

## Development

```bash
yarn install
cp .env.example .env   # fill in DATABASE_URL and API keys

yarn dev               # engine with hot-reload
yarn client:dev        # admin UI dev server
yarn dev:all           # both together

yarn test              # unit tests
yarn test:e2e          # integration tests (needs Postgres)
yarn build             # production build
```

**Migrations** run automatically on startup. To run manually:

```bash
yarn migration:run
yarn migration:revert  # roll back last migration
```

---

## Docker

```bash
# Build and run locally
docker compose up --build

# Use the pre-built image
docker pull ghcr.io/flutchai/flutch-oss:latest
```

Images are published to GHCR on every merge to `main` (multi-arch: `amd64` + `arm64`).

---

## Writing a custom agent

Extend `AbstractGraphBuilder` from `@flutchai/flutch-sdk`:

```typescript
import { Injectable } from "@nestjs/common";
import { AbstractGraphBuilder, IGraphRequestPayload } from "@flutchai/flutch-sdk";
import { StateGraph, START, END } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";

@Injectable()
export class MyAgentBuilder extends AbstractGraphBuilder<"1.0.0"> {
  readonly version = "1.0.0" as const;

  async buildGraph(payload: IGraphRequestPayload): Promise<any> {
    const model = new ChatOpenAI({ modelName: "gpt-4o-mini" });
    const systemPrompt = payload.config?.configurable?.graphSettings?.systemPrompt;

    return new StateGraph(/* ... */)
      .addNode("respond", async (state) => ({
        messages: [await model.invoke([...state.messages])],
      }))
      .addEdge(START, "respond")
      .addEdge("respond", END)
      .compile();
  }
}
```

Register it in `src/app.module.ts` under `UniversalGraphModule.forRoot({ versioning: [...] })`.

See `src/graph/` for the built-in examples, and the [node-sdk docs](https://github.com/flutchai/node-sdk) for the full API.

---

## License

MIT — see [LICENSE](LICENSE).
