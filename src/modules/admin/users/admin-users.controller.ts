import { Controller, Get, Post, Param, Body, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from "@nestjs/swagger";
import { AdminAuthGuard } from "../auth/admin-auth.guard";
import { AdminUsersService } from "./admin-users.service";

@ApiTags("Admin Users")
@ApiBearerAuth()
@Controller("api/admin/users")
@UseGuards(AdminAuthGuard)
export class AdminUsersController {
  constructor(private readonly usersService: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: "List users with pagination" })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiResponse({ status: 200, description: "Paginated list of users with identities" })
  list(@Query("page") page = "1", @Query("limit") limit = "20") {
    return this.usersService.list(page, limit);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get user with identities and threads" })
  @ApiResponse({ status: 200, description: "User detail" })
  @ApiResponse({ status: 404, description: "User not found" })
  getUser(@Param("id") id: string) {
    return this.usersService.getUser(id);
  }

  @Post("merge")
  @ApiOperation({ summary: "Merge two user records into one" })
  @ApiResponse({ status: 201, description: "Users merged successfully" })
  @ApiResponse({ status: 400, description: "Invalid sourceId or targetId" })
  mergeUsers(@Body() body: { sourceId: string; targetId: string }) {
    return this.usersService.mergeUsers(body.sourceId, body.targetId);
  }
}
