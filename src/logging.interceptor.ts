import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from "@nestjs/common";
import { Observable } from "rxjs";

const LOGGED_ROUTES = ["/stream", "/agent/stream", "/agent/generate"];

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    if (request.method === "POST" && LOGGED_ROUTES.includes(request.url)) {
      const payload = request.body;
      this.logger.debug("=== INCOMING REQUEST ===");
      this.logger.debug(`${request.method} ${request.url}`);
      this.logger.debug(`Full payload: ${JSON.stringify(payload, null, 2)}`);
      this.logger.debug("=== END REQUEST ===");
    }

    return next.handle();
  }
}
