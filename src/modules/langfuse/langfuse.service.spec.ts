import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { LangfuseService } from "./langfuse.service";

jest.mock("langfuse-langchain", () => ({
  CallbackHandler: jest.fn().mockImplementation(opts => ({ _opts: opts })),
}));

import { CallbackHandler } from "langfuse-langchain";

const makeService = async (env: Record<string, string>) => {
  const module = await Test.createTestingModule({
    providers: [
      LangfuseService,
      {
        provide: ConfigService,
        useValue: { get: (key: string) => env[key] ?? undefined },
      },
    ],
  }).compile();
  return module.get(LangfuseService);
};

describe("LangfuseService", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("isEnabled()", () => {
    it("returns false when LANGFUSE_ENABLED is not set", async () => {
      const svc = await makeService({});
      expect(svc.isEnabled()).toBe(false);
    });

    it("returns false when LANGFUSE_ENABLED=false", async () => {
      const svc = await makeService({ LANGFUSE_ENABLED: "false" });
      expect(svc.isEnabled()).toBe(false);
    });

    it("returns false when LANGFUSE_ENABLED=true but keys are missing", async () => {
      const svc = await makeService({ LANGFUSE_ENABLED: "true" });
      expect(svc.isEnabled()).toBe(false);
    });

    it("returns true when enabled and keys are present", async () => {
      const svc = await makeService({
        LANGFUSE_ENABLED: "true",
        LANGFUSE_PUBLIC_KEY: "pk-test",
        LANGFUSE_SECRET_KEY: "sk-test",
      });
      expect(svc.isEnabled()).toBe(true);
    });
  });

  describe("createCallbackHandler()", () => {
    const ctx = { userId: "u-1", agentId: "roofing-agent", threadId: "t-1" };

    it("returns null when disabled", async () => {
      const svc = await makeService({ LANGFUSE_ENABLED: "false" });
      expect(svc.createCallbackHandler(ctx)).toBeNull();
    });

    it("returns null when keys are missing even if enabled=true", async () => {
      const svc = await makeService({ LANGFUSE_ENABLED: "true" });
      expect(svc.createCallbackHandler(ctx)).toBeNull();
    });

    it("returns a CallbackHandler when fully configured", async () => {
      const svc = await makeService({
        LANGFUSE_ENABLED: "true",
        LANGFUSE_PUBLIC_KEY: "pk-test",
        LANGFUSE_SECRET_KEY: "sk-test",
        LANGFUSE_BASE_URL: "http://langfuse:3000",
      });
      const handler = svc.createCallbackHandler(ctx);
      expect(handler).not.toBeNull();
      expect(CallbackHandler).toHaveBeenCalledTimes(1);
    });

    it("passes correct options to CallbackHandler", async () => {
      const svc = await makeService({
        LANGFUSE_ENABLED: "true",
        LANGFUSE_PUBLIC_KEY: "pk-test",
        LANGFUSE_SECRET_KEY: "sk-test",
        LANGFUSE_BASE_URL: "http://langfuse:3000",
      });
      svc.createCallbackHandler(ctx);
      expect(CallbackHandler).toHaveBeenCalledWith({
        publicKey: "pk-test",
        secretKey: "sk-test",
        baseUrl: "http://langfuse:3000",
        sessionId: "t-1",
        userId: "u-1",
        metadata: { agentId: "roofing-agent" },
        tags: ["flutch-oss", "roofing-agent"],
      });
    });

    it("creates separate handler instances per call", async () => {
      const svc = await makeService({
        LANGFUSE_ENABLED: "true",
        LANGFUSE_PUBLIC_KEY: "pk-test",
        LANGFUSE_SECRET_KEY: "sk-test",
      });
      svc.createCallbackHandler({ ...ctx, threadId: "t-1" });
      svc.createCallbackHandler({ ...ctx, threadId: "t-2" });
      expect(CallbackHandler).toHaveBeenCalledTimes(2);
    });
  });
});
