import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { IsString, IsOptional, IsBoolean, IsEnum, IsNotEmpty } from "class-validator";
import {
  KnowledgeBaseOwnership,
  KnowledgeBaseStatus,
  KnowledgeBaseContentType,
  VisibilityLevel,
  ArticleSource,
  SearchService,
} from "@flutchai/knowledge";
import { KnowledgeBase } from "../../kms/entities/knowledge-base.entity";
import { Article } from "../../kms/entities/article.entity";

export class CreateKbDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(KnowledgeBaseOwnership)
  ownership?: KnowledgeBaseOwnership;

  @IsOptional()
  @IsEnum(VisibilityLevel)
  visibility?: VisibilityLevel;

  @IsOptional()
  @IsEnum(KnowledgeBaseContentType)
  contentType?: KnowledgeBaseContentType;
}

export class UpdateKbDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(KnowledgeBaseStatus)
  visibilityStatus?: KnowledgeBaseStatus;
}

export class CreateArticleDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  content?: string;
}

export class UpdateArticleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

@Injectable()
export class AdminKbService {
  private readonly logger = new Logger(AdminKbService.name);

  constructor(
    @InjectRepository(KnowledgeBase)
    private readonly kbRepo: Repository<KnowledgeBase>,
    @InjectRepository(Article)
    private readonly articleRepo: Repository<Article>,
    private readonly searchService: SearchService
  ) {}

  async listKbs(page = "1", limit = "20") {
    const take = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const skip = (pageNum - 1) * take;

    const [items, total] = await this.kbRepo.findAndCount({
      order: { createdAt: "DESC" },
      take,
      skip,
    });

    let countMap: Record<string, number> = {};
    if (items.length > 0) {
      const ids = items.map(kb => kb.id);
      const counts = await this.articleRepo
        .createQueryBuilder("a")
        .select("a.knowledgeBaseId", "kbId")
        .addSelect("COUNT(*)", "count")
        .where("a.knowledgeBaseId IN (:...ids)", { ids })
        .groupBy("a.knowledgeBaseId")
        .getRawMany();
      countMap = Object.fromEntries(counts.map(c => [c.kbId, Number(c.count)]));
    }

    return {
      data: items.map(kb => ({
        id: kb.id,
        name: kb.name,
        description: kb.description,
        ownership: kb.ownership,
        visibility: kb.visibility,
        visibilityStatus: kb.visibilityStatus,
        contentType: kb.contentType,
        articleCount: countMap[kb.id] ?? 0,
        createdAt: kb.createdAt,
      })),
      total,
      page: pageNum,
      limit: take,
    };
  }

  async getKb(id: string) {
    const kb = await this.kbRepo.findOne({ where: { id } });
    if (!kb) throw new NotFoundException("Knowledge base not found");
    const articleCount = await this.articleRepo.count({ where: { knowledgeBaseId: id } });
    return { ...kb, articleCount };
  }

  async createKb(body: CreateKbDto) {
    const entity = this.kbRepo.create({
      name: body.name,
      description: body.description,
      ownership: body.ownership ?? KnowledgeBaseOwnership.PERSONAL,
      visibility: body.visibility ?? VisibilityLevel.PRIVATE,
      visibilityStatus: KnowledgeBaseStatus.DRAFT,
      contentType: body.contentType ?? KnowledgeBaseContentType.GENERAL,
      ownerId: "admin", // TODO: replace with authenticated admin user id when multi-admin support is added
      settings: {},
    });
    return this.kbRepo.save(entity);
  }

  async updateKb(id: string, body: UpdateKbDto) {
    const kb = await this.kbRepo.findOne({ where: { id } });
    if (!kb) throw new NotFoundException("Knowledge base not found");

    if (Object.keys(body).length === 0) {
      throw new BadRequestException("No fields provided for update");
    }

    const allowed: Partial<KnowledgeBase> = {};
    if (body.name !== undefined) allowed.name = body.name;
    if (body.description !== undefined) allowed.description = body.description;
    if (body.visibilityStatus !== undefined) allowed.visibilityStatus = body.visibilityStatus;
    await this.kbRepo.update(id, allowed);
    const updated = await this.kbRepo.findOne({ where: { id } });
    if (!updated) throw new NotFoundException("Knowledge base not found");
    return updated;
  }

  async deleteKb(id: string) {
    const kb = await this.kbRepo.findOne({ where: { id } });
    if (!kb) throw new NotFoundException("Knowledge base not found");

    const publishedArticles = await this.articleRepo.find({
      where: { knowledgeBaseId: id, isPublished: true },
      select: ["id"],
    });
    for (const article of publishedArticles) {
      try {
        await this.searchService.removeArticleFromIndex(article.id);
      } catch (e) {
        this.logger.error(
          `Failed to remove article ${article.id} from index during KB deletion: ${e?.message}`
        );
      }
    }

    const result = await this.kbRepo.delete(id);
    if (result.affected === 0) throw new NotFoundException("Knowledge base not found");
  }

  async listArticles(kbId: string, page = "1", limit = "20") {
    const kb = await this.kbRepo.findOne({ where: { id: kbId } });
    if (!kb) throw new NotFoundException("Knowledge base not found");

    const take = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const skip = (pageNum - 1) * take;

    const [items, total] = await this.articleRepo.findAndCount({
      where: { knowledgeBaseId: kbId },
      order: { createdAt: "DESC" },
      take,
      skip,
    });

    return {
      data: items.map(a => ({
        id: a.id,
        title: a.draftArticle?.title ?? a.publishedArticle?.title ?? "(untitled)",
        isPublished: a.isPublished,
        source: a.source,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
      total,
      page: pageNum,
      limit: take,
    };
  }

  async getArticle(kbId: string, id: string) {
    const article = await this.articleRepo.findOne({ where: { id, knowledgeBaseId: kbId } });
    if (!article) throw new NotFoundException("Article not found");
    return article;
  }

  async createArticle(kbId: string, body: CreateArticleDto) {
    const kb = await this.kbRepo.findOne({ where: { id: kbId } });
    if (!kb) throw new NotFoundException("Knowledge base not found");

    const entity = this.articleRepo.create({
      knowledgeBaseId: kbId,
      source: ArticleSource.MANUAL,
      draftArticle: { title: body.title, content: body.content },
      isPublished: false,
    });
    return this.articleRepo.save(entity);
  }

  async updateArticle(kbId: string, id: string, body: UpdateArticleDto) {
    const article = await this.articleRepo.findOne({ where: { id, knowledgeBaseId: kbId } });
    if (!article) throw new NotFoundException("Article not found");

    if (Object.keys(body).length === 0) {
      throw new BadRequestException("No fields provided for update");
    }

    const updates: Partial<Article> = {};

    if (body.title !== undefined || body.content !== undefined) {
      updates.draftArticle = {
        ...article.draftArticle,
        title: body.title ?? article.draftArticle?.title,
        content: body.content ?? article.draftArticle?.content,
      };
    }

    const wasPublished = article.isPublished;

    if (body.isPublished === true) {
      const contentToPublish = updates.draftArticle ?? article.draftArticle;
      if (!contentToPublish) {
        throw new BadRequestException("Cannot publish an article with no content");
      }
      updates.isPublished = true;
      updates.publishedArticle = contentToPublish;
    } else if (body.isPublished === false) {
      updates.isPublished = false;
    }

    await this.articleRepo.update(id, updates);

    if (body.isPublished === true) {
      try {
        await this.searchService.indexArticle(id);
        this.logger.log(`Article ${id} indexed`);
      } catch (e) {
        this.logger.error(`Failed to index article ${id}: ${e?.message}`);
      }
    } else if (body.isPublished === false && wasPublished) {
      try {
        await this.searchService.removeArticleFromIndex(id);
        this.logger.log(`Article ${id} removed from index`);
      } catch (e) {
        this.logger.error(`Failed to remove article ${id} from index: ${e?.message}`);
      }
    }

    const updated = await this.articleRepo.findOne({ where: { id, knowledgeBaseId: kbId } });
    if (!updated) throw new NotFoundException("Article not found");
    return updated;
  }

  async deleteArticle(kbId: string, id: string) {
    const article = await this.articleRepo.findOne({ where: { id, knowledgeBaseId: kbId } });
    if (!article) throw new NotFoundException("Article not found");

    if (article.isPublished) {
      try {
        await this.searchService.removeArticleFromIndex(id);
        this.logger.log(`Article ${id} removed from index before deletion`);
      } catch (e) {
        this.logger.error(`Failed to remove article ${id} from index: ${e?.message}`);
      }
    }

    await this.articleRepo.delete(id);
  }
}
