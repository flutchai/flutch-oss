import { Test, TestingModule } from "@nestjs/testing";
import { HttpService } from "@nestjs/axios";
import { of, throwError } from "rxjs";
import { TelegramApiClient } from "./telegram-api.client";

describe("TelegramApiClient", () => {
  let client: TelegramApiClient;
  let httpService: { post: jest.Mock };

  beforeEach(async () => {
    httpService = { post: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramApiClient,
        { provide: HttpService, useValue: httpService },
      ],
    }).compile();

    client = module.get<TelegramApiClient>(TelegramApiClient);
  });

  it("should be defined", () => {
    expect(client).toBeDefined();
  });

  it("should call Telegram sendMessage API with correct params", async () => {
    httpService.post.mockReturnValue(of({ data: { ok: true } } as any));

    await client.sendMessage("123:TOKEN", 111111, "Hello!");

    expect(httpService.post).toHaveBeenCalledWith(
      "https://api.telegram.org/bot123:TOKEN/sendMessage",
      { chat_id: 111111, text: "Hello!", parse_mode: "HTML" }
    );
  });

  it("should resolve without error on success", async () => {
    httpService.post.mockReturnValue(of({ data: { ok: true } } as any));
    await expect(client.sendMessage("123:TOKEN", 111111, "Hi")).resolves.toBeUndefined();
  });

  it("should throw when Telegram API returns an error", async () => {
    httpService.post.mockReturnValue(throwError(() => new Error("Network error")));
    await expect(client.sendMessage("123:TOKEN", 111111, "Hi")).rejects.toThrow("Network error");
  });

  it("should include the bot token in the URL", async () => {
    httpService.post.mockReturnValue(of({ data: { ok: true } } as any));
    await client.sendMessage("987:MYTOKEN", 999, "test");
    expect(httpService.post).toHaveBeenCalledWith(
      expect.stringContaining("bot987:MYTOKEN"),
      expect.any(Object)
    );
  });
});
