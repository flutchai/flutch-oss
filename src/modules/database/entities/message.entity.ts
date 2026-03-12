import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Thread } from "./thread.entity";

export enum MessageDirection {
  INCOMING = "incoming",
  OUTGOING = "outgoing",
}

@Entity("messages")
export class Message {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Thread, (thread) => thread.messages, { onDelete: "CASCADE" })
  @JoinColumn({ name: "thread_id" })
  thread: Thread;

  @Column({ name: "thread_id" })
  threadId: string;

  @Column("text")
  content: string;

  @Column({ type: "enum", enum: MessageDirection })
  direction: MessageDirection;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
