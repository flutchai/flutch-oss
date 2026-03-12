import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Thread } from "../database/entities/thread.entity";
import { Platform } from "../database/entities/platform.enum";
import { Message, MessageDirection } from "../database/entities/message.entity";
import { User } from "../database/entities/user.entity";

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
   * agentId + user + platform combination.
   */
  async findOrCreate(agentId: string, user: User, platform: Platform): Promise<Thread> {
    let thread = await this.threadRepo.findOne({ where: { agentId, userId: user.id, platform } });
    if (!thread) {
      thread = this.threadRepo.create({ agentId, userId: user.id, platform });
      thread = await this.threadRepo.save(thread);
      this.logger.debug(`Created thread ${thread.id} for agent="${agentId}" user="${user.id}"`);
    }
    return thread;
  }

  async saveMessage(
    threadId: string,
    content: string,
    direction: MessageDirection
  ): Promise<Message> {
    const message = this.messageRepo.create({ threadId, content, direction });
    return this.messageRepo.save(message);
  }
}
