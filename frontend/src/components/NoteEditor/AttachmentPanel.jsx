import { useRef, useState } from 'react';
import { attachmentsApi } from '../../api/attachments.js';
import Icon from '../common/Icon.jsx';

function mimeIcon(mime) {
  if (!mime) return 'attach_file';
  if (mime.startsWith('image/'))         return 'image';
  if (mime.startsWith('audio/'))         return 'audio_file';
  if (mime.startsWith('video/'))         return 'videocam';
  if (mime === 'application/pdf')        return 'picture_as_pdf';
  return 'attach_file';
}

function prettySize(bytes) {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024**2)    return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1024**2).toFixed(1)} MB`;
}

function AttachmentItem({ att, noteId, onDeleted, onMarkupOpen }) {
  const [deleting, setDeleting] = useState(false);
  const url = attachmentsApi.fileUrl(att.id);
  const isImage = att.mime_type?.startsWith('image/');
  const isAudio = att.mime_type?.startsWith('audio/');
  const isVideo = att.mime_type?.startsWith('video/');

  return (
    <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
      {isImage ? (
        <img
          src={url}
          alt={att.original_name}
          className="w-16 h-16 object-cover rounded-lg shrink-0 cursor-pointer border border-slate-200 dark:border-slate-700"
          onClick={() => onMarkupOpen && onMarkupOpen(att)}
        />
      ) : (
        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center shrink-0">
          <Icon name={mimeIcon(att.mime_type)} size="lg" className="text-slate-400" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 truncate block"
        >
          {att.original_name}
        </a>
        <p className="text-xs text-slate-400 mt-0.5">{prettySize(att.size)}</p>

        {isAudio && (
          <audio controls src={url} className="mt-2 w-full h-8" style={{ height: 32 }} />
        )}
        {isVideo && (
          <video controls src={url} className="mt-2 w-full rounded max-h-32" />
        )}
      </div>

      <div className="flex flex-col gap-1 shrink-0">
        {isImage && onMarkupOpen && (
          <button
            onClick={() => onMarkupOpen(att)}
            title="Annotate"
            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <Icon name="draw" size="xs" />
          </button>
        )}
        <a
          href={url}
          download={att.original_name}
          title="Download"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex"
        >
          <Icon name="download" size="xs" />
        </a>
        <button
          onClick={async () => {
            if (!confirm('Delete this attachment?')) return;
            setDeleting(true);
            try { await attachmentsApi.delete(att.id); onDeleted(att.id); }
            catch (e) { alert(e.message); setDeleting(false); }
          }}
          disabled={deleting}
          title="Delete"
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          <Icon name="delete" size="xs" />
        </button>
      </div>
    </div>
  );
}

export default function AttachmentPanel({ noteId, attachments, onAttachmentsChange, onMarkupOpen }) {
  const inputRef  = useRef();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState(0);

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setProgress(0);
    try {
      const newAtts = [];
      for (const file of Array.from(files)) {
        const att = await attachmentsApi.upload(noteId, file, setProgress);
        newAtts.push(att);
      }
      onAttachmentsChange([...attachments, ...newAtts]);
    } catch (e) {
      alert(e.message);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div>
      {/* Existing attachments */}
      {attachments.length > 0 && (
        <div className="space-y-2 mb-3">
          {attachments.map(att => (
            <AttachmentItem
              key={att.id}
              att={att}
              noteId={noteId}
              onDeleted={(id) => onAttachmentsChange(attachments.filter(a => a.id !== id))}
              onMarkupOpen={onMarkupOpen}
            />
          ))}
        </div>
      )}

      {/* Upload zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center hover:border-blue-400 dark:hover:border-blue-600 transition-colors cursor-pointer"
        onClick={() => !uploading && inputRef.current?.click()}
      >
        {uploading ? (
          <div className="space-y-2">
            <Icon name="upload" size="lg" className="text-blue-500 mx-auto" />
            <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-slate-500">{progress}%</p>
          </div>
        ) : (
          <div className="space-y-1">
            <Icon name="attach_file" size="lg" className="text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Drop files or <span className="text-blue-600 dark:text-blue-400 font-medium">tap to upload</span>
            </p>
            <p className="text-xs text-slate-300 dark:text-slate-600">Images, audio, video, PDF — up to 500 MB</p>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,audio/*,video/*,application/pdf"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
