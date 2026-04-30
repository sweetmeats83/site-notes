import { api } from './client.js';

export const pipelineApi = {
  get:         ()   => api.get('/pipeline'),
  dismiss:     (id) => api.post(`/pipeline/dismiss/${id}`, {}),
  getInvoice:  (id) => api.get(`/pipeline/invoice/${id}`),
};
