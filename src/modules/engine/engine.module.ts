import { Module } from "@nestjs/common";
import { EngineController } from "./engine.controller";
import { EngineService } from "./engine.service";
import { AgentConfigModule } from "../config/config.module";

@Module({
  imports: [AgentConfigModule],
  controllers: [EngineController],
  providers: [EngineService],
})
export class EngineModule {}
