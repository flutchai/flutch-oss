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
| Knowledge Base | Ragflow |
| Monitoring | Prometheus + Promtail |
| Database | MongoDB (graph checkpoints) |

## Getting started

### Requirements

- Docker and Docker Compose
- Node.js 20+
- Yarn 4.5+

### Run with Docker Compose

```bash
cp .env.example .env
# Fill in your API keys

docker compose up
```

Engine available at `http://localhost:3000`.

### Local development

```bash
yarn install
cp .env.example .env
yarn dev
```

## Configuration

### Environment variables

Copy `.env.example` to `.env` and fill in the values.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | * | — | OpenAI API key (required for GPT models) |
| `ANTHROPIC_API_KEY` | * | — | Anthropic API key (required for Claude models) |
| `MONGODB_URI` | No | in-memory | MongoDB connection string for conversation checkpoints |
| `CONFIG_MODE` | No | `local` | Agent config source: `local` (agents.json) or `platform` (Flutch API) |
| `API_URL` | connected mode | — | Flutch Platform base URL (e.g. `https://api.flutch.ai`) |
| `INTERNAL_API_TOKEN` | connected mode | — | Bearer token for Flutch Platform auth |
| `PORT` | No | `3000` | HTTP port the engine listens on |

\* At least one LLM key is required, depending on the models you configure.

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
| `provider` | `openai` \| `anthropic` | No | Inferred from model name if omitted |
| `systemPrompt` | string | No | System prompt prepended to every conversation |
| `temperature` | number | No | Sampling temperature (default: `0.7`) |
| `maxTokens` | number | No | Max output tokens (default: `2048`) |

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

## Language

All user-facing strings, UI text, and code in this project use **English** as the default and only language. Do not add strings in other languages.

## Development

This project uses **Yarn** as its package manager. Do not use `npm` or `npx` — they will create a `package-lock.json` which is not committed.

```bash
yarn dev          # start with watch
yarn test         # run tests
yarn test:cov     # run tests with coverage
yarn lint         # lint
yarn format       # format code
yarn build        # production build
```

## License

MIT
