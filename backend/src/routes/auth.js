const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const db      = require('../db/database');

const getHash = db.prepare('SELECT value FROM settings WHERE key = ?');

router.post('/login', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });

  const row = getHash.get('admin_password_hash');
  if (!row?.value) {
    return res.status(503).json({ error: 'No password configured — set ADMIN_PASSWORD in .env and restart' });
  }

  const ok = await bcrypt.compare(password, row.value);
  if (!ok) {
    // Constant-time delay already provided by bcrypt.compare; still reject clearly
    return res.status(401).json({ error: 'Incorrect password' });
  }

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Session error' });
    req.session.authenticated = true;
    req.session.loginAt = new Date().toISOString();
    res.json({ ok: true, loginAt: req.session.loginAt });
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('sn.sid');
    res.json({ ok: true });
  });
});

router.get('/me', (req, res) => {
  if (!req.session?.authenticated) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ ok: true, loginAt: req.session.loginAt });
});

module.exports = router;
