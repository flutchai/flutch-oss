import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { AdminAuthGuard } from "../auth/admin-auth.guard";
import { AdminAgentsService } from "./admin-agents.service";

@ApiTags("Admin Agents")
@ApiBearerAuth()
@Controller("api/admin/agents")
@UseGuards(AdminAuthGuard)
export class AdminAgentsController {
  constructor(private readonly agentsService: AdminAgentsService) {}

  @Get()
  @ApiOperation({ summary: "List all configured agents" })
  @ApiResponse({ status: 200, description: "Array of agent configs with masked secrets" })
  getAgents() {
    return this.agentsService.getAgents();
  }
}
