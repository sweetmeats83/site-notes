import { useState } from 'react';
import Icon from '../common/Icon.jsx';

export default function TagInput({ tags, onChange }) {
  const [input, setInput] = useState('');

  const addTag = (raw) => {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, '-');
    if (!tag || tags.includes(tag)) return;
    onChange([...tags, tag]);
    setInput('');
  };

  const removeTag = (t) => onChange(tags.filter(x => x !== t));

  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(input); }
    if (e.key === 'Backspace' && !input && tags.length) removeTag(tags[tags.length - 1]);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 min-h-[36px]">
      <Icon name="label" size="xs" className="text-slate-400" />
      {tags.map(t => (
        <span
          key={t}
          className="flex items-center gap-1 text-xs bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full"
        >
          {t}
          <button
            onClick={() => removeTag(t)}
            className="hover:text-red-500 transition-colors"
            aria-label={`Remove tag ${t}`}
          >
            <Icon name="close" size="xs" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => { if (input.trim()) addTag(input); }}
        placeholder={tags.length === 0 ? 'Add tags…' : ''}
        className="flex-1 min-w-[80px] bg-transparent text-xs text-slate-600 dark:text-slate-400 placeholder-slate-400 outline-none"
      />
    </div>
  );
}
