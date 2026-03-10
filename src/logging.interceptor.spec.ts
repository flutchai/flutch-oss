import { ExecutionContext, CallHandler } from "@nestjs/common";
import { of } from "rxjs";
import { LoggingInterceptor } from "./logging.interceptor";

function mockContext(method: string, url: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method, url, body: { agentId: "test" } }),
    }),
  } as unknown as ExecutionContext;
}

function mockHandler(): CallHandler {
  return { handle: () => of("response") };
}

describe("LoggingInterceptor", () => {
  let interceptor: LoggingInterceptor;
  let debugSpy: jest.SpyInstance;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    // Suppress actual logger output and track calls
    debugSpy = jest.spyOn((interceptor as any).logger, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should be defined", () => {
    expect(interceptor).toBeDefined();
  });

  it.each([["/stream"], ["/agent/stream"], ["/agent/generate"]])(
    "should log debug for POST %s",
    url => {
      const ctx = mockContext("POST", url);
      interceptor.intercept(ctx, mockHandler());
      expect(debugSpy).toHaveBeenCalled();
    }
  );

  it("should NOT log for GET requests on logged routes", () => {
    const ctx = mockContext("GET", "/agent/stream");
    interceptor.intercept(ctx, mockHandler());
    expect(debugSpy).not.toHaveBeenCalled();
  });

  it("should NOT log for POST to unlisted routes", () => {
    const ctx = mockContext("POST", "/health");
    interceptor.intercept(ctx, mockHandler());
    expect(debugSpy).not.toHaveBeenCalled();
  });

  it("should pass through the handler observable", done => {
    const ctx = mockContext("POST", "/agent/generate");
    const result$ = interceptor.intercept(ctx, mockHandler());
    result$.subscribe(value => {
      expect(value).toBe("response");
      done();
    });
  });
});
