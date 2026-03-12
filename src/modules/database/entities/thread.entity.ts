import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  Unique,
} from "typeorm";
import { Message } from "./message.entity";

export enum Platform {
  TELEGRAM = "telegram",
  API = "api",
}

@Entity("threads")
@Unique(["agentId", "userId", "platform"])
export class Thread {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "agent_id" })
  agentId: string;

  /** Platform-specific user identifier (e.g. Telegram chatId as string) */
  @Column({ name: "user_id" })
  userId: string;

  @Column({ type: "enum", enum: Platform, default: Platform.TELEGRAM })
  platform: Platform;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @OneToMany(() => Message, (message) => message.thread)
  messages: Message[];
}
