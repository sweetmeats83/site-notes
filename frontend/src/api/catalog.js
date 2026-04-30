import { api } from './client.js';

export const catalogApi = {
  review: (instructions, model) => api.post('/catalog/review', { instructions, model }),
  apply:  (updates, additions, deletions)  => api.post('/catalog/apply',  { updates, additions, deletions }),
};
