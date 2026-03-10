import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    if (request.url === "/stream" && request.method === "POST") {
      const payload = request.body;
      this.logger.debug("=== INCOMING STREAM REQUEST ===");
      this.logger.debug(`Full payload: ${JSON.stringify(payload, null, 2)}`);
      this.logger.debug("=== END STREAM REQUEST ===");
    }

    return next.handle().pipe(tap(() => {}));
  }
}
