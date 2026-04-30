import { useState } from 'react';
import { catalogApi } from '../../api/catalog.js';
import Icon from '../common/Icon.jsx';

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const MODELS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku — fast & cheap' },
  { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet — more thorough' },
];

function SuggestionRow({ item, checked, onChange, isUpdate }) {
  return (
    <label className="flex items-start gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl cursor-pointer transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">
            {item.product_key}
          </span>
          {isUpdate ? (
            <span className="flex items-center gap-1 text-xs">
              <span className="text-slate-400 line-through">{fmt(item.current_price)}</span>
              <Icon name="arrow_forward" size="xs" className="text-slate-300" />
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{fmt(item.suggested_price)}</span>
            </span>
          ) : (
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              {fmt(item.suggested_price)}
            </span>
          )}
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">{item.description}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 italic">{item.reason}</p>
      </div>
    </label>
  );
}

export default function CatalogAI() {
  const [instructions, setInstructions] = useState('');
  const [model,        setModel]        = useState(MODELS[0].id);
  const [running,      setRunning]      = useState(false);
  const [applying,     setApplying]     = useState(false);
  const [error,        setError]        = useState('');
  const [results,      setResults]      = useState(null);   // { updates, additions }
  const [applied,      setApplied]      = useState(null);   // { updated, created, failed }
  const [selected,     setSelected]     = useState({ updates: new Set(), additions: new Set(), deletions: new Set() });

  const runReview = async () => {
    if (!instructions.trim()) return;
    setRunning(true);
    setError('');
    setResults(null);
    setApplied(null);
    try {
      const data = await catalogApi.review(instructions, model);
      setResults(data);
      // Select all by default
      setSelected({
        updates:   new Set(data.updates.map((_, i) => i)),
        additions: new Set(data.additions.map((_, i) => i)),
        deletions: new Set(data.deletions.map((_, i) => i)),
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  const toggleSelected = (type, index, checked) => {
    setSelected(prev => {
      const next = new Set(prev[type]);
      checked ? next.add(index) : next.delete(index);
      return { ...prev, [type]: next };
    });
  };

  const toggleAll = (type) => {
    const list = results?.[type] || [];
    setSelected(prev => ({
      ...prev,
      [type]: prev[type].size === list.length ? new Set() : new Set(list.map((_, i) => i)),
    }));
  };

  const applySelected = async () => {
    if (!results) return;
    const updates   = results.updates.filter((_, i) => selected.updates.has(i));
    const additions = results.additions.filter((_, i) => selected.additions.has(i));
    const deletions = results.deletions.filter((_, i) => selected.deletions.has(i));
    if (!updates.length && !additions.length && !deletions.length) return;
    setApplying(true);
    try {
      const res = await catalogApi.apply(updates, additions, deletions);
      setApplied(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setApplying(false);
    }
  };

  const totalSelected = selected.updates.size + selected.additions.size + selected.deletions.size;
  const hasResults    = results && (results.updates.length > 0 || results.additions.length > 0 || results.deletions.length > 0);

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Instructions for Claude
        </label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
          placeholder={`Examples:\n• "Lumber prices went up about 25%, update framing materials"\n• "Add basic electrical rough-in items, we do a lot of new construction"\n• "Add plumbing fixtures and update PEX pricing"`}
          className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Model + Run */}
      <div className="flex gap-2">
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="flex-1 px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
        >
          {MODELS.map(m => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
        <button
          onClick={runReview}
          disabled={!instructions.trim() || running}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shrink-0"
        >
          {running ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Reviewing…
            </>
          ) : (
            <>
              <Icon name="auto_awesome" size="sm" />
              Run Claude Pass
            </>
          )}
        </button>
      </div>

      {running && (
        <p className="text-xs text-slate-400 text-center animate-pulse">
          Claude is reading your catalog and generating suggestions…
        </p>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2.5 rounded-xl">
          <Icon name="error" size="sm" className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Results */}
      {results && !hasResults && (
        <div className="text-center py-6 text-sm text-slate-400">
          <Icon name="check_circle" size="lg" className="text-emerald-500 mb-2" />
          <p>Claude found nothing to change based on your instructions.</p>
        </div>
      )}

      {hasResults && !applied && (
        <div className="space-y-4">
          {/* Price updates */}
          {results.updates.length > 0 && (
            <div className="border border-amber-200 dark:border-amber-900 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900">
                <span className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <Icon name="edit" size="xs" />
                  Price Updates ({results.updates.length})
                </span>
                <button
                  onClick={() => toggleAll('updates')}
                  className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
                >
                  {selected.updates.size === results.updates.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {results.updates.map((item, i) => (
                  <SuggestionRow
                    key={i}
                    item={item}
                    checked={selected.updates.has(i)}
                    onChange={(v) => toggleSelected('updates', i, v)}
                    isUpdate
                  />
                ))}
              </div>
            </div>
          )}

          {/* New additions */}
          {results.additions.length > 0 && (
            <div className="border border-blue-200 dark:border-blue-900 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-900">
                <span className="text-sm font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                  <Icon name="add_circle" size="xs" />
                  New Items ({results.additions.length})
                </span>
                <button
                  onClick={() => toggleAll('additions')}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {selected.additions.size === results.additions.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {results.additions.map((item, i) => (
                  <SuggestionRow
                    key={i}
                    item={item}
                    checked={selected.additions.has(i)}
                    onChange={(v) => toggleSelected('additions', i, v)}
                    isUpdate={false}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Deletions */}
          {results.deletions.length > 0 && (
            <div className="border border-red-200 dark:border-red-900 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900">
                <span className="text-sm font-semibold text-red-800 dark:text-red-300 flex items-center gap-2">
                  <Icon name="delete" size="xs" />
                  Duplicates to Remove ({results.deletions.length})
                </span>
                <button
                  onClick={() => toggleAll('deletions')}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline"
                >
                  {selected.deletions.size === results.deletions.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {results.deletions.map((item, i) => (
                  <label key={i} className="flex items-start gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selected.deletions.has(i)}
                      onChange={(e) => toggleSelected('deletions', i, e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-red-600 cursor-pointer shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">{item.product_key}</span>
                      <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">{item.description}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 italic">{item.reason}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={applySelected}
            disabled={totalSelected === 0 || applying}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold text-sm transition-colors"
          >
            {applying ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Applying to Invoice Ninja…
              </>
            ) : (
              <>
                <Icon name="cloud_upload" size="sm" />
                Apply {totalSelected} selected change{totalSelected !== 1 ? 's' : ''} to Invoice Ninja
              </>
            )}
          </button>
        </div>
      )}

      {/* Apply results */}
      {applied && (
        <div className="space-y-2">
          {applied.updated.length > 0 && (
            <div className="flex items-start gap-2 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 px-3 py-2.5 rounded-xl">
              <Icon name="check_circle" size="sm" className="shrink-0 mt-0.5" />
              Updated: {applied.updated.join(', ')}
            </div>
          )}
          {applied.created.length > 0 && (
            <div className="flex items-start gap-2 text-sm text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 px-3 py-2.5 rounded-xl">
              <Icon name="add_circle" size="sm" className="shrink-0 mt-0.5" />
              Created: {applied.created.join(', ')}
            </div>
          )}
          {applied.deleted?.length > 0 && (
            <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2.5 rounded-xl">
              <Icon name="delete" size="sm" className="shrink-0 mt-0.5" />
              Deleted: {applied.deleted.join(', ')}
            </div>
          )}
          {applied.failed.length > 0 && (
            <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2.5 rounded-xl">
              <Icon name="error" size="sm" className="shrink-0 mt-0.5" />
              Failed: {applied.failed.map(f => `${f.key} (${f.error})`).join(', ')}
            </div>
          )}
          <button
            onClick={() => { setResults(null); setApplied(null); setInstructions(''); }}
            className="w-full text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 py-2 transition-colors"
          >
            Run another pass
          </button>
        </div>
      )}
    </div>
  );
}
