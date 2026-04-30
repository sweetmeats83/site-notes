import { useRef, useState, useEffect, useCallback } from 'react';
import { attachmentsApi } from '../../api/attachments.js';
import Icon from '../common/Icon.jsx';

const COLORS  = ['#000000','#DC2626','#2563EB','#16A34A','#D97706','#9333EA','#FFFFFF'];
const WIDTHS   = [2, 5, 12];
const WIDTH_LABELS = ['Thin', 'Medium', 'Thick'];

export default function DrawingCanvas({ noteId, onSaved }) {
  const canvasRef = useRef(null);
  const [color,   setColor]   = useState(COLORS[0]);
  const [width,   setWidth]   = useState(WIDTHS[1]);
  const [history, setHistory] = useState([]); // array of ImageData snapshots
  const [saving,  setSaving]  = useState(false);
  const drawing   = useRef(false);
  const lastPos   = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const src  = e.touches ? e.touches[0] : e;
    const scaleX = canvasRef.current.width  / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top)  * scaleY,
    };
  };

  const snapshot = () => {
    const canvas = canvasRef.current;
    return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  };

  const startDraw = useCallback((e) => {
    e.preventDefault();
    drawing.current = true;
    lastPos.current = getPos(e);
    setHistory(h => [...h.slice(-30), snapshot()]); // keep last 30 states
  }, []);

  const draw = useCallback((e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const pos = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = color;
    ctx.lineWidth   = width;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.stroke();
    lastPos.current = pos;
  }, [color, width]);

  const endDraw = useCallback((e) => {
    e?.preventDefault();
    drawing.current = false;
  }, []);

  const undo = () => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    canvasRef.current.getContext('2d').putImageData(prev, 0, 0);
    setHistory(h => h.slice(0, -1));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHistory([]);
  };

  const save = async () => {
    setSaving(true);
    try {
      const blob = await new Promise(res => canvasRef.current.toBlob(res, 'image/png'));
      const file = new File([blob], `drawing-${Date.now()}.png`, { type: 'image/png' });
      const att  = await attachmentsApi.upload(noteId, file);
      onSaved(att);
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Colors */}
        <div className="flex items-center gap-1.5">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center"
              style={{
                backgroundColor: c,
                borderColor: color === c ? '#2563EB' : '#e2e8f0',
                boxShadow: color === c ? '0 0 0 2px rgba(37,99,235,0.4)' : 'none',
              }}
              title={c}
            >
              {color === c && <Icon name="check" size="xs" style={{ color: c === '#FFFFFF' ? '#000' : '#fff' }} />}
            </button>
          ))}
        </div>

        {/* Widths */}
        <div className="flex items-center gap-1.5">
          {WIDTHS.map((w, i) => (
            <button
              key={w}
              onClick={() => setWidth(w)}
              title={WIDTH_LABELS[i]}
              className={`rounded-full bg-slate-800 dark:bg-slate-200 transition-all ${width === w ? 'ring-2 ring-blue-500' : 'opacity-40 hover:opacity-70'}`}
              style={{ width: Math.max(12, w * 2), height: Math.max(12, w * 2) }}
            />
          ))}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <button onClick={undo} title="Undo" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
            <Icon name="undo" size="sm" />
          </button>
          <button onClick={clear} title="Clear" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
            <Icon name="delete_sweep" size="sm" />
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-2 rounded-xl text-sm font-semibold transition-colors"
          >
            <Icon name="save" size="sm" />
            {saving ? 'Saving…' : 'Save as Attachment'}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={800}
        height={450}
        className="drawing-canvas w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white"
        style={{ touchAction: 'none' }}
        onPointerDown={startDraw}
        onPointerMove={draw}
        onPointerUp={endDraw}
        onPointerLeave={endDraw}
      />
    </div>
  );
}
