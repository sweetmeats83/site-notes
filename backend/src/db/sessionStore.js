const session = require('express-session');

class BetterSQLiteStore extends session.Store {
  constructor(db) {
    super();
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid     TEXT    PRIMARY KEY,
        sess    TEXT    NOT NULL,
        expired INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired);
    `);
    this._get     = db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expired > ?');
    this._set     = db.prepare('INSERT OR REPLACE INTO sessions (sid, sess, expired) VALUES (?, ?, ?)');
    this._destroy = db.prepare('DELETE FROM sessions WHERE sid = ?');
    this._prune   = db.prepare('DELETE FROM sessions WHERE expired < ?');

    // Prune expired sessions every hour without keeping the process alive
    setInterval(() => this._prune.run(Date.now()), 3_600_000).unref();
  }

  get(sid, cb) {
    try {
      const row = this._get.get(sid, Date.now());
      cb(null, row ? JSON.parse(row.sess) : null);
    } catch (e) { cb(e); }
  }

  set(sid, sess, cb) {
    try {
      const ttl = sess.cookie?.maxAge ?? 7 * 24 * 60 * 60 * 1000;
      this._set.run(sid, JSON.stringify(sess), Date.now() + ttl);
      cb(null);
    } catch (e) { cb(e); }
  }

  destroy(sid, cb) {
    try {
      this._destroy.run(sid);
      cb(null);
    } catch (e) { cb(e); }
  }
}

module.exports = BetterSQLiteStore;
