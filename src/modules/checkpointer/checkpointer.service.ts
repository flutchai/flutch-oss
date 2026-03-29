import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { Pool } from "pg";

export const CHECKPOINTER = "CHECKPOINTER";

@Injectable()
export class CheckpointerService implements OnModuleInit {
  private readonly logger = new Logger(CheckpointerService.name);
  readonly saver: PostgresSaver;

  constructor(private readonly configService: ConfigService) {
    const databaseUrl = this.configService.getOrThrow<string>("DATABASE_URL");
    const ssl = this.configService.get<string>("POSTGRES_SSL") === "true"
      ? { rejectUnauthorized: false }
      : false;
    const pool = new Pool({ connectionString: databaseUrl, ssl });
    this.saver = new PostgresSaver(pool, undefined, { schema: "public" });
  }

  async onModuleInit(): Promise<void> {
    this.logger.log("Setting up LangGraph PostgreSQL checkpointer tables...");
    await this.saver.setup();
    this.logger.log("Checkpointer tables ready.");
  }
}
