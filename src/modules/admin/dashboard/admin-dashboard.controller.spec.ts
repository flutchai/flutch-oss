import { Test, TestingModule } from "@nestjs/testing";
import { AdminDashboardController } from "./admin-dashboard.controller";
import { AdminDashboardService } from "./admin-dashboard.service";
import { AdminAuthGuard } from "../auth/admin-auth.guard";

describe("AdminDashboardController", () => {
  let controller: AdminDashboardController;
  let dashboardService: {
    getStats: jest.Mock;
    getStatus: jest.Mock;
    getRecentActivity: jest.Mock;
  };

  beforeEach(async () => {
    dashboardService = {
      getStats: jest.fn().mockResolvedValue({ threads_today: 5, agents_count: 2 }),
      getStatus: jest.fn().mockResolvedValue({ engine: true, database: true }),
      getRecentActivity: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminDashboardController],
      providers: [{ provide: AdminDashboardService, useValue: dashboardService }],
    })
      .overrideGuard(AdminAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminDashboardController>(AdminDashboardController);
  });

  it("getStats delegates to dashboardService.getStats", async () => {
    const result = await controller.getStats();

    expect(dashboardService.getStats).toHaveBeenCalled();
    expect(result).toEqual({ threads_today: 5, agents_count: 2 });
  });

  it("getStatus delegates to dashboardService.getStatus", async () => {
    const result = await controller.getStatus();

    expect(dashboardService.getStatus).toHaveBeenCalled();
    expect(result).toEqual({ engine: true, database: true });
  });

  it("getActivity delegates to dashboardService.getRecentActivity", async () => {
    const result = await controller.getActivity();

    expect(dashboardService.getRecentActivity).toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
