import { useRef, useState, useEffect } from 'react';
import { attachmentsApi } from '../../api/attachments.js';
import { aiApi } from '../../api/ai.js';
import Icon from '../common/Icon.jsx';

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function AudioRecorder({ noteId, onTranscription, onSaved }) {
  const [state,   setState]   = useState('idle');      // idle | recording | recorded
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl,setAudioUrl]= useState(null);
  const [blob,    setBlob]    = useState(null);
  const [volume,  setVolume]  = useState(0);
  const [transcribing, setTranscribing] = useState(false);

  const mediaRef    = useRef(null);
  const analyserRef = useRef(null);
  const timerRef    = useRef(null);
  const animRef     = useRef(null);
  const chunksRef   = useRef([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg',
      });
      mediaRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const b = new Blob(chunksRef.current, { type: recorder.mimeType });
        setBlob(b);
        setAudioUrl(URL.createObjectURL(b));
        setState('recorded');
      };
      recorder.start(100);

      // Volume visualization
      const ctx     = new AudioContext();
      const src     = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyserRef.current = analyser;

      const tick = () => {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setVolume(Math.min(100, avg * 2));
        animRef.current = requestAnimationFrame(tick);
      };
      animRef.current = requestAnimationFrame(tick);

      setElapsed(0);
      setState('recording');
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    } catch (e) {
      alert(`Microphone error: ${e.message}`);
    }
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    clearInterval(timerRef.current);
    cancelAnimationFrame(animRef.current);
    setVolume(0);
  };

  const discard = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null); setBlob(null);
    setElapsed(0); setState('idle');
  };

  const saveAttachment = async () => {
    if (!blob) return;
    const ext  = blob.type.includes('ogg') ? 'ogg' : 'webm';
    const file = new File([blob], `recording-${Date.now()}.${ext}`, { type: blob.type });
    const att  = await attachmentsApi.upload(noteId, file);
    onSaved?.(att);
    return att;
  };

  const transcribe = async () => {
    if (!blob) return;
    setTranscribing(true);
    try {
      // Save first so it's persisted
      await saveAttachment().catch(() => {});
      const text = await aiApi.transcribe(blob);
      onTranscription(text);
    } catch (e) {
      alert(`Transcription failed: ${e.message}`);
    } finally {
      setTranscribing(false);
    }
  };

  useEffect(() => () => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(animRef.current);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  return (
    <div className="space-y-3">
      {state === 'idle' && (
        <button
          onClick={startRecording}
          className="flex items-center gap-3 w-full bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 rounded-xl px-4 py-4 font-semibold transition-colors"
        >
          <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center shrink-0">
            <Icon name="mic" size="md" className="text-white" filled />
          </div>
          <span>Start Recording</span>
        </button>
      )}

      {state === 'recording' && (
        <div className="space-y-3">
          {/* Waveform */}
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl">
            <div className="relative w-10 h-10 shrink-0">
              <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center animate-pulse">
                <Icon name="mic" size="md" className="text-white" filled />
              </div>
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-red-700 dark:text-red-400 font-mono font-bold">{fmtTime(elapsed)}</span>
                <div className="flex-1 flex items-center gap-0.5 h-5">
                  {[...Array(20)].map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-red-500 rounded-full transition-all"
                      style={{ height: `${Math.max(10, (volume * (Math.sin(i * 0.8 + Date.now() / 200) + 1) / 2))}%` }}
                    />
                  ))}
                </div>
              </div>
              <p className="text-xs text-red-500 dark:text-red-600">Recording…</p>
            </div>
            <button
              onClick={stopRecording}
              className="w-10 h-10 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center text-white transition-colors shrink-0"
              aria-label="Stop recording"
            >
              <Icon name="stop" size="sm" filled />
            </button>
          </div>
        </div>
      )}

      {state === 'recorded' && audioUrl && (
        <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
          <audio controls src={audioUrl} className="w-full" />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={transcribe}
              disabled={transcribing}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            >
              <Icon name="transcribe" size="sm" />
              {transcribing ? 'Transcribing…' : 'Transcribe'}
            </button>
            <button
              onClick={async () => { await saveAttachment(); discard(); }}
              className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            >
              <Icon name="save" size="sm" />
              Save
            </button>
            <button
              onClick={startRecording}
              className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            >
              <Icon name="fiber_manual_record" size="sm" className="text-red-500" />
              Re-record
            </button>
            <button
              onClick={discard}
              className="flex items-center gap-2 text-slate-400 hover:text-red-500 px-2 py-2 rounded-xl text-sm transition-colors"
            >
              <Icon name="delete" size="sm" />
            </button>
          </div>
        </div>
      )}

      {/* Upload existing audio */}
      <div className="text-center">
        <label className="text-xs text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer flex items-center justify-center gap-1">
          <Icon name="upload_file" size="xs" />
          Upload existing audio file to transcribe
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setTranscribing(true);
              try {
                const formData = new FormData();
                formData.append('audio', file);
                const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
                const data = await res.json();
                if (data.text) onTranscription(data.text);
                else throw new Error(data.error || 'No transcription returned');
              } catch (err) {
                alert(`Transcription failed: ${err.message}`);
              } finally {
                setTranscribing(false);
                e.target.value = '';
              }
            }}
          />
        </label>
      </div>
    </div>
  );
}
