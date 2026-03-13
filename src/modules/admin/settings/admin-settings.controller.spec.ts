import { Test, TestingModule } from "@nestjs/testing";
import { AdminSettingsController } from "./admin-settings.controller";
import { AdminSettingsService } from "./admin-settings.service";
import { AdminAuthGuard } from "../auth/admin-auth.guard";

const mockSettings = {
  configMode: "local",
  flutchPlatformUrl: null,
  openaiKeyMasked: null,
  anthropicKeyMasked: null,
};
const mockWebhookOk = {
  success: true,
  webhookUrl: "https://host/public/tg/webhook/agent-1",
  description: "ok",
};

describe("AdminSettingsController", () => {
  let controller: AdminSettingsController;
  let service: { getSettings: jest.Mock; registerWebhook: jest.Mock };

  beforeEach(async () => {
    service = {
      getSettings: jest.fn().mockReturnValue(mockSettings),
      registerWebhook: jest.fn().mockResolvedValue(mockWebhookOk),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminSettingsController],
      providers: [{ provide: AdminSettingsService, useValue: service }],
    })
      .overrideGuard(AdminAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminSettingsController>(AdminSettingsController);
  });

  afterEach(() => jest.clearAllMocks());

  it("delegates getSettings() to service", () => {
    const result = controller.getSettings();

    expect(service.getSettings).toHaveBeenCalled();
    expect(result).toBe(mockSettings);
  });

  it("delegates registerWebhook() to service", async () => {
    const result = await controller.registerWebhook("agent-1");

    expect(service.registerWebhook).toHaveBeenCalledWith("agent-1");
    expect(result).toBe(mockWebhookOk);
  });
});
