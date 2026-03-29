import { DynamicModule, Global, Inject, Module, OnApplicationShutdown } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Pool } from "pg";
import { KmsModule as KmsLibModule } from "@flutchai/knowledge";
import { KnowledgeBase } from "./entities/knowledge-base.entity";
import { Article } from "./entities/article.entity";
import { KbRepository } from "./repositories/kb.repository";
import { ArticleRepository } from "./repositories/article.repository";

const PG_POOL_TOKEN = "KMS_PG_POOL";

@Global()
@Module({})
export class KmsModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL_TOKEN) private readonly pool: Pool) {}

  static forRoot(): DynamicModule {
    const required = [
      "POSTGRES_HOST",
      "POSTGRES_PORT",
      "POSTGRES_USER",
      "POSTGRES_PASSWORD",
      "POSTGRES_DB",
    ];
    for (const key of required) {
      if (!process.env[key]) throw new Error(`KmsModule: missing required env var ${key}`);
    }

    const pool = new Pool({
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT),
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
      max: 10,
      ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : false,
    });

    return {
      module: KmsModule,
      imports: [
        KmsLibModule.forRoot({
          retriever: {
            vectorStore: "postgres",
            postgres: {
              pool,
              knowledge: { tableName: "kms_embeddings", dimensions: 1536 },
              temp: { tableName: "kms_temp_embeddings", dimensions: 1536 },
            },
            embeddings: {
              openAiApiKey: process.env.OPENAI_API_KEY,
              model: "text-embedding-ada-002",
            },
          },
          repositories: {
            knowledgeBase: KbRepository,
            article: ArticleRepository,
          },
          extraImports: [TypeOrmModule.forFeature([KnowledgeBase, Article])],
        }),
      ],
      providers: [{ provide: PG_POOL_TOKEN, useValue: pool }],
      exports: [KmsLibModule],
    };
  }

  async onApplicationShutdown() {
    await this.pool.end();
  }
}
