import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThanOrEqual } from "typeorm";
import { Thread } from "../../database/entities/thread.entity";
import { Message, MessageDirection } from "../../database/entities/message.entity";
import { User } from "../../database/entities/user.entity";
import { KnowledgeBase } from "../../kms/entities/knowledge-base.entity";
import { Article } from "../../kms/entities/article.entity";
import { AgentConfigService } from "../../config/agent-config.service";

@Injectable()
export class AdminDashboardService {
  constructor(
    @InjectRepository(Thread)
    private readonly threadRepo: Repository<Thread>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(KnowledgeBase)
    private readonly kbRepo: Repository<KnowledgeBase>,
    @InjectRepository(Article)
    private readonly articleRepo: Repository<Article>,
    private readonly agentConfigService: AgentConfigService
  ) {}

  async getStats() {
    const since = new Date();
    since.setHours(0, 0, 0, 0);

    const [
      threads_today,
      messages_today,
      users_total,
      total_threads,
      kb_count,
      articles_total,
      articles_published,
    ] = await Promise.all([
      this.threadRepo.count({ where: { createdAt: MoreThanOrEqual(since) } }),
      this.messageRepo.count({ where: { createdAt: MoreThanOrEqual(since) } }),
      this.userRepo.count(),
      this.threadRepo.count(),
      this.kbRepo.count(),
      this.articleRepo.count(),
      this.articleRepo.count({ where: { isPublished: true } }),
    ]);

    const agents_count = this.agentConfigService.getAgentCount();

    return {
      threads_today,
      messages_today,
      users_total,
      total_threads,
      agents_count,
      kb_count,
      articles_total,
      articles_published,
    };
  }

  async getStatus() {
    // Simple health checks
    let db_connected = false;
    try {
      await this.userRepo.count();
      db_connected = true;
    } catch {
      db_connected = false;
    }

    return {
      engine: true,
      database: db_connected,
    };
  }

  async getRecentActivity() {
    const messages = await this.messageRepo.find({
      where: { direction: MessageDirection.INCOMING },
      order: { createdAt: "DESC" },
      take: 10,
      relations: ["thread"],
    });

    return messages.map(m => ({
      id: m.id,
      threadId: m.threadId,
      agentId: m.thread?.agentId,
      platform: m.thread?.platform,
      preview: m.content.slice(0, 80),
      createdAt: m.createdAt,
    }));
  }
}
