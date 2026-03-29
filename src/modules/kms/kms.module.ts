import { DynamicModule, Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { KmsModule as KmsLibModule } from "@flutchai/knowledge";
import { getSharedPool } from "../pg-pool/pg-pool.module";
import { KnowledgeBase } from "./entities/knowledge-base.entity";
import { Article } from "./entities/article.entity";
import { KbRepository } from "./repositories/kb.repository";
import { ArticleRepository } from "./repositories/article.repository";

@Global()
@Module({})
export class KmsModule {
  static forRoot(): DynamicModule {
    const pool = getSharedPool();

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
      exports: [KmsLibModule],
    };
  }
}
