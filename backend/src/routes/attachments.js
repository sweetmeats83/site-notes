const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const { upload, UPLOADS_DIR } = require('../middleware/upload');

// POST /api/notes/:noteId/attachments
router.post('/notes/:noteId/attachments', upload.single('file'), (req, res) => {
  const note = db.prepare('SELECT id FROM notes WHERE id = ?').get(req.params.noteId);
  if (!note) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(404).json({ error: 'Note not found' });
  }

  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const result = db.prepare(`
    INSERT INTO attachments (note_id, filename, original_name, mime_type, size)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    req.params.noteId,
    req.file.filename,
    req.file.originalname,
    req.file.mimetype,
    req.file.size
  );

  db.prepare("UPDATE notes SET updated_at = datetime('now') WHERE id = ?").run(req.params.noteId);

  res.status(201).json(
    db.prepare('SELECT * FROM attachments WHERE id = ?').get(result.lastInsertRowid)
  );
});

// GET /api/attachments/:id/file  — stream the actual file
router.get('/attachments/:id/file', (req, res) => {
  const att = db.prepare('SELECT * FROM attachments WHERE id = ?').get(req.params.id);
  if (!att) return res.status(404).json({ error: 'Attachment not found' });

  const filePath = path.join(UPLOADS_DIR, att.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });

  res.setHeader('Content-Type', att.mime_type);
  res.setHeader('Content-Disposition', `inline; filename="${att.original_name}"`);
  fs.createReadStream(filePath).pipe(res);
});

// DELETE /api/attachments/:id
router.delete('/attachments/:id', (req, res) => {
  const att = db.prepare('SELECT * FROM attachments WHERE id = ?').get(req.params.id);
  if (!att) return res.status(404).json({ error: 'Attachment not found' });

  const filePath = path.join(UPLOADS_DIR, att.filename);
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch (_) {}
  }

  db.prepare('DELETE FROM attachments WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
