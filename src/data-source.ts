/**
 * TypeORM DataSource used by the TypeORM CLI for migrations.
 *
 * Usage:
 *   yarn migration:generate src/migrations/MyMigration
 *   yarn migration:run
 *   yarn migration:revert
 */
import "reflect-metadata";
import * as dotenv from "dotenv";
dotenv.config();
import { DataSource } from "typeorm";
import { Thread } from "./modules/database/entities/thread.entity";
import { Message } from "./modules/database/entities/message.entity";
import { User } from "./modules/database/entities/user.entity";
import { UserIdentity } from "./modules/database/entities/user-identity.entity";
import { AdminUser } from "./modules/database/entities/admin-user.entity";
export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.POSTGRES_HOST ?? "localhost",
  port: parseInt(process.env.POSTGRES_PORT ?? "5432", 10),
  username: process.env.POSTGRES_USER ?? "flutch",
  password: process.env.POSTGRES_PASSWORD ?? "flutch",
  database: process.env.POSTGRES_DB ?? "flutch_oss",
  entities: [User, UserIdentity, Thread, Message, AdminUser],
  migrations: ["src/migrations/*.ts"],
  synchronize: false,
});
