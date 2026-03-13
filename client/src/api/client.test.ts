import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLogout = vi.fn();
const mockGetState = vi.fn();

vi.mock("@/store/auth", () => ({
  useAuthStore: { getState: mockGetState },
}));

// Import after mock setup
const { apiClient } = await import("./client");

// Access axios interceptor handlers (internal API)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const reqHandler = (apiClient.interceptors.request as any).handlers[0];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const resHandler = (apiClient.interceptors.response as any).handlers[0];

describe("apiClient — request interceptor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetState.mockReturnValue({ token: null, logout: mockLogout });
  });

  it("adds Authorization header when token is present", () => {
    mockGetState.mockReturnValue({ token: "jwt-abc", logout: mockLogout });

    const config = { headers: {} as Record<string, string> };
    const result = reqHandler.fulfilled(config);

    expect(result.headers["Authorization"]).toBe("Bearer jwt-abc");
  });

  it("does not add Authorization header when token is null", () => {
    mockGetState.mockReturnValue({ token: null, logout: mockLogout });

    const config = { headers: {} as Record<string, string> };
    const result = reqHandler.fulfilled(config);

    expect(result.headers["Authorization"]).toBeUndefined();
  });
});

describe("apiClient — response interceptor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetState.mockReturnValue({ token: "jwt-abc", logout: mockLogout });
  });

  it("passes through successful responses unchanged", () => {
    const response = { status: 200, data: { ok: true } };

    const result = resHandler.fulfilled(response);

    expect(result).toBe(response);
  });

  it("calls logout on 401 error", async () => {
    const error = { response: { status: 401 } };

    await expect(resHandler.rejected(error)).rejects.toEqual(error);
    expect(mockLogout).toHaveBeenCalled();
  });

  it("does not call logout for non-401 errors", async () => {
    const error = { response: { status: 500 } };

    await expect(resHandler.rejected(error)).rejects.toEqual(error);
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("re-throws error in all cases after 401 handling", async () => {
    const error = { response: { status: 401 } };

    await expect(resHandler.rejected(error)).rejects.toBe(error);
  });
});
