const router = require('express').Router();
const db = require('../db/database');

// GET /api/settings
router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  // Never expose secrets over the wire in plaintext beyond what's needed
  res.json(settings);
});

// PUT /api/settings  — partial update
router.put('/', (req, res) => {
  const allowed = [
    'transcription_url', 'transcription_api_key', 'transcription_model',
    'llm_url', 'llm_api_key', 'llm_model',
    'invoiceninja_url', 'invoiceninja_api_key',
    'anthropic_api_key',
    'google_client_id', 'google_client_secret',
    'dark_mode', 'app_name',
    'reminder_incomplete_bids', 'reminder_unscheduled', 'reminder_interval_hours',
  ];

  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );

  const update = db.transaction(() => {
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        upsert.run(key, String(req.body[key]));
      }
    }
  });
  update();

  const rows = db.prepare('SELECT key, value FROM settings').all();
  res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
});

module.exports = router;
