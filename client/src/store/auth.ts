import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  token: string | null;
  mustChangePassword: boolean;
  login: (token: string, mustChangePassword: boolean) => void;
  passwordChanged: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    set => ({
      token: null,
      mustChangePassword: false,
      login: (token, mustChangePassword) => set({ token, mustChangePassword }),
      passwordChanged: () => set({ mustChangePassword: false }),
      logout: () => set({ token: null, mustChangePassword: false }),
    }),
    { name: "flutch-admin-auth" }
  )
);
