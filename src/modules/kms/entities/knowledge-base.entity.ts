import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import {
  KnowledgeBaseOwnership,
  KnowledgeBaseStatus,
  KnowledgeBaseContentType,
  VisibilityLevel,
  IKBSettings,
} from "@flutchai/knowledge";

@Entity("knowledge_bases")
export class KnowledgeBase {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true, unique: true })
  slug?: string;

  @Column({ name: "owner_id" })
  ownerId: string;

  @Column({ name: "company_id", nullable: true })
  companyId?: string;

  @Column({ name: "avatar_url", nullable: true })
  avatarUrl?: string;

  @Column({ type: "enum", enum: KnowledgeBaseOwnership })
  ownership: KnowledgeBaseOwnership;

  @Column({ type: "enum", enum: VisibilityLevel })
  visibility: VisibilityLevel;

  @Column({
    name: "visibility_status",
    type: "enum",
    enum: KnowledgeBaseStatus,
    default: KnowledgeBaseStatus.DRAFT,
  })
  visibilityStatus: KnowledgeBaseStatus;

  @Column({
    name: "content_type",
    type: "enum",
    enum: KnowledgeBaseContentType,
    default: KnowledgeBaseContentType.GENERAL,
  })
  contentType: KnowledgeBaseContentType;

  @Column({ type: "jsonb", default: {} })
  settings: IKBSettings;

  @Column({ type: "jsonb", nullable: true })
  stats?: {
    articleCount: number;
    tagCount: number;
    categoryCount: number;
    viewCount: number;
  };

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
