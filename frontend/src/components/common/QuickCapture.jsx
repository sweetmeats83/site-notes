import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import { projectsApi } from '../../api/projects.js';
import { aiApi } from '../../api/ai.js';
import Icon from './Icon.jsx';

function fmtTime(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function QuickCapture() {
  const { quickCaptureOpen, setQCOpen, notify, triggerRefresh } = useApp();
  const [projects,   setProjects]   = useState([]);
  const [title,      setTitle]      = useState('');
  const [body,       setBody]       = useState('');
  const [projectId,  setProjectId]  = useState('');
  const [saving,     setSaving]     = useState(false);

  // idle | recording | transcribing
  const [recState,       setRecState]       = useState('idle');
  const [elapsed,        setElapsed]        = useState(0);
  const [titleSuggestion, setTitleSuggestion] = useState('');

  const mediaRef  = useRef(null);
  const chunksRef = useRef([]);
  const timerRef  = useRef(null);
  const navigate  = useNavigate();

  useEffect(() => {
    if (quickCaptureOpen) {
      projectsApi.list().then(setProjects).catch(() => {});
      setTitle(''); setBody(''); setProjectId('');
      setRecState('idle'); setElapsed(0); setTitleSuggestion('');
    }
    // Stop any in-progress recording when the modal closes
    return () => {
      mediaRef.current?.stop();
      clearInterval(timerRef.current);
    };
  }, [quickCaptureOpen]);

  const startRecording = async () => {
    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRef.current  = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        clearInterval(timerRef.current);
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecState('transcribing');
        try {
          const text = await aiApi.transcribe(blob);
          if (text) {
            setBody(prev => prev ? `${prev}\n${text}` : text);
            // Auto-suggest a title if field is still empty
            setTitle(t => {
              if (!t.trim() && text.length > 30) {
                aiApi.chat([
                  { role: 'system', content: 'Construction site assistant. Be extremely brief.' },
                  { role: 'user',   content: `Suggest a short title (5 words max, no quotes, no punctuation) for this job site note:\n${text.slice(0, 400)}` },
                ]).then(s => {
                  if (s?.trim()) setTitleSuggestion(s.trim().replace(/^["'.]+|["'.]+$/g, '').slice(0, 60));
                }).catch(() => {});
              }
              return t;
            });
          }
        } catch (e) {
          notify(`Transcription failed: ${e.message}`, 'error');
        } finally {
          setRecState('idle');
        }
      };

      recorder.start(100);
      setElapsed(0);
      setRecState('recording');
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    } catch (e) {
      notify(`Microphone error: ${e.message}`, 'error');
    }
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    clearInterval(timerRef.current);
  };

  const handleSave = async (andOpen = false) => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      let pid = projectId;
      if (!pid) {
        const p = await projectsApi.create({ name: 'Scratch', color: '#64748B' });
        pid = p.id;
      }
      const note = await projectsApi.createNote(pid, { title: title.trim(), body });
      setQCOpen(false);
      triggerRefresh();
      if (andOpen) navigate(`/projects/${pid}/notes/${note.id}`, { state: { editMode: true } });
      else notify('Note captured!', 'success');
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!quickCaptureOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={() => setQCOpen(false)} />
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 safe-bottom">

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Icon name="bolt" size="lg" className="text-amber-500" filled />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Quick Capture</h2>
          <button
            onClick={() => setQCOpen(false)}
            className="ml-auto text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <Icon name="close" />
          </button>
        </div>

        {/* Title */}
        <input
          autoFocus
          type="text"
          placeholder="Note title…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
          className="w-full text-xl font-semibold bg-transparent border-none outline-none text-slate-900 dark:text-white placeholder-slate-400 mb-3"
        />

        {/* AI title suggestion */}
        {titleSuggestion && !title && (
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => { setTitle(titleSuggestion); setTitleSuggestion(''); }}
              className="flex items-center gap-1.5 text-xs bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 px-2.5 py-1 rounded-full hover:bg-violet-100 dark:hover:bg-violet-950/60 transition-colors"
            >
              <Icon name="auto_awesome" size="xs" />
              Use: "{titleSuggestion}"
            </button>
            <button onClick={() => setTitleSuggestion('')} className="text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400">
              <Icon name="close" size="xs" />
            </button>
          </div>
        )}

        {/* Body textarea with mic button */}
        <div className="relative mb-2">
          <textarea
            placeholder={recState === 'transcribing' ? 'Transcribing…' : 'Jot something down… or tap the mic to record'}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            disabled={recState === 'transcribing'}
            className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl p-3 pr-12 text-slate-800 dark:text-slate-200 placeholder-slate-400 resize-none outline-none border border-slate-200 dark:border-slate-700 text-sm disabled:opacity-60"
          />

          {/* Mic / stop button */}
          <button
            type="button"
            onClick={recState === 'recording' ? stopRecording : startRecording}
            disabled={recState === 'transcribing'}
            title={
              recState === 'recording'     ? 'Stop & transcribe' :
              recState === 'transcribing'  ? 'Transcribing…' :
              'Record voice note'
            }
            className={`absolute right-2.5 bottom-2.5 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              recState === 'recording'
                ? 'bg-red-600 text-white animate-pulse'
                : recState === 'transcribing'
                ? 'bg-blue-100 dark:bg-blue-950 text-blue-500 cursor-wait'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400'
            }`}
          >
            {recState === 'transcribing' ? (
              <span className="w-3 h-3 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            ) : recState === 'recording' ? (
              <Icon name="stop" size="xs" filled />
            ) : (
              <Icon name="mic" size="xs" />
            )}
          </button>
        </div>

        {/* Recording / transcribing status strip */}
        {recState === 'recording' && (
          <div className="flex items-center gap-2 mb-3 px-3 py-1.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-xs font-mono font-bold text-red-600 dark:text-red-400">{fmtTime(elapsed)}</span>
            <span className="text-xs text-red-500 dark:text-red-600">Recording — tap stop to transcribe</span>
          </div>
        )}
        {recState === 'transcribing' && (
          <div className="flex items-center gap-2 mb-3 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg">
            <span className="w-3 h-3 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin shrink-0" />
            <span className="text-xs text-blue-600 dark:text-blue-400">Transcribing audio…</span>
          </div>
        )}
        {recState === 'idle' && <div className="mb-3" />}

        {/* Project selector */}
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 mb-4"
        >
          <option value="">No project (Scratch)</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => handleSave(false)}
            disabled={!title.trim() || saving || recState !== 'idle'}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl py-3 font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <Icon name="save" size="sm" />
            Save
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={!title.trim() || saving || recState !== 'idle'}
            className="flex-1 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl py-3 font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <Icon name="open_in_new" size="sm" />
            Open
          </button>
        </div>

      </div>
    </div>
  );
}
