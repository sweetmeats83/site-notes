const router    = require('express').Router();
const nodeFetch = require('node-fetch');
const db        = require('../db/database');

// Dismissed quotes persist across sessions
db.exec(`
  CREATE TABLE IF NOT EXISTS dismissed_quotes (
    id           TEXT PRIMARY KEY,
    dismissed_at TEXT DEFAULT (datetime('now'))
  )
`);

function inConfig() {
  const get = db.prepare('SELECT value FROM settings WHERE key = ?');
  const url = get.get('invoiceninja_url')?.value;
  const key = get.get('invoiceninja_api_key')?.value;
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
    const body = await res.text().catch(() => '');
    throw new Error(`Invoice Ninja ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchAll(conf, path) {
  const PER_PAGE = 200;
  const items = [];
  let page = 1;
  while (true) {
    const sep  = path.includes('?') ? '&' : '?';
    const json = await inFetch(conf, `${path}${sep}per_page=${PER_PAGE}&page=${page}`);
    const batch = json.data || [];
    items.push(...batch);
    const p = json.meta?.pagination;
    if (batch.length < PER_PAGE) break;
    if (p && p.current_page >= p.total_pages) break;
    if (items.length >= 5000) break;
    page++;
  }
  return items;
}

const fmt = (n) => parseFloat(n) || 0;

// ── GET /api/pipeline ─────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const conf = inConfig();
  if (!conf) return res.json({ configured: false, jobs: [], quotes: [] });

  try {
    const [rawInvoices, rawQuotes, rawClients] = await Promise.all([
      fetchAll(conf, '/invoices'),
      fetchAll(conf, '/quotes'),
      fetchAll(conf, '/clients'),
    ]);

    const clientName = Object.fromEntries(
      rawClients.map(c => [c.id, c.name || c.display_name || '(unknown)'])
    );

    const dismissed = new Set(
      db.prepare('SELECT id FROM dismissed_quotes').all().map(r => r.id)
    );

    const now = Date.now();

    // Active jobs: Sent(2) and Partial(3) — real jobs out in the world
    // Draft(1) excluded — incomplete invoices not ready yet
    // Coerce to Number — IN API sometimes returns status_id as a string
    const ACTIVE = new Set([2, 3]);
    const STATUS_LABEL = { 2: 'Sent', 3: 'Partial' };

    console.log(`[pipeline] invoices=${rawInvoices.length} quotes=${rawQuotes.length} clients=${rawClients.length}`);
    if (rawInvoices.length > 0) {
      const sample = rawInvoices[0];
      console.log(`[pipeline] sample invoice status_id=${JSON.stringify(sample.status_id)} is_deleted=${sample.is_deleted} archived_at=${sample.archived_at}`);
    }

    const jobs = rawInvoices
      .filter(inv => !inv.is_deleted && !inv.archived_at && ACTIVE.has(Number(inv.status_id)))
      .map(inv => {
        const dueMs   = inv.due_date ? new Date(inv.due_date).getTime() : null;
        const daysLeft = dueMs ? Math.ceil((dueMs - now) / 86400000) : null;
        return {
          id:        inv.id,
          number:    inv.number,
          client:    clientName[inv.client_id] || '(unknown client)',
          amount:    fmt(inv.amount),
          balance:   fmt(inv.balance),
          due_date:  inv.due_date  || null,
          date:      inv.date      || null,
          status:    STATUS_LABEL[Number(inv.status_id)] || 'Unknown',
          status_id: Number(inv.status_id),
          days_left: daysLeft,
          overdue:   dueMs ? dueMs < now : false,
        };
      })
      .sort((a, b) => {
        const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const db2 = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        return da - db2;
      });

    // Quote follow-ups: status Draft(1) or Sent(2), not dismissed, older than 7 days
    const cutoff = now - 7 * 86400000;

    const quotes = rawQuotes
      .filter(q =>
        !q.is_deleted &&
        !q.archived_at &&
        [1, 2].includes(Number(q.status_id)) &&
        !dismissed.has(q.id) &&
        new Date(q.date).getTime() < cutoff
      )
      .map(q => ({
        id:         q.id,
        number:     q.number,
        client:     clientName[q.client_id] || '(unknown client)',
        amount:     fmt(q.amount),
        date:       q.date,
        status_id:  q.status_id,
        days_since: Math.floor((now - new Date(q.date).getTime()) / 86400000),
        valid_until: q.valid_until || null,
      }))
      .sort((a, b) => b.days_since - a.days_since);

    res.json({ configured: true, jobs, quotes });
  } catch (e) {
    console.error('[pipeline]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/pipeline/invoice/:id — full invoice with bid-ready line items ────

router.get('/invoice/:id', async (req, res) => {
  const conf = inConfig();
  if (!conf) return res.status(503).json({ error: 'Invoice Ninja not configured' });

  try {
    const json = await inFetch(conf, `/invoices/${req.params.id}`);
    const inv  = json.data;
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });

    const lineItems = (inv.line_items || [])
      .filter(li => li.product_key || li.notes)
      .map(li => ({
        product_key: li.product_key || '',
        description: li.notes      || li.product_key || '',
        unit_cost:   parseFloat(li.cost)     || 0,
        quantity:    parseFloat(li.quantity) || 1,
      }));

    res.json({
      id:         inv.id,
      number:     inv.number,
      amount:     parseFloat(inv.amount)  || 0,
      balance:    parseFloat(inv.balance) || 0,
      due_date:   inv.due_date  || null,
      notes:      inv.public_notes || inv.private_notes || '',
      line_items: lineItems,
    });
  } catch (e) {
    console.error('[pipeline/invoice]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/pipeline/dismiss/:id ───────────────────────────────────────────

router.post('/dismiss/:id', (req, res) => {
  try {
    db.prepare('INSERT OR IGNORE INTO dismissed_quotes (id) VALUES (?)').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
