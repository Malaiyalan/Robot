import { api } from "./api";

// Builds list/get/create/update/remove for any REST resource.
export const createResource = (path) => ({
  list: (skip = 0, limit = 50) => api.get(`${path}/?skip=${skip}&limit=${limit}`),
  get: (id) => api.get(`${path}/${id}`),
  create: (data) => api.post(`${path}/`, data),
  update: (id, data) => api.patch(`${path}/${id}`, data),
  remove: (id) => api.del(`${path}/${id}`),
});
