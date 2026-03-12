import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TelegramWebhookController } from "./telegram-webhook.controller";
import { TelegramConnectorService } from "./telegram-connector.service";
import { TelegramUpdate } from "./telegram.types";

const fakeUpdate: TelegramUpdate = {
  update_id: 1,
  message: {
    message_id: 10,
    from: { id: 111111, first_name: "Ivan" },
    chat: { id: 111111, type: "private" },
    text: "Hello",
    date: 0,
  },
};

describe("TelegramWebhookController", () => {
  let controller: TelegramWebhookController;
  let connectorService: { handleUpdate: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    connectorService = { handleUpdate: jest.fn().mockResolvedValue(undefined) };
    configService = { get: jest.fn().mockReturnValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TelegramWebhookController],
      providers: [
        { provide: TelegramConnectorService, useValue: connectorService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    controller = module.get<TelegramWebhookController>(TelegramWebhookController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("POST /public/tg/webhook/:agentId", () => {
    it("should call handleUpdate with agentId and update body", async () => {
      await controller.handleWebhook("roofing-agent", fakeUpdate);
      expect(connectorService.handleUpdate).toHaveBeenCalledWith("roofing-agent", fakeUpdate);
    });

    it("should return void (200 OK) on success", async () => {
      await expect(controller.handleWebhook("roofing-agent", fakeUpdate)).resolves.toBeUndefined();
    });

    it("should return 200 (swallow error) when handleUpdate throws", async () => {
      connectorService.handleUpdate.mockRejectedValue(new Error("engine exploded"));
      await expect(controller.handleWebhook("roofing-agent", fakeUpdate)).resolves.toBeUndefined();
    });

    it("should NOT call handleUpdate when connector throws ForbiddenException", async () => {
      configService.get.mockReturnValue("my-secret");
      await expect(
        controller.handleWebhook("roofing-agent", fakeUpdate, "wrong-secret")
      ).rejects.toThrow(ForbiddenException);
      expect(connectorService.handleUpdate).not.toHaveBeenCalled();
    });
  });

  describe("webhook secret validation", () => {
    it("should throw ForbiddenException when secret is configured and header is missing", async () => {
      configService.get.mockReturnValue("correct-secret");
      await expect(
        controller.handleWebhook("roofing-agent", fakeUpdate, undefined)
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw ForbiddenException when secret header does not match", async () => {
      configService.get.mockReturnValue("correct-secret");
      await expect(
        controller.handleWebhook("roofing-agent", fakeUpdate, "wrong-secret")
      ).rejects.toThrow(ForbiddenException);
    });

    it("should pass when secret header matches configured secret", async () => {
      configService.get.mockReturnValue("correct-secret");
      await expect(
        controller.handleWebhook("roofing-agent", fakeUpdate, "correct-secret")
      ).resolves.toBeUndefined();
    });

    it("should skip validation entirely when TELEGRAM_WEBHOOK_SECRET is not set", async () => {
      configService.get.mockReturnValue(undefined);
      await expect(
        controller.handleWebhook("roofing-agent", fakeUpdate, undefined)
      ).resolves.toBeUndefined();
    });

    it("should skip validation when TELEGRAM_WEBHOOK_SECRET is not set even with wrong header", async () => {
      configService.get.mockReturnValue(undefined);
      await expect(
        controller.handleWebhook("roofing-agent", fakeUpdate, "any-header-value")
      ).resolves.toBeUndefined();
    });
  });
});
