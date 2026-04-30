import { api } from './client.js';

export const invApi = {
  clients:     ()     => api.get('/invoiceninja/clients'),
  products:    ()     => api.get('/invoiceninja/products'),
  createQuote: (data) => api.post('/invoiceninja/quotes', data),
  clearCache:  ()     => api.post('/invoiceninja/cache/clear', {}),
};
