export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

const API_BASE = import.meta.env.VITE_API_URL || "/api";

function getToken(): string | null {
  return localStorage.getItem("sb_token");
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem("sb_token", token);
  } else {
    localStorage.removeItem("sb_token");
  }
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: "include" });
  return res;
}

export async function apiJson<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, options);
  const data = await res.json();
  if (!res.ok) {
    throw { status: res.status, ...(typeof data === "object" && data !== null ? data : { error: "خطأ غير معروف" }) };
  }
  return data as T;
}

export interface LoginResponse {
  user: AuthUser;
  token: string;
}

export interface RegisterResponse {
  user: AuthUser;
  token: string;
}

export async function authLogin(email: string, password: string, rememberMe = false): Promise<LoginResponse> {
  return apiJson<LoginResponse>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, rememberMe }),
  });
}

export async function authRegister(name: string, email: string, password: string): Promise<RegisterResponse> {
  return apiJson<RegisterResponse>("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
}

export async function authMe(): Promise<{ user: AuthUser }> {
  return apiJson<{ user: AuthUser }>("/auth/me");
}

export async function authLogout(): Promise<void> {
  await apiFetch("/auth/logout", { method: "POST" });
}

export async function checkEmail(email: string): Promise<{ available: boolean }> {
  return apiJson<{ available: boolean }>(`/auth/check-email?email=${encodeURIComponent(email)}`);
}

export async function updateProfile(data: { name?: string; avatarUrl?: string }): Promise<{ user: AuthUser }> {
  return apiJson<{ user: AuthUser }>("/user/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean }> {
  return apiJson<{ ok: boolean }>("/user/password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function deleteAccount(password: string): Promise<{ ok: boolean }> {
  return apiJson<{ ok: boolean }>("/user/account", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
}

export async function forgotPassword(email: string): Promise<{ ok: boolean; message: string }> {
  return apiJson<{ ok: boolean; message: string }>("/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<{ ok: boolean }> {
  return apiJson<{ ok: boolean }>("/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
  });
}

export async function getAuthProviders(): Promise<{ google: boolean }> {
  return apiJson<{ google: boolean }>("/auth/providers");
}
