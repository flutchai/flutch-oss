import axios from "axios";
import { useAuthStore } from "@/store/auth";

export const apiClient = axios.create({
  baseURL: "/api/admin",
});

apiClient.interceptors.request.use(config => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = "/admin/login";
    }
    return Promise.reject(err);
  }
);
