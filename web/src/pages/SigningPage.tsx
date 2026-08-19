import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { X, Pen, Type, ChevronDown } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  headers: { 'Accept': 'application/json' },
  withCredentials: false,
});

interface TemplateField {
  id: number;
  label: string;
  field_type: string;
  assigned_to: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  sort_order: number;
  default_value: string;
  value: string;
}

// ── Inline Signature Modal ────────────────────────────────────────────────────

function InlineSignatureModal({
  onAdopt,
  onClose,
  defaultName,
}: {
  onAdopt: (dataUrl: string) => void;
  onClose: () => void;
  defaultName: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = useState(defaultName);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const { x, y } = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.strokeStyle = '#3B2F2A';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const { x, y } = getPos(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasContent(true);
  };

  const endDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
  };

  useEffect(() => {
    if (mode !== 'type') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!typedName.trim()) { setHasContent(false); return; }
    ctx.font = 'italic 44px Georgia, serif';
    ctx.fillStyle = '#3B2F2A';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(typedName, canvas.width / 2, canvas.height / 2);
    setHasContent(true);
  }, [mode, typedName]);

  // Switch mode resets canvas
  const switchMode = (m: 'draw' | 'type') => {
    clearCanvas();
    setMode(m);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md">
        {/* Header */}
        <div className="px-5 py-4 border-b border-cream flex items-center justify-between">
          <h2 className="font-display text-espresso text-lg">Create Your Signature</h2>
          <button onClick={onClose} className="text-taupe hover:text-espresso p-1 rounded-full hover:bg-cream transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Draw / Type tabs */}
          <div className="flex gap-2">
            {(['draw', 'type'] as const).map(m => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  mode === m
                    ? 'bg-blue text-cream border-blue'
                    : 'border-taupe/40 text-espresso hover:bg-cream'
                }`}
              >
                {m === 'draw' ? <Pen className="w-3.5 h-3.5" /> : <Type className="w-3.5 h-3.5" />}
                {m === 'draw' ? 'Draw' : 'Type'}
              </button>
            ))}
          </div>

          {mode === 'type' && (
            <input
              type="text"
              value={typedName}
              onChange={e => setTypedName(e.target.value)}
              placeholder="Type your name"
              autoFocus
              className="w-full border border-taupe/30 rounded-lg px-3 py-2.5 text-sm text-espresso focus:outline-none focus:ring-2 focus:ring-gold/40"
            />
          )}

          {/* Canvas */}
          <div
            className="relative border-2 border-dashed border-taupe/30 rounded-xl overflow-hidden bg-cream/20"
            style={{ touchAction: 'none' }}
          >
            <canvas
              ref={canvasRef}
              width={500}
              height={150}
              className="w-full cursor-crosshair block"
              style={{ userSelect: 'none' }}
              onMouseDown={mode === 'draw' ? startDraw : undefined}
              onMouseMove={mode === 'draw' ? draw : undefined}
              onMouseUp={mode === 'draw' ? endDraw : undefined}
              onMouseLeave={mode === 'draw' ? endDraw : undefined}
              onTouchStart={mode === 'draw' ? startDraw : undefined}
              onTouchMove={mode === 'draw' ? draw : undefined}
              onTouchEnd={mode === 'draw' ? endDraw : undefined}
            />
            {mode === 'draw' && !hasContent && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-taupe/50 text-sm select-none">Draw your signature here</p>
              </div>
            )}
          </div>

          {mode === 'draw' && hasContent && (
            <button onClick={clearCanvas} className="text-sm text-taupe hover:text-espresso underline">
              Clear and redraw
            </button>
          )}

          {/* Adopt button */}
          <button
            disabled={!hasContent}
            onClick={() => {
              const canvas = canvasRef.current;
              if (canvas) onAdopt(canvas.toDataURL('image/png'));
            }}
            className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${
              hasContent
                ? 'bg-gold text-espresso hover:bg-gold/90 shadow-md'
                : 'bg-taupe/20 text-taupe cursor-not-allowed'
            }`}
          >
            Adopt Signature
          </button>

          <p className="text-center text-xs text-taupe leading-relaxed pb-1">
            By clicking "Adopt Signature," I agree that this is my electronic signature.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main Signing Page ─────────────────────────────────────────────────────────

export default function SigningPage() {
  const { token } = useParams<{ token: string }>();
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  // PDF
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageWidth, setPageWidth] = useState(700);

  // Field state
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [inlineSignatures, setInlineSignatures] = useState<Record<number, string>>({});
  const [signatureModalField, setSignatureModalField] = useState<TemplateField | null>(null);
  const [focusedField, setFocusedField] = useState<number | null>(null);

  // Signer info
  const [signerName, setSignerName] = useState('');
  const [agreed, setAgreed] = useState(false);

  // Fallback canvas (used only when no signature field exists in the template)
  const fallbackCanvasRef = useRef<HTMLCanvasElement>(null);
  const [fallbackIsDrawing, setFallbackIsDrawing] = useState(false);
  const [fallbackHasSignature, setFallbackHasSignature] = useState(false);
  const [fallbackMode, setFallbackMode] = useState<'draw' | 'type'>('draw');
  const [fallbackTypedName, setFallbackTypedName] = useState('');

  // UI state
  const [showFinishPanel, setShowFinishPanel] = useState(false);
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState('');

  // ── Data fetch ──────────────────────────────────────────────────────────────

  const { data, isLoading, isError, error: loadError } = useQuery({
    queryKey: ['signing', token],
    queryFn: () => publicApi.get(`/api/signing/${token}`).then(r => r.data.data),
    retry: false,
  });

  const fields: TemplateField[] = data?.fields ?? [];
  const hasFields = data?.has_fields && fields.length > 0;

  // Load PDF
  useEffect(() => {
    if (!token) return;
    const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
    fetch(`${apiBase}/api/signing/${token}/document`)
      .then(r => r.arrayBuffer())
      .then(buf => setPdfData(new Uint8Array(buf.slice(0))))
      .catch(() => {});
  }, [token]);

  const pdfFile = useMemo(
    () => (pdfData ? { data: pdfData.slice() } : null),
    [pdfData],
  );

  // Track container width
  useEffect(() => {
    const container = pdfContainerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) setPageWidth(entry.contentRect.width);
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [data]);

  // ── Field initialization ────────────────────────────────────────────────────

  useEffect(() => {
    if (!data) return;

    const serverValues: Record<string, string> = data.field_values ?? {};
    const today = new Date().toISOString().slice(0, 10);
    const initial: Record<string, string> = {};

    fields.forEach(f => {
      const stored = serverValues[f.id] ?? serverValues[String(f.id)] ?? '';
      if (stored) {
        initial[f.id] = stored;
      } else if (f.field_type === 'name') {
        initial[f.id] = data.client ?? '';
      } else if (f.field_type === 'date') {
        initial[f.id] = today;
      } else {
        initial[f.id] = f.value ?? '';
      }
    });

    setFieldValues(initial);

    // Derive signerName from the name field or from data.client
    const nameField = fields.find(f => f.field_type === 'name');
    const derivedName = nameField
      ? (initial[nameField.id] || data.client || '')
      : (data.client || '');
    setSignerName(derivedName);
  }, [data]); // eslint-disable-line

  // ── Fallback canvas (no template signature field) ───────────────────────────

  const fallbackGetPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const fallbackStartDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = fallbackCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const { x, y } = fallbackGetPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setFallbackIsDrawing(true);
  };

  const fallbackDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!fallbackIsDrawing) return;
    const canvas = fallbackCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.strokeStyle = '#3B2F2A';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const { x, y } = fallbackGetPos(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
    setFallbackHasSignature(true);
  };

  const fallbackEndDraw = () => setFallbackIsDrawing(false);

  const fallbackClearCanvas = () => {
    const canvas = fallbackCanvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setFallbackHasSignature(false);
  };

  const renderFallbackTyped = useCallback(() => {
    if (fallbackMode !== 'type') return;
    const canvas = fallbackCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!fallbackTypedName.trim()) { setFallbackHasSignature(false); return; }
    ctx.font = 'italic 42px Georgia, serif';
    ctx.fillStyle = '#3B2F2A';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fallbackTypedName, canvas.width / 2, canvas.height / 2);
    setFallbackHasSignature(true);
  }, [fallbackMode, fallbackTypedName]);

  useEffect(() => { renderFallbackTyped(); }, [renderFallbackTyped]);

  // ── Derived state ───────────────────────────────────────────────────────────

  const hasSignatureField = fields.some(f => f.field_type === 'signature');
  const hasNameField = fields.some(f => f.field_type === 'name');

  // All signature-type fields must have an inline signature placed
  const allSignaturesPlaced = !hasSignatureField || fields
    .filter(f => f.field_type === 'signature')
    .every(f => !!inlineSignatures[f.id]);

  // Required non-signature fields must be filled
  const requiredFieldsFilled = !hasFields || fields
    .filter(f => f.required && f.field_type !== 'signature')
    .every(f => {
      const val = fieldValues[f.id];
      if (f.field_type === 'checkbox') return val === 'true' || val === '1';
      return val && val.trim().length > 0;
    });

  const totalRequired = fields.filter(f => f.required && f.field_type !== 'signature').length;
  const filledRequired = fields.filter(f => {
    if (!f.required || f.field_type === 'signature') return false;
    const val = fieldValues[f.id];
    if (f.field_type === 'checkbox') return val === 'true' || val === '1';
    return val && val.trim().length > 0;
  }).length;

  // Fallback signature required only when template has no signature fields
  const fallbackSignatureOk = hasSignatureField || fallbackHasSignature;

  const canFinish = signerName.trim() && agreed && requiredFieldsFilled && allSignaturesPlaced && fallbackSignatureOk;

  // ── Field helpers ───────────────────────────────────────────────────────────

  const updateFieldValue = (fieldId: number | string, value: string) => {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }));
  };

  const scrollToNextField = () => {
    const next = fields.find(f => {
      if (f.field_type === 'signature') return !inlineSignatures[f.id];
      if (!f.required) return false;
      const val = fieldValues[f.id];
      if (f.field_type === 'checkbox') return val !== 'true' && val !== '1';
      return !val || !val.trim();
    });
    if (next) {
      const el = document.getElementById(`field-overlay-${next.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setFocusedField(next.id);
        setTimeout(() => {
          const input = el.querySelector('input, textarea') as HTMLElement;
          input?.focus();
        }, 400);
        if (next.field_type === 'signature') {
          setTimeout(() => setSignatureModalField(next), 500);
        }
      }
    } else {
      setShowFinishPanel(true);
    }
  };

  const handleFieldKeyDown = (e: React.KeyboardEvent, fieldId: number) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const currentIdx = fields.findIndex(f => f.id === fieldId);
      const next = fields.slice(currentIdx + 1).find(f => f.field_type !== 'signature');
      if (next) {
        const el = document.getElementById(`field-overlay-${next.id}`);
        const input = el?.querySelector('input, textarea') as HTMLElement;
        input?.focus();
      }
    }
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

  const getSubmitSignatureData = (): string => {
    // Prefer the first inline signature field
    const sigField = fields.find(f => f.field_type === 'signature');
    if (sigField && inlineSignatures[sigField.id]) {
      const dataUrl = inlineSignatures[sigField.id];
      return dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    }
    // Fallback canvas
    const dataUrl = fallbackCanvasRef.current?.toDataURL('image/png') ?? '';
    return dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  };

  const submit = useMutation({
    mutationFn: () =>
      publicApi.post(`/api/signing/${token}/sign`, {
        signer_name:    signerName.trim(),
        signature_data: getSubmitSignatureData(),
        field_values:   hasFields ? fieldValues : undefined,
      }),
    onSuccess: () => setSigned(true),
    onError: (err: any) => {
      setError(err.response?.data?.message ?? 'Something went wrong. Please try again.');
    },
  });

  // ── Field overlay renderer ──────────────────────────────────────────────────

  const renderFieldOverlay = (field: TemplateField) => {
    const val = fieldValues[field.id] ?? '';
    const isFocused = focusedField === field.id;
    const isEmpty = field.field_type === 'checkbox'
      ? (val !== 'true' && val !== '1')
      : field.field_type === 'signature'
        ? !inlineSignatures[field.id]
        : !val.trim();
    const isRequiredEmpty = isEmpty && field.required;

    const style: React.CSSProperties = {
      position: 'absolute',
      left: `${field.x}%`,
      top: `${field.y}%`,
      width: `${field.width}%`,
      height: `${field.height}%`,
      zIndex: 10,
    };

    // ── Signature field ──
    if (field.field_type === 'signature') {
      const sigPng = inlineSignatures[field.id];
      return (
        <div key={field.id} id={`field-overlay-${field.id}`} style={style}>
          {sigPng ? (
            <button
              onClick={() => setSignatureModalField(field)}
              className="w-full h-full rounded overflow-hidden bg-white/95 transition-opacity hover:opacity-90"
              style={{ border: '1.5px solid #C8BFB6', padding: '2px' }}
              title="Click to change signature"
            >
              <img src={sigPng} className="w-full h-full object-contain" alt="Signature" />
            </button>
          ) : (
            <button
              onClick={() => setSignatureModalField(field)}
              className="w-full h-full rounded border-2 border-dashed flex flex-col items-center justify-center gap-0.5 transition-colors hover:bg-gold/20"
              style={{
                borderColor: '#C9A24D',
                backgroundColor: 'rgba(201,162,77,0.1)',
                color: '#C9A24D',
              }}
            >
              <Pen className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="text-[10px] font-semibold leading-tight">Click to Sign</span>
            </button>
          )}
        </div>
      );
    }

    // ── Name field — pre-filled, editable ──
    if (field.field_type === 'name') {
      const borderColor = isFocused ? '#C9A24D' : isRequiredEmpty ? '#6492D8' : '#C8BFB6';
      return (
        <div key={field.id} id={`field-overlay-${field.id}`} style={style}>
          <input
            type="text"
            value={val}
            onChange={e => {
              updateFieldValue(field.id, e.target.value);
              setSignerName(e.target.value);
            }}
            onFocus={() => setFocusedField(field.id)}
            onBlur={() => setFocusedField(null)}
            onKeyDown={e => handleFieldKeyDown(e, field.id)}
            className="w-full h-full rounded text-xs text-espresso bg-white/95 shadow-sm focus:outline-none focus:ring-2 focus:ring-gold/50 px-1.5 font-medium"
            style={{ border: `1.5px solid ${borderColor}` }}
          />
        </div>
      );
    }

    // ── Date field — read-only, auto-filled ──
    if (field.field_type === 'date') {
      const displayDate = val
        ? new Date(val + 'T00:00:00').toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
        : new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
      return (
        <div
          key={field.id}
          id={`field-overlay-${field.id}`}
          style={{ ...style, display: 'flex', alignItems: 'center' }}
        >
          <div
            className="w-full h-full flex items-center rounded text-[10px] text-espresso bg-white/90 shadow-sm px-1.5 font-medium"
            style={{ border: '1.5px solid #C8BFB6' }}
          >
            {displayDate}
          </div>
        </div>
      );
    }

    // ── Checkbox field ──
    if (field.field_type === 'checkbox') {
      const borderColor = isFocused ? '#C9A24D' : isRequiredEmpty ? '#6492D8' : '#C8BFB6';
      return (
        <div key={field.id} id={`field-overlay-${field.id}`} style={style} className="flex items-center">
          <label
            className="flex items-center gap-1.5 cursor-pointer bg-white/95 rounded px-1.5 py-0.5 shadow-sm border"
            style={{ borderColor }}
          >
            <input
              type="checkbox"
              checked={val === 'true' || val === '1'}
              onChange={e => updateFieldValue(field.id, e.target.checked ? 'true' : 'false')}
              onFocus={() => setFocusedField(field.id)}
              onBlur={() => setFocusedField(null)}
              className="h-3.5 w-3.5 rounded border-taupe text-gold focus:ring-gold"
            />
            <span className="text-[10px] text-espresso leading-tight">{field.label}</span>
          </label>
        </div>
      );
    }

    // ── Open text field ──
    if (field.field_type === 'open_text') {
      const borderColor = isFocused ? '#C9A24D' : isRequiredEmpty ? '#6492D8' : '#C8BFB6';
      return (
        <div key={field.id} id={`field-overlay-${field.id}`} style={style}>
          <textarea
            value={val}
            onChange={e => updateFieldValue(field.id, e.target.value)}
            onFocus={() => setFocusedField(field.id)}
            onBlur={() => setFocusedField(null)}
            onKeyDown={e => handleFieldKeyDown(e, field.id)}
            placeholder={field.label}
            className="w-full h-full rounded text-xs text-espresso bg-white/95 shadow-sm focus:outline-none focus:ring-2 focus:ring-gold/50 px-1.5 py-1 resize-none"
            style={{ border: `1.5px solid ${borderColor}` }}
          />
        </div>
      );
    }

    // ── Default (dog_name, etc.) ──
    const borderColor = isFocused ? '#C9A24D' : isRequiredEmpty ? '#6492D8' : '#C8BFB6';
    return (
      <div key={field.id} id={`field-overlay-${field.id}`} style={style}>
        <input
          type="text"
          value={val}
          onChange={e => updateFieldValue(field.id, e.target.value)}
          onFocus={() => setFocusedField(field.id)}
          onBlur={() => setFocusedField(null)}
          onKeyDown={e => handleFieldKeyDown(e, field.id)}
          placeholder={field.label}
          className="w-full h-full rounded text-xs text-espresso bg-white/95 shadow-sm focus:outline-none focus:ring-2 focus:ring-gold/50 px-1.5"
          style={{ border: `1.5px solid ${borderColor}` }}
        />
      </div>
    );
  };

  // ── States: loading / error / done ─────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <p className="text-taupe">Loading document...</p>
      </div>
    );
  }

  if (isError) {
    const status = (loadError as any)?.response?.status as number | undefined;
    const serverMessage = (loadError as any)?.response?.data?.message as string | undefined;
    let title = 'Link Not Found';
    let detail = 'This signing link is invalid, expired, or has already been used.';
    let emoji = '\u{1F512}';

    if (status === 410) {
      emoji = '✅';
      const lower = (serverMessage ?? '').toLowerCase();
      if (lower.includes('counter')) {
        title = 'Already Counter-Signed';
        detail = 'This document has been counter-signed and is fully executed. Nothing more to do here.';
      } else if (lower.includes('signed')) {
        title = 'Already Signed';
        detail = 'This document has already been signed. The administrator has been notified.';
      } else if (serverMessage) {
        detail = serverMessage;
      }
    } else if (status === 404) {
      title = 'Link Not Found';
      detail = 'This signing link doesn\'t match any document on file. It may have been replaced by a newer link — check your inbox for the most recent email, or reach out at sophie@thepupperclub.ca.';
    }

    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">{emoji}</div>
          <h2 className="text-xl font-display text-espresso mb-2">{title}</h2>
          <p className="text-taupe text-sm leading-relaxed">{detail}</p>
        </div>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-display text-espresso mb-2">
            {data?.is_countersign ? 'Document Counter-Signed!' : 'Document Signed!'}
          </h2>
          <p className="text-taupe text-sm">
            {data?.is_countersign
              ? `Thank you, ${signerName}. Your counter-signature has been recorded and the document is now complete.`
              : `Thank you, ${signerName}. Your signature has been recorded.`}
          </p>
          <p className="text-taupe text-xs mt-4">You can close this window.</p>
        </div>
      </div>
    );
  }

  // Progress: combine required text fields + signature fields
  const sigFieldsTotal = fields.filter(f => f.field_type === 'signature').length;
  const sigFieldsFilled = fields.filter(f => f.field_type === 'signature' && !!inlineSignatures[f.id]).length;
  const overallTotal = totalRequired + sigFieldsTotal;
  const overallFilled = filledRequired + sigFieldsFilled;

  return (
    <div className="min-h-screen bg-[#525659] flex flex-col">
      {/* Top bar */}
      <div className="bg-blue text-cream px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="The Pupper Club" className="w-7 h-7 object-contain" />
          <div>
            <div className="font-display text-sm tracking-wide">THE PUPPER CLUB</div>
            <div className="text-xs text-cream/60">
              {data?.is_countersign ? 'Counter-Signature' : 'Document Signing'}
            </div>
          </div>
        </div>
        <div className="text-sm text-cream/80 truncate ml-4">{data?.filename}</div>
      </div>

      {/* Progress banner */}
      <div className="bg-gold/90 px-4 py-2.5 flex items-center justify-between flex-shrink-0 gap-3">
        <p className="text-sm font-medium text-espresso">
          {overallTotal > 0
            ? overallFilled < overallTotal
              ? `Complete all highlighted fields (${overallFilled}/${overallTotal})`
              : 'All fields complete — click Finish to sign'
            : data?.is_countersign
              ? 'Review the document and sign below.'
              : 'Review this document, then click Finish to sign.'}
        </p>
        <button
          onClick={overallFilled < overallTotal ? scrollToNextField : () => setShowFinishPanel(true)}
          className="bg-blue text-cream text-sm font-semibold px-4 py-1.5 rounded-lg hover:bg-blue/90 transition-colors flex items-center gap-1.5 whitespace-nowrap flex-shrink-0"
        >
          {overallFilled < overallTotal
            ? <>Next <ChevronDown className="w-4 h-4" /></>
            : <>Finish <ChevronDown className="w-4 h-4" /></>}
        </button>
      </div>

      {/* PDF viewer with overlays */}
      <div className="flex-1 overflow-y-auto bg-[#525659]" ref={pdfContainerRef}>
        <div className="max-w-4xl mx-auto py-4 px-2">
          {pdfFile ? (
            <Document
              file={pdfFile}
              onLoadSuccess={({ numPages: n }) => setNumPages(n)}
              loading={<div className="text-center py-20 text-cream/60">Loading PDF...</div>}
              error={<div className="text-center py-20 text-red-400">Failed to load PDF</div>}
            >
              {Array.from({ length: numPages }, (_, i) => (
                <div key={i} className="relative mb-4 shadow-lg">
                  <Page
                    pageNumber={i + 1}
                    width={pageWidth > 900 ? 880 : pageWidth - 16}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                  {fields
                    .filter(f => (f.page || 1) === i + 1)
                    .map(field => renderFieldOverlay(field))}
                </div>
              ))}
            </Document>
          ) : (
            <div className="text-center py-20 text-cream/60">Loading document...</div>
          )}
        </div>
      </div>

      {/* Bottom Finish button bar */}
      {!showFinishPanel && (
        <div className="sticky bottom-0 bg-white border-t border-cream px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="text-sm text-taupe hidden sm:block">
            {overallFilled < overallTotal
              ? `${overallFilled} of ${overallTotal} fields completed`
              : 'All fields complete — ready to finish.'}
          </div>
          <button
            onClick={overallFilled < overallTotal ? scrollToNextField : () => setShowFinishPanel(true)}
            className="bg-gold text-espresso text-sm font-semibold px-8 py-3 rounded-xl hover:bg-gold/90 transition-colors shadow-lg w-full sm:w-auto"
          >
            {overallFilled < overallTotal ? 'Next Field' : 'Finish & Sign'}
          </button>
        </div>
      )}

      {/* Inline Signature Modal */}
      {signatureModalField && (
        <InlineSignatureModal
          defaultName={signerName}
          onClose={() => setSignatureModalField(null)}
          onAdopt={dataUrl => {
            if (!signatureModalField) return;
            setInlineSignatures(prev => ({ ...prev, [signatureModalField.id]: dataUrl }));
            updateFieldValue(signatureModalField.id, dataUrl);
            setSignatureModalField(null);
          }}
        />
      )}

      {/* Finish Panel */}
      {showFinishPanel && (
        <div className="fixed inset-0 z-40 flex flex-col">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowFinishPanel(false)}
          />
          <div className="relative mt-auto bg-white rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto animate-slide-up">
            <div className="sticky top-0 bg-white border-b border-cream px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="font-display text-espresso text-lg">Finish Signing</h2>
              <button
                onClick={() => setShowFinishPanel(false)}
                className="p-1.5 rounded-full hover:bg-cream transition-colors text-taupe hover:text-espresso"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-6 max-w-2xl mx-auto space-y-5">
              {/* Incomplete fields warning */}
              {(overallFilled < overallTotal) && (
                <div className="bg-gold/10 border border-gold/30 rounded-lg px-4 py-3 text-sm text-espresso">
                  <strong>{overallTotal - overallFilled} field{overallTotal - overallFilled !== 1 ? 's' : ''} still need{overallTotal - overallFilled === 1 ? 's' : ''} to be completed.</strong>
                  <button
                    onClick={() => { setShowFinishPanel(false); scrollToNextField(); }}
                    className="block mt-1.5 text-blue font-semibold hover:underline text-sm"
                  >
                    Go to next field
                  </button>
                </div>
              )}

              {/* Signer name — shown if no name field exists on doc, or always for clarity */}
              {!hasNameField && (
                <div>
                  <label className="block text-sm font-medium text-espresso mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={signerName}
                    onChange={e => setSignerName(e.target.value)}
                    placeholder="Type your full legal name"
                    className="w-full border border-taupe/30 rounded-lg px-3 py-2.5 text-sm text-espresso focus:outline-none focus:ring-2 focus:ring-gold/40"
                  />
                </div>
              )}

              {/* Signer name summary (when pre-filled from doc name field) */}
              {hasNameField && signerName && (
                <div className="bg-cream/60 rounded-lg px-4 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue/20 flex items-center justify-center text-blue font-bold text-sm flex-shrink-0">
                    {signerName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs text-taupe">Signing as</div>
                    <div className="text-sm font-semibold text-espresso">{signerName}</div>
                  </div>
                </div>
              )}

              {/* Signature summary — if placed inline */}
              {hasSignatureField && (
                <div>
                  <div className="text-sm font-medium text-espresso mb-2">Signature</div>
                  {allSignaturesPlaced ? (
                    <div className="flex flex-wrap gap-3">
                      {fields.filter(f => f.field_type === 'signature').map(f => (
                        inlineSignatures[f.id] && (
                          <div key={f.id} className="border border-cream rounded-xl overflow-hidden bg-cream/30 flex flex-col items-center p-2 gap-1">
                            <img src={inlineSignatures[f.id]} className="h-12 object-contain" alt={f.label} />
                            <span className="text-[10px] text-taupe">{f.label}</span>
                          </div>
                        )
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gold/10 border border-gold/30 rounded-lg px-3 py-2.5 text-sm text-espresso">
                      Please click all <strong>signature fields</strong> in the document to place your signature.
                      <button
                        onClick={() => {
                          setShowFinishPanel(false);
                          const unsigned = fields.find(f => f.field_type === 'signature' && !inlineSignatures[f.id]);
                          if (unsigned) {
                            const el = document.getElementById(`field-overlay-${unsigned.id}`);
                            if (el) {
                              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              setTimeout(() => setSignatureModalField(unsigned), 500);
                            }
                          }
                        }}
                        className="block mt-1.5 text-blue font-semibold hover:underline"
                      >
                        Go to signature field
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Fallback signature canvas (only when template has no signature field) */}
              {!hasSignatureField && (
                <div>
                  <label className="block text-sm font-medium text-espresso mb-2">Signature *</label>
                  <div className="flex gap-2 mb-3">
                    {(['draw', 'type'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => { setFallbackMode(m); fallbackClearCanvas(); }}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                          fallbackMode === m
                            ? 'bg-blue text-cream border-blue'
                            : 'border-taupe/40 text-espresso hover:bg-cream'
                        }`}
                      >
                        {m === 'draw' ? 'Draw' : 'Type'}
                      </button>
                    ))}
                  </div>
                  {fallbackMode === 'type' && (
                    <input
                      type="text"
                      value={fallbackTypedName}
                      onChange={e => setFallbackTypedName(e.target.value)}
                      placeholder="Type your signature name"
                      className="w-full border border-taupe/30 rounded-lg px-3 py-1.5 text-sm mb-3 bg-white focus:outline-none focus:ring-2 focus:ring-gold/40"
                    />
                  )}
                  <div
                    className="relative border-2 border-dashed border-taupe/40 rounded-xl bg-cream/30"
                    style={{ touchAction: 'none' }}
                  >
                    <canvas
                      ref={fallbackCanvasRef}
                      width={600}
                      height={160}
                      className="w-full rounded-xl cursor-crosshair block"
                      style={{ userSelect: 'none' }}
                      onMouseDown={fallbackMode === 'draw' ? fallbackStartDraw : undefined}
                      onMouseMove={fallbackMode === 'draw' ? fallbackDraw : undefined}
                      onMouseUp={fallbackMode === 'draw' ? fallbackEndDraw : undefined}
                      onMouseLeave={fallbackMode === 'draw' ? fallbackEndDraw : undefined}
                      onTouchStart={fallbackMode === 'draw' ? fallbackStartDraw : undefined}
                      onTouchMove={fallbackMode === 'draw' ? fallbackDraw : undefined}
                      onTouchEnd={fallbackMode === 'draw' ? fallbackEndDraw : undefined}
                    />
                    {fallbackMode === 'draw' && !fallbackHasSignature && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <p className="text-taupe/40 text-sm">Draw your signature here</p>
                      </div>
                    )}
                  </div>
                  {fallbackHasSignature && (
                    <button onClick={fallbackClearCanvas} className="text-sm text-taupe hover:text-espresso underline mt-2">
                      Clear signature
                    </button>
                  )}
                </div>
              )}

              {/* Agreement */}
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                  className="h-4 w-4 mt-0.5 rounded border-taupe text-gold focus:ring-gold flex-shrink-0"
                />
                <span className="text-sm text-espresso">
                  I have read and reviewed the document above and agree to its terms. I understand that my electronic signature is legally binding.
                </span>
              </label>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                disabled={!canFinish || submit.isPending}
                onClick={() => submit.mutate()}
                className={`w-full py-3.5 rounded-xl text-sm font-semibold transition-colors ${
                  canFinish && !submit.isPending
                    ? 'bg-gold text-espresso hover:bg-gold/90 shadow-lg'
                    : 'bg-taupe/20 text-taupe cursor-not-allowed'
                }`}
              >
                {submit.isPending ? 'Submitting...' : 'Sign Document'}
              </button>

              <p className="text-center text-xs text-taupe pb-2">Secured by The Pupper Club</p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up { animation: slideUp 0.3s ease-out; }
      `}</style>
    </div>
  );
}
