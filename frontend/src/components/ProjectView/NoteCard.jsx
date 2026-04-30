import { useNavigate } from 'react-router-dom';
import { relativeDate } from '../../utils/dates.js';
import Icon from '../common/Icon.jsx';

function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseTasksFromBody(html) {
  if (!html || !html.includes('data-type="taskList"')) return null;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const items = doc.querySelectorAll('li[data-checked]');
  if (!items.length) return null;
  return Array.from(items).map(li => ({
    text: li.querySelector('div')?.textContent?.trim() || '',
    completed: li.getAttribute('data-checked') === 'true',
  }));
}

const MIME_ICON = {
  image:       'image',
  audio:       'audio_file',
  video:       'videocam',
  'application/pdf': 'picture_as_pdf',
};

function mimeIcon(mime) {
  if (!mime) return 'attach_file';
  const [type] = mime.split('/');
  return MIME_ICON[mime] || MIME_ICON[type] || 'attach_file';
}

const MAX_PREVIEW_TASKS = 5;

export default function NoteCard({ note, projectId, onDelete }) {
  const navigate  = useNavigate();
  const tasks     = parseTasksFromBody(note.body);
  const snippet   = !tasks ? stripHtml(note.body).slice(0, 140) : null;
  const tags      = (() => { try { return JSON.parse(note.tags || '[]'); } catch { return []; } })();
  const taskDone  = tasks ? tasks.filter(t => t.completed).length : (note.task_done ?? 0);
  const taskTotal = tasks ? tasks.length : (note.task_count ?? 0);

  return (
    <div
      onClick={() => navigate(`/projects/${projectId}/notes/${note.id}`)}
      className="group relative bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 cursor-pointer hover:shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all active:scale-[0.99] select-none"
    >
      {/* Title */}
      <h3 className="font-semibold text-slate-900 dark:text-white leading-tight line-clamp-2 mb-2">
        {note.title}
      </h3>

      {/* Task list preview */}
      {tasks && (
        <div className="space-y-1 mb-2">
          {tasks.slice(0, MAX_PREVIEW_TASKS).map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={`shrink-0 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                t.completed
                  ? 'bg-blue-500 border-blue-500 dark:bg-blue-400 dark:border-blue-400'
                  : 'border-slate-300 dark:border-slate-600'
              }`}>
                {t.completed && (
                  <svg viewBox="0 0 10 8" className="w-2 h-2" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1,4 3.5,7 9,1" />
                  </svg>
                )}
              </span>
              <span className={`text-xs truncate ${
                t.completed
                  ? 'line-through text-slate-400 dark:text-slate-500'
                  : 'text-slate-600 dark:text-slate-300'
              }`}>
                {t.text}
              </span>
            </div>
          ))}
          {tasks.length > MAX_PREVIEW_TASKS && (
            <p className="text-xs text-slate-400 dark:text-slate-500 pl-5">
              +{tasks.length - MAX_PREVIEW_TASKS} more
            </p>
          )}
        </div>
      )}

      {/* Text snippet (only when no tasks) */}
      {snippet && (
        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
          {snippet}
        </p>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {tags.map(t => (
            <span
              key={t}
              className="text-xs bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 mt-1">
        <span>{relativeDate(note.updated_at)}</span>

        {taskTotal > 0 && !tasks && (
          <span className="ml-auto flex items-center gap-1">
            <Icon name="checklist" size="xs" />
            {taskDone}/{taskTotal}
          </span>
        )}
        {tasks && (
          <span className="ml-auto text-xs tabular-nums">
            {taskDone}/{taskTotal} done
          </span>
        )}

        {(note.attachment_count ?? 0) > 0 && (
          <span className="flex items-center gap-1">
            <Icon name="attach_file" size="xs" />
            {note.attachment_count}
          </span>
        )}
      </div>

      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(note); }}
        className="absolute top-3 right-3 hidden group-hover:flex p-1.5 rounded-lg bg-white dark:bg-slate-800 shadow border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-500 transition-colors"
      >
        <Icon name="delete" size="xs" />
      </button>
    </div>
  );
}
