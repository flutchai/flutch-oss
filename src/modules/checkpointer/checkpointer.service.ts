import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { Pool } from "pg";
import { PG_POOL_TOKEN } from "../pg-pool/pg-pool.module";

export const CHECKPOINTER = "CHECKPOINTER";

@Injectable()
export class CheckpointerService implements OnModuleInit {
  private readonly logger = new Logger(CheckpointerService.name);
  readonly saver: PostgresSaver;

  constructor(@Inject(PG_POOL_TOKEN) pool: Pool) {
    this.saver = new PostgresSaver(pool, undefined, { schema: "public" });
  }

  async onModuleInit(): Promise<void> {
    this.logger.log("Setting up LangGraph PostgreSQL checkpointer tables...");
    await this.saver.setup();
    this.logger.log("Checkpointer tables ready.");
  }
}
