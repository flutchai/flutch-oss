import { beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "./auth";

describe("useAuthStore", () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, mustChangePassword: false });
  });

  it("initial state has no token and mustChangePassword false", () => {
    const { token, mustChangePassword } = useAuthStore.getState();

    expect(token).toBeNull();
    expect(mustChangePassword).toBe(false);
  });

  it("login sets token and mustChangePassword", () => {
    useAuthStore.getState().login("jwt-abc", true);

    const { token, mustChangePassword } = useAuthStore.getState();
    expect(token).toBe("jwt-abc");
    expect(mustChangePassword).toBe(true);
  });

  it("login with mustChangePassword=false sets flag to false", () => {
    useAuthStore.getState().login("jwt-xyz", false);

    expect(useAuthStore.getState().mustChangePassword).toBe(false);
  });

  it("passwordChanged sets mustChangePassword to false", () => {
    useAuthStore.setState({ token: "jwt-abc", mustChangePassword: true });

    useAuthStore.getState().passwordChanged();

    expect(useAuthStore.getState().mustChangePassword).toBe(false);
    expect(useAuthStore.getState().token).toBe("jwt-abc");
  });

  it("logout clears token and mustChangePassword", () => {
    useAuthStore.setState({ token: "jwt-abc", mustChangePassword: true });

    useAuthStore.getState().logout();

    const { token, mustChangePassword } = useAuthStore.getState();
    expect(token).toBeNull();
    expect(mustChangePassword).toBe(false);
  });
});
