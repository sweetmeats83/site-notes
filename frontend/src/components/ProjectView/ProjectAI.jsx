import { useState, useEffect } from 'react';
import { aiApi } from '../../api/ai.js';
import { materialsApi } from '../../api/materials.js';
import { projectsApi } from '../../api/projects.js';
import { useApp } from '../../context/AppContext.jsx';
import Icon from '../common/Icon.jsx';

// ── Convert AI text to TipTap-compatible HTML for saving as a note ───────────
function convertToNoteHtml(text, checklist) {
  const lines = text.split('\n');
  let html = '';
  let inList = false;

  const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closeList(); continue; }

    if (/^#{1,3}\s/.test(line)) {
      closeList();
      const lvl = Math.min(line.match(/^(#+)/)[1].length + 1, 3);
      html += `<h${lvl}>${line.replace(/^#+\s*/, '')}</h${lvl}>`;
    } else if (/^[-*]\s/.test(line)) {
      const content = line.replace(/^[-*]\s*/, '');
      if (checklist) {
        if (!inList) { html += '<ul data-type="taskList">'; inList = true; }
        html += `<li data-checked="false"><label contenteditable="false"><input type="checkbox"></label><div><p>${content}</p></div></li>`;
      } else {
        if (!inList) { html += '<ul>'; inList = true; }
        html += `<li><p>${content}</p></li>`;
      }
    } else {
      closeList();
      html += `<p>${line}</p>`;
    }
  }
  closeList();
  return html;
}

// ── Inline markdown renderer ──────────────────────────────────────────────────
function AIText({ text, checklist }) {
  const lines = text.split('\n');
  const elements = [];
  let listBuf = [];

  const flushList = () => {
    if (!listBuf.length) return;
    if (checklist) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="space-y-2 my-3 pl-1">
          {listBuf.map((item, i) => (
            <li key={i} className="flex items-center gap-2.5">
              <span className="shrink-0 w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center" />
              <span className="text-sm text-slate-800 dark:text-slate-200" dangerouslySetInnerHTML={{ __html: inlineMd(item) }} />
            </li>
          ))}
        </ul>
      );
    } else {
      elements.push(
        <ul key={`ul-${elements.length}`} className="space-y-1 my-2 pl-1">
          {listBuf.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 shrink-0" />
              <span dangerouslySetInnerHTML={{ __html: inlineMd(item) }} />
            </li>
          ))}
        </ul>
      );
    }
    listBuf = [];
  };

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (/^#{1,3}\s/.test(line)) {
      flushList();
      const level = line.match(/^(#+)/)[1].length;
      const content = line.replace(/^#+\s*/, '');
      const cls = level === 1
        ? 'text-base font-bold text-slate-900 dark:text-white mt-5 mb-1'
        : level === 2
          ? 'text-sm font-bold text-slate-800 dark:text-slate-100 mt-4 mb-1'
          : 'text-sm font-semibold text-slate-700 dark:text-slate-200 mt-3 mb-0.5';
      elements.push(<p key={i} className={cls} dangerouslySetInnerHTML={{ __html: inlineMd(content) }} />);
    } else if (/^[-*]\s/.test(line)) {
      listBuf.push(line.replace(/^[-*]\s*/, ''));
    } else if (/^\d+\.\s/.test(line)) {
      flushList();
      const content = line.replace(/^\d+\.\s*/, '');
      elements.push(
        <p key={i} className="text-sm text-slate-700 dark:text-slate-300 my-0.5 pl-4"
           dangerouslySetInnerHTML={{ __html: inlineMd(content) }} />
      );
    } else if (line.trim() === '') {
      flushList();
    } else {
      flushList();
      elements.push(
        <p key={i} className="text-sm text-slate-700 dark:text-slate-300 my-1"
           dangerouslySetInnerHTML={{ __html: inlineMd(line) }} />
      );
    }
  });
  flushList();

  return <div className="space-y-0.5">{elements}</div>;
}

function inlineMd(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/`(.+?)`/g,       '<code class="bg-slate-100 dark:bg-slate-800 px-1 rounded text-xs font-mono">$1</code>');
}

// ── Materials reference panel ─────────────────────────────────────────────────
function MaterialsReference({ prefs, onAdd, onDelete, onEdit }) {
  const [mat,  setMat]  = useState('');
  const [pref, setPref] = useState('');
  const [editId, setEditId]   = useState(null);
  const [editMat,  setEditMat]  = useState('');
  const [editPref, setEditPref] = useState('');

  const add = () => {
    if (!mat.trim() || !pref.trim()) return;
    onAdd({ material: mat.trim(), preference: pref.trim() });
    setMat(''); setPref('');
  };

  const startEdit = (p) => { setEditId(p.id); setEditMat(p.material); setEditPref(p.preference); };
  const saveEdit  = () => { onEdit(editId, { material: editMat.trim(), preference: editPref.trim() }); setEditId(null); };

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
        <Icon name="menu_book" size="sm" className="text-slate-400" />
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Materials Reference</span>
        <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">— how you buy specific materials</span>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {prefs.map(p => (
          <div key={p.id} className="px-4 py-2.5">
            {editId === p.id ? (
              <div className="flex gap-2 items-center">
                <input value={editMat}  onChange={e => setEditMat(e.target.value)}
                  className="w-36 px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white" />
                <input value={editPref} onChange={e => setEditPref(e.target.value)}
                  className="flex-1 px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white" />
                <button onClick={saveEdit} className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline">Save</button>
                <button onClick={() => setEditId(null)} className="text-slate-400 hover:text-slate-600"><Icon name="close" size="xs" /></button>
              </div>
            ) : (
              <div className="flex items-start gap-3 group">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 w-36 shrink-0 pt-0.5">{p.material}</span>
                <span className="flex-1 text-xs text-slate-500 dark:text-slate-400">{p.preference}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => startEdit(p)} className="text-slate-400 hover:text-blue-500 transition-colors"><Icon name="edit" size="xs" /></button>
                  <button onClick={() => onDelete(p.id)} className="text-slate-400 hover:text-red-500 transition-colors"><Icon name="delete" size="xs" /></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add row */}
      <div className="flex gap-2 px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
        <input
          value={mat}
          onChange={e => setMat(e.target.value)}
          placeholder="Material (e.g. lumber)"
          className="w-36 px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white placeholder-slate-400"
        />
        <input
          value={pref}
          onChange={e => setPref(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="How you buy it (e.g. 8ft studs from Home Depot, by the bundle)"
          className="flex-1 px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white placeholder-slate-400"
        />
        <button
          onClick={add}
          disabled={!mat.trim() || !pref.trim()}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ── Presets ───────────────────────────────────────────────────────────────────
const PRESETS = [
  {
    id: 'materials',
    label: 'Material List',
    icon: 'inventory_2',
    checklist: true,
    prompt: `Based on the bid items and all project notes, produce a materials list.

Output format — follow this exactly:
## Notes
2-3 sentences: project context, anything to flag, items needing clarification.

## Checklist
One bullet per material item. Keep each line short:
- Item name — qty unit (supplier/spec from preferences if known)

Use my buying preferences where they apply. Every distinct material gets its own bullet. No tables, no long explanations in the list.`,
  },
  {
    id: 'tasks',
    label: 'Task List',
    icon: 'checklist',
    checklist: true,
    prompt: `Based on the scope of work in the bid and all project notes, produce a task list.

Output format — follow this exactly:
## Notes
1-2 sentences about sequence or dependencies to be aware of.

## Checklist
One bullet per task in the order it should be done. Keep each line short and specific:
- Task description (phase/trade if relevant)

Use actual scope items, not generic steps. No tables, no long explanations.`,
  },
  {
    id: 'purchase',
    label: 'Purchase Order',
    icon: 'shopping_cart',
    checklist: true,
    prompt: `Draft a purchase order for this project.

Output format — follow this exactly:
## Notes
2-3 sentences: total scope, anything that needs a quote or is unpriced.

## Checklist
One bullet per line item to buy. Keep each line short:
- Item — qty unit @ estimated cost (supplier from preferences if known)

Use my buying preferences for supplier, size, and unit where they apply. No tables.`,
  },
  {
    id: 'missing',
    label: "What's Missing",
    icon: 'search',
    checklist: false,
    prompt: 'Review the bid, scope, and notes. What information is missing or unclear? What should I confirm with the client before starting? What could cause problems or cost overruns? Be specific.',
  },
  {
    id: 'summary',
    label: 'Summary',
    icon: 'summarize',
    checklist: false,
    prompt: 'Write a concise project summary: what the job is, scope, client, current status based on notes, and key next steps or concerns. Under 150 words.',
  },
];

// ── Main component ────────────────────────────────────────────────────────────
export default function ProjectAI({ project, projectId, onNoteCreated }) {
  const { notify } = useApp();
  const [activePreset,   setActivePreset]   = useState(null);
  const [customPrompt,   setCustomPrompt]   = useState('');
  const [loading,        setLoading]        = useState(false);
  const [result,         setResult]         = useState(null);
  const [saving,         setSaving]         = useState(false);
  const [prefs,          setPrefs]          = useState([]);
  const [showRef,        setShowRef]        = useState(false);
  const [apiThread,      setApiThread]      = useState(null);
  const [displayThread,  setDisplayThread]  = useState([]);
  const [followup,       setFollowup]       = useState('');
  const [followLoading,  setFollowLoading]  = useState(false);

  useEffect(() => {
    materialsApi.list().then(setPrefs).catch(() => {});
  }, []);

  const run = async (preset, custom) => {
    const prompt = preset ? preset.prompt : custom.trim();
    if (!prompt) return;
    setLoading(true);
    setResult(null);
    setApiThread(null);
    setDisplayThread([]);
    setFollowup('');
    setActivePreset(preset?.id || 'custom');
    try {
      const data = await aiApi.project(projectId, prompt);
      const text = data.text || '';
      setResult({ label: preset?.label || 'AI Response', icon: preset?.icon || 'smart_toy', text, checklist: preset?.checklist ?? false });
      if (data.firstUserMessage) {
        setApiThread([
          { role: 'user', content: data.firstUserMessage },
          { role: 'assistant', content: text },
        ]);
      }
    } catch (e) {
      notify(e.message, 'error');
      setActivePreset(null);
    } finally {
      setLoading(false);
    }
  };

  const sendFollowup = async () => {
    if (!followup.trim() || !apiThread || followLoading) return;
    const msg = followup.trim();
    setFollowup('');
    setFollowLoading(true);
    const newThread = [...apiThread, { role: 'user', content: msg }];
    setDisplayThread(prev => [...prev, { role: 'user', text: msg }]);
    try {
      const data = await aiApi.project(projectId, null, newThread);
      const text = data.text || '';
      setApiThread([...newThread, { role: 'assistant', content: text }]);
      setDisplayThread(prev => [...prev, { role: 'assistant', text }]);
      setResult(prev => ({ ...prev, text }));
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setFollowLoading(false);
    }
  };

  const saveAsNote = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const body = convertToNoteHtml(result.text, result.checklist);
      const note = await projectsApi.createNote(projectId, {
        title: result.label,
        body,
        template: 'blank',
      });
      notify('Saved as note', 'success');
      setResult(null);
      setActivePreset(null);
      onNoteCreated?.(note);
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const addPref   = async (data) => { const p = await materialsApi.create(data); setPrefs(prev => [...prev, p]); };
  const editPref  = async (id, data) => { const p = await materialsApi.update(id, data); setPrefs(prev => prev.map(x => x.id === id ? p : x)); };
  const deletePref = async (id) => { await materialsApi.delete(id); setPrefs(prev => prev.filter(x => x.id !== id)); };

  const bidCount = (() => { try { return JSON.parse(project.bid_items || '[]').length; } catch { return 0; } })();

  return (
    <div className="max-w-2xl space-y-5">
      {/* Context strip */}
      <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
        {project.client && (
          <span className="flex items-center gap-1.5">
            <Icon name="business" size="xs" />
            {project.client}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <Icon name="request_quote" size="xs" />
          {bidCount} bid items
        </span>
        <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
          <Icon name="auto_awesome" size="xs" />
          Bid + all notes in context
        </span>
        {prefs.length > 0 && (
          <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
            <Icon name="menu_book" size="xs" />
            {prefs.length} material {prefs.length === 1 ? 'preference' : 'preferences'} loaded
          </span>
        )}
      </div>

      {/* Preset buttons */}
      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Quick Actions</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => run(p, null)}
              disabled={loading}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left disabled:opacity-50 ${
                activePreset === p.id && loading
                  ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:text-blue-700 dark:hover:text-blue-400'
              }`}
            >
              {activePreset === p.id && loading
                ? <span className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-500 rounded-full animate-spin shrink-0" />
                : <Icon name={p.icon} size="xs" className="shrink-0" />
              }
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom prompt */}
      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Custom Question</p>
        <div className="flex gap-2">
          <textarea
            value={customPrompt}
            onChange={e => setCustomPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run(null, customPrompt); }}
            placeholder="Ask anything about this project… (Ctrl+Enter to send)"
            rows={3}
            className="flex-1 px-3 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <button
            onClick={() => run(null, customPrompt)}
            disabled={!customPrompt.trim() || loading}
            className="self-end px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-1.5"
          >
            {loading && activePreset === 'custom'
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Icon name="send" size="xs" />
            }
            Ask
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
            <div className="flex items-center gap-2">
              <Icon name={result.icon} size="sm" className="text-blue-500" />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{result.label}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={saveAsNote}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                <Icon name="note_add" size="xs" />
                {saving ? 'Saving…' : 'Save as Note'}
              </button>
              <button
                onClick={() => { setResult(null); setActivePreset(null); }}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
              >
                <Icon name="close" size="xs" />
              </button>
            </div>
          </div>
          <div className="px-4 py-4">
            <AIText text={result.text} checklist={result.checklist} />
          </div>
        </div>
      )}

      {/* Refinement chat — shown after first result */}
      {apiThread && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center gap-2">
            <Icon name="chat" size="sm" className="text-slate-400" />
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Refine this response</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">Answer questions or clarify details</span>
          </div>

          {/* Thread history */}
          {displayThread.length > 0 && (
            <div className="px-4 py-3 space-y-3 max-h-72 overflow-y-auto">
              {displayThread.map((msg, i) => (
                msg.role === 'user' ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[80%] bg-blue-600 text-white text-sm rounded-2xl rounded-tr-sm px-3.5 py-2">
                      {msg.text}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                    <Icon name="check_circle" size="xs" />
                    <span>Response updated above</span>
                  </div>
                )
              ))}
              {followLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="w-3 h-3 border-2 border-slate-300/50 border-t-slate-400 rounded-full animate-spin" />
                  Thinking…
                </div>
              )}
            </div>
          )}

          {/* Input row */}
          <div className="flex gap-2 px-4 py-3 border-t border-slate-100 dark:border-slate-800">
            <input
              type="text"
              value={followup}
              onChange={e => setFollowup(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendFollowup()}
              disabled={followLoading}
              placeholder="Answer a question or ask for changes… (Enter to send)"
              className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              onClick={sendFollowup}
              disabled={!followup.trim() || followLoading}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
            >
              {followLoading
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Icon name="send" size="xs" />
              }
            </button>
          </div>
        </div>
      )}

      {/* Materials Reference */}
      <div>
        <button
          onClick={() => setShowRef(v => !v)}
          className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hover:text-slate-700 dark:hover:text-slate-200 transition-colors mb-2"
        >
          <Icon name={showRef ? 'expand_less' : 'expand_more'} size="xs" />
          Materials Reference
          {prefs.length > 0 && !showRef && (
            <span className="normal-case font-normal text-slate-400">({prefs.length} saved)</span>
          )}
        </button>
        {showRef && (
          <MaterialsReference
            prefs={prefs}
            onAdd={addPref}
            onEdit={editPref}
            onDelete={deletePref}
          />
        )}
      </div>
    </div>
  );
}
