import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { X, ChevronDown } from 'lucide-react';

const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  headers: { 'Accept': 'application/json' },
  withCredentials: false,
});

interface TemplateField {
  id: number;
  label: string;
  field_type: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  value: string;
}

export default function SigningPage() {
  const { token } = useParams<{ token: string }>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signSectionRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [mode, setMode] = useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = useState('');
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [showSignPanel, setShowSignPanel] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['signing', token],
    queryFn: () => publicApi.get(`/api/signing/${token}`).then(r => r.data.data),
    retry: false,
  });

  const hasFields = data?.has_fields && data?.fields?.length > 0;
  const fields: TemplateField[] = data?.fields ?? [];

  useEffect(() => {
    if (data?.field_values) {
      setFieldValues(data.field_values);
    } else if (fields.length > 0) {
      const initial: Record<string, string> = {};
      fields.forEach(f => { initial[f.id] = f.value || ''; });
      setFieldValues(initial);
    }
  }, [data]);

  useEffect(() => {
    if (hasFields && !signerName) {
      const nameField = fields.find(f => f.field_type === 'name');
      if (nameField && fieldValues[nameField.id]) {
        setSignerName(fieldValues[nameField.id]);
      }
    }
  }, [fieldValues, hasFields]);

  // Canvas drawing
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

  const updateFieldValue = (fieldId: number | string, value: string) => {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }));
  };

  const submit = useMutation({
    mutationFn: () =>
      publicApi.post(`/api/signing/${token}/sign`, {
        signer_name:    signerName.trim(),
        signature_data: getSignatureData(),
        field_values:   hasFields ? fieldValues : undefined,
      }),
    onSuccess: () => setSigned(true),
    onError: (err: any) => {
      setError(err.response?.data?.message ?? 'Something went wrong. Please try again.');
    },
  });

  const requiredFieldsFilled = !hasFields || fields
    .filter(f => f.required && f.field_type !== 'signature')
    .every(f => {
      const val = fieldValues[f.id];
      if (f.field_type === 'checkbox') return val === 'true' || val === '1';
      return val && val.trim().length > 0;
    });

  const handleContinueToSign = () => {
    setShowSignPanel(true);
    setTimeout(() => signSectionRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  // ── States ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <p className="text-taupe">Loading document...</p>
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
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 className="text-2xl font-display text-espresso mb-2">
            {data?.is_countersign ? 'Document Counter-Signed!' : 'Document Signed!'}
          </h2>
          <p className="text-taupe text-sm">
            {data?.is_countersign
              ? `Thank you, ${signerName}. Your counter-signature has been recorded and the document is now complete.`
              : `Thank you, ${signerName}. Your signature has been recorded.${data?.signer_role === 'client' ? '' : ''}`}
          </p>
          <p className="text-taupe text-xs mt-4">You can close this window.</p>
        </div>
      </div>
    );
  }

  const canSubmit = signerName.trim() && hasSignature && agreed && requiredFieldsFilled;
  const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
  const docUrl  = `${apiBase}/api/signing/${token}/document`;

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
        <div className="text-sm text-cream/80">{data?.filename}</div>
      </div>

      {/* Action banner */}
      <div className="bg-gold/90 px-4 py-2.5 flex items-center justify-between flex-shrink-0">
        <p className="text-sm font-medium text-espresso">
          {data?.is_countersign
            ? 'The client has signed. Please review and counter-sign below.'
            : 'Please review this document, then sign below.'}
        </p>
        {!showSignPanel && (
          <button
            onClick={handleContinueToSign}
            className="bg-blue text-cream text-sm font-semibold px-5 py-1.5 rounded-lg hover:bg-blue/90 transition-colors flex items-center gap-1.5"
          >
            Continue to Sign <ChevronDown className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* PDF viewer — fills available space */}
      <div className="flex-1 flex items-stretch">
        <iframe
          src={docUrl}
          className="w-full border-0"
          style={{ minHeight: 'calc(100vh - 200px)' }}
          title="Document to sign"
        />
      </div>

      {/* Sign panel — slides in from bottom */}
      {showSignPanel && (
        <div className="fixed inset-0 z-50 flex flex-col">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowSignPanel(false)}
          />

          {/* Panel */}
          <div className="relative mt-auto bg-white rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto animate-slide-up">
            {/* Panel header */}
            <div className="sticky top-0 bg-white border-b border-cream px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="font-display text-espresso text-lg">Sign Document</h2>
              <button
                onClick={() => setShowSignPanel(false)}
                className="p-1.5 rounded-full hover:bg-cream transition-colors text-taupe hover:text-espresso"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div ref={signSectionRef} className="px-6 py-6 max-w-2xl mx-auto space-y-6">
              {/* Template form fields */}
              {hasFields && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-espresso uppercase tracking-wide">Required Information</h3>
                  {fields
                    .filter(f => f.field_type !== 'signature')
                    .sort((a, b) => (a as any).sort_order - (b as any).sort_order)
                    .map(field => (
                      <div key={field.id}>
                        <label className="block text-sm font-medium text-espresso mb-1">
                          {field.label} {field.required && <span className="text-red-400">*</span>}
                        </label>
                        {field.field_type === 'checkbox' ? (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={fieldValues[field.id] === 'true' || fieldValues[field.id] === '1'}
                              onChange={e => updateFieldValue(field.id, e.target.checked ? 'true' : 'false')}
                              className="h-4 w-4 rounded border-taupe text-gold focus:ring-gold"
                            />
                            <span className="text-sm text-espresso">{field.label}</span>
                          </label>
                        ) : field.field_type === 'date' ? (
                          <input
                            type="date"
                            value={fieldValues[field.id] || ''}
                            onChange={e => updateFieldValue(field.id, e.target.value)}
                            className="w-full border border-taupe/30 rounded-lg px-3 py-2 text-sm text-espresso focus:outline-none focus:ring-2 focus:ring-gold/40"
                          />
                        ) : field.field_type === 'open_text' ? (
                          <textarea
                            value={fieldValues[field.id] || ''}
                            onChange={e => updateFieldValue(field.id, e.target.value)}
                            rows={3}
                            className="w-full border border-taupe/30 rounded-lg px-3 py-2 text-sm text-espresso focus:outline-none focus:ring-2 focus:ring-gold/40"
                            placeholder={`Enter ${field.label.toLowerCase()}...`}
                          />
                        ) : (
                          <input
                            type="text"
                            value={fieldValues[field.id] || ''}
                            onChange={e => updateFieldValue(field.id, e.target.value)}
                            className="w-full border border-taupe/30 rounded-lg px-3 py-2 text-sm text-espresso focus:outline-none focus:ring-2 focus:ring-gold/40"
                            placeholder={`Enter ${field.label.toLowerCase()}...`}
                          />
                        )}
                      </div>
                    ))}
                  <div className="border-b border-cream" />
                </div>
              )}

              {/* Full Name */}
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

              {/* Signature mode toggle */}
              <div>
                <label className="block text-sm font-medium text-espresso mb-2">Signature *</label>
                <div className="flex gap-2 mb-3">
                  {(['draw', 'type'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => { setMode(m); clearCanvas(); }}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        mode === m
                          ? 'bg-blue text-cream border-blue'
                          : 'border-taupe/40 text-espresso hover:bg-cream'
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
                    className="text-sm text-taupe hover:text-espresso underline mt-2"
                  >
                    Clear signature
                  </button>
                )}
              </div>

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
                className={`w-full py-3.5 rounded-xl text-sm font-semibold transition-colors ${
                  canSubmit && !submit.isPending
                    ? 'bg-gold text-espresso hover:bg-gold/90 shadow-lg'
                    : 'bg-taupe/20 text-taupe cursor-not-allowed'
                }`}
              >
                {submit.isPending ? 'Submitting...' : 'Sign Document'}
              </button>

              <p className="text-center text-xs text-taupe pb-2">
                Secured by The Pupper Club · Signature certificate generated upon submission
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Fixed bottom bar when sign panel is closed */}
      {!showSignPanel && (
        <div className="sticky bottom-0 bg-white border-t border-cream px-6 py-4 flex items-center justify-between flex-shrink-0">
          <p className="text-sm text-taupe hidden sm:block">
            Review the document above, then click to sign.
          </p>
          <button
            onClick={handleContinueToSign}
            className="bg-gold text-espresso text-sm font-semibold px-8 py-3 rounded-xl hover:bg-gold/90 transition-colors shadow-lg w-full sm:w-auto"
          >
            Continue to Sign
          </button>
        </div>
      )}

      {/* Animation */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
