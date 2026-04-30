import { useState, useRef, useEffect } from 'react';
import { aiApi } from '../../api/ai.js';
import { useApp } from '../../context/AppContext.jsx';
import Icon from '../common/Icon.jsx';

const PRESETS = [
  {
    label: 'Scope of Work',
    icon:  'description',
    prompt: 'Write a formal Scope of Work for this project based on these notes. Use clear contractor language. Format: one concise paragraph per major work area. No preamble, start directly with the scope.',
  },
  {
    label: 'Materials list',
    icon:  'inventory_2',
    prompt: 'List every material needed for this job based on the notes. Format each line as: [Quantity] [Unit] — [Material] — [Notes/spec if mentioned]. Group by trade (framing, electrical, plumbing, etc.). If quantity is unknown write "TBD".',
  },
  {
    label: 'Punch list',
    icon:  'checklist_rtl',
    prompt: 'Convert these notes into a numbered punch list. Each item must be one specific, actionable task. No categories, no explanations — just the list.',
  },
  {
    label: 'Bid summary',
    icon:  'request_quote',
    prompt: 'Write a one-paragraph professional estimate summary to send to a client. Cover: what work will be done, any important conditions or exclusions, and next steps. Professional tone, no pricing unless mentioned in the notes. Start directly — no greeting.',
  },
  {
    label: 'Client email',
    icon:  'mail',
    prompt: 'Draft a brief professional email to the client based on these notes. Include a subject line, then the body. Keep it under 150 words. Professional but friendly contractor tone.',
  },
  {
    label: 'Clean up transcript',
    icon:  'auto_fix_high',
    prompt: 'This is a voice transcription from a job site. Fix grammar and punctuation, remove filler words (um, uh, like), and organize into clear short paragraphs. Keep every detail — do not summarize or remove information.',
  },
  {
    label: 'Change order',
    icon:  'edit_document',
    prompt: 'Draft a change order based on the additional or modified work described in this note. Include: what changed from original scope, reason for the change, and a placeholder for pricing. Professional contractor language, one page max.',
  },
  {
    label: 'Daily report',
    icon:  'today',
    prompt: 'Convert this note into a brief daily job site report. Format: Work Performed (bullet list), Issues / Delays (if any), Next Day Plan (bullet list). Infer from context — if something is not mentioned, omit that section.',
  },
  {
    label: "What's missing",
    icon:  'find_in_page',
    prompt: "Review this note and scope of work. Based on the type of job described, what materials, tasks, or trades are commonly needed but NOT mentioned here? List only specific gaps — things that would realistically be needed and might get missed in a bid.",
  },
];

export default function AIAssistant({ noteContent, noteTitle, onInsert }) {
  const { settings } = useApp();
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const noteText = (noteContent || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000);
  const systemPrompt = `You are an assistant for a construction contractor. Be direct and concise. Never explain what you are about to do — just do it. Do not add disclaimers or caveats.

Current note title: ${noteTitle || 'Untitled'}
Note content:
${noteText || '(empty note)'}`.trim();

  const send = async (text) => {
    if (!text?.trim() || loading) return;
    const userMsg = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages([...newMessages, { role: 'assistant', content: '' }]);
    setInput('');
    setLoading(true);

    try {
      const model = settings?.llm_model;
      let full = '';
      await aiApi.chat(
        [{ role: 'system', content: systemPrompt }, ...newMessages],
        model,
        (delta, accumulated) => {
          full = accumulated;
          setMessages(prev => [
            ...prev.slice(0, -1),
            { role: 'assistant', content: accumulated },
          ]);
        }
      );
    } catch (e) {
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: `Error: ${e.message}`, error: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant' && m.content && !m.error);

  return (
    <div className="flex flex-col h-full min-h-[400px]">
      {/* Preset chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {PRESETS.map(p => (
          <button
            key={p.label}
            onClick={() => send(p.prompt)}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950 hover:text-blue-700 dark:hover:text-blue-300 text-slate-600 dark:text-slate-400 px-2.5 py-1.5 rounded-full transition-colors disabled:opacity-50"
          >
            <Icon name={p.icon} size="xs" />
            {p.label}
          </button>
        ))}
      </div>

      {/* Message history */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-3 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-8 text-slate-400 dark:text-slate-600">
            <Icon name="smart_toy" size="2xl" />
            <p className="mt-2 text-sm text-center">Ask about this note or use a preset above</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
              m.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-sm'
                : m.error
                ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-bl-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm'
            }`}>
              {m.content || (loading && i === messages.length - 1 ? '…' : '')}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Insert button */}
      {lastAssistant && (
        <button
          onClick={() => onInsert(lastAssistant.content)}
          className="flex items-center gap-2 w-full mb-2 px-3 py-2 bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-950/60 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900 rounded-xl text-sm font-medium transition-colors"
        >
          <Icon name="add_circle" size="sm" />
          Insert response into note
        </button>
      )}

      {/* Input */}
      <div className="flex items-end gap-2">
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder="Ask the AI something about this note…"
          className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || loading}
          className="p-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-colors"
        >
          {loading
            ? <Icon name="hourglass_top" size="sm" className="animate-spin" />
            : <Icon name="send" size="sm" />
          }
        </button>
      </div>

      {!settings?.llm_url && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
          <Icon name="warning" size="xs" filled />
          LLM endpoint not configured. Visit Settings to set it up.
        </p>
      )}
    </div>
  );
}
