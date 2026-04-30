const router = require('express').Router();
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const db = require('../db/database');
const { upload } = require('../middleware/upload');

function getSetting(key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value || '';
}

// POST /api/transcribe  — accepts multipart audio file, proxies to Whisper
router.post('/', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });

  const transcriptionUrl = getSetting('transcription_url') ||
    'http://localhost:8000/v1/audio/transcriptions';
  const apiKey = getSetting('transcription_api_key');
  const model  = getSetting('transcription_model') || 'whisper-1';

  const form = new FormData();
  form.append('file', fs.createReadStream(req.file.path), {
    filename: req.file.originalname,
    contentType: req.file.mimetype,
  });
  form.append('model', req.body.model || model);
  if (req.body.language) form.append('language', req.body.language);

  const headers = { ...form.getHeaders() };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  try {
    const upstream = await fetch(transcriptionUrl, {
      method: 'POST',
      headers,
      body: form,
    });

    const data = await upstream.json();

    // Clean up the temp file after forwarding
    try { fs.unlinkSync(req.file.path); } catch (_) {}

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: data });
    }
    res.json(data);
  } catch (err) {
    try { fs.unlinkSync(req.file.path); } catch (_) {}
    res.status(502).json({ error: `Transcription service unreachable: ${err.message}` });
  }
});

module.exports = router;
