import { Controller, Get, Post, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { AdminAuthGuard } from "../auth/admin-auth.guard";
import { AdminSettingsService } from "./admin-settings.service";

@ApiTags("Admin Settings")
@ApiBearerAuth()
@Controller("api/admin/settings")
@UseGuards(AdminAuthGuard)
export class AdminSettingsController {
  constructor(private readonly settingsService: AdminSettingsService) {}

  @Get()
  @ApiOperation({ summary: "Get current engine settings" })
  @ApiResponse({ status: 200, description: "Masked environment settings" })
  getSettings() {
    return this.settingsService.getSettings();
  }

  @Post("telegram/webhook/:agentId")
  @ApiOperation({ summary: "Register Telegram webhook for an agent" })
  @ApiResponse({ status: 201, description: "Webhook registration result" })
  registerWebhook(@Param("agentId") agentId: string) {
    return this.settingsService.registerWebhook(agentId);
  }
}
