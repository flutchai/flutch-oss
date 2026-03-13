import { Test, TestingModule } from "@nestjs/testing";
import { AdminAgentsController } from "./admin-agents.controller";
import { AdminAgentsService } from "./admin-agents.service";
import { AdminAuthGuard } from "../auth/admin-auth.guard";

const mockAgents = [{ id: "agent-1", graphType: "v1.0.0", graphSettings: {}, platforms: {} }];

describe("AdminAgentsController", () => {
  let controller: AdminAgentsController;
  let service: { getAgents: jest.Mock };

  beforeEach(async () => {
    service = { getAgents: jest.fn().mockReturnValue(mockAgents) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAgentsController],
      providers: [{ provide: AdminAgentsService, useValue: service }],
    })
      .overrideGuard(AdminAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminAgentsController>(AdminAgentsController);
  });

  afterEach(() => jest.clearAllMocks());

  it("delegates getAgents() to service", () => {
    const result = controller.getAgents();

    expect(service.getAgents).toHaveBeenCalled();
    expect(result).toBe(mockAgents);
  });
});
