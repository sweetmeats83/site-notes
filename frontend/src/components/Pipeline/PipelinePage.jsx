import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { pipelineApi } from '../../api/pipeline.js';
import { projectsApi } from '../../api/projects.js';
import { useApp } from '../../context/AppContext.jsx';
import Icon from '../common/Icon.jsx';

const COLORS = [
  '#2563EB', '#16A34A', '#D97706', '#DC2626',
  '#9333EA', '#DB2777', '#EA580C', '#0D9488',
];

const currency = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

function StatusBadge({ status, overdue }) {
  const styles = overdue
    ? 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400'
    : status === 'Partial'
      ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
      : status === 'Sent'
        ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400'
        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';

  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${styles}`}>
      {overdue ? 'Overdue' : status}
    </span>
  );
}

function DueBadge({ days_left, due_date }) {
  if (!due_date) return <span className="text-xs text-slate-400 dark:text-slate-500">No due date</span>;
  if (days_left < 0)
    return <span className="text-xs font-medium text-red-600 dark:text-red-400">{Math.abs(days_left)}d overdue</span>;
  if (days_left === 0)
    return <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Due today</span>;
  if (days_left <= 7)
    return <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Due in {days_left}d</span>;
  return <span className="text-xs text-slate-400 dark:text-slate-500">Due in {days_left}d</span>;
}

function CreateProjectModal({ job, onClose, onCreated }) {
  const [name,    setName]    = useState(`${job.client} — ${job.number}`);
  const [color,   setColor]   = useState(COLORS[0]);
  const [working, setWorking] = useState(false);
  const [status,  setStatus]  = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.select(); }, []);

  const create = async () => {
    if (!name.trim() || working) return;
    setWorking(true);
    try {
      setStatus('Creating project…');
      const project = await projectsApi.create({
        name: name.trim(),
        client: job.client,
        color,
      });

      setStatus('Pulling invoice line items…');
      let bidItems = [];
      try {
        const inv = await pipelineApi.getInvoice(job.id);
        bidItems = inv.line_items || [];
      } catch {
        // Not fatal — project still opens, bid just starts empty
      }

      if (bidItems.length > 0) {
        await projectsApi.update(project.id, {
          bid_items: JSON.stringify(bidItems),
        });
      }

      onCreated(project.id);
    } catch (e) {
      setStatus(`Error: ${e.message}`);
      setWorking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-700 p-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 dark:text-white">Create Project</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
            <Icon name="close" size="sm" />
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Starts with <span className="font-medium text-slate-700 dark:text-slate-300">{job.number}</span> line items pre-loaded in the Bid Builder.
        </p>

        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Project Name</label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && create()}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        <div className="mb-5">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Color</label>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center"
                style={{
                  backgroundColor: c,
                  borderColor: color === c ? c : 'transparent',
                  boxShadow: color === c ? `0 0 0 3px ${c}40` : 'none',
                }}
              >
                {color === c && <Icon name="check" size="xs" className="text-white" />}
              </button>
            ))}
          </div>
        </div>

        {status && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
            <span className="w-3 h-3 border-2 border-blue-400/30 border-t-blue-500 rounded-full animate-spin shrink-0" />
            {status}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={working}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={create}
            disabled={!name.trim() || working}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <Icon name="add" size="xs" />
            {working ? 'Creating…' : 'Create & Open'}
          </button>
        </div>
      </div>
    </div>
  );
}

function JobCard({ job, onCreateProject }) {
  const urgentBorder = job.overdue
    ? 'border-red-200 dark:border-red-900/60'
    : job.days_left !== null && job.days_left <= 7
      ? 'border-amber-200 dark:border-amber-900/60'
      : 'border-slate-200 dark:border-slate-800';

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-xl border ${urgentBorder} p-4 transition-all`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 dark:text-white truncate">{job.client}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{job.number}</p>
        </div>
        <StatusBadge status={job.status} overdue={job.overdue} />
      </div>

      <div className="flex items-end justify-between gap-2 mb-3">
        <div>
          <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
            {currency(job.balance > 0 ? job.balance : job.amount)}
          </p>
          {job.balance > 0 && job.balance !== job.amount && (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              of {currency(job.amount)} total
            </p>
          )}
        </div>
        <DueBadge days_left={job.days_left} due_date={job.due_date} />
      </div>

      <button
        onClick={() => onCreateProject(job)}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-700 dark:hover:text-blue-400 transition-colors"
      >
        <Icon name="create_new_folder" size="xs" />
        Create Project
      </button>
    </div>
  );
}

function QuoteCard({ quote, onDismiss, dismissing }) {
  const urgency = quote.days_since >= 30
    ? 'border-red-200 dark:border-red-900/60'
    : quote.days_since >= 14
      ? 'border-amber-200 dark:border-amber-900/60'
      : 'border-slate-200 dark:border-slate-800';

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-xl border ${urgency} p-4 transition-all`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 dark:text-white truncate">{quote.client}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{quote.number}</p>
        </div>
        <button
          onClick={() => onDismiss(quote.id)}
          disabled={dismissing}
          title="Dismiss — no longer relevant"
          className="shrink-0 p-1.5 rounded-lg text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
        >
          <Icon name="close" size="xs" />
        </button>
      </div>

      <div className="flex items-end justify-between gap-2">
        <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
          {currency(quote.amount)}
        </p>
        <span className={`text-xs font-medium ${
          quote.days_since >= 30
            ? 'text-red-600 dark:text-red-400'
            : quote.days_since >= 14
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-slate-400 dark:text-slate-500'
        }`}>
          Sent {quote.days_since}d ago
        </span>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, count, children }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <Icon name={icon} size="sm" className="text-slate-400 dark:text-slate-500" />
      <h2 className="font-semibold text-slate-700 dark:text-slate-300 flex-1">{title}</h2>
      {count > 0 && (
        <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full tabular-nums">
          {count}
        </span>
      )}
      {children}
    </div>
  );
}

export default function PipelinePage() {
  const { notify, settings } = useApp();
  const navigate = useNavigate();

  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [dismissing,  setDismissing]  = useState(new Set());
  const [modalJob,    setModalJob]    = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await pipelineApi.get();
      setData(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const dismiss = async (id) => {
    setDismissing(prev => new Set(prev).add(id));
    try {
      await pipelineApi.dismiss(id);
      setData(prev => prev
        ? { ...prev, quotes: prev.quotes.filter(q => q.id !== id) }
        : prev
      );
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setDismissing(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const inConfigured = settings?.invoiceninja_url && settings?.invoiceninja_api_key;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pipeline</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Active jobs and quote follow-ups
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
          title="Refresh"
        >
          <Icon name="refresh" size="sm" className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Not configured */}
      {!inConfigured && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-2xl px-5 py-6 text-center">
          <Icon name="receipt_long" size="2xl" className="text-amber-400 mx-auto mb-3" />
          <p className="font-semibold text-amber-800 dark:text-amber-300 mb-1">Invoice Ninja not connected</p>
          <p className="text-sm text-amber-600 dark:text-amber-400 mb-4">
            Add your Invoice Ninja URL and API token in Settings to see your job pipeline.
          </p>
          <button
            onClick={() => navigate('/settings')}
            className="text-sm font-semibold text-amber-700 dark:text-amber-300 underline"
          >
            Open Settings
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-2xl px-5 py-4 mb-6 flex items-center gap-3">
          <Icon name="error" size="sm" className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</p>
          <button onClick={load} className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline shrink-0">Retry</button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="space-y-3 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 h-24" />
          ))}
        </div>
      )}

      {/* Content */}
      {data && (
        <div className="space-y-8">
          {/* Active Jobs */}
          <div>
            <SectionHeader icon="work" title="Active Jobs" count={data.jobs.length}>
              {data.jobs.length === 0 && null}
            </SectionHeader>

            {data.jobs.length === 0 ? (
              <div className="text-center py-10 text-slate-400 dark:text-slate-600">
                <Icon name="check_circle" size="2xl" className="mx-auto mb-2 text-emerald-400" />
                <p className="text-sm font-medium">No active jobs — all clear!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.jobs.map(job => (
                  <JobCard key={job.id} job={job} onCreateProject={setModalJob} />
                ))}
              </div>
            )}
          </div>

          {/* Quote Follow-ups */}
          <div>
            <SectionHeader icon="follow_the_signs" title="Quote Follow-ups" count={data.quotes.length}>
              <span className="text-xs text-slate-400 dark:text-slate-500">older than 7 days</span>
            </SectionHeader>

            {data.quotes.length === 0 ? (
              <div className="text-center py-10 text-slate-400 dark:text-slate-600">
                <Icon name="mark_email_read" size="2xl" className="mx-auto mb-2" />
                <p className="text-sm font-medium">No quotes need following up</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.quotes.map(q => (
                  <QuoteCard
                    key={q.id}
                    quote={q}
                    onDismiss={dismiss}
                    dismissing={dismissing.has(q.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {modalJob && (
        <CreateProjectModal
          job={modalJob}
          onClose={() => setModalJob(null)}
          onCreated={(projectId) => navigate(`/projects/${projectId}`)}
        />
      )}
    </div>
  );
}
