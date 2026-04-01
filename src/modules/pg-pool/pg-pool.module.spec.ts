import { Test } from "@nestjs/testing";
import { Pool } from "pg";
import { PgPoolModule, PG_POOL_TOKEN, getSharedPool, _resetSharedPool } from "./pg-pool.module";

jest.mock("pg", () => ({
  Pool: jest.fn().mockImplementation(() => ({ end: jest.fn().mockResolvedValue(undefined) })),
}));

const BASE_ENV = {
  POSTGRES_HOST: "localhost",
  POSTGRES_PORT: "5432",
  POSTGRES_USER: "user",
  POSTGRES_PASSWORD: "pass",
  POSTGRES_DB: "testdb",
};

function setEnv(extra: Record<string, string | undefined> = {}) {
  Object.assign(process.env, BASE_ENV);
  for (const [k, v] of Object.entries(extra)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

beforeEach(() => {
  _resetSharedPool();
  jest.clearAllMocks();
  setEnv();
});

afterEach(() => {
  _resetSharedPool();
  delete process.env.POSTGRES_SSL;
});

describe("getSharedPool", () => {
  it("creates Pool with correct options", () => {
    getSharedPool();
    expect(Pool).toHaveBeenCalledWith({
      host: "localhost",
      port: 5432,
      user: "user",
      password: "pass",
      database: "testdb",
      max: 10,
      ssl: false,
    });
  });

  it("enables SSL when POSTGRES_SSL=true", () => {
    setEnv({ POSTGRES_SSL: "true" });
    getSharedPool();
    expect(Pool).toHaveBeenCalledWith(
      expect.objectContaining({
        ssl: { rejectUnauthorized: false },
      })
    );
  });

  it("returns the same instance on multiple calls (singleton)", () => {
    const a = getSharedPool();
    const b = getSharedPool();
    expect(a).toBe(b);
    expect(Pool).toHaveBeenCalledTimes(1);
  });

  it("throws when a required env var is missing", () => {
    setEnv({ POSTGRES_HOST: undefined });
    expect(() => getSharedPool()).toThrow("PgPoolModule: missing required env var POSTGRES_HOST");
  });
});

describe("PgPoolModule.forRoot", () => {
  it("provides PG_POOL_TOKEN with the shared pool", async () => {
    const module = await Test.createTestingModule({
      imports: [PgPoolModule.forRoot()],
    }).compile();

    const pool = module.get<Pool>(PG_POOL_TOKEN);
    expect(pool).toBeDefined();
    expect(pool).toBe(getSharedPool());
  });
});

describe("PgPoolModule.onApplicationShutdown", () => {
  it("calls pool.end() and resets the singleton", async () => {
    const module = await Test.createTestingModule({
      imports: [PgPoolModule.forRoot()],
    }).compile();

    const pool = module.get<Pool>(PG_POOL_TOKEN);
    await module.close();

    expect(pool.end).toHaveBeenCalledTimes(1);
    // singleton reset — next call creates a new pool
    _resetSharedPool();
    jest.clearAllMocks();
    getSharedPool();
    expect(Pool).toHaveBeenCalledTimes(1);
  });
});
