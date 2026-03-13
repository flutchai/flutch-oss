import { Injectable, Logger, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, QueryFailedError } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import { AdminUser } from "../../database/entities/admin-user.entity";

export interface JwtPayload {
  sub: string;
  username: string;
}

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    @InjectRepository(AdminUser)
    private readonly adminUserRepo: Repository<AdminUser>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {
    if (!this.configService.get<string>("ADMIN_PASSWORD")) {
      this.logger.warn(
        "ADMIN_PASSWORD is not set — bootstrap login will be unavailable until it is configured"
      );
    }
  }

  async login(
    username: string,
    password: string
  ): Promise<{ access_token: string; must_change_password: boolean }> {
    const user = await this.adminUserRepo.findOne({ where: { username } });

    // Bootstrap flow: accept env ADMIN_PASSWORD if no admin exists or first admin hasn't changed password
    const envPassword = this.configService.get<string>("ADMIN_PASSWORD");

    if (!user) {
      if (username === "admin" && envPassword && password === envPassword) {
        const hash = await bcrypt.hash(password, 10);
        const created = this.adminUserRepo.create({
          username: "admin",
          passwordHash: hash,
          passwordChanged: false,
        });
        try {
          const saved = await this.adminUserRepo.save(created);
          const token = this.jwtService.sign({
            sub: saved.id,
            username: saved.username,
          } as JwtPayload);
          return { access_token: token, must_change_password: true };
        } catch (err) {
          // Concurrent request already created the admin user — verify password then proceed
          if (err instanceof QueryFailedError) {
            const existing = await this.adminUserRepo.findOne({ where: { username: "admin" } });
            if (existing && password === envPassword) {
              const token = this.jwtService.sign({
                sub: existing.id,
                username: existing.username,
              } as JwtPayload);
              return { access_token: token, must_change_password: !existing.passwordChanged };
            }
            // QueryFailedError but password does not match — still 401, not 500
            throw new UnauthorizedException("Invalid credentials");
          }
          throw err;
        }
      }
      throw new UnauthorizedException("Invalid credentials");
    }

    // If password hasn't been changed yet, also allow env password
    if (!user.passwordChanged && envPassword && password === envPassword) {
      const token = this.jwtService.sign({ sub: user.id, username: user.username } as JwtPayload);
      return { access_token: token, must_change_password: true };
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException("Invalid credentials");

    const token = this.jwtService.sign({ sub: user.id, username: user.username } as JwtPayload);
    this.logger.log(`Admin login: ${username}`);
    return { access_token: token, must_change_password: false };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await this.adminUserRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException("User not found");

    if (newPassword.length < 8)
      throw new BadRequestException("Password must be at least 8 characters");

    // Allow env password as current password for first-time change
    const envPassword = this.configService.get<string>("ADMIN_PASSWORD");
    const isEnvPassword = !user.passwordChanged && envPassword && currentPassword === envPassword;
    const isValid = isEnvPassword || (await bcrypt.compare(currentPassword, user.passwordHash));

    if (!isValid) throw new UnauthorizedException("Current password is incorrect");

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordChanged = true;
    await this.adminUserRepo.save(user);
    this.logger.log(`Admin ${user.username} changed password`);
  }

  async findById(id: string): Promise<AdminUser | null> {
    return this.adminUserRepo.findOne({ where: { id } });
  }
}
