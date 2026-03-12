import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from "typeorm";
import { User } from "./user.entity";
import { Platform } from "./thread.entity";

@Entity("user_identities")
@Unique(["platform", "externalId"])
export class UserIdentity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, user => user.identities, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ name: "user_id", type: "uuid" })
  userId: string;

  @Column({ type: "enum", enum: Platform })
  platform: Platform;

  /** Platform-specific identifier: Telegram chatId, widget fingerprint, etc. */
  @Column({ name: "external_id" })
  externalId: string;

  /** Optional metadata: firstName, username, languageCode, etc. */
  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
