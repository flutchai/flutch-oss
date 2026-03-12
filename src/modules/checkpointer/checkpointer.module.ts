import { Global, Module } from "@nestjs/common";
import { CheckpointerService, CHECKPOINTER } from "./checkpointer.service";

@Global()
@Module({
  providers: [
    CheckpointerService,
    {
      provide: CHECKPOINTER,
      useFactory: (service: CheckpointerService) => service.saver,
      inject: [CheckpointerService],
    },
  ],
  exports: [CHECKPOINTER],
})
export class CheckpointerModule {}
