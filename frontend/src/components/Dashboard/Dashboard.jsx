import { useState, useEffect, useCallback } from 'react';
import { projectsApi } from '../../api/projects.js';
import { aiApi } from '../../api/ai.js';
import { useApp } from '../../context/AppContext.jsx';
import ProjectCard from './ProjectCard.jsx';
import CreateProjectModal from './CreateProjectModal.jsx';
import Icon from '../common/Icon.jsx';

export default function Dashboard() {
  const { notify, refreshKey } = useApp();
  const [projects,      setProjects]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [modalOpen,     setModalOpen]     = useState(false);
  const [editing,       setEditing]       = useState(null);
  const [search,        setSearch]        = useState('');
  const [briefing,      setBriefing]      = useState('');
  const [briefingState, setBriefingState] = useState('idle'); // idle | loading | done

  const load = useCallback(() => {
    projectsApi.list()
      .then(setProjects)
      .catch(e => notify(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [notify]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleSave = async (data) => {
    try {
      if (editing) {
        await projectsApi.update(editing.id, data);
        notify('Project updated', 'success');
      } else {
        await projectsApi.create(data);
        notify('Project created', 'success');
      }
      load();
    } catch (e) {
      notify(e.message, 'error');
      throw e;
    }
  };

  const handleDelete = async (project) => {
    if (!confirm(`Delete "${project.name}" and all its notes? This cannot be undone.`)) return;
    try {
      await projectsApi.delete(project.id);
      notify('Project deleted', 'success');
      load();
    } catch (e) {
      notify(e.message, 'error');
    }
  };

  const runBriefing = async () => {
    if (briefingState === 'loading') return;
    setBriefingState('loading');
    setBriefing('');
    try {
      const text = await aiApi.briefing();
      setBriefing(text);
      setBriefingState('done');
    } catch (e) {
      setBriefing(`Error: ${e.message}`);
      setBriefingState('done');
    }
  };

  const filtered = search.trim()
    ? projects.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.client || '').toLowerCase().includes(search.toLowerCase())
      )
    : projects;

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Projects</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {projects.length} active {projects.length === 1 ? 'project' : 'projects'}
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-sm"
        >
          <Icon name="add" size="sm" />
          <span className="hidden sm:inline">New Project</span>
        </button>
      </div>

      {/* AI Briefing */}
      <div className="mb-5">
        {briefingState === 'idle' && (
          <button
            onClick={runBriefing}
            className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
          >
            <Icon name="auto_awesome" size="sm" />
            Get AI briefing for today
          </button>
        )}
        {briefingState === 'loading' && (
          <div className="flex items-center gap-2 text-sm text-slate-400 animate-pulse">
            <span className="w-4 h-4 border-2 border-violet-400/30 border-t-violet-500 rounded-full animate-spin" />
            Generating briefing…
          </div>
        )}
        {briefingState === 'done' && briefing && (
          <div className="bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-900 rounded-2xl px-4 py-3">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <Icon name="auto_awesome" size="sm" className="text-violet-500 shrink-0" />
                <span className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide">Today's Briefing</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={runBriefing} className="text-xs text-violet-500 hover:text-violet-700 dark:hover:text-violet-300">Refresh</button>
                <button onClick={() => setBriefingState('idle')} className="text-slate-300 dark:text-slate-600 hover:text-slate-500">
                  <Icon name="close" size="xs" />
                </button>
              </div>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{briefing}</p>
          </div>
        )}
      </div>

      {/* Search bar */}
      {projects.length > 4 && (
        <div className="relative mb-5">
          <Icon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Filter projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Project grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl h-36 animate-pulse border border-slate-200 dark:border-slate-800" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 dark:text-slate-600">
          <Icon name="folder_open" size="2xl" />
          <p className="mt-3 text-lg font-medium">
            {search ? 'No projects match that filter' : 'No projects yet'}
          </p>
          {!search && (
            <button
              onClick={() => { setEditing(null); setModalOpen(true); }}
              className="mt-4 text-blue-600 dark:text-blue-400 font-semibold hover:underline"
            >
              Create your first project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <ProjectCard
              key={p.id}
              project={p}
              onEdit={(proj) => { setEditing(proj); setModalOpen(true); }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <CreateProjectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        existing={editing}
      />
    </div>
  );
}
