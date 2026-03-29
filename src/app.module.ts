import { Logger, Module, OnModuleInit } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { LoggingInterceptor } from "./logging.interceptor";
import { RootController } from "./root.controller";
import { SimpleGraphBuilder, SalesGraphBuilder } from "./graph";
import { EngineModule } from "./modules/engine/engine.module";
import { DatabaseModule } from "./modules/database/database.module";
import { PlatformConnectorModule } from "./modules/platform-connector/platform-connector.module";
import { CheckpointerModule } from "./modules/checkpointer/checkpointer.module";
import { AdminModule } from "./modules/admin/admin.module";
import { LangfuseModule } from "./modules/langfuse/langfuse.module";
import { KmsModule } from "./modules/kms/kms.module";
import { PgPoolModule } from "./modules/pg-pool/pg-pool.module";
import {
  BaseGraphServiceController,
  BuilderRegistryService,
  UniversalGraphModule,
  GraphEngineType,
  McpRuntimeHttpClient,
  ModelInitializer,
} from "@flutchai/flutch-sdk";
import { createOssConfigFetcher } from "./graph/model-config-fetcher";

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
          baseGraphType: "flutch.simple",
          versions: [
            {
              version: "1.0.0",
              builderClass: SimpleGraphBuilder,
              isDefault: true,
            },
          ],
        },
        {
          baseGraphType: "flutch.sales",
          versions: [
            {
              version: "2.0.0",
              builderClass: SalesGraphBuilder,
              isDefault: true,
            },
          ],
        },
      ],
    }),
    PgPoolModule.forRoot(),
    CheckpointerModule,
    LangfuseModule,
    EngineModule,
    DatabaseModule,
    PlatformConnectorModule,
    AdminModule,
    KmsModule.forRoot(),
  ],
  controllers: [RootController, BaseGraphServiceController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    McpRuntimeHttpClient,
    {
      provide: ModelInitializer,
      useFactory: () => new ModelInitializer(createOssConfigFetcher()),
    },
    SimpleGraphBuilder,
    SalesGraphBuilder,
  ],
  exports: [ConfigModule],
})
export class AppModule implements OnModuleInit {
  constructor(
    private readonly simpleBuilder: SimpleGraphBuilder,
    private readonly salesBuilder: SalesGraphBuilder,
    private readonly builderRegistry: BuilderRegistryService
  ) {}

  async onModuleInit() {
    this.builderRegistry.registerBuilder(this.simpleBuilder);
    this.builderRegistry.registerBuilder(this.salesBuilder);
    logger.log(
      `Registered graphs: ${this.simpleBuilder.graphType}, ${this.salesBuilder.graphType}`
    );
  }
}
