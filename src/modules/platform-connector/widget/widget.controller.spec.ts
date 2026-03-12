import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { WidgetController } from "./widget.controller";
import { WidgetConnectorService } from "./widget-connector.service";

const mockInitResponse = { threadId: "thread-uuid-1", sessionToken: "tok-abc" };

function makeMockRes() {
  return {
    set: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
  };
}

describe("WidgetController", () => {
  let controller: WidgetController;
  let service: { init: jest.Mock; sendMessage: jest.Mock };

  beforeEach(async () => {
    service = {
      init: jest.fn().mockResolvedValue(mockInitResponse),
      sendMessage: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WidgetController],
      providers: [{ provide: WidgetConnectorService, useValue: service }],
    }).compile();

    controller = module.get<WidgetController>(WidgetController);
  });

  afterEach(() => jest.clearAllMocks());

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("POST /public/widget/init", () => {
    it("returns threadId and sessionToken", async () => {
      const result = await controller.init({
        widgetKey: "wk_test",
        fingerprint: "fp-abc",
      });

      expect(result).toEqual(mockInitResponse);
    });

    it("delegates to WidgetConnectorService.init", async () => {
      await controller.init({ widgetKey: "wk_test", fingerprint: "fp-abc" });
      expect(service.init).toHaveBeenCalledWith({ widgetKey: "wk_test", fingerprint: "fp-abc" });
    });

    it("propagates BadRequestException from service", async () => {
      service.init.mockRejectedValue(new BadRequestException("bad threadId"));
      await expect(
        controller.init({ widgetKey: "wk_test", fingerprint: "fp", threadId: "wrong" })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("POST /public/widget/message", () => {
    it("delegates to WidgetConnectorService.sendMessage with req and res", async () => {
      const res = makeMockRes();
      const req = { on: jest.fn() };

      await controller.message(
        {
          widgetKey: "wk_test",
          threadId: "thread-uuid-1",
          sessionToken: "tok-abc",
          text: "Привет",
        },
        req as any,
        res as any
      );

      expect(service.sendMessage).toHaveBeenCalledWith(
        {
          widgetKey: "wk_test",
          threadId: "thread-uuid-1",
          sessionToken: "tok-abc",
          text: "Привет",
        },
        req,
        res
      );
    });

    it("SSE headers are set by service (controller does not set them directly)", async () => {
      const res = makeMockRes();
      const req = { on: jest.fn() };

      await controller.message(
        { widgetKey: "wk_test", threadId: "t1", sessionToken: "tok", text: "test" },
        req as any,
        res as any
      );

      // headers are the service's responsibility — controller just delegates
      expect(service.sendMessage).toHaveBeenCalledTimes(1);
    });
  });
});
