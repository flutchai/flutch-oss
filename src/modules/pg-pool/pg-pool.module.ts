import { DynamicModule, Global, Inject, Module, OnApplicationShutdown } from "@nestjs/common";
import { Pool } from "pg";

export const PG_POOL_TOKEN = "PG_POOL";

// Module-level singleton — shared between all consumers (KmsModule, CheckpointerService).
// Created on first call to getSharedPool(); reset on application shutdown.
let _pool: Pool | undefined;

/**
 * Returns the shared pg.Pool singleton.
 * Created once from POSTGRES_* env vars; all calls return the same instance.
 * Called synchronously by both KmsModule.forRoot() and via DI (PG_POOL_TOKEN).
 */
export function getSharedPool(): Pool {
  if (!_pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("PgPoolModule: missing required env var DATABASE_URL");
    _pool = new Pool({
      connectionString,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
      max: 10,
    });
  }
  return _pool;
}

// Exposed for testing — lets specs reset the singleton between test runs.
export function _resetSharedPool(): void {
  _pool = undefined;
}

@Global()
@Module({})
export class PgPoolModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL_TOKEN) private readonly pool: Pool) {}

  static forRoot(): DynamicModule {
    const pool = getSharedPool();
    return {
      module: PgPoolModule,
      providers: [{ provide: PG_POOL_TOKEN, useValue: pool }],
      exports: [PG_POOL_TOKEN],
    };
  }

  async onApplicationShutdown(): Promise<void> {
    _pool = undefined;
    await this.pool.end();
  }
}
