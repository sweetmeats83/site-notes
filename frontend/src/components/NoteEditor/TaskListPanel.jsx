import { useState } from 'react';
import Icon from '../common/Icon.jsx';

function CircleCheck({ checked, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
        checked
          ? 'bg-blue-600 border-blue-600 dark:bg-blue-500 dark:border-blue-500'
          : 'border-slate-300 dark:border-slate-600 hover:border-blue-500 dark:hover:border-blue-400'
      } ${className}`}
    >
      {checked && (
        <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1,4 3.5,7 9,1" />
        </svg>
      )}
    </button>
  );
}

export default function TaskListPanel({ tasks, onChange }) {
  const [input, setInput] = useState('');

  const addTask = () => {
    const text = input.trim();
    if (!text) return;
    onChange([...tasks, { text, completed: false }]);
    setInput('');
  };

  const toggle = (i) => {
    const next = [...tasks];
    next[i] = { ...next[i], completed: !next[i].completed };
    onChange(next);
  };

  const remove = (i) => onChange(tasks.filter((_, idx) => idx !== i));

  const updateText = (i, text) => {
    const next = [...tasks];
    next[i] = { ...next[i], text };
    onChange(next);
  };

  const done  = tasks.filter(t => t.completed).length;
  const total = tasks.length;

  return (
    <div>
      {/* Progress bar */}
      {total > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${(done / total) * 100}%` }}
            />
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
            {done}/{total}
          </span>
        </div>
      )}

      {/* Task items */}
      <div className="space-y-1.5 mb-3">
        {tasks.map((task, i) => (
          <div key={i} className="flex items-center gap-2.5 group">
            <CircleCheck checked={task.completed} onClick={() => toggle(i)} />
            <input
              type="text"
              value={task.text}
              onChange={(e) => updateText(i, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } }}
              className={`flex-1 bg-transparent text-sm outline-none transition-colors ${
                task.completed
                  ? 'line-through text-slate-400 dark:text-slate-500'
                  : 'text-slate-800 dark:text-slate-200'
              }`}
            />
            <button
              onClick={() => remove(i)}
              className="shrink-0 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
            >
              <Icon name="close" size="xs" />
            </button>
          </div>
        ))}
      </div>

      {/* Add task input */}
      <div className="flex items-center gap-2">
        <Icon name="add_circle" size="sm" className="text-slate-300 dark:text-slate-600 shrink-0" />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } }}
          placeholder="Add a task…"
          className="flex-1 bg-transparent text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400 outline-none"
        />
        {input.trim() && (
          <button
            onClick={addTask}
            className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline"
          >
            Add
          </button>
        )}
      </div>
    </div>
  );
}
