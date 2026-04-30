const router    = require('express').Router();
const nodeFetch = require('node-fetch');
const db        = require('../db/database');

// ── In-memory cache (5 min TTL) ───────────────────────────────────────────────
const cache = new Map();
const TTL   = 5 * 60 * 1000;

const getCached = (key)       => { const e = cache.get(key); return (e && Date.now() - e.ts < TTL) ? e.data : null; };
const setCached = (key, data) => cache.set(key, { data, ts: Date.now() });

// ── Read IN config from settings table ───────────────────────────────────────
function inConfig() {
  const getSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
  const url = getSetting.get('invoiceninja_url')?.value;
  const key = getSetting.get('invoiceninja_api_key')?.value;
  if (!url || !key) return null;
  return { baseUrl: url.replace(/\/+$/, ''), apiKey: key };
}

// ── Authenticated fetch to IN API ────────────────────────────────────────────
async function inFetch(conf, path, opts = {}) {
  const res = await nodeFetch(`${conf.baseUrl}/api/v1${path}`, {
    ...opts,
    headers: {
      'X-Api-Token':     conf.apiKey,
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type':    'application/json',
      ...opts.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Invoice Ninja ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

// ── Paginate through all records ─────────────────────────────────────────────
async function fetchAll(conf, path) {
  const PER_PAGE = 200;
  const items = [];
  let page = 1;
  while (true) {
    const json = await inFetch(conf, `${path}?per_page=${PER_PAGE}&page=${page}`);
    const batch = json.data || [];
    items.push(...batch);
    // Stop if IN says we're done OR we got fewer items than requested (last page)
    const p = json.meta?.pagination;
    if (batch.length < PER_PAGE) break;
    if (p && p.current_page >= p.total_pages) break;
    if (items.length >= 5000) break; // safety cap
    page++;
  }
  return items;
}

// ── GET /api/invoiceninja/clients ─────────────────────────────────────────────
router.get('/clients', async (req, res) => {
  const conf = inConfig();
  if (!conf) return res.status(503).json({ error: 'Invoice Ninja not configured in Settings' });

  const hit = getCached('clients');
  if (hit) return res.json(hit);

  try {
    const raw = await fetchAll(conf, '/clients');
    const data = raw
      .filter(c => !c.is_deleted)
      .map(c => ({
        id:      c.id,
        name:    c.name || c.display_name || '(unnamed)',
        email:   c.contacts?.[0]?.email || '',
        address: [c.address1, c.city, c.state].filter(Boolean).join(', '),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    setCached('clients', data);
    res.json(data);
  } catch (e) {
    console.error('[IN] clients:', e.message);
    res.status(502).json({ error: e.message });
  }
});

// ── GET /api/invoiceninja/products ────────────────────────────────────────────
router.get('/products', async (req, res) => {
  const conf = inConfig();
  if (!conf) return res.status(503).json({ error: 'Invoice Ninja not configured in Settings' });

  const hit = getCached('products');
  if (hit) return res.json(hit);

  try {
    const raw = await fetchAll(conf, '/products');
    const data = raw
      .filter(p => !p.is_deleted)
      .map(p => ({
        id:          p.id,
        product_key: p.product_key || '',
        description: p.notes || p.product_key || '',
        cost:        parseFloat(p.cost  || 0),
        price:       parseFloat(p.price || p.cost || 0),
      }))
      .sort((a, b) => (a.product_key || '').localeCompare(b.product_key || ''));
    setCached('products', data);
    res.json(data);
  } catch (e) {
    console.error('[IN] products:', e.message);
    res.status(502).json({ error: e.message });
  }
});

// ── POST /api/invoiceninja/quotes ─────────────────────────────────────────────
router.post('/quotes', async (req, res) => {
  const conf = inConfig();
  if (!conf) return res.status(503).json({ error: 'Invoice Ninja not configured in Settings' });

  const { client_id, line_items, public_notes = '', terms = '' } = req.body;
  if (!client_id)      return res.status(400).json({ error: 'client_id is required' });
  if (!line_items?.length) return res.status(400).json({ error: 'At least one line item is required' });

  try {
    const json = await inFetch(conf, '/quotes', {
      method: 'POST',
      body: JSON.stringify({
        client_id,
        status_id:    '1', // Draft
        public_notes,
        terms,
        line_items: line_items.map(item => ({
          product_key: item.product_key || '',
          notes:       item.description  || '',
          quantity:    Number(item.quantity)  || 1,
          cost:        Number(item.unit_cost) || 0,
        })),
      }),
    });
    const quote = json.data;
    res.json({
      id:  quote?.id,
      url: `${conf.baseUrl}/quotes/${quote?.id}/edit`,
    });
  } catch (e) {
    console.error('[IN] create quote:', e.message);
    res.status(502).json({ error: e.message });
  }
});

// ── POST /api/invoiceninja/cache/clear ────────────────────────────────────────
router.post('/cache/clear', (_req, res) => {
  cache.clear();
  res.json({ ok: true });
});

module.exports = router;
