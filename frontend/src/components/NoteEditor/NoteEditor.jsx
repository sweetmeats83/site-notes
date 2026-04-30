import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { notesApi } from '../../api/notes.js';
import { projectsApi } from '../../api/projects.js';
import { attachmentsApi } from '../../api/attachments.js';
import { useApp } from '../../context/AppContext.jsx';
import { fullDate, relativeDate } from '../../utils/dates.js';
import { exportNoteToPDF } from '../../utils/exportPDF.js';
import RichTextEditor from './RichTextEditor.jsx';
import AttachmentPanel from './AttachmentPanel.jsx';
import DrawingCanvas from './DrawingCanvas.jsx';
import AudioRecorder from './AudioRecorder.jsx';
import AIAssistant from './AIAssistant.jsx';
import TagInput from './TagInput.jsx';
import Icon from '../common/Icon.jsx';

// ─── Attachment gallery shown in view mode ──────────────────────────────────

function AttachmentGallery({ attachments }) {
  const [lightbox, setLightbox] = useState(null);
  if (!attachments.length) return null;

  const images = attachments.filter(a => a.mime_type?.startsWith('image/'));
  const audios  = attachments.filter(a => a.mime_type?.startsWith('audio/'));
  const videos  = attachments.filter(a => a.mime_type?.startsWith('video/'));
  const others  = attachments.filter(a =>
    !a.mime_type?.startsWith('image/') &&
    !a.mime_type?.startsWith('audio/') &&
    !a.mime_type?.startsWith('video/')
  );

  const fileIcon = (mime) => {
    if (mime === 'application/pdf') return 'picture_as_pdf';
    return 'attach_file';
  };

  return (
    <div className="space-y-4">
      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {images.map(a => (
            <button
              key={a.id}
              onClick={() => setLightbox(a)}
              className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 hover:opacity-90 transition-opacity"
            >
              <img
                src={attachmentsApi.fileUrl(a.id)}
                alt={a.original_name}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Audio players */}
      {audios.map(a => (
        <div key={a.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
          <Icon name="audio_file" size="lg" className="text-blue-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate mb-1">{a.original_name}</p>
            <audio controls src={attachmentsApi.fileUrl(a.id)} className="w-full h-8" style={{ height: 32 }} />
          </div>
        </div>
      ))}

      {/* Video players */}
      {videos.map(a => (
        <div key={a.id} className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
          <video controls src={attachmentsApi.fileUrl(a.id)} className="w-full max-h-64" />
          <p className="text-xs text-slate-400 px-3 py-1.5">{a.original_name}</p>
        </div>
      ))}

      {/* Other files */}
      {others.length > 0 && (
        <div className="space-y-2">
          {others.map(a => (
            <a
              key={a.id}
              href={attachmentsApi.fileUrl(a.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
            >
              <Icon name={fileIcon(a.mime_type)} size="md" className="text-slate-400 shrink-0" />
              <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{a.original_name}</span>
              <Icon name="open_in_new" size="xs" className="text-slate-300 shrink-0" />
            </a>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={attachmentsApi.fileUrl(lightbox.id)}
            alt={lightbox.original_name}
            className="max-w-full max-h-full rounded-lg object-contain"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <Icon name="close" size="md" />
          </button>
          <a
            href={attachmentsApi.fileUrl(lightbox.id)}
            download={lightbox.original_name}
            onClick={e => e.stopPropagation()}
            className="absolute bottom-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <Icon name="download" size="md" />
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Read-only view of a note ────────────────────────────────────────────────

function NoteView({ note, title, body, tags, attachments, project, onEdit, onExport, onBodyChange }) {
  const bodyRef = useRef(null);
  const cbRef   = useRef(onBodyChange);
  useEffect(() => { cbRef.current = onBodyChange; });

  useEffect(() => {
    const container = bodyRef.current;
    if (!container) return;
    const handle = (e) => {
      if (e.target.type !== 'checkbox') return;
      const li = e.target.closest('li[data-checked]');
      if (!li) return;
      li.setAttribute('data-checked', String(e.target.checked));
      cbRef.current(container.innerHTML);
    };
    container.addEventListener('change', handle);
    return () => container.removeEventListener('change', handle);
  }, []);

  return (
    <div className="max-w-3xl mx-auto pb-24">
      {/* Header */}
      <div className="sticky top-14 z-30 -mx-4 px-4 py-2 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 mb-6">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project?.color }} />
          <span className="text-sm text-slate-500 dark:text-slate-400 truncate">{project?.name}</span>
        </div>
        <button
          onClick={onExport}
          title="Export PDF"
          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Icon name="picture_as_pdf" size="sm" />
        </button>
        <button
          onClick={onEdit}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          <Icon name="edit" size="xs" />
          Edit
        </button>
      </div>

      {/* Title */}
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white leading-tight mb-3">
        {title || 'Untitled Note'}
      </h1>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-3 mb-4 text-sm text-slate-400 dark:text-slate-500">
        <span className="flex items-center gap-1">
          <Icon name="schedule" size="xs" />
          {fullDate(note.created_at)}
        </span>
        {note.updated_at !== note.created_at && (
          <span className="flex items-center gap-1">
            <Icon name="edit" size="xs" />
            edited {relativeDate(note.updated_at)}
          </span>
        )}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {tags.map(t => (
            <span key={t} className="text-xs bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-full font-medium">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Body */}
      {body && body !== '<p></p>' ? (
        <div
          ref={bodyRef}
          className="tiptap-editor prose dark:prose-invert max-w-none mb-8 text-slate-800 dark:text-slate-200"
          dangerouslySetInnerHTML={{ __html: body }}
        />
      ) : (
        <p className="text-slate-300 dark:text-slate-600 italic mb-8">No content yet. Tap Edit to start writing.</p>
      )}

      {/* Attachments */}
      {attachments.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Icon name="attach_file" size="sm" />
            Attachments
            <span className="text-xs font-normal normal-case">{attachments.length}</span>
          </h2>
          <AttachmentGallery attachments={attachments} />
        </div>
      )}
    </div>
  );
}

// ─── Collapsible section wrapper for edit mode ───────────────────────────────

function Section({ id, label, icon, open, onToggle, children, badge }) {
  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      <button
        onClick={() => onToggle(id)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
      >
        <Icon name={icon} size="sm" className="text-slate-500 dark:text-slate-400" />
        <span className="flex-1 text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</span>
        {badge != null && badge > 0 && (
          <span className="text-xs bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
            {badge}
          </span>
        )}
        <Icon name={open ? 'keyboard_arrow_up' : 'keyboard_arrow_down'} size="sm" className="text-slate-400" />
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function NoteEditor() {
  const { projectId, noteId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { notify, triggerRefresh } = useApp();

  const [note,        setNote]        = useState(null);
  const [project,     setProject]     = useState(null);
  const [title,       setTitle]       = useState('');
  const [body,        setBody]        = useState('');
  const [tags,        setTags]        = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [dirty,       setDirty]       = useState(false);
  const [viewMode,    setViewMode]    = useState(!location.state?.editMode);
  const [openSection, setOpenSection] = useState(null);  // auto-open bid section for bid-template notes
  const [voiceTitle,  setVoiceTitle]  = useState(false);

  const saveTimer = useRef(null);

  // Always-current snapshot for the unmount save
  const liveRef = useRef({});
  useEffect(() => {
    liveRef.current = { dirty, note, title, body, tags };
  });

  // Save on unmount if dirty
  useEffect(() => {
    return () => {
      clearTimeout(saveTimer.current);
      const { dirty, note, title, body, tags } = liveRef.current;
      if (!dirty || !note) return;
      notesApi.update(note.id, {
        title: title || 'Untitled Note',
        body,
        tags: JSON.stringify(tags),
      }).catch(() => {});
      triggerRefresh();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    try {
      const [n, p] = await Promise.all([
        notesApi.get(noteId),
        projectsApi.get(projectId),
      ]);
      setNote(n); setProject(p);
      setTitle(n.title || '');
      setBody(n.body || '');
      setTags(() => { try { return JSON.parse(n.tags || '[]'); } catch { return []; } });
      setAttachments(n.attachments || []);
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [noteId, projectId, notify]);

  useEffect(() => { load(); }, [load]);

  // Auto-save 2s after edits stop
  useEffect(() => {
    if (!dirty || !note) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(false), 2000);
    return () => clearTimeout(saveTimer.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body, tags, dirty]);

  const save = useCallback(async (showNotif = true) => {
    if (!note) return;
    setSaving(true);
    try {
      await notesApi.update(note.id, {
        title: title || 'Untitled Note',
        body,
        tags:  JSON.stringify(tags),
      });
      setDirty(false);
      triggerRefresh();
      if (showNotif) notify('Saved', 'success', 1500);
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }, [note, title, body, tags, notify, triggerRefresh]);

  const markDirty = (fn) => (...args) => { fn(...args); setDirty(true); };

  const toggleSection = (id) => setOpenSection(prev => prev === id ? null : id);

  // Save and switch back to view mode
  const handleDoneEditing = async () => {
    await save(false);
    setViewMode(true);
  };

  const startVoiceTitle = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { notify('Speech recognition not supported in this browser', 'error'); return; }
    const rec = new SR();
    rec.lang = 'en-US'; rec.interimResults = false; rec.maxAlternatives = 1;
    setVoiceTitle(true);
    rec.start();
    rec.onresult = (e) => { setTitle(e.results[0][0].transcript); setDirty(true); };
    rec.onend = () => setVoiceTitle(false);
    rec.onerror = () => setVoiceTitle(false);
  };

  const appendTranscription = (text) => {
    setBody(prev => prev + `<p><em>[Transcription]</em> ${text}</p>`);
    setDirty(true);
  };

  const insertAIResponse = (text) => {
    setBody(prev => prev + `<p>${text.replace(/\n/g, '</p><p>')}</p>`);
    setDirty(true);
    notify('AI response inserted into note', 'success');
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto animate-pulse">
        <div className="h-10 w-2/3 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-64 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800" />
      </div>
    );
  }

  if (!note) return <p className="text-slate-500">Note not found.</p>;

  // ── VIEW MODE ──────────────────────────────────────────────────────────────
  if (viewMode) {
    return (
      <NoteView
        note={note}
        title={title}
        body={body}
        tags={tags}
        attachments={attachments}
        project={project}
        onEdit={() => setViewMode(false)}
        onExport={() => exportNoteToPDF({ ...note, attachments }, project)}
        onBodyChange={(html) => { setBody(html); setDirty(true); }}
      />
    );
  }

  // ── EDIT MODE ──────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto pb-24">
      {/* Sticky toolbar */}
      <div className="sticky top-14 z-30 -mx-4 px-4 py-2 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(`/projects/${projectId}`)}
          className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project?.color }} />
          <span className="truncate max-w-[120px]">{project?.name}</span>
        </button>
        <Icon name="chevron_right" size="xs" className="text-slate-300 shrink-0" />
        <span className="text-sm text-slate-400 truncate flex-1">{title || 'Untitled'}</span>

        <span className="text-xs text-slate-400 shrink-0">
          {saving ? 'Saving…' : dirty ? 'Unsaved' : 'Saved'}
        </span>
        <button
          onClick={() => exportNoteToPDF({ ...note, attachments }, project)}
          title="Export PDF"
          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Icon name="picture_as_pdf" size="sm" />
        </button>
        <button
          onClick={handleDoneEditing}
          disabled={saving}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          <Icon name="check" size="xs" />
          Done
        </button>
      </div>

      {/* Title */}
      <div className="flex items-start gap-2 mb-4">
        <textarea
          value={title}
          onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
          placeholder="Note title…"
          rows={1}
          className="flex-1 text-3xl font-bold bg-transparent border-none outline-none text-slate-900 dark:text-white placeholder-slate-300 resize-none leading-tight"
          style={{ fieldSizing: 'content' }}
        />
        <button
          onClick={startVoiceTitle}
          title="Speak title"
          className={`shrink-0 mt-1 p-2 rounded-lg transition-colors ${
            voiceTitle
              ? 'bg-red-100 dark:bg-red-950/40 text-red-600 animate-pulse'
              : 'text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Icon name="mic" size="md" filled={voiceTitle} />
        </button>
      </div>

      {/* Date */}
      <div className="flex items-center gap-2 mb-5 text-xs text-slate-400 dark:text-slate-500">
        <Icon name="schedule" size="xs" />
        <span>{fullDate(note.created_at)}</span>
      </div>

      {/* Tags */}
      <div className="mb-6 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
        <TagInput tags={tags} onChange={markDirty(setTags)} />
      </div>

      {/* Rich text body */}
      <div className="mb-4">
        <RichTextEditor
          content={body}
          onChange={markDirty(setBody)}
          placeholder="Start writing your field notes here…"
        />
      </div>

      {/* Collapsible sections */}
      <div className="space-y-3">
        <Section id="attach" label="Attachments" icon="attach_file" open={openSection === 'attach'} onToggle={toggleSection} badge={attachments.length}>
          <AttachmentPanel
            noteId={note.id}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            onMarkupOpen={() => toggleSection('draw')}
          />
        </Section>

        <Section id="audio" label="Audio & Transcription" icon="mic" open={openSection === 'audio'} onToggle={toggleSection}>
          <AudioRecorder
            noteId={note.id}
            onTranscription={appendTranscription}
            onSaved={(att) => setAttachments(prev => [...prev, att])}
          />
        </Section>

        <Section id="draw" label="Drawing Canvas" icon="draw" open={openSection === 'draw'} onToggle={toggleSection}>
          <DrawingCanvas
            noteId={note.id}
            onSaved={(att) => {
              setAttachments(prev => [...prev, att]);
              notify('Drawing saved as attachment', 'success');
            }}
          />
        </Section>

        <Section id="ai" label="AI Assistant" icon="smart_toy" open={openSection === 'ai'} onToggle={toggleSection}>
          <AIAssistant
            noteContent={body}
            noteTitle={title}
            onInsert={insertAIResponse}
          />
        </Section>
      </div>
    </div>
  );
}
