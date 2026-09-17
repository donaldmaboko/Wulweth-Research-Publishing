"use client";

/** Typed fetch wrapper for the Wulweth API (same-origin via Next rewrites). */

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  if (res.status === 204) return undefined as T;
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON response
  }
  if (!res.ok) {
    const detail = data?.detail;
    let message = "Something went wrong. Please try again.";
    if (typeof detail === "string") message = detail;
    else if (Array.isArray(detail) && detail[0]?.msg) message = detail[0].msg;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

export const get = <T = any>(path: string) => api<T>(path);
export const post = <T = any>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
export const put = <T = any>(path: string, body?: unknown) =>
  api<T>(path, { method: "PUT", body: body === undefined ? undefined : JSON.stringify(body) });
export const del = <T = any>(path: string) => api<T>(path, { method: "DELETE" });

export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

// ---------- session ----------

export type SessionUser = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  professional_title?: string | null;
  country?: string | null;
  email_verified?: boolean;
  phone?: string | null;
  timezone?: string | null;
  organization_id?: string | null;
  organization_name?: string | null;
  notification_prefs?: Record<string, { email?: boolean }>;
};

export async function fetchMe(): Promise<SessionUser | null> {
  try {
    return await get<SessionUser>("/auth/me");
  } catch {
    return null;
  }
}

export const STAFF_ROLES = ["MANAGER", "QC_REVIEWER", "FINANCE", "ADMIN", "SUPER_ADMIN"];
export const PROFESSIONAL_ROLES = ["RESEARCHER", "RESEARCH_CONSULTANT", "DATA_SPECIALIST", "EDITOR"];
export const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

export const isStaff = (u: SessionUser | null) => !!u && STAFF_ROLES.includes(u.role);
export const isProfessional = (u: SessionUser | null) => !!u && PROFESSIONAL_ROLES.includes(u.role);
export const isAdmin = (u: SessionUser | null) => !!u && ADMIN_ROLES.includes(u.role);

export const roleLabel = (role: string) =>
  ({
    CLIENT: "Client",
    RESEARCHER: "Researcher",
    RESEARCH_CONSULTANT: "Research Consultant",
    DATA_SPECIALIST: "Data Specialist",
    EDITOR: "Editor",
    ORGANIZATION: "Organization",
    MANAGER: "Programmes Manager",
    QC_REVIEWER: "Quality Reviewer",
    FINANCE: "Finance",
    ADMIN: "Administrator",
    SUPER_ADMIN: "Administrator",
  }[role] ?? role);
