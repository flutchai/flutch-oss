import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  IArticleRepository,
  IArticle,
  ICreateArticle,
  IUpdateArticle,
  PaginationOptions,
  PaginatedResult,
} from "@flutchai/knowledge";
import { Article } from "../entities/article.entity";

@Injectable()
export class ArticleRepository implements IArticleRepository {
  constructor(
    @InjectRepository(Article)
    private readonly repo: Repository<Article>
  ) {}

  async findById(id: string): Promise<IArticle | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByKnowledgeBase(
    kbId: string,
    options: PaginationOptions
  ): Promise<PaginatedResult<IArticle>> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;

    const [items, total] = await this.repo.findAndCount({
      where: { knowledgeBaseId: kbId },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: "DESC" },
    });

    return { items, total, page, limit };
  }

  async create(data: ICreateArticle): Promise<IArticle> {
    const entity = this.repo.create(data as Partial<Article>);
    return this.repo.save(entity);
  }

  async update(id: string, data: IUpdateArticle): Promise<IArticle | null> {
    await this.repo.update(id, data as Partial<Article>);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
