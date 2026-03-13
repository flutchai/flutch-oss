import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../../database/entities/user.entity";
import { UserService } from "../../platform-connector/user.service";

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly userService: UserService
  ) {}

  async list(page = "1", limit = "20") {
    const take = Math.min(Number(limit), 100);
    const skip = (Number(page) - 1) * take;

    const [users, total] = await this.userRepo.findAndCount({
      relations: ["identities"],
      order: { createdAt: "DESC" },
      take,
      skip,
    });

    return {
      data: users.map(u => ({
        id: u.id,
        identities: u.identities?.map(i => ({
          platform: i.platform,
          externalId: i.externalId,
          metadata: i.metadata,
        })),
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
      total,
      page: Number(page),
      limit: take,
    };
  }

  async getUser(id: string) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ["identities", "threads"],
    });
    if (!user) throw new NotFoundException("User not found");

    return {
      id: user.id,
      identities: user.identities,
      threads: user.threads?.map(t => ({
        id: t.id,
        agentId: t.agentId,
        platform: t.platform,
        createdAt: t.createdAt,
      })),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async mergeUsers(sourceId: string, targetId: string) {
    if (!sourceId || !targetId) throw new BadRequestException("sourceId and targetId are required");
    if (sourceId === targetId)
      throw new BadRequestException("sourceId and targetId must be different");
    await this.userService.mergeUsers(sourceId, targetId);
    return { success: true };
  }
}
