const router = require('express').Router();
const db = require('../db/database');

function stripHtml(html) {
  return (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// GET /api/search?q=term
router.get('/', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);

  // Sanitize input for FTS5 — wrap in quotes to treat as phrase, escape internal quotes
  const ftsQuery = `"${q.replace(/"/g, '""')}"*`;

  try {
    const rows = db.prepare(`
      SELECT
        n.id, n.project_id, n.title, n.body, n.tags, n.created_at, n.updated_at,
        p.name  AS project_name,
        p.color AS project_color,
        snippet(notes_fts, 0, '<mark>', '</mark>', '…', 8)  AS title_snippet,
        snippet(notes_fts, 1, '<mark>', '</mark>', '…', 20) AS body_snippet
      FROM notes_fts
      JOIN notes    n ON notes_fts.rowid = n.id
      JOIN projects p ON n.project_id   = p.id
      WHERE notes_fts MATCH ?
      ORDER BY rank
      LIMIT 100
    `).all(ftsQuery);

    // Strip HTML from body snippets for clean display
    const results = rows.map(r => ({
      ...r,
      body_plain: stripHtml(r.body).slice(0, 200),
    }));

    res.json(results);
  } catch (err) {
    // FTS syntax error — fall back to LIKE search
    const like = `%${q}%`;
    const rows = db.prepare(`
      SELECT
        n.id, n.project_id, n.title, n.body, n.tags, n.created_at, n.updated_at,
        p.name  AS project_name,
        p.color AS project_color
      FROM notes n
      JOIN projects p ON n.project_id = p.id
      WHERE n.title LIKE ? OR n.body LIKE ? OR n.tags LIKE ?
      ORDER BY n.updated_at DESC
      LIMIT 100
    `).all(like, like, like);

    res.json(rows.map(r => ({
      ...r,
      body_plain: stripHtml(r.body).slice(0, 200),
    })));
  }
});

module.exports = router;
