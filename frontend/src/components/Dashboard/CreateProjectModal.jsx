import { useState, useEffect, useRef } from 'react';
import Modal from '../common/Modal.jsx';
import Icon from '../common/Icon.jsx';
import { invApi } from '../../api/invoiceninja.js';
import { useApp } from '../../context/AppContext.jsx';

const COLORS = [
  { label: 'Blue',   value: '#2563EB' },
  { label: 'Green',  value: '#16A34A' },
  { label: 'Amber',  value: '#D97706' },
  { label: 'Red',    value: '#DC2626' },
  { label: 'Purple', value: '#9333EA' },
  { label: 'Pink',   value: '#DB2777' },
  { label: 'Orange', value: '#EA580C' },
  { label: 'Teal',   value: '#0D9488' },
  { label: 'Slate',  value: '#64748B' },
];

export default function CreateProjectModal({ open, onClose, onSave, existing }) {
  const { settings } = useApp();
  const [name,    setName]    = useState('');
  const [client,  setClient]  = useState('');
  const [color,   setColor]   = useState(COLORS[0].value);
  const [saving,  setSaving]  = useState(false);
  const [inClientId,  setInClientId]  = useState(null);

  // IN client picker state
  const [inClients,    setInClients]    = useState([]);
  const [inSearch,     setInSearch]     = useState('');
  const [pickerOpen,   setPickerOpen]   = useState(false);
  const [inLoading,    setInLoading]    = useState(false);
  const pickerRef = useRef(null);

  const inConfigured = !!(settings?.invoiceninja_url && settings?.invoiceninja_api_key);

  useEffect(() => {
    if (existing) {
      setName(existing.name || '');
      setClient(existing.client || '');
      setColor(existing.color || COLORS[0].value);
      setInClientId(existing.invoiceninja_client_id || null);
    } else {
      setName(''); setClient(''); setColor(COLORS[0].value); setInClientId(null);
    }
    setPickerOpen(false); setInSearch('');
  }, [existing, open]);

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickerOpen]);

  const openPicker = async () => {
    if (!pickerOpen && inClients.length === 0) {
      setInLoading(true);
      try {
        const data = await invApi.clients();
        setInClients(data);
      } catch { /* IN unreachable — show empty */ }
      finally { setInLoading(false); }
    }
    setPickerOpen(v => !v);
  };

  const selectInClient = (c) => {
    setClient(c.name);
    setInClientId(c.id);
    setPickerOpen(false);
    setInSearch('');
  };

  const clearInClient = () => {
    setInClientId(null);
  };

  const filtered = inClients.filter(c =>
    !inSearch || c.name.toLowerCase().includes(inSearch.toLowerCase()) || c.email.toLowerCase().includes(inSearch.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), client: client.trim(), color, invoiceninja_client_id: inClientId || null });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={existing ? 'Edit Project' : 'New Project'}>
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Project name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Project Name <span className="text-red-500">*</span>
          </label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Kitchen Remodel — 123 Main St"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Client — with optional IN picker */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Client Name
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={client}
              onChange={(e) => { setClient(e.target.value); setInClientId(null); }}
              placeholder="e.g. John Smith"
              className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
            />
            {inConfigured && (
              <button
                type="button"
                onClick={openPicker}
                title="Pick from Invoice Ninja"
                className={`shrink-0 px-3 py-2.5 rounded-xl border transition-colors flex items-center gap-1.5 text-sm font-medium ${
                  inClientId
                    ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-600 dark:hover:text-blue-400'
                }`}
              >
                <Icon name="receipt_long" size="sm" />
                {inClientId ? 'Linked' : 'IN'}
              </button>
            )}
          </div>

          {/* IN client linked badge */}
          {inClientId && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
              <Icon name="check_circle" size="xs" />
              Linked to Invoice Ninja client
              <button type="button" onClick={clearInClient} className="text-slate-400 hover:text-red-500 ml-1">
                <Icon name="close" size="xs" />
              </button>
            </div>
          )}

          {/* Picker dropdown */}
          {pickerOpen && (
            <div ref={pickerRef} className="mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
              <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                <input
                  autoFocus
                  type="text"
                  value={inSearch}
                  onChange={(e) => setInSearch(e.target.value)}
                  placeholder="Search clients…"
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 outline-none"
                />
              </div>
              <div className="max-h-52 overflow-y-auto">
                {inLoading ? (
                  <div className="py-6 text-center text-sm text-slate-400">Loading…</div>
                ) : filtered.length === 0 ? (
                  <div className="py-6 text-center text-sm text-slate-400">No clients found</div>
                ) : filtered.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectInClient(c)}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{c.name}</p>
                    {c.email && <p className="text-xs text-slate-400">{c.email}</p>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Color */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Color Tag
          </label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => setColor(c.value)}
                title={c.label}
                className="w-9 h-9 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center"
                style={{
                  backgroundColor: c.value,
                  borderColor: color === c.value ? c.value : 'transparent',
                  boxShadow:   color === c.value ? `0 0 0 3px ${c.value}40` : 'none',
                }}
              >
                {color === c.value && <Icon name="check" size="xs" className="text-white" />}
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || saving}
            className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <Icon name={existing ? 'save' : 'add'} size="sm" />
            {saving ? 'Saving…' : existing ? 'Save Changes' : 'Create Project'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
