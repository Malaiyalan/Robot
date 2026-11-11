import { BASE_URL } from "../config";
import { api } from "./api";
import { createResource } from "./crud";

export const userService = createResource("/users");
export const deviceService = createResource("/devices");
export const activityLogService = createResource("/activity-logs");
export const sareeService = createResource("/sarees");
export const photoSessionService = {
  ...createResource("/photo-sessions"),
  getByToken: (token) => api.get(`/photo-sessions/public/${token}`),
};

export const publicEventService = {
  accessEvent: (accessCode) => api.post("/public/events/access", { access_code: accessCode }),
  getSession: (sessionToken) =>
    api.get("/public/session", { "X-Event-Session": sessionToken }),
  getSessionPhotos: (sessionToken) =>
    api.get("/public/session/photos", { "X-Event-Session": sessionToken }),
  uploadPhoto: (fileUri, sessionToken) =>
    api.uploadPhoto("/public/photos/upload", fileUri, sessionToken),
  getPhotoByCode: (photoId) =>
    api.get(`/public/photos/${encodeURIComponent(photoId)}`),
  resolveUrl: (path) => (path && path.startsWith("http") ? path : `${BASE_URL}${path}`),
};

export const publicPhotoService = publicEventService;

export { api };
