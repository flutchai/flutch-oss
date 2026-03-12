import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Unique,
} from "typeorm";
import { Message } from "./message.entity";
import { User } from "./user.entity";
import { Platform } from "./platform.enum";

@Entity("threads")
@Unique(["agentId", "userId", "platform"])
export class Thread {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "agent_id" })
  agentId: string;

  @ManyToOne(() => User, user => user.threads, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ name: "user_id", type: "uuid" })
  userId: string;

  @Column({ type: "enum", enum: Platform })
  platform: Platform;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @OneToMany(() => Message, message => message.thread)
  messages: Message[];
}
