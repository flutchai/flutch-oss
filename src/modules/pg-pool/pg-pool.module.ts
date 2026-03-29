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
    const required = [
      "POSTGRES_HOST",
      "POSTGRES_PORT",
      "POSTGRES_USER",
      "POSTGRES_PASSWORD",
      "POSTGRES_DB",
    ];
    for (const key of required) {
      if (!process.env[key]) throw new Error(`PgPoolModule: missing required env var ${key}`);
    }
    const ssl = process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : false;
    _pool = new Pool({
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT),
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
      max: 10,
      ssl,
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
