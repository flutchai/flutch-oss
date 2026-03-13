import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from "@nestjs/swagger";
import { AdminAuthGuard } from "../auth/admin-auth.guard";
import { Platform } from "../../database/entities/platform.enum";
import { AdminConversationsService } from "./admin-conversations.service";

@ApiTags("Admin Conversations")
@ApiBearerAuth()
@Controller("api/admin/conversations")
@UseGuards(AdminAuthGuard)
export class AdminConversationsController {
  constructor(private readonly conversationsService: AdminConversationsService) {}

  @Get()
  @ApiOperation({ summary: "List threads with pagination and optional filters" })
  @ApiQuery({ name: "agentId", required: false })
  @ApiQuery({ name: "platform", required: false, enum: Platform })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiResponse({ status: 200, description: "Paginated list of threads" })
  list(
    @Query("agentId") agentId?: string,
    @Query("platform") platform?: Platform,
    @Query("page") page = "1",
    @Query("limit") limit = "20"
  ) {
    return this.conversationsService.list(agentId, platform, page, limit);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get thread with messages and user details" })
  @ApiResponse({ status: 200, description: "Thread detail with messages" })
  @ApiResponse({ status: 404, description: "Thread not found" })
  getThread(@Param("id") id: string) {
    return this.conversationsService.getThread(id);
  }
}
