/**
 * E2E test for Telegram webhook — runs against a real PostgreSQL database.
 *
 * External services are mocked (Telegram API, LLM engine).
 * Schema is managed via MIGRATIONS (not synchronize) to ensure dev/test/prod parity.
 *
 * What we test here:
 *   1. HTTP 200 returned for valid Telegram updates
 *   2. Thread created in Postgres on first message
 *   3. Incoming + outgoing messages persisted
 *   4. Same thread reused for subsequent messages from the same user
 *   5. Migrations run cleanly (implicit — if migration is broken, test setup fails)
 *
 * Requirements:
 *   - Postgres running and accessible via env vars (see .env.example)
 *   - In CI: provided by GitHub Actions `services.postgres`
 *   - Locally: `docker-compose up postgres -d && POSTGRES_DB=flutch_oss_test yarn test:e2e`
 */
import { DataSource } from "typeorm";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { TypeOrmModule, getRepositoryToken } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";
import { HttpModule } from "@nestjs/axios";
import { Repository } from "typeorm";
import { Thread, Platform } from "../../src/modules/database/entities/thread.entity";
import { Message, MessageDirection } from "../../src/modules/database/entities/message.entity";
import { InitialSchema1741769000000 } from "../../src/migrations/1741769000000-InitialSchema";
import { AgentConfigService } from "../../src/modules/config/agent-config.service";
import { TelegramWebhookController } from "../../src/modules/platform-connector/telegram/telegram-webhook.controller";
import { TelegramConnectorService } from "../../src/modules/platform-connector/telegram/telegram-connector.service";
import { TelegramApiClient } from "../../src/modules/platform-connector/telegram/telegram-api.client";
import { ThreadService } from "../../src/modules/platform-connector/thread.service";

const fakeUpdate = {
  update_id: 1,
  message: {
    message_id: 10,
    from: { id: 999999, first_name: "E2E User" },
    chat: { id: 999999, type: "private" },
    text: "E2E тестовое сообщение",
    date: Math.floor(Date.now() / 1000),
  },
};

const mockAgentConfig = {
  agentId: "roofing-agent",
  graphType: "flutch.agent",
  graphSettings: { model: "gpt-4o-mini" },
  platforms: { telegram: { botToken: "e2e-bot-token" } },
};

const mockContext = {
  agentId: "roofing-agent",
  userId: "999999",
  threadId: "roofing-agent:999999",
  graphType: "flutch.agent",
  graphSettings: { model: "gpt-4o-mini" },
};

describe("Telegram Webhook (E2E)", () => {
  let app: INestApplication;
  let threadRepo: Repository<Thread>;
  let messageRepo: Repository<Message>;
  let dataSource: DataSource;
  let mockGraphService: { generateAnswer: jest.Mock };
  let mockTelegramApiClient: { sendMessage: jest.Mock };

  beforeAll(async () => {
    mockGraphService = {
      generateAnswer: jest.fn().mockResolvedValue({
        requestId: "e2e-req-1",
        text: "E2E AI ответ",
        metadata: { usageMetrics: { inputTokens: 5, outputTokens: 10, totalTokens: 15 } },
      }),
    };
    mockTelegramApiClient = { sendMessage: jest.fn().mockResolvedValue(undefined) };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: "postgres",
          host: process.env.POSTGRES_HOST ?? "localhost",
          port: parseInt(process.env.POSTGRES_PORT ?? "5432", 10),
          username: process.env.POSTGRES_USER ?? "flutch",
          password: process.env.POSTGRES_PASSWORD ?? "flutch",
          database: process.env.POSTGRES_DB ?? "flutch_oss_test",
          entities: [Thread, Message],
          // Use real migrations — same path as production.
          // If a migration is broken, test setup will fail here, not in prod.
          migrations: [InitialSchema1741769000000],
          migrationsRun: true,
          synchronize: false,
          dropSchema: true, // clean slate before each test run
        }),
        TypeOrmModule.forFeature([Thread, Message]),
        HttpModule,
      ],
      controllers: [TelegramWebhookController],
      providers: [
        ThreadService,
        TelegramConnectorService,
        {
          provide: AgentConfigService,
          useValue: {
            resolve: jest.fn().mockResolvedValue(mockContext),
            getConfig: jest.fn().mockResolvedValue(mockAgentConfig),
          },
        },
        { provide: TelegramApiClient, useValue: mockTelegramApiClient },
        { provide: "GRAPH_SERVICE", useValue: mockGraphService },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    threadRepo = moduleFixture.get(getRepositoryToken(Thread));
    messageRepo = moduleFixture.get(getRepositoryToken(Message));
  });

  afterEach(async () => {
    await messageRepo.delete({});
    await threadRepo.delete({});
    mockGraphService.generateAnswer.mockClear();
    mockTelegramApiClient.sendMessage.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  it("POST /public/tg/webhook/:agentId returns 200", () => {
    return request(app.getHttpServer())
      .post("/public/tg/webhook/roofing-agent")
      .send(fakeUpdate)
      .expect(200);
  });

  it("creates a thread in Postgres on first message", async () => {
    await request(app.getHttpServer())
      .post("/public/tg/webhook/roofing-agent")
      .send(fakeUpdate)
      .expect(200);

    const threads = await threadRepo.find();
    expect(threads).toHaveLength(1);
    expect(threads[0].agentId).toBe("roofing-agent");
    expect(threads[0].userId).toBe("999999");
    expect(threads[0].platform).toBe(Platform.TELEGRAM);
  });

  it("persists incoming and outgoing messages", async () => {
    await request(app.getHttpServer())
      .post("/public/tg/webhook/roofing-agent")
      .send(fakeUpdate)
      .expect(200);

    const messages = await messageRepo.find({ order: { createdAt: "ASC" } });
    expect(messages).toHaveLength(2);
    expect(messages[0].direction).toBe(MessageDirection.INCOMING);
    expect(messages[0].content).toBe("E2E тестовое сообщение");
    expect(messages[1].direction).toBe(MessageDirection.OUTGOING);
    expect(messages[1].content).toBe("E2E AI ответ");
  });

  it("reuses the same thread for subsequent messages from same user", async () => {
    await request(app.getHttpServer())
      .post("/public/tg/webhook/roofing-agent")
      .send(fakeUpdate)
      .expect(200);

    await request(app.getHttpServer())
      .post("/public/tg/webhook/roofing-agent")
      .send({ ...fakeUpdate, update_id: 2 })
      .expect(200);

    const threads = await threadRepo.find();
    expect(threads).toHaveLength(1);

    const messages = await messageRepo.find();
    expect(messages).toHaveLength(4); // 2 incoming + 2 outgoing
  });

  it("returns 200 even when engine fails (prevents Telegram retries)", async () => {
    mockGraphService.generateAnswer.mockRejectedValueOnce(new Error("LLM timeout"));

    await request(app.getHttpServer())
      .post("/public/tg/webhook/roofing-agent")
      .send(fakeUpdate)
      .expect(200);
  });
});
