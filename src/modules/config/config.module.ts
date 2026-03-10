import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { AgentConfigService } from "./agent-config.service";

@Module({
  imports: [HttpModule],
  providers: [AgentConfigService],
  exports: [AgentConfigService],
})
export class AgentConfigModule {}
