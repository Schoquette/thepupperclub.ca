import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

interface Field {
  id?: number;
  label: string;
  field_type: string;
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

const fieldColor = (type: string) => FIELD_TYPES.find(f => f.value === type)?.color ?? '#999';
const fieldLabel = (type: string) => FIELD_TYPES.find(f => f.value === type)?.label ?? type;

export default function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);

  const [fields, setFields] = useState<Field[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [addType, setAddType] = useState('name');
  const [currentPage, setCurrentPage] = useState(1);
  const [dragging, setDragging] = useState<{ idx: number; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [saved, setSaved] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [zoom, setZoom] = useState(1);

  const { data: template, isLoading } = useQuery({
    queryKey: ['document-template', id],
    queryFn: () => api.get(`/admin/document-templates/${id}`).then(r => r.data.data),
    enabled: !!id,
  });

  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (template) {
      setFields(template.fields?.map((f: any, i: number) => ({ ...f, sort_order: f.sort_order ?? i })) ?? []);
      setTemplateName(template.name);
      setTemplateDesc(template.description ?? '');
    }
  }, [template]);

  // Fetch PDF as authenticated blob
  useEffect(() => {
    if (!id) return;
    let revoked = false;
    api.get(`/admin/document-templates/${id}/pdf`, { responseType: 'blob' })
      .then(res => {
        if (revoked) return;
        const url = URL.createObjectURL(res.data);
        setPdfBlobUrl(url);
      })
      .catch(() => setPdfBlobUrl(null));
    return () => { revoked = true; if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl); };
  }, [id]);

  const saveFields = useMutation({
    mutationFn: () => api.put(`/admin/document-templates/${id}/fields`, { fields }),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      qc.invalidateQueries({ queryKey: ['document-template', id] });
      qc.invalidateQueries({ queryKey: ['document-templates'] });
    },
  });

  const updateMeta = useMutation({
    mutationFn: () => api.patch(`/admin/document-templates/${id}`, { name: templateName, description: templateDesc }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['document-template', id] }),
  });

  const addField = () => {
    const newField: Field = {
      label: fieldLabel(addType),
      field_type: addType,
      page: currentPage,
      x: 10,
      y: 10 + (fields.filter(f => f.page === currentPage).length * 8),
      width: addType === 'signature' ? 30 : addType === 'checkbox' ? 5 : 25,
      height: addType === 'signature' ? 10 : addType === 'checkbox' ? 4 : 5,
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

  // Drag handling
  const handleMouseDown = useCallback((e: React.MouseEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIdx(idx);
    setDragging({
      idx,
      startX: e.clientX,
      startY: e.clientY,
      origX: fields[idx].x,
      origY: fields[idx].y,
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
      const newX = Math.max(0, Math.min(100 - fields[dragging.idx].width, dragging.origX + dx));
      const newY = Math.max(0, Math.min(100 - fields[dragging.idx].height, dragging.origY + dy));
      updateField(dragging.idx, { x: Math.round(newX * 100) / 100, y: Math.round(newY * 100) / 100 });
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
  const totalPages = template?.page_count ?? 1;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-taupe">Loading template...</p>
      </div>
    );
  }

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
          <div className="flex items-end">
            <Button variant="outline" onClick={() => updateMeta.mutate()} loading={updateMeta.isPending}>
              Update
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* PDF Preview with fields overlay */}
        <Card padding="none">
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-cream flex-wrap">
            <select
              value={addType}
              onChange={e => setAddType(e.target.value)}
              className="border border-taupe/30 rounded-lg px-3 py-1.5 text-sm text-espresso"
            >
              {FIELD_TYPES.map(ft => (
                <option key={ft.value} value={ft.value}>{ft.label}</option>
              ))}
            </select>
            <Button onClick={addField} variant="outline">
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

          {/* Zoom controls */}
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
              className="px-2.5 py-1 text-sm rounded border border-taupe/30 text-espresso hover:bg-cream"
            >
              &minus;
            </button>
            <span className="text-sm text-espresso w-14 text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(z => Math.min(2, z + 0.1))}
              className="px-2.5 py-1 text-sm rounded border border-taupe/30 text-espresso hover:bg-cream"
            >
              +
            </button>
            {zoom !== 1 && (
              <button
                onClick={() => setZoom(1)}
                className="px-2 py-1 text-xs text-blue hover:underline"
              >
                Reset
              </button>
            )}
          </div>

          {/* PDF + overlay container */}
          <div className="overflow-auto bg-gray-100 rounded-lg" style={{ maxHeight: '80vh' }}>
          <div
            ref={containerRef}
            className="relative"
            style={{ minHeight: 600, transform: `scale(${zoom})`, transformOrigin: 'top left', width: `${100 / zoom}%` }}
            onClick={() => setSelectedIdx(null)}
          >
            {/* PDF as background */}
            {pdfBlobUrl ? (
              <iframe
                src={`${pdfBlobUrl}#page=${currentPage}&toolbar=0`}
                className="w-full pointer-events-none"
                style={{ height: 900 }}
                title="Template PDF"
              />
            ) : (
              <div className="flex items-center justify-center" style={{ height: 700 }}>
                <p className="text-taupe text-sm">Loading PDF...</p>
              </div>
            )}

            {/* Field overlays */}
            <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
              {pageFields.map((field) => {
                const globalIdx = fields.indexOf(field);
                const isSelected = selectedIdx === globalIdx;
                const color = fieldColor(field.field_type);
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
                      backgroundColor: color + (isSelected ? 'DD' : '99'),
                      pointerEvents: 'auto',
                      zIndex: isSelected ? 20 : 10,
                    }}
                    title={field.label}
                  >
                    <span className="truncate px-1">{field.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
          </div>
        </Card>

        {/* Field list / properties panel */}
        <div className="space-y-3">
          <Card>
            <h3 className="font-display text-espresso text-sm mb-3">
              Fields ({fields.length})
            </h3>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {fields.length === 0 && (
                <p className="text-xs text-taupe py-3 text-center">
                  No fields yet. Select a type and click "+ Add Field" to place one on the document.
                </p>
              )}
              {fields.map((field, idx) => (
                <button
                  key={idx}
                  onClick={() => { setSelectedIdx(idx); setCurrentPage(field.page); }}
                  className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                    selectedIdx === idx ? 'bg-cream' : 'hover:bg-cream/50'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: fieldColor(field.field_type) }}
                  />
                  <span className="flex-1 truncate text-espresso">{field.label}</span>
                  <span className="text-taupe">p{field.page}</span>
                </button>
              ))}
            </div>
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
