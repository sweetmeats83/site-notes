const router = require('express').Router();
const db     = require('../db/database');

// GET /api/materials
router.get('/', (_req, res) => {
  res.json(db.prepare('SELECT * FROM material_preferences ORDER BY material ASC').all());
});

// POST /api/materials
router.post('/', (req, res) => {
  const { material, preference } = req.body;
  if (!material?.trim() || !preference?.trim())
    return res.status(400).json({ error: 'material and preference required' });
  const result = db.prepare(
    'INSERT INTO material_preferences (material, preference) VALUES (?, ?)'
  ).run(material.trim(), preference.trim());
  res.status(201).json(db.prepare('SELECT * FROM material_preferences WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /api/materials/:id
router.put('/:id', (req, res) => {
  const { material, preference } = req.body;
  db.prepare(
    'UPDATE material_preferences SET material = ?, preference = ? WHERE id = ?'
  ).run(material?.trim(), preference?.trim(), req.params.id);
  res.json(db.prepare('SELECT * FROM material_preferences WHERE id = ?').get(req.params.id));
});

// DELETE /api/materials/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM material_preferences WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
