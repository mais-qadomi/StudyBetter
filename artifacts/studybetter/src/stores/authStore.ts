import { create } from "zustand";
import { type AuthUser, authMe, authLogin, authRegister, authLogout, setToken, checkEmail, updateProfile, changePassword, deleteAccount, getAuthProviders } from "../lib/api";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  initialized: boolean;
  providers: { google: boolean };
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  fetchProviders: () => Promise<void>;
  checkEmail: (email: string) => Promise<boolean>;
  updateProfile: (data: { name?: string; avatarUrl?: string }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  initialized: false,
  providers: { google: false },

  fetchMe: async () => {
    try {
      const { user } = await authMe();
      set({ user, initialized: true });
    } catch {
      set({ user: null, initialized: true });
    }
  },

  fetchProviders: async () => {
    try {
      const providers = await getAuthProviders();
      set({ providers });
    } catch {}
  },

  login: async (email, password, rememberMe = false) => {
    set({ loading: true });
    try {
      const { user, token } = await authLogin(email, password, rememberMe);
      setToken(token);
      set({ user, loading: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  register: async (name, email, password) => {
    set({ loading: true });
    try {
      const { user, token } = await authRegister(name, email, password);
      setToken(token);
      set({ user, loading: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  logout: async () => {
    try {
      await authLogout();
    } finally {
      setToken(null);
      set({ user: null });
    }
  },

  checkEmail: async (email) => {
    const { available } = await checkEmail(email);
    return available;
  },

  updateProfile: async (data) => {
    const { user } = await updateProfile(data);
    set({ user });
  },

  changePassword: async (currentPassword, newPassword) => {
    await changePassword(currentPassword, newPassword);
  },

  deleteAccount: async (password) => {
    await deleteAccount(password);
    setToken(null);
    set({ user: null });
  },
}));
