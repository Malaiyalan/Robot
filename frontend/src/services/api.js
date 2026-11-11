import { Platform } from "react-native";
import { API_URL, BASE_URL } from "../config";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = "GET", body, headers = {}, base = API_URL } = {}) {
  let res;
  try {
    res = await fetch(`${base}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(`Cannot reach server at ${base}. Check API URL / Wi-Fi / backend.`, 0);
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.detail;
    throw new ApiError(
      typeof detail === "string" ? detail : JSON.stringify(detail) || "Request failed",
      res.status
    );
  }
  return data;
}

async function uploadPhotoFile(path, fileUri, sessionToken) {
  const form = new FormData();
  const filename = `capture-${Date.now()}.jpg`;

  if (Platform.OS === "web") {
    const blobRes = await fetch(fileUri);
    const blob = await blobRes.blob();
    form.append("file", blob, filename);
  } else {
    form.append("file", {
      uri: fileUri,
      name: filename,
      type: "image/jpeg",
    });
  }

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "X-Event-Session": sessionToken,
      },
      body: form,
    });
  } catch {
    throw new ApiError(`Cannot reach server at ${API_URL}. Check API URL / Wi-Fi / backend.`, 0);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.detail;
    throw new ApiError(
      typeof detail === "string" ? detail : JSON.stringify(detail) || "Photo upload failed.",
      res.status
    );
  }
  return data;
}

export const api = {
  get: (p, headers) => request(p, { headers }),
  post: (p, body, headers) => request(p, { method: "POST", body, headers }),
  patch: (p, body, headers) => request(p, { method: "PATCH", body, headers }),
  del: (p, headers) => request(p, { method: "DELETE", headers }),
  uploadPhoto: (p, fileUri, sessionToken) => uploadPhotoFile(p, fileUri, sessionToken),
  health: () => request("/health", { base: BASE_URL }),
};
