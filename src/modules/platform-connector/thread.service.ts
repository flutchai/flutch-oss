import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Thread, Platform } from "../database/entities/thread.entity";
import { Message, MessageDirection } from "../database/entities/message.entity";

@Injectable()
export class ThreadService {
  private readonly logger = new Logger(ThreadService.name);

  constructor(
    @InjectRepository(Thread)
    private readonly threadRepo: Repository<Thread>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>
  ) {}

  /**
   * Returns an existing thread or creates a new one for the given
   * agentId + userId + platform combination.
   */
  async findOrCreate(agentId: string, userId: string, platform: Platform): Promise<Thread> {
    let thread = await this.threadRepo.findOne({ where: { agentId, userId, platform } });
    if (!thread) {
      thread = this.threadRepo.create({ agentId, userId, platform });
      thread = await this.threadRepo.save(thread);
      this.logger.debug(`Created thread ${thread.id} for agent="${agentId}" user="${userId}"`);
    }
    return thread;
  }

  async saveMessage(threadId: string, content: string, direction: MessageDirection): Promise<Message> {
    const message = this.messageRepo.create({ threadId, content, direction });
    return this.messageRepo.save(message);
  }
}
