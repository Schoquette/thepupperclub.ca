import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';

const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  headers: { 'Accept': 'application/json' },
  withCredentials: false,
});

export default function SigningPage() {
  const { token } = useParams<{ token: string }>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [mode, setMode] = useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = useState('');
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['signing', token],
    queryFn: () => publicApi.get(`/api/signing/${token}`).then(r => r.data.data),
    retry: false,
  });

  // Canvas drawing setup
  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
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
    setHasSignature(true);
  };

  const endDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // Render typed name onto canvas when mode is 'type'
  const renderTypedSignature = useCallback(() => {
    if (mode !== 'type') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!typedName.trim()) { setHasSignature(false); return; }
    ctx.font = 'italic 42px Georgia, serif';
    ctx.fillStyle = '#3B2F2A';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(typedName, canvas.width / 2, canvas.height / 2);
    setHasSignature(true);
  }, [mode, typedName]);

  useEffect(() => { renderTypedSignature(); }, [renderTypedSignature]);

  const getSignatureData = (): string => {
    return canvasRef.current?.toDataURL('image/png') ?? '';
  };

  const submit = useMutation({
    mutationFn: () =>
      publicApi.post(`/api/signing/${token}/sign`, {
        signer_name:    signerName.trim(),
        signature_data: getSignatureData(),
      }),
    onSuccess: () => setSigned(true),
    onError: (err: any) => {
      setError(err.response?.data?.message ?? 'Something went wrong. Please try again.');
    },
  });

  // ── States ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <p className="text-taupe">Loading document…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-display text-espresso mb-2">Link Not Found</h2>
          <p className="text-taupe text-sm">This signing link is invalid, expired, or has already been used.</p>
        </div>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-display text-espresso mb-2">Document Signed!</h2>
          <p className="text-taupe text-sm">
            Thank you, {signerName}. Your signature has been recorded and a certificate has been generated.
          </p>
          <p className="text-taupe text-xs mt-4">You can close this window.</p>
        </div>
      </div>
    );
  }

  const canSubmit = signerName.trim() && hasSignature && agreed;
  const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
  const docUrl  = `${apiBase}/api/signing/${token}/document`;

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="bg-white border-b border-cream px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <span className="text-2xl">🐾</span>
          <div>
            <div className="font-display text-espresso text-sm tracking-wide">THE PUPPER CLUB</div>
            <div className="text-xs text-taupe">Document Signing</div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Document info */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h1 className="font-display text-espresso text-xl mb-1">Please Review & Sign</h1>
          <p className="text-taupe text-sm">{data?.filename}</p>
        </div>

        {/* PDF viewer */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-cream">
            <p className="text-xs text-taupe font-medium uppercase tracking-wide">Document Preview</p>
          </div>
          <iframe
            src={docUrl}
            className="w-full"
            style={{ height: 500 }}
            title="Document to sign"
          />
        </div>

        {/* Signature pad */}
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
          <h2 className="font-display text-espresso text-base">Your Signature</h2>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-espresso mb-1">Full Name *</label>
            <input
              type="text"
              value={signerName}
              onChange={e => setSignerName(e.target.value)}
              placeholder="Type your full name"
              className="w-full border border-taupe/30 rounded-lg px-3 py-2 text-sm text-espresso focus:outline-none focus:ring-2 focus:ring-gold/40"
            />
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2">
            {(['draw', 'type'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); clearCanvas(); }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors capitalize ${
                  mode === m
                    ? 'bg-espresso text-cream border-espresso'
                    : 'border-taupe text-espresso hover:bg-cream'
                }`}
              >
                {m === 'draw' ? 'Draw' : 'Type'}
              </button>
            ))}
          </div>

          {/* Canvas */}
          <div className="relative border-2 border-dashed border-taupe/40 rounded-xl bg-cream/30" style={{ touchAction: 'none' }}>
            {mode === 'type' && (
              <input
                type="text"
                value={typedName}
                onChange={e => setTypedName(e.target.value)}
                placeholder="Type your signature name"
                className="absolute inset-x-0 top-2 mx-4 border border-taupe/30 rounded-lg px-3 py-1.5 text-sm bg-white/80 focus:outline-none z-10"
              />
            )}
            <canvas
              ref={canvasRef}
              width={600}
              height={160}
              className="w-full rounded-xl cursor-crosshair"
              style={{ display: 'block', userSelect: 'none' }}
              onMouseDown={mode === 'draw' ? startDraw : undefined}
              onMouseMove={mode === 'draw' ? draw : undefined}
              onMouseUp={mode === 'draw' ? endDraw : undefined}
              onMouseLeave={mode === 'draw' ? endDraw : undefined}
              onTouchStart={mode === 'draw' ? startDraw : undefined}
              onTouchMove={mode === 'draw' ? draw : undefined}
              onTouchEnd={mode === 'draw' ? endDraw : undefined}
            />
            {mode === 'draw' && !hasSignature && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-taupe/40 text-sm">Draw your signature here</p>
              </div>
            )}
          </div>

          {hasSignature && (
            <button
              onClick={clearCanvas}
              className="text-sm text-taupe hover:text-espresso underline"
            >
              Clear signature
            </button>
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
              I have read the document above and agree to its terms. I understand that my electronic signature is legally binding.
            </span>
          </label>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            disabled={!canSubmit || submit.isPending}
            onClick={() => submit.mutate()}
            className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${
              canSubmit && !submit.isPending
                ? 'bg-espresso text-cream hover:bg-espresso/90'
                : 'bg-taupe/20 text-taupe cursor-not-allowed'
            }`}
          >
            {submit.isPending ? 'Submitting…' : 'Sign Document'}
          </button>
        </div>

        <p className="text-center text-xs text-taupe pb-8">
          Secured by The Pupper Club · Signature certificate generated upon submission
        </p>
      </div>
    </div>
  );
}
