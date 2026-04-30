import { api } from './client.js';

export const notesApi = {
  get:    (id)       => api.get(`/notes/${id}`),
  update: (id, data) => api.put(`/notes/${id}`, data),
  delete: (id)       => api.delete(`/notes/${id}`),
};
