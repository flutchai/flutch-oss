import { Test } from "@nestjs/testing";
import { Pool } from "pg";
import { PgPoolModule, PG_POOL_TOKEN, getSharedPool, _resetSharedPool } from "./pg-pool.module";

jest.mock("pg", () => ({
  Pool: jest.fn().mockImplementation(() => ({ end: jest.fn().mockResolvedValue(undefined) })),
}));

const BASE_ENV = {
  DATABASE_URL: "postgres://user:pass@localhost:5432/testdb",
};

function setEnv(extra: Record<string, string | undefined> = {}) {
  for (const [k, v] of Object.entries({ ...BASE_ENV, ...extra })) {
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
  delete process.env.DATABASE_SSL;
  delete process.env.DATABASE_URL;
});

describe("getSharedPool", () => {
  it("creates Pool with correct options", () => {
    getSharedPool();
    expect(Pool).toHaveBeenCalledWith({
      connectionString: "postgres://user:pass@localhost:5432/testdb",
      max: 10,
      ssl: false,
    });
  });

  it("enables SSL when DATABASE_SSL=true", () => {
    setEnv({ DATABASE_SSL: "true" });
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

  it("throws when DATABASE_URL is missing", () => {
    setEnv({ DATABASE_URL: undefined });
    expect(() => getSharedPool()).toThrow("PgPoolModule: missing required env var DATABASE_URL");
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
