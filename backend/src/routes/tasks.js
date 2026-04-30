const router = require('express').Router();
const db = require('../db/database');

// POST /api/notes/:noteId/tasks
router.post('/notes/:noteId/tasks', (req, res) => {
  const note = db.prepare('SELECT id FROM notes WHERE id = ?').get(req.params.noteId);
  if (!note) return res.status(404).json({ error: 'Note not found' });

  const { text, position = 0 } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Task text is required' });

  const result = db.prepare(
    'INSERT INTO tasks (note_id, text, position) VALUES (?, ?, ?)'
  ).run(req.params.noteId, text.trim(), position);

  res.status(201).json(
    db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid)
  );
});

// POST /api/tasks/bulk — must come before /:id to avoid shadowing
router.post('/tasks/bulk', (req, res) => {
  const { note_id, tasks } = req.body;
  if (!note_id || !Array.isArray(tasks)) {
    return res.status(400).json({ error: 'note_id and tasks[] required' });
  }

  const replaceTasks = db.transaction(() => {
    db.prepare('DELETE FROM tasks WHERE note_id = ?').run(note_id);
    const insert = db.prepare(
      'INSERT INTO tasks (note_id, text, completed, position) VALUES (?, ?, ?, ?)'
    );
    tasks.forEach((t, i) => {
      insert.run(note_id, t.text, t.completed ? 1 : 0, i);
    });
  });
  replaceTasks();

  res.json(db.prepare('SELECT * FROM tasks WHERE note_id = ? ORDER BY position, id').all(note_id));
});

// PUT /api/tasks/:id
router.put('/tasks/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const { text, completed, position } = req.body;
  db.prepare(`
    UPDATE tasks SET text = ?, completed = ?, position = ? WHERE id = ?
  `).run(
    text      !== undefined ? text.trim()           : task.text,
    completed !== undefined ? (completed ? 1 : 0)   : task.completed,
    position  !== undefined ? position               : task.position,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  db.prepare("UPDATE notes SET updated_at = datetime('now') WHERE id = ?").run(task.note_id);

  res.json(updated);
});

// DELETE /api/tasks/:id
router.delete('/tasks/:id', (req, res) => {
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Task not found' });
  res.json({ ok: true });
});

module.exports = router;
