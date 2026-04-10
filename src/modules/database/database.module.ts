import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { User } from "./entities/user.entity";
import { UserIdentity } from "./entities/user-identity.entity";
import { Thread } from "./entities/thread.entity";
import { Message } from "./entities/message.entity";
import { AdminUser } from "./entities/admin-user.entity";
import { KnowledgeBase } from "../kms/entities/knowledge-base.entity";
import { Article } from "../kms/entities/article.entity";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "postgres",
        url: config.getOrThrow<string>("DATABASE_URL"),
        ssl: config.get<string>("DATABASE_SSL") === "true" ? { rejectUnauthorized: false } : false,
        entities: [User, UserIdentity, Thread, Message, AdminUser, KnowledgeBase, Article],
        migrations: [__dirname + "/../../migrations/*.{ts,js}"],
        migrationsRun: true,
        synchronize: false,
        logging: false,
      }),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
