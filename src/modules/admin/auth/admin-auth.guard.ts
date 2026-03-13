import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { AdminAuthService, JwtPayload } from "./admin-auth.service";
import { AdminUser } from "../../database/entities/admin-user.entity";

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly adminAuthService: AdminAuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { adminUser?: AdminUser }>();
    const token = this.extractToken(request);

    if (!token) throw new UnauthorizedException("Missing token");

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      const user = await this.adminAuthService.findById(payload.sub);
      if (!user) throw new UnauthorizedException("User not found");
      request.adminUser = user;
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException("Invalid token");
    }
  }

  private extractToken(request: Request): string | null {
    const [type, token] = request.headers.authorization?.split(" ") ?? [];
    return type === "Bearer" ? (token ?? null) : null;
  }
}
