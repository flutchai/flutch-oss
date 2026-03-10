import { Module } from "@nestjs/common";
import { UniversalGraphService } from "@flutchai/flutch-sdk";
import { EngineController } from "./engine.controller";
import { EngineService } from "./engine.service";
import { AgentConfigModule } from "../config/config.module";

@Module({
  imports: [AgentConfigModule],
  controllers: [EngineController],
  providers: [
    EngineService,
    // GRAPH_SERVICE is provided globally by UniversalGraphModule (registered in AppModule).
    // Declaring it explicitly here makes the dependency visible and keeps EngineModule
    // compilable in isolation (e.g. integration tests) when the global module is mocked.
    {
      provide: "GRAPH_SERVICE",
      useExisting: UniversalGraphService,
    },
  ],
})
export class EngineModule {}
