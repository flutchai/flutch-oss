import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AdminUser } from "../database/entities/admin-user.entity";
import { Thread } from "../database/entities/thread.entity";
import { Message } from "../database/entities/message.entity";
import { User } from "../database/entities/user.entity";
import { AdminAuthService } from "./auth/admin-auth.service";
import { AdminAuthController } from "./auth/admin-auth.controller";
import { AdminAuthGuard } from "./auth/admin-auth.guard";
import { AdminDashboardService } from "./dashboard/admin-dashboard.service";
import { AdminDashboardController } from "./dashboard/admin-dashboard.controller";
import { AdminAgentsController } from "./agents/admin-agents.controller";
import { AdminAgentsService } from "./agents/admin-agents.service";
import { AdminConversationsController } from "./conversations/admin-conversations.controller";
import { AdminConversationsService } from "./conversations/admin-conversations.service";
import { AdminUsersController } from "./users/admin-users.controller";
import { AdminUsersService } from "./users/admin-users.service";
import { AdminSettingsController } from "./settings/admin-settings.controller";
import { AdminSettingsService } from "./settings/admin-settings.service";
import { AdminKbController } from "./knowledge-base/admin-kb.controller";
import { AdminKbService } from "./knowledge-base/admin-kb.service";
import { KnowledgeBase } from "../kms/entities/knowledge-base.entity";
import { Article } from "../kms/entities/article.entity";
import { AgentConfigModule } from "../config/config.module";
import { PlatformConnectorModule } from "../platform-connector/platform-connector.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminUser, Thread, Message, User, KnowledgeBase, Article]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>("ADMIN_JWT_SECRET");
        if (!secret) throw new Error("ADMIN_JWT_SECRET env variable is required");
        return { secret, signOptions: { expiresIn: "8h" } };
      },
    }),
    HttpModule,
    AgentConfigModule,
    PlatformConnectorModule,
  ],
  controllers: [
    AdminAuthController,
    AdminDashboardController,
    AdminAgentsController,
    AdminConversationsController,
    AdminUsersController,
    AdminSettingsController,
    AdminKbController,
  ],
  providers: [
    AdminAuthService,
    AdminAuthGuard,
    AdminDashboardService,
    AdminConversationsService,
    AdminUsersService,
    AdminAgentsService,
    AdminSettingsService,
    AdminKbService,
  ],
  exports: [AdminAuthService, AdminAuthGuard],
})
export class AdminModule {}
