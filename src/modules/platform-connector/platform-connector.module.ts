import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UniversalGraphService } from "@flutchai/flutch-sdk";
import { AgentConfigModule } from "../config/config.module";
import { Thread } from "../database/entities/thread.entity";
import { Message } from "../database/entities/message.entity";
import { ThreadService } from "./thread.service";
import { TelegramWebhookController } from "./telegram/telegram-webhook.controller";
import { TelegramConnectorService } from "./telegram/telegram-connector.service";
import { TelegramApiClient } from "./telegram/telegram-api.client";

@Module({
  imports: [HttpModule, AgentConfigModule, TypeOrmModule.forFeature([Thread, Message])],
  controllers: [TelegramWebhookController],
  providers: [
    ThreadService,
    TelegramConnectorService,
    TelegramApiClient,
    {
      // UniversalGraphService is provided globally by UniversalGraphModule.forRoot()
      // in AppModule. Re-registering it under GRAPH_SERVICE token makes the dependency
      // explicit and keeps the module testable in isolation.
      provide: "GRAPH_SERVICE",
      useExisting: UniversalGraphService,
    },
  ],
})
export class PlatformConnectorModule {}
