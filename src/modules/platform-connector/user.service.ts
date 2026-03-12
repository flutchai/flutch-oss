import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../database/entities/user.entity";
import { UserIdentity } from "../database/entities/user-identity.entity";
import { Platform } from "../database/entities/thread.entity";

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserIdentity)
    private readonly identityRepo: Repository<UserIdentity>,
  ) {}

  /**
   * Finds an existing user by platform identity, or creates a new one.
   * Optionally updates metadata (e.g. firstName, username) on each call.
   */
  async findOrCreateByIdentity(
    platform: Platform,
    externalId: string,
    metadata?: Record<string, any>,
  ): Promise<User> {
    let identity = await this.identityRepo.findOne({
      where: { platform, externalId },
      relations: ["user"],
    });

    if (identity) {
      if (metadata) {
        identity.metadata = { ...identity.metadata, ...metadata };
        await this.identityRepo.save(identity);
      }
      return identity.user;
    }

    const user = await this.userRepo.save(this.userRepo.create());
    identity = this.identityRepo.create({ userId: user.id, platform, externalId, metadata: metadata ?? null });
    await this.identityRepo.save(identity);

    this.logger.debug(`Created user ${user.id} with identity ${platform}:${externalId}`);
    return user;
  }

  /**
   * Merges sourceUser into targetUser.
   * All identities and threads of sourceUser are reassigned to targetUser,
   * then sourceUser is deleted.
   *
   * Use this for manual deduplication when you know two records represent
   * the same real person.
   */
  async mergeUsers(sourceUserId: string, targetUserId: string): Promise<void> {
    const [source, target] = await Promise.all([
      this.userRepo.findOne({ where: { id: sourceUserId }, relations: ["identities"] }),
      this.userRepo.findOne({ where: { id: targetUserId } }),
    ]);

    if (!source) throw new NotFoundException(`Source user ${sourceUserId} not found`);
    if (!target) throw new NotFoundException(`Target user ${targetUserId} not found`);

    // Reassign all identities to target
    if (source.identities?.length) {
      await this.identityRepo.update({ userId: sourceUserId }, { userId: targetUserId });
    }

    // Reassign all threads to target (FK update)
    await this.userRepo.manager.getRepository("threads").update({ userId: sourceUserId }, { userId: targetUserId });

    await this.userRepo.delete(sourceUserId);
    this.logger.log(`Merged user ${sourceUserId} into ${targetUserId}`);
  }
}
