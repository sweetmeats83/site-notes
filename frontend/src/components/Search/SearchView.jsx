import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { relativeDate } from '../../utils/dates.js';
import Icon from '../common/Icon.jsx';

export default function SearchView() {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const navigate = useNavigate();
  const timer = useRef(null);

  const search = useCallback((q) => {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true);
    api.get(`/search?q=${encodeURIComponent(q)}`)
      .then(r => { setResults(r); setSearched(true); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (val) => {
    setQuery(val);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => search(val), 350);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-5">Search</h1>

      {/* Search input */}
      <div className="relative mb-6">
        <Icon name="search" size="md" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Search notes, titles, tags…"
          className="w-full pl-12 pr-4 py-4 text-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
        />
        {loading && (
          <Icon name="hourglass_top" size="sm" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
        )}
      </div>

      {/* Results */}
      {searched && results.length === 0 && !loading && (
        <div className="text-center py-16 text-slate-400 dark:text-slate-600">
          <Icon name="search_off" size="2xl" />
          <p className="mt-3">No results for &ldquo;{query}&rdquo;</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {results.length} result{results.length !== 1 ? 's' : ''}
          </p>
          {results.map(r => (
            <button
              key={r.id}
              onClick={() => navigate(`/projects/${r.project_id}/notes/${r.id}`)}
              className="w-full text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.project_color }} />
                <span className="text-xs text-slate-400 dark:text-slate-500 truncate">{r.project_name}</span>
                <span className="text-xs text-slate-300 dark:text-slate-600 ml-auto shrink-0">
                  {relativeDate(r.updated_at)}
                </span>
              </div>
              <h3
                className="font-semibold text-slate-900 dark:text-white mb-1"
                dangerouslySetInnerHTML={{ __html: r.title_snippet || r.title }}
              />
              {(r.body_snippet || r.body_plain) && (
                <p
                  className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2"
                  dangerouslySetInnerHTML={{
                    __html: (r.body_snippet || r.body_plain || '').replace(/<[^>]+>/g, ''),
                  }}
                />
              )}
            </button>
          ))}
        </div>
      )}

      {!searched && !loading && (
        <div className="text-center py-16 text-slate-300 dark:text-slate-700">
          <Icon name="travel_explore" size="2xl" />
          <p className="mt-3 text-sm">Start typing to search across all notes</p>
        </div>
      )}
    </div>
  );
}
