import { api } from './client.js';

export const tasksApi = {
  create:    (noteId, data) => api.post(`/notes/${noteId}/tasks`, data),
  update:    (id, data)     => api.put(`/tasks/${id}`, data),
  delete:    (id)           => api.delete(`/tasks/${id}`),
  bulkReplace: (noteId, tasks) => api.post('/tasks/bulk', { note_id: noteId, tasks }),
};
