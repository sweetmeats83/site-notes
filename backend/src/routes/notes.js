const router = require('express').Router();
const db = require('../db/database');

// GET /api/notes/:id  — note + tasks + attachments
router.get('/:id', (req, res) => {
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });

  const tasks = db.prepare(
    'SELECT * FROM tasks WHERE note_id = ? ORDER BY position, id'
  ).all(req.params.id);

  const attachments = db.prepare(
    'SELECT * FROM attachments WHERE note_id = ? ORDER BY created_at'
  ).all(req.params.id);

  res.json({ ...note, tasks, attachments });
});

// PUT /api/notes/:id
router.put('/:id', (req, res) => {
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });

  const { title, body, tags, template, bid_items } = req.body;
  db.prepare(`
    UPDATE notes
    SET title     = ?,
        body      = ?,
        tags      = ?,
        template  = ?,
        bid_items = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title     !== undefined ? title     : note.title,
    body      !== undefined ? body      : note.body,
    tags      !== undefined ? tags      : note.tags,
    template  !== undefined ? template  : note.template,
    bid_items !== undefined ? bid_items : (note.bid_items || '[]'),
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id));
});

// DELETE /api/notes/:id
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Note not found' });
  res.json({ ok: true });
});

module.exports = router;
