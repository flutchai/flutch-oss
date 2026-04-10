/**
 * Tests for AppDataSource (TypeORM CLI data source).
 * Re-imports the module with different env vars to test SSL branching.
 */

const BASE_ENV = {
  DATABASE_URL: "postgres://user:pass@localhost:5432/testdb",
};

jest.mock("typeorm", () => ({
  DataSource: jest.fn().mockImplementation((opts: unknown) => ({ options: opts })),
}));
jest.mock("dotenv", () => ({ config: jest.fn() }));
jest.mock("./modules/database/entities/thread.entity", () => ({ Thread: class Thread {} }));
jest.mock("./modules/database/entities/message.entity", () => ({ Message: class Message {} }));
jest.mock("./modules/database/entities/user.entity", () => ({ User: class User {} }));
jest.mock("./modules/database/entities/user-identity.entity", () => ({
  UserIdentity: class UserIdentity {},
}));
jest.mock("./modules/database/entities/admin-user.entity", () => ({
  AdminUser: class AdminUser {},
}));
jest.mock("./modules/kms/entities/knowledge-base.entity", () => ({
  KnowledgeBase: class KnowledgeBase {},
}));
jest.mock("./modules/kms/entities/article.entity", () => ({ Article: class Article {} }));

/** Re-imports data-source with a clean module registry and given extra env vars.
 *  Returns both the AppDataSource and the DataSource mock from the same registry. */
async function load(extra: Record<string, string | undefined> = {}) {
  jest.resetModules();
  // Apply env
  for (const [k, v] of Object.entries({ ...BASE_ENV, ...extra })) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const [mod, typeorm] = await Promise.all([import("./data-source"), import("typeorm")]);
  return { source: mod.AppDataSource, MockDataSource: typeorm.DataSource as jest.Mock };
}

afterEach(() => {
  delete process.env.DATABASE_SSL;
});

describe("AppDataSource", () => {
  it("creates DataSource with correct connection params", async () => {
    const { MockDataSource } = await load();
    const [opts] = MockDataSource.mock.calls.at(-1);
    expect(opts).toMatchObject({
      type: "postgres",
      url: "postgres://user:pass@localhost:5432/testdb",
      synchronize: false,
    });
  });

  it("disables SSL when DATABASE_SSL is not set", async () => {
    const { MockDataSource } = await load({ DATABASE_SSL: undefined });
    const [opts] = MockDataSource.mock.calls.at(-1);
    expect(opts.ssl).toBe(false);
  });

  it("disables SSL when DATABASE_SSL=false", async () => {
    const { MockDataSource } = await load({ DATABASE_SSL: "false" });
    const [opts] = MockDataSource.mock.calls.at(-1);
    expect(opts.ssl).toBe(false);
  });

  it("enables SSL with rejectUnauthorized=false when DATABASE_SSL=true", async () => {
    const { MockDataSource } = await load({ DATABASE_SSL: "true" });
    const [opts] = MockDataSource.mock.calls.at(-1);
    expect(opts.ssl).toEqual({ rejectUnauthorized: false });
  });

  it("throws when DATABASE_URL is missing", async () => {
    jest.resetModules();
    delete process.env.DATABASE_URL;
    await expect(import("./data-source")).rejects.toThrow(
      "Missing required environment variable: DATABASE_URL"
    );
  });
});
