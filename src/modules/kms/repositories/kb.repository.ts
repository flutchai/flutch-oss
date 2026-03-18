import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  IKnowledgeBaseRepository,
  IKnowledgeBase,
  ICreateKnowledgeBase,
  IUpdateKnowledgeBase,
  PaginationOptions,
  PaginatedResult,
} from "@flutchai/knowledge";
import { KnowledgeBase } from "../entities/knowledge-base.entity";

@Injectable()
export class KbRepository implements IKnowledgeBaseRepository {
  constructor(
    @InjectRepository(KnowledgeBase)
    private readonly repo: Repository<KnowledgeBase>
  ) {}

  async findById(id: string): Promise<IKnowledgeBase | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByCompany(
    companyId: string,
    options: PaginationOptions
  ): Promise<PaginatedResult<IKnowledgeBase>> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;

    const [items, total] = await this.repo.findAndCount({
      where: { companyId },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: "DESC" },
    });

    return { items, total, page, limit };
  }

  async findByOwner(
    ownerId: string,
    options: PaginationOptions
  ): Promise<PaginatedResult<IKnowledgeBase>> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;

    const [items, total] = await this.repo.findAndCount({
      where: { ownerId },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: "DESC" },
    });

    return { items, total, page, limit };
  }

  async create(data: ICreateKnowledgeBase): Promise<IKnowledgeBase> {
    const entity = this.repo.create(data as Partial<KnowledgeBase>);
    return this.repo.save(entity);
  }

  async update(id: string, data: IUpdateKnowledgeBase): Promise<IKnowledgeBase | null> {
    await this.repo.update(id, data as Partial<KnowledgeBase>);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
