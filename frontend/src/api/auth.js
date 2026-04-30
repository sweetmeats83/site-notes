// Auth endpoints bypass the shared client so a 401 never fires the auth:expired event
async function authFetch(method, path, body) {
  const res = await fetch(`/api/auth${path}`, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const authApi = {
  me:     ()         => authFetch('GET',  '/me'),
  login:  (password) => authFetch('POST', '/login',  { password }),
  logout: ()         => authFetch('POST', '/logout'),
};
