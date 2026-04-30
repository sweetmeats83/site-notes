import { api } from './client.js';

export const materialsApi = {
  list:   ()         => api.get('/materials'),
  create: (data)     => api.post('/materials', data),
  update: (id, data) => api.put(`/materials/${id}`, data),
  delete: (id)       => api.delete(`/materials/${id}`),
};
