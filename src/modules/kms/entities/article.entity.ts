import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { ArticleSource, IArticleContent, IArticleExtra } from "@flutchai/knowledge";
import { KnowledgeBase } from "./knowledge-base.entity";

@Entity("articles")
export class Article {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "knowledge_base_id" })
  knowledgeBaseId: string;

  @ManyToOne(() => KnowledgeBase, { onDelete: "CASCADE" })
  @JoinColumn({ name: "knowledge_base_id" })
  knowledgeBase: KnowledgeBase;

  @Column({ name: "owner_id", nullable: true })
  ownerId?: string;

  @Column({
    type: "enum",
    enum: ArticleSource,
    nullable: true,
    default: ArticleSource.MANUAL,
  })
  source?: ArticleSource;

  @Column({ name: "draft_article", type: "jsonb", nullable: true })
  draftArticle?: IArticleContent;

  @Column({ name: "published_article", type: "jsonb", nullable: true })
  publishedArticle?: IArticleContent;

  @Column({ name: "is_published", default: false })
  isPublished: boolean;

  @Column({ name: "retriever_chunks_ids", type: "jsonb", nullable: true })
  retrieverChunksIds?: string[];

  @Column({ type: "jsonb", nullable: true })
  extra?: IArticleExtra;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
