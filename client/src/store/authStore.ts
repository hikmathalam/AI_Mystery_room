import { create } from "zustand";
import type { PublicUser } from "@mystery-room/shared";
import { api } from "../services/api";

type AuthState = {
  user: PublicUser | null;
  loading: boolean;
  setUser: (user: PublicUser | null) => void;
  hydrate: () => Promise<void>;
  login: (input: { email: string; password: string }) => Promise<void>;
  register: (input: { name: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user, loading: false }),
  hydrate: async () => {
    try {
      const { data } = await api.get("/auth/me");
      set({ user: data.user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
  login: async (input) => {
    const { data } = await api.post("/auth/login", input);
    set({ user: data.user, loading: false });
  },
  register: async (input) => {
    const { data } = await api.post("/auth/register", input);
    set({ user: data.user, loading: false });
  },
  logout: async () => {
    await api.post("/auth/logout");
    set({ user: null, loading: false });
  }
}));
