import { bootstrap } from "@flutchai/flutch-sdk";
import { AppModule } from "./app.module";

bootstrap(AppModule).catch(err => {
  console.error("Fatal error starting Flutch OSS agent engine:", err);
  process.exit(1);
});
