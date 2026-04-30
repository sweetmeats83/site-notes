import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectsApi } from '../../api/projects.js';
import { notesApi } from '../../api/notes.js';
import { useApp } from '../../context/AppContext.jsx';
import { exportProjectToPDF } from '../../utils/exportPDF.js';
import NoteCard from './NoteCard.jsx';
import BidPanel from '../NoteEditor/BidPanel.jsx';
import ProjectAI from './ProjectAI.jsx';
import CreateProjectModal from '../Dashboard/CreateProjectModal.jsx';
import Icon from '../common/Icon.jsx';

const TEMPLATES = [
  { id: 'bid',        label: 'Bid Walkthrough',  icon: 'request_quote' },
  { id: 'materials',  label: 'Materials List',    icon: 'inventory_2' },
  { id: 'punch',      label: 'Punch List',        icon: 'checklist_rtl' },
  { id: 'inspection', label: 'Site Inspection',   icon: 'fact_check' },
  { id: 'blank',      label: 'Blank Note',        icon: 'description' },
];

export default function ProjectView() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { notify, refreshKey } = useApp();

  const [project,  setProject]  = useState(null);
  const [notes,    setNotes]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [tagFilter,setTagFilter]= useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [activeTab, setActiveTab] = useState('notes');
  const [bidItems,  setBidItems]  = useState([]);
  const [bidDirty,  setBidDirty]  = useState(false);
  const bidSaveTimer = useRef(null);

  const load = useCallback(() => {
    Promise.all([
      projectsApi.get(projectId),
      projectsApi.getNotes(projectId, tagFilter ? { tag: tagFilter } : {}),
    ])
      .then(([p, n]) => {
        setProject(p);
        setNotes(n);
        setBidItems(() => { try { return JSON.parse(p.bid_items || '[]'); } catch { return []; } });
      })
      .catch(e => notify(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [projectId, tagFilter, notify]);

  useEffect(() => { load(); }, [load, refreshKey]);

  // Auto-save bid items 1.5s after changes
  useEffect(() => {
    if (!bidDirty || !project) return;
    clearTimeout(bidSaveTimer.current);
    bidSaveTimer.current = setTimeout(() => {
      projectsApi.update(projectId, { bid_items: JSON.stringify(bidItems) })
        .then(() => setBidDirty(false))
        .catch(() => {});
    }, 1500);
    return () => clearTimeout(bidSaveTimer.current);
  }, [bidItems, bidDirty, project, projectId]);

  const handleNewNote = async (template = 'blank') => {
    setShowTemplates(false);
    const templateBodies = {
      bid: '<h2>Project Overview</h2><p></p><h2>Scope of Work</h2><p></p><h2>Client Notes</h2><p></p><h2>Estimated Timeline</h2><p></p>',
      materials: '<h2>Materials List</h2><p></p><h2>Quantities &amp; Specs</h2><p></p><h2>Supplier Notes</h2><p></p>',
      punch: '<h2>Punch List Items</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox" /><span></span></label><div><p>Item 1</p></div></li></ul>',
      inspection: '<h2>Site Conditions</h2><p></p><h2>Safety Observations</h2><p></p><h2>Issues Found</h2><p></p><h2>Follow-Up Required</h2><p></p>',
      blank: '',
    };

    try {
      const note = await projectsApi.createNote(projectId, {
        title: TEMPLATES.find(t => t.id === template)?.label || 'New Note',
        body: templateBodies[template] || '',
        template,
      });
      navigate(`/projects/${projectId}/notes/${note.id}`, { state: { editMode: true } });
    } catch (e) {
      notify(e.message, 'error');
    }
  };

  const handleDelete = async (note) => {
    if (!confirm(`Delete "${note.title}"? This cannot be undone.`)) return;
    try {
      await notesApi.delete(note.id);
      notify('Note deleted', 'success');
      load();
    } catch (e) {
      notify(e.message, 'error');
    }
  };

  const handleEditProject = async (data) => {
    try {
      await projectsApi.update(projectId, data);
      notify('Project updated', 'success');
      load();
    } catch (e) {
      notify(e.message, 'error');
      throw e;
    }
  };

  // Collect all tags across notes for filter bar
  const allTags = [...new Set(
    notes.flatMap(n => { try { return JSON.parse(n.tags || '[]'); } catch { return []; } })
  )];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-white dark:bg-slate-900 rounded-xl animate-pulse border border-slate-200 dark:border-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  if (!project) return <p className="text-slate-500">Project not found.</p>;

  return (
    <div>
      {/* Project header */}
      <div className="flex items-start gap-4 mb-6">
        <div
          className="w-3 h-12 rounded-full shrink-0 mt-1"
          style={{ backgroundColor: project.color }}
        />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white truncate">
            {project.name}
          </h1>
          {project.client && (
            <p className="text-slate-500 dark:text-slate-400 flex items-center gap-1 text-sm mt-0.5">
              <Icon name="business" size="xs" />
              {project.client}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => exportProjectToPDF(project, notes)}
            title="Export PDF"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Icon name="picture_as_pdf" size="sm" />
          </button>
          <button
            onClick={() => setEditOpen(true)}
            title="Edit project"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Icon name="edit" size="sm" />
          </button>

          {/* New note button */}
          <div className="relative">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
            >
              <Icon name="add" size="sm" />
              <span className="hidden sm:inline">New Note</span>
            </button>

            {showTemplates && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 overflow-hidden">
                {TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleNewNote(t.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Icon name={t.icon} size="sm" className="text-slate-400" />
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6">
        {[
          { id: 'notes', label: 'Notes',       icon: 'description',   badge: notes.length },
          { id: 'bid',   label: 'Bid Builder',  icon: 'request_quote', badge: bidItems.length },
          { id: 'ai',    label: 'AI',           icon: 'auto_awesome',  badge: 0 },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <Icon name={tab.icon} size="xs" />
            {tab.label}
            {tab.badge > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                activeTab === tab.id
                  ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
        {bidDirty && (
          <span className="ml-auto self-center text-xs text-slate-400 pr-1">Saving…</span>
        )}
      </div>

      {/* Bid Builder tab */}
      {activeTab === 'bid' && (
        <div className="max-w-2xl">
          <BidPanel
            bidItems={bidItems}
            project={project}
            onChange={(items) => { setBidItems(items); setBidDirty(true); }}
          />
        </div>
      )}

      {/* AI tab */}
      {activeTab === 'ai' && (
        <ProjectAI
          project={project}
          projectId={projectId}
          onNoteCreated={(note) => { setActiveTab('notes'); load(); }}
        />
      )}

      {/* Tag filter row */}
      {activeTab === 'notes' && allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => setTagFilter('')}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              !tagFilter
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setTagFilter(tag === tagFilter ? '' : tag)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                tagFilter === tag
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Notes grid */}
      {activeTab === 'notes' && notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 dark:text-slate-600">
          <Icon name="note_add" size="2xl" />
          <p className="mt-3 text-lg font-medium">No notes yet</p>
          <button
            onClick={() => setShowTemplates(true)}
            className="mt-4 text-blue-600 dark:text-blue-400 font-semibold hover:underline"
          >
            Create the first note
          </button>
        </div>
      ) : activeTab === 'notes' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map(n => (
            <NoteCard
              key={n.id}
              note={n}
              projectId={projectId}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : null}

      <CreateProjectModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSave={handleEditProject}
        existing={project}
      />
    </div>
  );
}
