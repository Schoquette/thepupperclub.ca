import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Document, Page, pdfjs } from 'react-pdf';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type AssignedTo = 'client' | 'company';

interface Field {
  id?: number;
  label: string;
  field_type: string;
  assigned_to: AssignedTo;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  sort_order: number;
  default_value: string;
}

const FIELD_TYPES = [
  { value: 'name',      label: 'Full Name',  color: '#6492D8' },
  { value: 'signature', label: 'Signature',  color: '#C9A24D' },
  { value: 'date',      label: 'Date',       color: '#C8BFB6' },
  { value: 'checkbox',  label: 'Checkbox',   color: '#3B2F2A' },
  { value: 'dog_name',  label: 'Dog Name',   color: '#8BC34A' },
  { value: 'open_text', label: 'Open Text',  color: '#9C7DBB' },
];

const ROLES: { value: AssignedTo; label: string; color: string; bg: string }[] = [
  { value: 'client',  label: 'Client',           color: '#6492D8', bg: 'bg-blue/10' },
  { value: 'company', label: 'The Pupper Club',  color: '#C9A24D', bg: 'bg-gold/10' },
];

const roleColor = (role: AssignedTo) => ROLES.find(r => r.value === role)?.color ?? '#999';
const roleLabel = (role: AssignedTo) => ROLES.find(r => r.value === role)?.label ?? role;
const fieldColor = (type: string) => FIELD_TYPES.find(f => f.value === type)?.color ?? '#999';
const fieldLabel = (type: string) => FIELD_TYPES.find(f => f.value === type)?.label ?? type;

type DragState = {
  idx: number;
  mode: 'move' | 'resize';
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
  corner?: string;
};

export default function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);

  const [fields, setFields] = useState<Field[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [addType, setAddType] = useState('name');
  const [addRole, setAddRole] = useState<AssignedTo>('client');
  const [currentPage, setCurrentPage] = useState(1);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [saved, setSaved] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [zoom, setZoom] = useState(1);
  const [roleFilter, setRoleFilter] = useState<AssignedTo | 'all'>('all');

  const { data: template, isLoading } = useQuery({
    queryKey: ['document-template', id],
    queryFn: () => api.get(`/admin/document-templates/${id}`).then(r => r.data.data),
    enabled: !!id,
  });

  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [pdfError, setPdfError] = useState('');
  const [pdfNumPages, setPdfNumPages] = useState<number>(1);
  const [pdfPageWidth, setPdfPageWidth] = useState(800);

  useEffect(() => {
    if (template) {
      setFields(template.fields?.map((f: any, i: number) => ({
        ...f,
        assigned_to: f.assigned_to ?? 'client',
        sort_order: f.sort_order ?? i,
      })) ?? []);
      setTemplateName(template.name);
      setTemplateDesc(template.description ?? '');
    }
  }, [template]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setPdfError('');
    api.get(`/admin/document-templates/${id}/pdf`, { responseType: 'arraybuffer' })
      .then(res => {
        if (cancelled) return;
        setPdfData(res.data);
      })
      .catch((err) => {
        if (!cancelled) {
          const status = err.response?.status;
          setPdfError(status === 404
            ? 'PDF file not found on server. Try re-uploading the template.'
            : `Failed to load PDF (${status || 'network error'}).`);
        }
      });
    return () => { cancelled = true; };
  }, [id]);

  const [saveError, setSaveError] = useState('');
  const saveFields = useMutation({
    mutationFn: () => api.put(`/admin/document-templates/${id}/fields`, { fields }),
    onSuccess: () => {
      setSaved(true);
      setSaveError('');
      setTimeout(() => setSaved(false), 3000);
      qc.invalidateQueries({ queryKey: ['document-template', id] });
      qc.invalidateQueries({ queryKey: ['document-templates'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.errors
        ? JSON.stringify(err.response.data.errors)
        : 'Failed to save fields.';
      setSaveError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  const [metaSuccess, setMetaSuccess] = useState('');
  const updateMeta = useMutation({
    mutationFn: () => api.patch(`/admin/document-templates/${id}`, { name: templateName, description: templateDesc }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document-template', id] });
      setMetaSuccess('Updated!'); setTimeout(() => setMetaSuccess(''), 2500);
    },
    onError: (err: any) => {
      setSaveError(err.response?.data?.message || 'Failed to update template details.');
    },
  });

  const addField = () => {
    const newField: Field = {
      label: fieldLabel(addType),
      field_type: addType,
      assigned_to: addRole,
      page: currentPage,
      x: 10,
      y: 10 + (fields.filter(f => f.page === currentPage).length * 8),
      width: addType === 'signature' ? 20 : addType === 'checkbox' ? 3 : 15,
      height: addType === 'signature' ? 5 : addType === 'checkbox' ? 2.5 : 3,
      required: true,
      sort_order: fields.length,
      default_value: '',
    };
    setFields(prev => [...prev, newField]);
    setSelectedIdx(fields.length);
  };

  const removeField = (idx: number) => {
    setFields(prev => prev.filter((_, i) => i !== idx));
    setSelectedIdx(null);
  };

  const updateField = (idx: number, updates: Partial<Field>) => {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, ...updates } : f));
  };

  // Move drag
  const handleMouseDown = useCallback((e: React.MouseEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIdx(idx);
    setDragging({
      idx,
      mode: 'move',
      startX: e.clientX,
      startY: e.clientY,
      origX: fields[idx].x,
      origY: fields[idx].y,
      origW: fields[idx].width,
      origH: fields[idx].height,
    });
  }, [fields]);

  // Resize drag from corners
  const handleResizeDown = useCallback((e: React.MouseEvent, idx: number, corner: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIdx(idx);
    setDragging({
      idx,
      mode: 'resize',
      startX: e.clientX,
      startY: e.clientY,
      origX: fields[idx].x,
      origY: fields[idx].y,
      origW: fields[idx].width,
      origH: fields[idx].height,
      corner,
    });
  }, [fields]);

  useEffect(() => {
    if (!dragging) return;
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();

    const handleMove = (e: MouseEvent) => {
      const dx = ((e.clientX - dragging.startX) / rect.width) * 100;
      const dy = ((e.clientY - dragging.startY) / rect.height) * 100;

      if (dragging.mode === 'move') {
        const newX = Math.max(0, Math.min(100 - fields[dragging.idx].width, dragging.origX + dx));
        const newY = Math.max(0, Math.min(100 - fields[dragging.idx].height, dragging.origY + dy));
        updateField(dragging.idx, {
          x: Math.round(newX * 100) / 100,
          y: Math.round(newY * 100) / 100,
        });
      } else if (dragging.mode === 'resize') {
        const corner = dragging.corner!;
        let newX = dragging.origX;
        let newY = dragging.origY;
        let newW = dragging.origW;
        let newH = dragging.origH;

        if (corner.includes('r')) { newW = Math.max(3, dragging.origW + dx); }
        if (corner.includes('l')) { newX = dragging.origX + dx; newW = Math.max(3, dragging.origW - dx); }
        if (corner.includes('b')) { newH = Math.max(2, dragging.origH + dy); }
        if (corner.includes('t')) { newY = dragging.origY + dy; newH = Math.max(2, dragging.origH - dy); }

        newX = Math.max(0, Math.min(97, newX));
        newY = Math.max(0, Math.min(98, newY));

        updateField(dragging.idx, {
          x: Math.round(newX * 100) / 100,
          y: Math.round(newY * 100) / 100,
          width: Math.round(newW * 100) / 100,
          height: Math.round(newH * 100) / 100,
        });
      }
    };

    const handleUp = () => setDragging(null);

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [dragging, fields]);

  const pageFields = fields.filter(f => f.page === currentPage);
  // Measure container width for PDF rendering
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setPdfPageWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    setPdfPageWidth(el.clientWidth || 800);
    return () => observer.disconnect();
  }, []);

  const visiblePageFields = roleFilter === 'all'
    ? pageFields
    : pageFields.filter(f => f.assigned_to === roleFilter);
  const totalPages = pdfNumPages || template?.page_count || 1;

  const clientFieldCount = fields.filter(f => f.assigned_to === 'client').length;
  const companyFieldCount = fields.filter(f => f.assigned_to === 'company').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-taupe">Loading template...</p>
      </div>
    );
  }

  // Resize handle component
  const ResizeHandle = ({ corner, idx }: { corner: string; idx: number }) => {
    const cursors: Record<string, string> = {
      tl: 'nw-resize', tr: 'ne-resize', bl: 'sw-resize', br: 'se-resize',
      t: 'n-resize', b: 's-resize', l: 'w-resize', r: 'e-resize',
    };
    const positions: Record<string, React.CSSProperties> = {
      tl: { top: -4, left: -4 },
      tr: { top: -4, right: -4 },
      bl: { bottom: -4, left: -4 },
      br: { bottom: -4, right: -4 },
    };
    return (
      <div
        onMouseDown={e => handleResizeDown(e, idx, corner)}
        className="absolute w-2.5 h-2.5 bg-white border-2 border-espresso rounded-sm z-30"
        style={{
          cursor: cursors[corner],
          ...positions[corner],
          pointerEvents: 'auto',
        }}
      />
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/documents')} className="text-taupe hover:text-espresso text-sm">
            &larr; Back
          </button>
          <h1 className="page-title">Edit Template</h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            loading={saveFields.isPending}
            onClick={() => saveFields.mutate()}
          >
            Save Fields
          </Button>
        </div>
      </div>

      {saved && (
        <div className="bg-green-50 text-green-700 text-sm font-medium px-4 py-2.5 rounded-lg">
          Fields saved successfully!
        </div>
      )}
      {saveError && (
        <div className="bg-red-50 text-red-700 text-sm font-medium px-4 py-2.5 rounded-lg">
          Save failed: {saveError}
        </div>
      )}

      {/* Template metadata */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              label="Template Name"
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Input
              label="Description"
              value={templateDesc}
              onChange={e => setTemplateDesc(e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={() => updateMeta.mutate()} loading={updateMeta.isPending}>
              Update
            </Button>
            {metaSuccess && <span className="text-sm text-green-600 font-medium pb-2">{metaSuccess}</span>}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* PDF Preview with fields overlay */}
        <Card padding="none">
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-cream flex-wrap">
            {/* Role selector for new fields */}
            <div className="flex rounded-lg border border-taupe/30 overflow-hidden">
              {ROLES.map(r => (
                <button
                  key={r.value}
                  onClick={() => setAddRole(r.value)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    addRole === r.value
                      ? 'text-white'
                      : 'text-espresso hover:bg-cream'
                  }`}
                  style={addRole === r.value ? { backgroundColor: r.color } : {}}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <select
              value={addType}
              onChange={e => setAddType(e.target.value)}
              className="border border-taupe/30 rounded-lg px-3 py-1.5 text-sm text-espresso"
            >
              {FIELD_TYPES.map(ft => (
                <option key={ft.value} value={ft.value}>{ft.label}</option>
              ))}
            </select>
            <Button onClick={addField} variant="outline" size="sm">
              + Add Field
            </Button>
            {totalPages > 1 && (
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="px-2 py-1 text-sm text-espresso disabled:text-taupe/30"
                >
                  &laquo;
                </button>
                <span className="text-sm text-espresso">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-2 py-1 text-sm text-espresso disabled:text-taupe/30"
                >
                  &raquo;
                </button>
              </div>
            )}
          </div>

          {/* Role filter + zoom */}
          <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-cream/50">
            <div className="flex items-center gap-1">
              <span className="text-xs text-taupe mr-1">Show:</span>
              {[
                { value: 'all' as const, label: 'All' },
                ...ROLES.map(r => ({ value: r.value as AssignedTo | 'all', label: r.label })),
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setRoleFilter(opt.value)}
                  className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                    roleFilter === opt.value
                      ? 'bg-espresso text-cream'
                      : 'text-taupe hover:bg-cream'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
                className="px-2 py-0.5 text-sm rounded border border-taupe/30 text-espresso hover:bg-cream"
              >
                &minus;
              </button>
              <span className="text-xs text-espresso w-10 text-center">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom(z => Math.min(2, z + 0.1))}
                className="px-2 py-0.5 text-sm rounded border border-taupe/30 text-espresso hover:bg-cream"
              >
                +
              </button>
              {zoom !== 1 && (
                <button onClick={() => setZoom(1)} className="px-2 py-0.5 text-xs text-blue hover:underline">
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* PDF + overlay container */}
          <div className="overflow-auto bg-gray-100 rounded-b-lg" style={{ maxHeight: '80vh' }}>
          <div
            ref={containerRef}
            className="relative"
            style={{ minHeight: 400, transform: `scale(${zoom})`, transformOrigin: 'top left', width: `${100 / zoom}%` }}
            onClick={() => setSelectedIdx(null)}
          >
            {/* PDF as background */}
            {pdfData ? (
              <Document
                file={{ data: pdfData }}
                onLoadSuccess={(pdf) => setPdfNumPages(pdf.numPages)}
                loading={<div className="flex items-center justify-center" style={{ height: 700 }}><p className="text-taupe text-sm">Rendering PDF...</p></div>}
                error={<div className="flex items-center justify-center" style={{ height: 700 }}><p className="text-red-500 text-sm">Failed to render PDF.</p></div>}
              >
                <Page
                  pageNumber={currentPage}
                  width={pdfPageWidth}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  className="pointer-events-none"
                />
              </Document>
            ) : (
              <div className="flex items-center justify-center flex-col gap-3" style={{ height: 700 }}>
                {pdfError ? (
                  <>
                    <p className="text-red-500 text-sm font-medium">{pdfError}</p>
                    <p className="text-xs text-taupe">You can still add and position fields — they'll align when the PDF is available.</p>
                  </>
                ) : (
                  <p className="text-taupe text-sm">Loading PDF...</p>
                )}
              </div>
            )}

            {/* Field overlays */}
            <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
              {visiblePageFields.map((field) => {
                const globalIdx = fields.indexOf(field);
                const isSelected = selectedIdx === globalIdx;
                const color = roleColor(field.assigned_to);
                return (
                  <div
                    key={globalIdx}
                    onMouseDown={e => handleMouseDown(e, globalIdx)}
                    onClick={e => { e.stopPropagation(); setSelectedIdx(globalIdx); }}
                    className={`absolute cursor-move flex items-center justify-center text-white text-[10px] font-medium rounded transition-shadow ${
                      isSelected ? 'ring-2 ring-offset-1 ring-espresso shadow-lg' : 'shadow'
                    }`}
                    style={{
                      left: `${field.x}%`,
                      top: `${field.y}%`,
                      width: `${field.width}%`,
                      height: `${field.height}%`,
                      backgroundColor: color + (isSelected ? 'DD' : '88'),
                      borderLeft: `3px solid ${color}`,
                      pointerEvents: 'auto',
                      zIndex: isSelected ? 20 : 10,
                    }}
                    title={`${roleLabel(field.assigned_to)}: ${field.label}`}
                  >
                    <span className="truncate px-1">{field.label}</span>
                    {/* Resize handles on selected */}
                    {isSelected && (
                      <>
                        <ResizeHandle corner="tl" idx={globalIdx} />
                        <ResizeHandle corner="tr" idx={globalIdx} />
                        <ResizeHandle corner="bl" idx={globalIdx} />
                        <ResizeHandle corner="br" idx={globalIdx} />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          </div>
        </Card>

        {/* Field list / properties panel */}
        <div className="space-y-3">
          {/* Field list grouped by role */}
          <Card>
            <h3 className="font-display text-espresso text-sm mb-3">
              Fields ({fields.length})
            </h3>
            {fields.length === 0 && (
              <p className="text-xs text-taupe py-3 text-center">
                No fields yet. Select a recipient and type, then click "+ Add Field".
              </p>
            )}

            {/* Client fields */}
            {clientFieldCount > 0 && (
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: roleColor('client') }} />
                  <span className="text-xs font-semibold text-espresso uppercase tracking-wide">Client ({clientFieldCount})</span>
                </div>
                <div className="space-y-0.5">
                  {fields.filter(f => f.assigned_to === 'client').map(field => {
                    const idx = fields.indexOf(field);
                    return (
                      <button
                        key={idx}
                        onClick={() => { setSelectedIdx(idx); setCurrentPage(field.page); }}
                        className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                          selectedIdx === idx ? 'bg-blue/10' : 'hover:bg-cream/50'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: fieldColor(field.field_type) }} />
                        <span className="flex-1 truncate text-espresso">{field.label}</span>
                        <span className="text-taupe">p{field.page}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Company fields */}
            {companyFieldCount > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: roleColor('company') }} />
                  <span className="text-xs font-semibold text-espresso uppercase tracking-wide">The Pupper Club ({companyFieldCount})</span>
                </div>
                <div className="space-y-0.5">
                  {fields.filter(f => f.assigned_to === 'company').map(field => {
                    const idx = fields.indexOf(field);
                    return (
                      <button
                        key={idx}
                        onClick={() => { setSelectedIdx(idx); setCurrentPage(field.page); }}
                        className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                          selectedIdx === idx ? 'bg-gold/10' : 'hover:bg-cream/50'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: fieldColor(field.field_type) }} />
                        <span className="flex-1 truncate text-espresso">{field.label}</span>
                        <span className="text-taupe">p{field.page}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>

          {/* Selected field properties */}
          {selectedIdx !== null && fields[selectedIdx] && (
            <Card>
              <h3 className="font-display text-espresso text-sm mb-3">Field Properties</h3>
              <div className="space-y-3">
                <Input
                  label="Label"
                  value={fields[selectedIdx].label}
                  onChange={e => updateField(selectedIdx, { label: e.target.value })}
                />
                <div>
                  <label className="block text-sm font-medium text-espresso mb-1">Recipient</label>
                  <div className="flex rounded-lg border border-taupe/30 overflow-hidden">
                    {ROLES.map(r => (
                      <button
                        key={r.value}
                        onClick={() => updateField(selectedIdx, { assigned_to: r.value })}
                        className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                          fields[selectedIdx].assigned_to === r.value
                            ? 'text-white'
                            : 'text-espresso hover:bg-cream'
                        }`}
                        style={fields[selectedIdx].assigned_to === r.value ? { backgroundColor: r.color } : {}}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-espresso mb-1">Type</label>
                  <select
                    value={fields[selectedIdx].field_type}
                    onChange={e => updateField(selectedIdx, { field_type: e.target.value })}
                    className="w-full border border-taupe/30 rounded-lg px-3 py-2 text-sm text-espresso"
                  >
                    {FIELD_TYPES.map(ft => (
                      <option key={ft.value} value={ft.value}>{ft.label}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="X (%)"
                    type="number"
                    value={String(fields[selectedIdx].x)}
                    onChange={e => updateField(selectedIdx, { x: Number(e.target.value) })}
                  />
                  <Input
                    label="Y (%)"
                    type="number"
                    value={String(fields[selectedIdx].y)}
                    onChange={e => updateField(selectedIdx, { y: Number(e.target.value) })}
                  />
                  <Input
                    label="Width (%)"
                    type="number"
                    value={String(fields[selectedIdx].width)}
                    onChange={e => updateField(selectedIdx, { width: Number(e.target.value) })}
                  />
                  <Input
                    label="Height (%)"
                    type="number"
                    value={String(fields[selectedIdx].height)}
                    onChange={e => updateField(selectedIdx, { height: Number(e.target.value) })}
                  />
                </div>
                {totalPages > 1 && (
                  <Input
                    label="Page"
                    type="number"
                    value={String(fields[selectedIdx].page)}
                    onChange={e => updateField(selectedIdx, { page: Number(e.target.value) })}
                  />
                )}
                <Input
                  label="Default Value"
                  value={fields[selectedIdx].default_value}
                  onChange={e => updateField(selectedIdx, { default_value: e.target.value })}
                  placeholder="Optional"
                />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fields[selectedIdx].required}
                    onChange={e => updateField(selectedIdx, { required: e.target.checked })}
                    className="h-4 w-4 rounded border-taupe text-gold focus:ring-gold"
                  />
                  <span className="text-sm text-espresso">Required</span>
                </label>
                <button
                  onClick={() => removeField(selectedIdx)}
                  className="text-xs text-red-400 hover:text-red-600 font-medium"
                >
                  Remove Field
                </button>
              </div>
            </Card>
          )}

          {/* Legend */}
          <Card>
            <h3 className="font-display text-espresso text-sm mb-2">Recipients</h3>
            <div className="space-y-1.5 mb-3">
              {ROLES.map(r => (
                <div key={r.value} className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: r.color }} />
                  <span className="text-espresso font-medium">{r.label}</span>
                  <span className="text-taupe">— fills {r.value === 'client' ? 'first' : 'after client signs'}</span>
                </div>
              ))}
            </div>
            <h3 className="font-display text-espresso text-sm mb-2">Field Types</h3>
            <div className="space-y-1">
              {FIELD_TYPES.map(ft => (
                <div key={ft.value} className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: ft.color }} />
                  <span className="text-espresso">{ft.label}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
