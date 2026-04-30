import { api } from './client.js';

export const projectsApi = {
  list:        ()            => api.get('/projects'),
  get:         (id)          => api.get(`/projects/${id}`),
  create:      (data)        => api.post('/projects', data),
  update:      (id, data)    => api.put(`/projects/${id}`, data),
  delete:      (id)          => api.delete(`/projects/${id}`),
  getNotes:    (id, filters) => {
    const params = new URLSearchParams(filters || {});
    const qs = params.toString();
    return api.get(`/projects/${id}/notes${qs ? `?${qs}` : ''}`);
  },
  createNote:  (id, data)    => api.post(`/projects/${id}/notes`, data),
};
