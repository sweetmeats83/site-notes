const router = require('express').Router();
const db = require('../db/database');

// GET /api/projects
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT p.*,
      COUNT(DISTINCT n.id) AS note_count,
      MAX(n.updated_at)    AS last_note_at
    FROM projects p
    LEFT JOIN notes n ON n.project_id = p.id
    GROUP BY p.id
    ORDER BY p.updated_at DESC
  `).all();
  res.json(rows);
});

// POST /api/projects
router.post('/', (req, res) => {
  const { name, client = '', color = '#3B82F6', invoiceninja_client_id = null } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Project name is required' });
  }
  const result = db.prepare(
    'INSERT INTO projects (name, client, color, invoiceninja_client_id) VALUES (?, ?, ?, ?)'
  ).run(name.trim(), client.trim(), color, invoiceninja_client_id || null);
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(project);
});

// GET /api/projects/:id
router.get('/:id', (req, res) => {
  const project = db.prepare(`
    SELECT p.*,
      COUNT(DISTINCT n.id) AS note_count
    FROM projects p
    LEFT JOIN notes n ON n.project_id = p.id
    WHERE p.id = ?
    GROUP BY p.id
  `).get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
});

// PUT /api/projects/:id
router.put('/:id', (req, res) => {
  const { name, client, color, invoiceninja_client_id, bid_items } = req.body;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  db.prepare(`
    UPDATE projects
    SET name = ?, client = ?, color = ?, invoiceninja_client_id = ?, bid_items = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name                    !== undefined ? name.trim()             : project.name,
    client                  !== undefined ? client.trim()           : project.client,
    color                   !== undefined ? color                   : project.color,
    invoiceninja_client_id  !== undefined ? invoiceninja_client_id  : project.invoiceninja_client_id,
    bid_items               !== undefined ? bid_items               : project.bid_items,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id));
});

// DELETE /api/projects/:id
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Project not found' });
  res.json({ ok: true });
});

// GET /api/projects/:id/notes
router.get('/:id/notes', (req, res) => {
  const { tag } = req.query;
  let query = `
    SELECT n.*,
      COUNT(DISTINCT t.id)                         AS task_count,
      COUNT(DISTINCT CASE WHEN t.completed = 1 THEN t.id END) AS task_done,
      COUNT(DISTINCT a.id)                         AS attachment_count
    FROM notes n
    LEFT JOIN tasks t ON t.note_id = n.id
    LEFT JOIN attachments a ON a.note_id = n.id
    WHERE n.project_id = ?
  `;
  const params = [req.params.id];
  if (tag) {
    query += ` AND json_each.value = ? `;
    // SQLite json_each workaround — do a simple LIKE match for tags
    query = `
      SELECT n.*,
        COUNT(DISTINCT t.id) AS task_count,
        COUNT(DISTINCT CASE WHEN t.completed = 1 THEN t.id END) AS task_done,
        COUNT(DISTINCT a.id) AS attachment_count
      FROM notes n
      LEFT JOIN tasks t ON t.note_id = n.id
      LEFT JOIN attachments a ON a.note_id = n.id
      WHERE n.project_id = ? AND n.tags LIKE ?
    `;
    params.push(`%"${tag}"%`);
  }
  query += ' GROUP BY n.id ORDER BY n.updated_at DESC';
  res.json(db.prepare(query).all(...params));
});

// POST /api/projects/:id/notes
router.post('/:id/notes', (req, res) => {
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { title = 'Untitled Note', body = '', tags = '[]', template = null } = req.body;
  const result = db.prepare(
    'INSERT INTO notes (project_id, title, body, tags, template) VALUES (?, ?, ?, ?, ?)'
  ).run(req.params.id, title.trim() || 'Untitled Note', body, tags, template);

  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(note);
});

module.exports = router;
