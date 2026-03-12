import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

export const CHECKPOINTER = "CHECKPOINTER";

@Injectable()
export class CheckpointerService implements OnModuleInit {
  private readonly logger = new Logger(CheckpointerService.name);
  readonly saver: PostgresSaver;

  constructor(private readonly configService: ConfigService) {
    const databaseUrl = this.configService.getOrThrow<string>("DATABASE_URL");
    this.saver = PostgresSaver.fromConnString(databaseUrl, {
      schema: "public",
    });
  }

  async onModuleInit(): Promise<void> {
    this.logger.log("Setting up LangGraph PostgreSQL checkpointer tables...");
    await this.saver.setup();
    this.logger.log("Checkpointer tables ready.");
  }
}
