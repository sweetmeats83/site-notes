const router    = require('express').Router();
const nodeFetch = require('node-fetch');
const db        = require('../db/database');

function getSetting(key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value || '';
}

function inConfig() {
  const url = getSetting('invoiceninja_url');
  const key = getSetting('invoiceninja_api_key');
  if (!url || !key) return null;
  return { baseUrl: url.replace(/\/+$/, ''), apiKey: key };
}

async function inFetch(conf, path, opts = {}) {
  const res = await nodeFetch(`${conf.baseUrl}/api/v1${path}`, {
    ...opts,
    headers: {
      'X-Api-Token':      conf.apiKey,
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type':     'application/json',
      ...opts.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Invoice Ninja ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchAllProducts(conf) {
  const PER_PAGE = 200;
  const items = [];
  let page = 1;
  while (true) {
    const json = await inFetch(conf, `/products?per_page=${PER_PAGE}&page=${page}`);
    const batch = json.data || [];
    items.push(...batch);
    const p = json.meta?.pagination;
    if (batch.length < PER_PAGE) break;
    if (p && p.current_page >= p.total_pages) break;
    if (items.length >= 5000) break;
    page++;
  }
  return items.filter(p => !p.is_deleted);
}

// ── POST /api/catalog/review ──────────────────────────────────────────────────
// Sends the full IN product catalog to Claude, returns suggested updates + additions
router.post('/review', async (req, res) => {
  const anthropicKey = getSetting('anthropic_api_key');
  if (!anthropicKey) return res.status(503).json({ error: 'Anthropic API key not set in Settings' });

  const conf = inConfig();
  if (!conf) return res.status(503).json({ error: 'Invoice Ninja not configured in Settings' });

  const { instructions = '', model = 'claude-haiku-4-5-20251001' } = req.body;
  if (!instructions.trim()) return res.status(400).json({ error: 'Instructions are required' });

  try {
    const raw = await fetchAllProducts(conf);
    const products = raw.map(p => ({
      id:          p.id,
      k: p.product_key || '',
      d: (p.notes || p.product_key || '').slice(0, 80),
      p: parseFloat(p.price || p.cost || 0),
    }));

    const systemPrompt = `You are a construction cost estimator reviewing a contractor's Invoice Ninja product catalog. Your job is to suggest price updates and new items based on the contractor's instructions.

Return ONLY a valid JSON object — no explanation, no markdown, no code blocks. Start your response with { and end with }.`;

    const userPrompt = `Current catalog (${products.length} items, fields: id=product id, k=product_key, d=description, p=price):
${JSON.stringify(products)}

Contractor instructions: ${instructions.trim()}

Return this exact JSON structure:
{
  "updates": [
    {
      "id": "exact-id-from-catalog",
      "product_key": "existing key",
      "description": "existing description",
      "current_price": 0.00,
      "suggested_price": 0.00,
      "reason": "one sentence max"
    }
  ],
  "additions": [
    {
      "product_key": "SHORT-KEY",
      "description": "Full description of the item",
      "suggested_price": 0.00,
      "reason": "one sentence max"
    }
  ],
  "deletions": [
    {
      "id": "exact-id-from-catalog",
      "product_key": "key to delete",
      "description": "item description",
      "reason": "one sentence — what it is a duplicate of"
    }
  ]
}

Rules:
- product_key must be ≤20 chars, uppercase, hyphens only (no spaces)
- Only suggest updates when instructions give you clear basis to do so
- Only add items that are genuinely missing and commonly needed
- Only suggest deletions for clear duplicates where a better replacement already exists in the catalog
- Never delete an item unless a surviving equivalent is present
- If nothing should change, return {"updates":[],"additions":[],"deletions":[]}`;

    const anthropicRes = await nodeFetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        system:   systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.json().catch(() => ({}));
      return res.status(anthropicRes.status).json({ error: err.error?.message || `Anthropic ${anthropicRes.status}` });
    }

    const anthropicData = await anthropicRes.json();
    const text = anthropicData.content?.[0]?.text || '';

    // Extract JSON — find the outermost { } regardless of surrounding text or code fences
    let parsed;
    try {
      const first = text.indexOf('{');
      const last  = text.lastIndexOf('}');
      if (first === -1 || last === -1) throw new Error('no braces');
      parsed = JSON.parse(text.slice(first, last + 1));
    } catch {
      return res.status(502).json({ error: 'Claude returned invalid JSON. Try again or simplify your instructions.', raw: text.slice(0, 500) });
    }

    res.json({
      updates:   parsed.updates   || [],
      additions: parsed.additions || [],
      deletions: parsed.deletions || [],
      usage:     anthropicData.usage,
    });
  } catch (e) {
    console.error('[catalog/review]', e.message);
    res.status(502).json({ error: e.message });
  }
});

// ── POST /api/catalog/apply ───────────────────────────────────────────────────
// Applies approved updates + additions to Invoice Ninja
router.post('/apply', async (req, res) => {
  const conf = inConfig();
  if (!conf) return res.status(503).json({ error: 'Invoice Ninja not configured' });

  const { updates = [], additions = [], deletions = [] } = req.body;
  const results = { updated: [], created: [], deleted: [], failed: [] };

  // Build product_key → real IN id map so we don't rely on Claude returning correct UUIDs
  let keyToId = {};
  if (updates.length > 0 || deletions.length > 0) {
    try {
      const live = await fetchAllProducts(conf);
      keyToId = Object.fromEntries(live.map(p => [p.product_key, p.id]));
    } catch { /* fall back to item.id below */ }
  }

  for (const item of updates) {
    const id = keyToId[item.product_key] || item.id;
    try {
      const price = parseFloat(String(item.suggested_price).replace(/[^0-9.]/g, '')) || 0;
      await inFetch(conf, `/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ price, cost: price }),
      });
      results.updated.push(item.product_key);
    } catch (e) {
      results.failed.push({ key: item.product_key, error: e.message });
    }
  }

  for (const item of additions) {
    try {
      const price = parseFloat(String(item.suggested_price).replace(/[^0-9.]/g, '')) || 0;
      await inFetch(conf, '/products', {
        method: 'POST',
        body: JSON.stringify({
          product_key: item.product_key,
          notes:       item.description,
          cost:        price,
          price:       price,
        }),
      });
      results.created.push(item.product_key);
    } catch (e) {
      results.failed.push({ key: item.product_key, error: e.message });
    }
  }

  for (const item of deletions) {
    const id = keyToId[item.product_key] || item.id;
    try {
      await inFetch(conf, `/products/${id}`, { method: 'DELETE' });
      results.deleted.push(item.product_key);
    } catch (e) {
      results.failed.push({ key: item.product_key, error: e.message });
    }
  }

  res.json(results);
});

module.exports = router;
