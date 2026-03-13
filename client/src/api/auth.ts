import { apiClient } from "./client";

export const authApi = {
  login: (username: string, password: string) =>
    apiClient
      .post<{
        access_token: string;
        must_change_password: boolean;
      }>("/auth/login", { username, password })
      .then(r => r.data),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post("/auth/change-password", { currentPassword, newPassword }).then(r => r.data),
};
