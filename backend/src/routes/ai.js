const router = require('express').Router();
const fetch = require('node-fetch');
const db = require('../db/database');

const LLM_TIMEOUT_MS = 270_000;

function getSetting(key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value || '';
}

function llmFetch(endpoint, headers, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  return fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

// POST /api/ai/chat
router.post('/chat', async (req, res) => {
  const { messages, model, stream = false } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages[] required' });
  }

  const llmUrl    = getSetting('llm_url') || 'http://localhost:11434/v1';
  const llmKey    = getSetting('llm_api_key');
  const llmModel  = model || getSetting('llm_model') || 'llama3';

  const endpoint = `${llmUrl.replace(/\/$/, '')}/chat/completions`;

  const headers = { 'Content-Type': 'application/json' };
  if (llmKey) headers['Authorization'] = `Bearer ${llmKey}`;

  try {
    const upstream = await llmFetch(endpoint, headers, { model: llmModel, messages, stream, think: false });

    if (!upstream.ok) {
      const text = await upstream.text();
      return res.status(upstream.status).json({ error: text });
    }

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Accel-Buffering', 'no');
      upstream.body.pipe(res);
    } else {
      const data = await upstream.json();
      res.json(data);
    }
  } catch (err) {
    const msg = err.name === 'AbortError' ? 'LLM timed out (>120s)' : `LLM unreachable: ${err.message}`;
    res.status(504).json({ error: msg });
  }
});

// POST /api/ai/briefing — assembles recent project/note context and calls LLM
router.post('/briefing', async (req, res) => {
  const llmUrl   = getSetting('llm_url') || 'http://localhost:11434/v1';
  const llmKey   = getSetting('llm_api_key');
  const llmModel = getSetting('llm_model') || 'llama3';
  if (!llmUrl) return res.status(503).json({ error: 'LLM not configured' });

  try {
    const projects = db.prepare(
      'SELECT name, client FROM projects ORDER BY updated_at DESC LIMIT 20'
    ).all();

    const notes = db.prepare(`
      SELECT n.title, n.body, p.name AS project_name
      FROM notes n
      JOIN projects p ON p.id = n.project_id
      WHERE n.created_at > datetime('now', '-7 days')
      ORDER BY n.created_at DESC
      LIMIT 25
    `).all();

    const projectLines = projects.length
      ? projects.map(p => `- ${p.name}${p.client ? ` (${p.client})` : ''}`).join('\n')
      : 'No active projects';

    const noteLines = notes.length
      ? notes.map(n => {
          const body = (n.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);
          return `[${n.project_name}] ${n.title}${body ? ': ' + body : ''}`;
        }).join('\n')
      : 'No notes in the last 7 days';

    const messages = [
      {
        role: 'system',
        content: 'You are a construction business assistant. Be direct and practical. No fluff, no greetings.',
      },
      {
        role: 'user',
        content: `Give me a quick briefing for my contracting business. Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}\n\nActive projects:\n${projectLines}\n\nRecent activity (last 7 days):\n${noteLines}\n\nWhat should I focus on today? Any patterns or concerns? Under 150 words.`,
      },
    ];

    const endpoint = `${llmUrl.replace(/\/$/, '')}/chat/completions`;
    const headers  = { 'Content-Type': 'application/json' };
    if (llmKey) headers['Authorization'] = `Bearer ${llmKey}`;

    const upstream = await llmFetch(endpoint, headers, { model: llmModel, messages, stream: false, think: false });

    if (!upstream.ok) {
      const text = await upstream.text();
      return res.status(upstream.status).json({ error: text });
    }

    const data = await upstream.json();
    res.json({ text: data.choices?.[0]?.message?.content || '' });
  } catch (e) {
    const msg = e.name === 'AbortError' ? 'LLM timed out (>120s)' : `LLM unreachable: ${e.message}`;
    res.status(504).json({ error: msg });
  }
});

// POST /api/ai/project — full project context (bid + all notes) sent to LLM
// Supports multi-turn: send chatMessages[] for follow-up refinements
router.post('/project', async (req, res) => {
  const { projectId, prompt, chatMessages } = req.body;
  if (!projectId || (!prompt && !chatMessages?.length))
    return res.status(400).json({ error: 'projectId and prompt (or chatMessages) required' });

  const llmUrl   = getSetting('llm_url')   || 'http://localhost:11434/v1';
  const llmKey   = getSetting('llm_api_key');
  const llmModel = getSetting('llm_model') || 'llama3';
  if (!llmUrl) return res.status(503).json({ error: 'LLM not configured' });

  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const notes = db.prepare(
      'SELECT title, body FROM notes WHERE project_id = ? ORDER BY created_at ASC'
    ).all(projectId);

    let bidItems = [];
    try { bidItems = JSON.parse(project.bid_items || '[]'); } catch {}

    const stripHtml = (html) =>
      (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    const bidContext = bidItems.length
      ? bidItems.map(i =>
          `- ${i.description || i.product_key}  qty:${i.quantity}  @$${i.unit_cost}`
        ).join('\n')
      : 'No bid items recorded.';

    const notesContext = notes.length
      ? notes.map(n => {
          const body = stripHtml(n.body).slice(0, 500);
          return `### ${n.title}\n${body || '(empty)'}`;
        }).join('\n\n')
      : 'No notes yet.';

    const matPrefs = db.prepare('SELECT material, preference FROM material_preferences ORDER BY material ASC').all();
    const prefsContext = matPrefs.length
      ? matPrefs.map(p => `- ${p.material}: ${p.preference}`).join('\n')
      : '';

    const systemContent = `You are a construction project assistant for a contractor. Be specific and practical. Use plain text only — NO markdown tables, NO HTML. Use section headers with ##, bullet points with -, and bold with **text**. Be direct, no fluff.${prefsContext ? `\n\nContractor buying preferences (use these when listing materials):\n${prefsContext}` : ''}`;

    let messages;
    let firstUserMessage;

    if (chatMessages?.length) {
      // Multi-turn: chatMessages already contains the full conversation anchored to the original context
      messages = [{ role: 'system', content: systemContent }, ...chatMessages];
    } else {
      // First turn: build full context message
      firstUserMessage = `PROJECT: ${project.name}${project.client ? ` | Client: ${project.client}` : ''}

BID / SCOPE OF WORK:
${bidContext}

PROJECT NOTES:
${notesContext}

---
${prompt}`;
      messages = [{ role: 'system', content: systemContent }, { role: 'user', content: firstUserMessage }];
    }

    const endpoint = `${llmUrl.replace(/\/$/, '')}/chat/completions`;
    const headers  = { 'Content-Type': 'application/json' };
    if (llmKey) headers['Authorization'] = `Bearer ${llmKey}`;

    const upstream = await llmFetch(endpoint, headers, { model: llmModel, messages, stream: false, think: false });

    if (!upstream.ok) {
      const text = await upstream.text();
      return res.status(upstream.status).json({ error: text });
    }

    const data = await upstream.json();
    const text = data.choices?.[0]?.message?.content || '';
    res.json({ text, ...(firstUserMessage ? { firstUserMessage } : {}) });
  } catch (e) {
    const msg = e.name === 'AbortError' ? 'LLM timed out (>120s)' : `LLM unreachable: ${e.message}`;
    res.status(504).json({ error: msg });
  }
});

module.exports = router;
