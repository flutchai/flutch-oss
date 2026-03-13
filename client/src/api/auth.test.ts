import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock("./client", () => ({
  apiClient: { get: mockGet, post: mockPost },
}));

// Import after mock is set up
const { authApi } = await import("./auth");

describe("authApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("login calls POST /auth/login with credentials", async () => {
    mockPost.mockResolvedValue({
      data: { access_token: "jwt-token", must_change_password: false },
    });

    const result = await authApi.login("admin", "password");

    expect(mockPost).toHaveBeenCalledWith("/auth/login", {
      username: "admin",
      password: "password",
    });
    expect(result).toEqual({ access_token: "jwt-token", must_change_password: false });
  });

  it("changePassword calls POST /auth/change-password", async () => {
    mockPost.mockResolvedValue({ data: { success: true } });

    const result = await authApi.changePassword("old-pass", "new-pass");

    expect(mockPost).toHaveBeenCalledWith("/auth/change-password", {
      currentPassword: "old-pass",
      newPassword: "new-pass",
    });
    expect(result).toEqual({ success: true });
  });
});
