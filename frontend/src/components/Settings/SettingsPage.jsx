import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import Icon from '../common/Icon.jsx';
import CatalogAI from './CatalogAI.jsx';

function SettingGroup({ title, icon, children }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden mb-4">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
        <Icon name={icon} size="sm" className="text-slate-400" />
        <h2 className="font-semibold text-slate-800 dark:text-slate-200">{title}</h2>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {children}
      </div>
    </div>
  );
}

function SettingRow({ label, hint, children }) {
  return (
    <div className="flex items-start gap-4 px-5 py-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</p>
        {hint && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0 w-full max-w-xs">{children}</div>
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text', secret }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={secret && !show ? 'password' : type}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 pr-8"
      />
      {secret && (
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          <Icon name={show ? 'visibility_off' : 'visibility'} size="xs" />
        </button>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { settings, updateSettings, notify } = useApp();
  const { resolved, setTheme, theme } = useTheme();

  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(settings); }, [settings]);

  const set = (key) => (val) => setForm(prev => ({ ...prev, [key]: val }));

  const save = async () => {
    setSaving(true);
    try {
      await updateSettings(form);
      notify('Settings saved', 'success');
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
        >
          <Icon name="save" size="sm" />
          {saving ? 'Saving…' : 'Save All'}
        </button>
      </div>

      {/* Appearance */}
      <SettingGroup title="Appearance" icon="palette">
        <SettingRow label="App Name" hint="Shown in the header">
          <TextInput value={form.app_name} onChange={set('app_name')} placeholder="SiteNote" />
        </SettingRow>
        <SettingRow label="Theme" hint="Affects the entire app">
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            {[
              { id: 'light',  label: 'Light'  },
              { id: 'dark',   label: 'Dark'   },
              { id: 'system', label: 'System' },
              { id: 'neon',   label: '⚡ Neon' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => { setTheme(t.id); set('dark_mode')(t.id); }}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  theme === t.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </SettingRow>
      </SettingGroup>

      {/* Transcription */}
      <SettingGroup title="Transcription (Whisper)" icon="transcribe">
        <SettingRow
          label="Endpoint URL"
          hint="OpenAI-compatible /v1/audio/transcriptions endpoint"
        >
          <TextInput
            value={form.transcription_url}
            onChange={set('transcription_url')}
            placeholder="http://localhost:8000/v1/audio/transcriptions"
          />
        </SettingRow>
        <SettingRow label="API Key" hint="Leave blank if not required">
          <TextInput value={form.transcription_api_key} onChange={set('transcription_api_key')} placeholder="sk-…" secret />
        </SettingRow>
      </SettingGroup>

      {/* LLM */}
      <SettingGroup title="AI / LLM" icon="smart_toy">
        <SettingRow
          label="Endpoint URL"
          hint="Ollama: http://localhost:11434/v1 — or any OpenAI-compatible base URL"
        >
          <TextInput value={form.llm_url} onChange={set('llm_url')} placeholder="http://localhost:11434/v1" />
        </SettingRow>
        <SettingRow label="API Key" hint="Leave blank for local Ollama">
          <TextInput value={form.llm_api_key} onChange={set('llm_api_key')} placeholder="sk-…" secret />
        </SettingRow>
        <SettingRow label="Model Name" hint="e.g. llama3, mistral, gpt-4o">
          <TextInput value={form.llm_model} onChange={set('llm_model')} placeholder="llama3" />
        </SettingRow>
      </SettingGroup>

      {/* Invoice Ninja */}
      <SettingGroup title="Invoice Ninja" icon="receipt_long">
        <SettingRow label="Base URL" hint="Your Invoice Ninja instance URL">
          <TextInput value={form.invoiceninja_url} onChange={set('invoiceninja_url')} placeholder="https://invoicing.co" />
        </SettingRow>
        <SettingRow label="API Token" hint="Found in Invoice Ninja → Settings → API Tokens">
          <TextInput value={form.invoiceninja_api_key} onChange={set('invoiceninja_api_key')} placeholder="Token…" secret />
        </SettingRow>
      </SettingGroup>

      {/* Claude / Anthropic */}
      <SettingGroup title="Claude AI (Anthropic)" icon="auto_awesome">
        <SettingRow
          label="API Key"
          hint="Used for catalog management passes. Get one at console.anthropic.com"
        >
          <TextInput value={form.anthropic_api_key} onChange={set('anthropic_api_key')} placeholder="sk-ant-…" secret />
        </SettingRow>
      </SettingGroup>

      {/* Catalog AI — only shown when both IN and Anthropic are configured */}
      {form.invoiceninja_url && form.invoiceninja_api_key && form.anthropic_api_key && (
        <SettingGroup title="Catalog AI Pass" icon="inventory_2">
          <div className="px-5 py-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Claude reads your full Invoice Ninja product catalog and suggests price updates and new items based on your instructions. Review and approve each change before anything is modified.
            </p>
            <CatalogAI />
          </div>
        </SettingGroup>
      )}

      {/* Google Calendar */}
      <SettingGroup title="Google Calendar" icon="calendar_today">
        <SettingRow label="OAuth Client ID">
          <TextInput value={form.google_client_id} onChange={set('google_client_id')} placeholder="xxx.apps.googleusercontent.com" />
        </SettingRow>
        <SettingRow label="OAuth Client Secret">
          <TextInput value={form.google_client_secret} onChange={set('google_client_secret')} placeholder="GOCSPX-…" secret />
        </SettingRow>
        <div className="px-5 py-3 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
          <Icon name="info" size="xs" filled />
          Google Calendar sync coming in a future release.
        </div>
      </SettingGroup>

      {/* Reminders */}
      <SettingGroup title="Reminders" icon="notifications">
        <SettingRow label="Incomplete bid reminders" hint="Notify about notes tagged 'bid' with no linked invoice">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.reminder_incomplete_bids === 'true'}
              onChange={(e) => set('reminder_incomplete_bids')(String(e.target.checked))}
              className="w-5 h-5 rounded border-slate-300 text-blue-600 cursor-pointer"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">Enabled</span>
          </label>
        </SettingRow>
        <SettingRow label="Unscheduled project reminders" hint="Notify about projects with no calendar event">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.reminder_unscheduled === 'true'}
              onChange={(e) => set('reminder_unscheduled')(String(e.target.checked))}
              className="w-5 h-5 rounded border-slate-300 text-blue-600 cursor-pointer"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">Enabled</span>
          </label>
        </SettingRow>
        <SettingRow label="Reminder interval" hint="How often to re-nag (hours)">
          <input
            type="number"
            min={1}
            max={168}
            value={form.reminder_interval_hours || 24}
            onChange={(e) => set('reminder_interval_hours')(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
          />
        </SettingRow>
      </SettingGroup>

      {/* About */}
      <div className="text-center py-6 text-xs text-slate-300 dark:text-slate-700 space-y-1">
        <p className="font-semibold text-slate-400 dark:text-slate-500">SiteNote</p>
        <p>Self-hosted field notes for contractors</p>
        <p>SQLite · Node/Express · React · PWA</p>
      </div>
    </div>
  );
}
