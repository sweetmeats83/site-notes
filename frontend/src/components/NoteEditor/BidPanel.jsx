import { useState, useEffect, useMemo } from 'react';
import { invApi } from '../../api/invoiceninja.js';
import { aiApi } from '../../api/ai.js';
import Icon from '../common/Icon.jsx';

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

// ── Line item row ─────────────────────────────────────────────────────────────
function LineItem({ item, index, onChange, onRemove }) {
  return (
    <div className="flex items-center gap-2 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{item.description || item.product_key}</p>
        {item.product_key && item.description && (
          <p className="text-xs text-slate-400">{item.product_key}</p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-xs text-slate-400 w-16 text-right">{fmt(item.unit_cost)}</span>
        <span className="text-xs text-slate-300 dark:text-slate-600">×</span>
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={item.quantity}
          onChange={(e) => onChange(index, { ...item, quantity: parseFloat(e.target.value) || 1 })}
          className="w-14 px-2 py-1 text-xs text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
        />
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 w-20 text-right">
          {fmt((item.unit_cost || 0) * (item.quantity || 1))}
        </span>
      </div>
      <button
        onClick={() => onRemove(index)}
        className="shrink-0 text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors"
      >
        <Icon name="remove_circle" size="sm" />
      </button>
    </div>
  );
}

// ── Product row in the catalog picker ─────────────────────────────────────────
function ProductRow({ product, onAdd }) {
  return (
    <button
      type="button"
      onClick={() => onAdd(product)}
      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
          {product.description || product.product_key}
        </p>
        {product.product_key && product.description && (
          <p className="text-xs text-slate-400 truncate">{product.product_key}</p>
        )}
      </div>
      <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{fmt(product.price || product.cost)}</span>
      <Icon name="add_circle" size="sm" className="text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />
    </button>
  );
}

// ── Main BidPanel ─────────────────────────────────────────────────────────────
export default function BidPanel({ bidItems, onChange, project }) {
  const [products,    setProducts]    = useState([]);
  const [search,      setSearch]      = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [creating,    setCreating]    = useState(false);
  const [quoteResult, setQuoteResult] = useState(null); // { id, url }
  const [notes,       setNotes]       = useState('');
  const [aiQuery,     setAiQuery]     = useState('');
  const [aiLoading,   setAiLoading]   = useState(false);
  const [aiMsg,       setAiMsg]       = useState('');

  const loadProducts = (bust = false) => {
    setLoading(true);
    setError('');
    const fetch = bust
      ? invApi.clearCache().then(() => invApi.products())
      : invApi.products();
    fetch
      .then(setProducts)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadProducts(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return products;
    return products.filter(p =>
      (p.product_key || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q)
    );
  }, [products, search]);

  const addItem = (product) => {
    const existing = bidItems.findIndex(i => i.product_id === product.id);
    if (existing >= 0) {
      // Increment quantity instead of duplicating
      const updated = bidItems.map((item, i) =>
        i === existing ? { ...item, quantity: (item.quantity || 1) + 1 } : item
      );
      onChange(updated);
    } else {
      onChange([...bidItems, {
        product_id:  product.id,
        product_key: product.product_key,
        description: product.description,
        unit_cost:   product.price || product.cost || 0,
        quantity:    1,
      }]);
    }
  };

  const updateItem = (index, item) => {
    onChange(bidItems.map((it, i) => i === index ? item : it));
  };

  const removeItem = (index) => {
    onChange(bidItems.filter((_, i) => i !== index));
  };

  const suggestItems = async () => {
    if (!aiQuery.trim() || aiLoading || !products.length) return;
    setAiLoading(true);
    setAiMsg('');
    try {
      // Use index-based catalog so the LLM never returns strings that could break JSON
      const catalogLines = products
        .map((p, i) => `${i}: ${p.product_key}${p.description ? ' — ' + p.description.slice(0, 40) : ''} ($${p.price || p.cost || 0})`)
        .join('\n');

      const text = await aiApi.chat([
        { role: 'system', content: 'Construction bid assistant. Return ONLY valid JSON — no markdown, no backticks, no explanation.' },
        { role: 'user',   content: `Catalog (index: name — description (price)):\n${catalogLines}\n\nJob: "${aiQuery.trim()}"\n\nReturn JSON using catalog indices only:\n{"items":[{"i":0,"qty":1}]}\nMax 15 items.` },
      ]);

      // Extract JSON robustly — find outermost { }
      const first = text.indexOf('{');
      const last  = text.lastIndexOf('}');
      if (first === -1 || last === -1) throw new Error('No JSON in LLM response');
      const parsed = JSON.parse(text.slice(first, last + 1));

      const toAdd = [];
      for (const s of (parsed.items || [])) {
        const idx = parseInt(s.i ?? s.index, 10);
        const product = products[idx];
        if (!product) continue;
        if (bidItems.some(i => i.product_id === product.id)) continue;
        toAdd.push({
          product_id:  product.id,
          product_key: product.product_key,
          description: product.description,
          unit_cost:   product.price || product.cost || 0,
          quantity:    Math.max(1, parseFloat(s.qty ?? s.quantity) || 1),
        });
      }

      if (toAdd.length) {
        onChange([...bidItems, ...toAdd]);
        setAiMsg(`Added ${toAdd.length} item${toAdd.length !== 1 ? 's' : ''}`);
        setAiQuery('');
      } else {
        setAiMsg('No matching catalog items found — try rephrasing or build out your catalog first');
      }
    } catch (e) {
      setAiMsg(`Error: ${e.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  const subtotal = bidItems.reduce((sum, i) => sum + (i.unit_cost || 0) * (i.quantity || 1), 0);

  const createQuote = async () => {
    if (!project?.invoiceninja_client_id) return;
    if (!bidItems.length) return;
    setCreating(true);
    setQuoteResult(null);
    try {
      const result = await invApi.createQuote({
        client_id:   project.invoiceninja_client_id,
        line_items:  bidItems,
        public_notes: notes,
      });
      setQuoteResult(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const canQuote = project?.invoiceninja_client_id && bidItems.length > 0;

  return (
    <div className="space-y-4">

      {/* AI describe-to-bid */}
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Icon name="auto_awesome" size="sm" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-violet-400 pointer-events-none" />
            <input
              type="text"
              value={aiQuery}
              onChange={(e) => { setAiQuery(e.target.value); setAiMsg(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') suggestItems(); }}
              placeholder="Describe the work — AI suggests items…"
              disabled={aiLoading || !products.length}
              className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-violet-200 dark:border-violet-900 rounded-xl text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
            />
          </div>
          <button
            onClick={suggestItems}
            disabled={!aiQuery.trim() || aiLoading || !products.length}
            className="shrink-0 flex items-center justify-center w-10 h-10 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl transition-colors"
          >
            {aiLoading
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Icon name="auto_awesome" size="sm" />
            }
          </button>
        </div>
        {aiMsg && (
          <p className={`text-xs px-1 ${
            aiMsg.startsWith('Error') ? 'text-red-500' :
            aiMsg.startsWith('No matching') ? 'text-amber-500 dark:text-amber-400' :
            'text-emerald-600 dark:text-emerald-400'
          }`}>
            {aiMsg}
          </p>
        )}
      </div>

      {/* Product catalog */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="relative">
            <Icon name="search" size="sm" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${products.length} catalog items…`}
              className="w-full pl-8 pr-10 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={() => loadProducts(true)}
              disabled={loading}
              title="Refresh catalog from Invoice Ninja"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-50 transition-colors"
            >
              <Icon name="refresh" size="xs" className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-400">Loading catalog…</div>
          ) : error ? (
            <div className="py-4 px-4 text-sm text-red-600 dark:text-red-400">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              {search ? 'No items match that search' : 'No items in Invoice Ninja catalog'}
            </div>
          ) : filtered.map(p => (
            <ProductRow key={p.id} product={p} onAdd={addItem} />
          ))}
        </div>
      </div>

      {/* Line items */}
      {bidItems.length > 0 && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Bid Items
            </span>
            <span className="text-xs text-slate-400">{bidItems.length} item{bidItems.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="px-4">
            {bidItems.map((item, i) => (
              <LineItem key={i} item={item} index={i} onChange={updateItem} onRemove={removeItem} />
            ))}
          </div>

          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Subtotal</span>
            <span className="text-base font-bold text-slate-900 dark:text-white">{fmt(subtotal)}</span>
          </div>
        </div>
      )}

      {/* Quote notes */}
      {bidItems.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
            Notes for Quote (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Scope, terms, or any notes to include on the IN quote…"
            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
        </div>
      )}

      {/* Create Quote button */}
      {bidItems.length > 0 && (
        <div className="space-y-2">
          {!project?.invoiceninja_client_id && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-900">
              <Icon name="warning" size="xs" />
              Link this project to an Invoice Ninja client to create quotes
            </p>
          )}

          <button
            onClick={createQuote}
            disabled={!canQuote || creating}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold text-sm transition-colors"
          >
            {creating ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating Quote…
              </>
            ) : (
              <>
                <Icon name="receipt_long" size="sm" />
                Create Draft Quote in Invoice Ninja
              </>
            )}
          </button>

          {quoteResult && (
            <a
              href={quoteResult.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 px-4 py-2.5 rounded-xl font-medium hover:bg-emerald-100 dark:hover:bg-emerald-950/60 transition-colors"
            >
              <Icon name="check_circle" size="sm" />
              Quote created — open in Invoice Ninja
              <Icon name="open_in_new" size="xs" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
