import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { User } from "./entities/user.entity";
import { UserIdentity } from "./entities/user-identity.entity";
import { Thread } from "./entities/thread.entity";
import { Message } from "./entities/message.entity";
import { AdminUser } from "./entities/admin-user.entity";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "postgres",
        host: config.get<string>("POSTGRES_HOST", "localhost"),
        port: config.get<number>("POSTGRES_PORT", 5432),
        username: config.get<string>("POSTGRES_USER", "flutch"),
        password: config.get<string>("POSTGRES_PASSWORD", "flutch"),
        database: config.get<string>("POSTGRES_DB", "flutch_oss"),
        entities: [User, UserIdentity, Thread, Message, AdminUser],
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
