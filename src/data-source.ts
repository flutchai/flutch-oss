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
import { KnowledgeBase } from "./modules/kms/entities/knowledge-base.entity";
import { Article } from "./modules/kms/entities/article.entity";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const AppDataSource = new DataSource({
  type: "postgres",
  host: requireEnv("POSTGRES_HOST"),
  port: parseInt(requireEnv("POSTGRES_PORT"), 10),
  username: requireEnv("POSTGRES_USER"),
  password: requireEnv("POSTGRES_PASSWORD"),
  database: requireEnv("POSTGRES_DB"),
  ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : false,
  entities: [User, UserIdentity, Thread, Message, AdminUser, KnowledgeBase, Article],
  migrations: ["src/migrations/*.ts"],
  synchronize: false,
});
