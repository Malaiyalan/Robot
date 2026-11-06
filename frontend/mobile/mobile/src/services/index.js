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
export { api };
