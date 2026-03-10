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

See `.env.example` for all available variables.

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `API_URL` | Flutch Platform URL (connected mode) |
| `INTERNAL_API_TOKEN` | Flutch Platform auth token (connected mode) |

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
