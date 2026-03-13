import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { Response, Request } from "express";
import { IGraphService, IGraphRequestPayload } from "@flutchai/flutch-sdk";
import { HumanMessage } from "@langchain/core/messages";
import { v4 as uuidv4 } from "uuid";
import { AgentConfigService } from "../../config/agent-config.service";
import { UserService } from "../user.service";
import { ThreadService } from "../thread.service";
import { Platform } from "../../database/entities/platform.enum";
import { MessageDirection } from "../../database/entities/message.entity";
import { WidgetInitDto, WidgetInitResponse, WidgetMessageDto } from "./widget.types";

@Injectable()
export class WidgetConnectorService {
  private readonly logger = new Logger(WidgetConnectorService.name);

  /** sessionToken → { fingerprint, expiresAt }. Cleared on service restart (MVP: in-memory only). */
  private readonly sessions = new Map<string, { fingerprint: string; expiresAt: number }>();
  private readonly MAX_SESSIONS = 10_000;
  private readonly SESSION_TTL_MS = 24 * 60 * 60 * 1_000; // 24 h

  constructor(
    private readonly agentConfigService: AgentConfigService,
    private readonly userService: UserService,
    private readonly threadService: ThreadService,
    @Inject("GRAPH_SERVICE") private readonly graphService: IGraphService
  ) {}

  async init(dto: WidgetInitDto): Promise<WidgetInitResponse> {
    const agentConfig = await this.agentConfigService.resolveByWidgetKey(dto.widgetKey);

    const user = await this.userService.findOrCreateByIdentity(Platform.WIDGET, dto.fingerprint);

    const thread = await this.threadService.findOrCreate(
      agentConfig.agentId,
      user,
      Platform.WIDGET
    );

    if (dto.threadId && dto.threadId !== thread.id) {
      throw new BadRequestException(
        `threadId "${dto.threadId}" does not belong to this agent/user`
      );
    }

    // Lazy TTL sweep: purge expired sessions before adding a new one
    const now = Date.now();
    for (const [token, session] of this.sessions) {
      if (session.expiresAt <= now) this.sessions.delete(token);
    }

    // Hard cap: evict oldest entry when still over limit after TTL sweep
    if (this.sessions.size >= this.MAX_SESSIONS) {
      const oldest = this.sessions.keys().next().value;
      if (oldest !== undefined) this.sessions.delete(oldest);
    }

    const sessionToken = uuidv4();
    this.sessions.set(sessionToken, {
      fingerprint: dto.fingerprint,
      expiresAt: now + this.SESSION_TTL_MS,
    });

    return { threadId: thread.id, sessionToken };
  }

  async sendMessage(dto: WidgetMessageDto, req: Request, res: Response): Promise<void> {
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();

    let responseEnded = false;
    req.on("close", () => {
      responseEnded = true;
    });

    const writeEvent = (event: string, data: string): void => {
      if (!responseEnded) {
        res.write(`event: ${event}\ndata: ${data}\n\n`);
      }
    };

    try {
      const session = this.sessions.get(dto.sessionToken);
      if (!session || session.expiresAt <= Date.now()) {
        this.sessions.delete(dto.sessionToken);
        throw new UnauthorizedException("Invalid or expired session token");
      }
      const { fingerprint } = session;

      const agentConfig = await this.agentConfigService.resolveByWidgetKey(dto.widgetKey);

      const user = await this.userService.findOrCreateByIdentity(Platform.WIDGET, fingerprint);
      const thread = await this.threadService.findOrCreate(
        agentConfig.agentId,
        user,
        Platform.WIDGET
      );

      await this.threadService.saveMessage(thread.id, dto.text, MessageDirection.INCOMING);

      const context = await this.agentConfigService.resolve(agentConfig.agentId, user.id);

      const payload: IGraphRequestPayload = {
        requestId: uuidv4(),
        input: { messages: [new HumanMessage(dto.text)] },
        config: {
          configurable: {
            thread_id: thread.id,
            context: {
              agentId: context.agentId,
              userId: user.id,
              threadId: thread.id,
            },
            graphSettings: { ...context.graphSettings, graphType: context.graphType },
            metadata: { platform: "widget" },
          },
        },
      };

      let fullText = "";

      const result = await this.graphService.streamAnswer(payload, (chunk: string) => {
        fullText += chunk;
        writeEvent("partial", chunk);
      });

      const finalText = result?.text ?? fullText;
      await this.threadService.saveMessage(thread.id, finalText, MessageDirection.OUTGOING);

      writeEvent("final", JSON.stringify({ messageId: uuidv4(), text: finalText }));
      this.logger.debug(`Widget message handled for thread "${thread.id}"`);
    } catch (error) {
      this.logger.error(`Widget stream error: ${error.message}`);
      writeEvent("error", error.message);
    } finally {
      if (!responseEnded) {
        res.end();
      }
    }
  }
}
