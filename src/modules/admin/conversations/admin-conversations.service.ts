import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Thread } from "../../database/entities/thread.entity";
import { Message } from "../../database/entities/message.entity";
import { Platform } from "../../database/entities/platform.enum";

type ThreadWithCount = Thread & { messageCount: number };

@Injectable()
export class AdminConversationsService {
  constructor(
    @InjectRepository(Thread)
    private readonly threadRepo: Repository<Thread>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>
  ) {}

  async list(agentId?: string, platform?: Platform, page = "1", limit = "20") {
    const take = Math.min(Number(limit), 100);
    const skip = (Number(page) - 1) * take;

    const qb = this.threadRepo
      .createQueryBuilder("t")
      .leftJoinAndSelect("t.user", "u")
      .loadRelationCountAndMap("t.messageCount", "t.messages")
      .orderBy("t.createdAt", "DESC")
      .take(take)
      .skip(skip);

    if (agentId) qb.andWhere("t.agent_id = :agentId", { agentId });
    if (platform) qb.andWhere("t.platform = :platform", { platform });

    const [threads, total] = await qb.getManyAndCount();

    return {
      data: (threads as ThreadWithCount[]).map(t => ({
        id: t.id,
        agentId: t.agentId,
        platform: t.platform,
        userId: t.userId,
        messageCount: t.messageCount ?? 0,
        createdAt: t.createdAt,
      })),
      total,
      page: Number(page),
      limit: take,
    };
  }

  async getThread(id: string) {
    const thread = await this.threadRepo.findOne({
      where: { id },
      relations: ["user", "user.identities"],
    });
    if (!thread) throw new NotFoundException("Thread not found");

    const messages = await this.messageRepo.find({
      where: { threadId: id },
      order: { createdAt: "ASC" },
    });

    return {
      id: thread.id,
      agentId: thread.agentId,
      platform: thread.platform,
      user: thread.user,
      createdAt: thread.createdAt,
      messages: messages.map(m => ({
        id: m.id,
        content: m.content,
        direction: m.direction,
        createdAt: m.createdAt,
      })),
    };
  }
}
