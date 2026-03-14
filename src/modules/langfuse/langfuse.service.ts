import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CallbackHandler } from "langfuse-langchain";

export interface LangfuseTraceContext {
  userId: string;
  agentId: string;
  threadId: string;
}

@Injectable()
export class LangfuseService {
  private readonly logger = new Logger(LangfuseService.name);
  private readonly enabled: boolean;
  private readonly publicKey: string | undefined;
  private readonly secretKey: string | undefined;
  private readonly baseUrl: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<string>("LANGFUSE_ENABLED") === "true";
    this.publicKey = this.configService.get<string>("LANGFUSE_PUBLIC_KEY");
    this.secretKey = this.configService.get<string>("LANGFUSE_SECRET_KEY");

    // LANGFUSE_BASE_URL takes priority; fallback: build from LANGFUSE_HOST + LANGFUSE_PORT (both required)
    const explicitUrl = this.configService.get<string>("LANGFUSE_BASE_URL");
    const host = this.configService.get<string>("LANGFUSE_HOST");
    const port = this.configService.get<string>("LANGFUSE_PORT");
    this.baseUrl = explicitUrl ?? (host && port ? `http://${host}:${port}` : undefined);

    if (this.enabled) {
      this.logger.log(`LangFuse tracing enabled (${this.baseUrl ?? "cloud"})`);
    }
  }

  isEnabled(): boolean {
    return this.enabled && !!this.publicKey && !!this.secretKey;
  }

  createCallbackHandler(ctx: LangfuseTraceContext): CallbackHandler | null {
    if (!this.isEnabled()) {
      return null;
    }

    return new CallbackHandler({
      publicKey: this.publicKey!,
      secretKey: this.secretKey!,
      baseUrl: this.baseUrl,
      sessionId: ctx.threadId,
      userId: ctx.userId,
      metadata: { agentId: ctx.agentId },
      tags: ["flutch-oss", ctx.agentId],
    });
  }
}
