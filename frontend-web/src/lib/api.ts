import type {
  AdminLoginResponse,
  AdminPhoto,
  AdminPhotoListResponse,
  AdminUser,
  DashboardStats,
  EventAccessResponse,
  EventCreatePayload,
  EventItem,
  EventProvisionResponse,
  EventStatus,
  PublicPhotoUploadResponse,
  PublicPhotoViewResponse,
  PublicSessionPhotoItem,
  PublicSessionStatusResponse,
} from "../types/api";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "") || "";
const API_V1 = `${API_BASE}/api/v1`;

const ADMIN_TOKEN_KEY = "eventlens_admin_token";
const EVENT_SESSION_KEY = "eventlens_event_session";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const tokenStore = {
  getAdminToken: (): string | null => localStorage.getItem(ADMIN_TOKEN_KEY),
  setAdminToken: (token: string) => localStorage.setItem(ADMIN_TOKEN_KEY, token),
  clearAdminToken: () => localStorage.removeItem(ADMIN_TOKEN_KEY),
  getEventSession: (): string | null => sessionStorage.getItem(EVENT_SESSION_KEY),
  setEventSession: (token: string) => sessionStorage.setItem(EVENT_SESSION_KEY, token),
  clearEventSession: () => sessionStorage.removeItem(EVENT_SESSION_KEY),
};

export function resolveApiUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path}`;
}

async function request<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string | null;
    extraHeaders?: Record<string, string>;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.extraHeaders || {}),
  };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_V1}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError("Unable to reach server. Please verify backend connectivity.", 0);
  }

  if (res.status === 204) return undefined as T;
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = payload?.detail;
    const msg = typeof detail === "string" ? detail : Array.isArray(detail) ? detail[0]?.msg : "Request failed";
    if (res.status === 401 && options.token === tokenStore.getAdminToken()) {
      tokenStore.clearAdminToken();
    }
    throw new ApiError(msg || "Request failed", res.status);
  }
  return payload as T;
}

export const adminApi = {
  login: (username: string, password: string) =>
    request<AdminLoginResponse>("/admin/auth/login", { method: "POST", body: { username, password } }),
  logout: () =>
    request<{ message: string }>("/admin/auth/logout", {
      method: "POST",
      token: tokenStore.getAdminToken(),
    }),
  me: () => request<AdminUser>("/admin/auth/me", { token: tokenStore.getAdminToken() }),
  dashboard: () => request<DashboardStats>("/admin/dashboard", { token: tokenStore.getAdminToken() }),
  listEvents: (params?: { search?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.status && params.status !== "all") qs.set("status", params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<EventItem[]>(`/admin/events${suffix}`, { token: tokenStore.getAdminToken() });
  },
  getEvent: (eventUid: string) =>
    request<EventItem>(`/admin/events/${encodeURIComponent(eventUid)}`, {
      token: tokenStore.getAdminToken(),
    }),
  createEvent: (payload: EventCreatePayload) =>
    request<EventProvisionResponse>("/admin/events", {
      method: "POST",
      body: payload,
      token: tokenStore.getAdminToken(),
    }),
  updateEvent: (eventUid: string, payload: Partial<EventCreatePayload>) =>
    request<EventItem>(`/admin/events/${encodeURIComponent(eventUid)}`, {
      method: "PATCH",
      body: payload,
      token: tokenStore.getAdminToken(),
    }),
  updateEventStatus: (eventUid: string, status: EventStatus, accepting_photos?: boolean) =>
    request<EventItem>(`/admin/events/${encodeURIComponent(eventUid)}/status`, {
      method: "PATCH",
      body: { status, accepting_photos },
      token: tokenStore.getAdminToken(),
    }),
  retryStorage: (eventUid: string) =>
    request<EventProvisionResponse>(`/admin/events/${encodeURIComponent(eventUid)}/provision-storage`, {
      method: "POST",
      token: tokenStore.getAdminToken(),
    }),
  archiveEvent: (eventUid: string) =>
    request<EventItem>(`/admin/events/${encodeURIComponent(eventUid)}/archive`, {
      method: "POST",
      token: tokenStore.getAdminToken(),
    }),
  deleteEvent: (eventUid: string) =>
    request<void>(`/admin/events/${encodeURIComponent(eventUid)}?confirm=true`, {
      method: "DELETE",
      token: tokenStore.getAdminToken(),
    }),
  listEventPhotos: (
    eventUid: string,
    params?: { search?: string; mime_type?: string; uploaded_date?: string }
  ) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.mime_type && params.mime_type !== "all") qs.set("mime_type", params.mime_type);
    if (params?.uploaded_date) qs.set("uploaded_date", params.uploaded_date);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<AdminPhotoListResponse>(
      `/admin/events/${encodeURIComponent(eventUid)}/photos${suffix}`,
      { token: tokenStore.getAdminToken() }
    );
  },
  togglePhotoVisibility: (photoCode: string, is_public: boolean) =>
    request<AdminPhoto>(`/admin/photos/${encodeURIComponent(photoCode)}`, {
      method: "PATCH",
      body: { is_public },
      token: tokenStore.getAdminToken(),
    }),
  deletePhoto: (photoCode: string) =>
    request<void>(`/admin/photos/${encodeURIComponent(photoCode)}`, {
      method: "DELETE",
      token: tokenStore.getAdminToken(),
    }),
};

export const publicApi = {
  accessEvent: (access_code: string) =>
    request<EventAccessResponse>("/public/events/access", {
      method: "POST",
      body: { access_code },
    }),
  getSession: () =>
    request<PublicSessionStatusResponse>("/public/session", {
      extraHeaders: { "X-Event-Session": tokenStore.getEventSession() || "" },
    }),
  getSessionPhotos: () =>
    request<PublicSessionPhotoItem[]>("/public/session/photos", {
      extraHeaders: { "X-Event-Session": tokenStore.getEventSession() || "" },
    }),
  getPhoto: (photoCode: string) =>
    request<PublicPhotoViewResponse>(`/public/photos/${encodeURIComponent(photoCode)}`),
  uploadPhoto: (
    file: Blob,
    filename: string,
    onProgress?: (percent: number) => void
  ): Promise<PublicPhotoUploadResponse> => {
    const sessionToken = tokenStore.getEventSession();
    if (!sessionToken) {
      return Promise.reject(new ApiError("Event session expired. Please re-enter event code.", 401));
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_V1}/public/photos/upload`);
      xhr.setRequestHeader("X-Event-Session", sessionToken);

      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable && onProgress) {
          onProgress(Math.round((ev.loaded / ev.total) * 100));
        }
      };

      xhr.onload = () => {
        let data: { detail?: string } | PublicPhotoUploadResponse | null = null;
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          data = null;
        }
        if (xhr.status >= 200 && xhr.status < 300 && data) {
          resolve(data as PublicPhotoUploadResponse);
          return;
        }
        const msg =
          (data && "detail" in data && typeof data.detail === "string" && data.detail) ||
          "Photo upload failed.";
        reject(new ApiError(msg, xhr.status));
      };

      xhr.onerror = () => {
        reject(new ApiError("Network error while uploading photograph.", 0));
      };

      const form = new FormData();
      form.append("file", file, filename);
      xhr.send(form);
    });
  },
};

