import { Logger, Module, OnModuleInit } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { LoggingInterceptor } from "./logging.interceptor";
import { AgentV1Builder } from "./graph";
import {
  BaseGraphServiceController,
  BuilderRegistryService,
  UniversalGraphModule,
  GraphEngineType,
} from "@flutchai/flutch-sdk";

const logger = new Logger("AppModule");

@Module({
  imports: [
    HttpModule,
    ConfigModule.forRoot({
      envFilePath: ".env",
      isGlobal: true,
    }),
    UniversalGraphModule.forRoot({
      engineType: GraphEngineType.LANGGRAPH,
      versioning: [
        {
          baseGraphType: "flutch.agent",
          versions: [
            {
              version: "1.0.0",
              builderClass: AgentV1Builder,
              isDefault: true,
            },
          ],
          defaultVersionStrategy: "latest",
        },
      ],
      mongodb: {},
    }),
  ],
  controllers: [BaseGraphServiceController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    AgentV1Builder,
  ],
  exports: [ConfigModule],
})
export class AppModule implements OnModuleInit {
  constructor(
    private readonly agentV1Builder: AgentV1Builder,
    private readonly builderRegistry: BuilderRegistryService
  ) {}

  async onModuleInit() {
    this.builderRegistry.registerBuilder(this.agentV1Builder);
    logger.log("Registered AgentV1Builder with graph type: " + this.agentV1Builder.graphType);
    logger.log("🚀 FLUTCH OSS AGENT ENGINE INITIALIZED");
  }
}
