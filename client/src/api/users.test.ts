import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock("./client", () => ({
  apiClient: { get: mockGet, post: mockPost },
}));

const { usersApi } = await import("./users");

const mockPaginatedUsers = {
  data: [
    {
      id: "user-1",
      identities: [{ platform: "telegram", externalId: "12345", metadata: { firstName: "Ivan" } }],
      createdAt: "2024-01-01",
      updatedAt: "2024-01-02",
    },
  ],
  total: 1,
  page: 1,
  limit: 20,
};

const mockUserDetail = {
  id: "user-1",
  identities: [],
  threads: [],
  createdAt: "2024-01-01",
  updatedAt: "2024-01-02",
};

describe("usersApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("list calls GET /users without params", async () => {
    mockGet.mockResolvedValue({ data: mockPaginatedUsers });

    const result = await usersApi.list();

    expect(mockGet).toHaveBeenCalledWith("/users", { params: undefined });
    expect(result).toEqual(mockPaginatedUsers);
  });

  it("list passes pagination params", async () => {
    mockGet.mockResolvedValue({ data: mockPaginatedUsers });

    await usersApi.list({ page: 2, limit: 10 });

    expect(mockGet).toHaveBeenCalledWith("/users", { params: { page: 2, limit: 10 } });
  });

  it("getUser calls GET /users/:id", async () => {
    mockGet.mockResolvedValue({ data: mockUserDetail });

    const result = await usersApi.getUser("user-1");

    expect(mockGet).toHaveBeenCalledWith("/users/user-1");
    expect(result).toEqual(mockUserDetail);
  });

  it("mergeUsers calls POST /users/merge with sourceId and targetId", async () => {
    mockPost.mockResolvedValue({ data: { success: true } });

    const result = await usersApi.mergeUsers("source-id", "target-id");

    expect(mockPost).toHaveBeenCalledWith("/users/merge", {
      sourceId: "source-id",
      targetId: "target-id",
    });
    expect(result).toEqual({ success: true });
  });
});
