import { Controller, Post, Body, UseGuards, Req, HttpCode } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { IsString, IsNotEmpty, MinLength } from "class-validator";
import { AdminAuthService } from "./admin-auth.service";
import { AdminAuthGuard } from "./admin-auth.guard";
import { AdminUser } from "../../database/entities/admin-user.entity";

class LoginDto {
  @IsString() @IsNotEmpty() username: string;
  @IsString() @IsNotEmpty() password: string;
}

class ChangePasswordDto {
  @IsString() @IsNotEmpty() currentPassword: string;
  @IsString() @MinLength(8) newPassword: string;
}

@ApiTags("Admin Auth")
@Controller("api/admin/auth")
export class AdminAuthController {
  constructor(private readonly authService: AdminAuthService) {}

  @Post("login")
  @HttpCode(200)
  @ApiOperation({ summary: "Admin login" })
  @ApiResponse({ status: 200, description: "Returns JWT access token" })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password);
  }

  @Post("change-password")
  @UseGuards(AdminAuthGuard)
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Change admin password" })
  @ApiResponse({ status: 200, description: "Password changed successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized or incorrect current password" })
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req: { adminUser: AdminUser }) {
    await this.authService.changePassword(req.adminUser.id, dto.currentPassword, dto.newPassword);
    return { success: true };
  }
}
