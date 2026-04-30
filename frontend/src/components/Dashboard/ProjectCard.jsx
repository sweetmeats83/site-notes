import { useNavigate } from 'react-router-dom';
import { relativeDate } from '../../utils/dates.js';
import Icon from '../common/Icon.jsx';

export default function ProjectCard({ project, onEdit, onDelete }) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/projects/${project.id}`)}
      className="group relative bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 cursor-pointer hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all overflow-hidden select-none active:scale-[0.98]"
    >
      {/* Color accent bar */}
      <div className="h-2 w-full" style={{ backgroundColor: project.color || '#2563EB' }} />

      <div className="p-4">
        {/* Project name */}
        <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight mb-1 line-clamp-2">
          {project.name}
        </h2>

        {/* Client */}
        {project.client && (
          <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-3">
            <Icon name="business" size="xs" />
            {project.client}
          </p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500 mt-3">
          <span className="flex items-center gap-1">
            <Icon name="description" size="xs" />
            {project.note_count ?? 0} {project.note_count === 1 ? 'note' : 'notes'}
          </span>
          <span className="flex items-center gap-1 ml-auto">
            <Icon name="schedule" size="xs" />
            {relativeDate(project.updated_at)}
          </span>
        </div>
      </div>

      {/* Action buttons — appear on hover/long-press */}
      <div
        className="absolute top-3 right-3 hidden group-hover:flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => onEdit(project)}
          className="p-1.5 rounded-lg bg-white dark:bg-slate-800 shadow border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <Icon name="edit" size="xs" />
        </button>
        <button
          onClick={() => onDelete(project)}
          className="p-1.5 rounded-lg bg-white dark:bg-slate-800 shadow border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-600 transition-colors"
        >
          <Icon name="delete" size="xs" />
        </button>
      </div>
    </div>
  );
}
