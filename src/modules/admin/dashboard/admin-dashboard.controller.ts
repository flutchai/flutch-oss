import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { AdminAuthGuard } from "../auth/admin-auth.guard";
import { AdminDashboardService } from "./admin-dashboard.service";

@ApiTags("Admin Dashboard")
@ApiBearerAuth()
@Controller("api/admin/dashboard")
@UseGuards(AdminAuthGuard)
export class AdminDashboardController {
  constructor(private readonly dashboardService: AdminDashboardService) {}

  @Get("stats")
  @ApiOperation({ summary: "Get dashboard statistics" })
  @ApiResponse({ status: 200, description: "Aggregated platform stats" })
  getStats() {
    return this.dashboardService.getStats();
  }

  @Get("status")
  @ApiOperation({ summary: "Get engine and service health status" })
  @ApiResponse({ status: 200, description: "Health status of engine, DB, and RAGflow" })
  getStatus() {
    return this.dashboardService.getStatus();
  }

  @Get("activity")
  @ApiOperation({ summary: "Get recent message activity" })
  @ApiResponse({ status: 200, description: "Last 10 incoming messages across all agents" })
  getActivity() {
    return this.dashboardService.getRecentActivity();
  }
}
