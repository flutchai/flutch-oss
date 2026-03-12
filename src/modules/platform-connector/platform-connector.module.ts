import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UniversalGraphService } from "@flutchai/flutch-sdk";
import { AgentConfigModule } from "../config/config.module";
import { User } from "../database/entities/user.entity";
import { UserIdentity } from "../database/entities/user-identity.entity";
import { Thread } from "../database/entities/thread.entity";
import { Message } from "../database/entities/message.entity";
import { UserService } from "./user.service";
import { ThreadService } from "./thread.service";
import { TelegramWebhookController } from "./telegram/telegram-webhook.controller";
import { TelegramConnectorService } from "./telegram/telegram-connector.service";
import { TelegramApiClient } from "./telegram/telegram-api.client";
import { WidgetController } from "./widget/widget.controller";
import { WidgetConnectorService } from "./widget/widget-connector.service";

@Module({
  imports: [
    HttpModule,
    AgentConfigModule,
    TypeOrmModule.forFeature([User, UserIdentity, Thread, Message]),
  ],
  controllers: [TelegramWebhookController, WidgetController],
  providers: [
    UserService,
    ThreadService,
    TelegramConnectorService,
    TelegramApiClient,
    WidgetConnectorService,
    {
      provide: "GRAPH_SERVICE",
      useExisting: UniversalGraphService,
    },
  ],
})
export class PlatformConnectorModule {}
