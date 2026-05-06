import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { format } from 'date-fns';
import { Upload, ArrowUp, ArrowDown, Pencil, Trash2, Check, X } from 'lucide-react';

function DocumentPreviewFrame({ docId }: { docId: number }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let revoked = false;
    api.get(`/documents/${docId}`, { responseType: 'blob' })
      .then(res => {
        if (revoked) return;
        const url = URL.createObjectURL(res.data);
        setBlobUrl(url);
      })
      .catch(async (err) => {
        const status = err.response?.status;
        let detail = '';
        if (err.response?.data instanceof Blob) {
          try { detail = await err.response.data.text(); } catch {}
        }
        setError(`Failed to load document preview (${status || err.message}). ${detail}`);
      });
    return () => { revoked = true; if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [docId]);

  if (error) return <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>;
  if (!blobUrl) return <div className="flex items-center justify-center h-96 text-taupe">Loading preview...</div>;
  return <iframe src={blobUrl} className="w-full h-[70vh] rounded-lg border border-cream" />;
}

type SortKey = 'filename' | 'client' | 'status' | 'date';
type SortDir = 'asc' | 'desc';

function SortHeader({ label, sortKey, current, dir, onSort }: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir; onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <th
      className="px-4 py-3 font-semibold text-espresso cursor-pointer select-none hover:bg-cream/30 transition-colors"
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
      </span>
    </th>
  );
}

export default function AdminDocumentsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'all' | 'templates' | 'signed' | 'sent' | 'drafts'>('all');
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('');

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Rename state
  const [renameId, setRenameId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Upload template modal
  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');

  // Upload document modal
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [docUploadFile, setDocUploadFile] = useState<File | null>(null);
  const [docUploadClient, setDocUploadClient] = useState('');
  const [docUploadType, setDocUploadType] = useState('other');
  const [docUploadError, setDocUploadError] = useState('');

  // Use template modal
  const [useModal, setUseModal] = useState<any>(null);
  const [useClientId, setUseClientId] = useState('');
  const [useError, setUseError] = useState('');

  // Preview modal
  const [previewDoc, setPreviewDoc] = useState<any>(null);

  // Templates list
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['document-templates'],
    queryFn: () => api.get('/admin/document-templates').then(r => r.data.data),
  });

  // Documents list
  const statusFilter = tab === 'signed' ? 'signed' : tab === 'sent' ? 'sent' : tab === 'drafts' ? 'draft' : undefined;
  const { data: docsData, isLoading: docsLoading, isError: docsError, error: docsErrorObj } = useQuery({
    queryKey: ['admin-documents', statusFilter, search, clientFilter],
    queryFn: () => api.get('/admin/documents', {
      params: {
        status: statusFilter,
        search: search || undefined,
        client_id: clientFilter || undefined,
      },
    }).then(r => r.data),
    enabled: tab !== 'templates',
  });

  // Clients for picker
  const { data: clients } = useQuery({
    queryKey: ['admin-clients-simple'],
    queryFn: () => api.get('/admin/clients').then(r => r.data.data),
  });

  // Sort documents client-side
  const sortedDocs = useMemo(() => {
    const docs = [...(docsData?.data ?? [])];
    const getStatus = (doc: any) => {
      if (doc.signed_at) return 'signed';
      if (doc.sent_at) return 'sent';
      return doc.status || 'draft';
    };
    const getDate = (doc: any) => doc.signed_at || doc.sent_at || doc.created_at || '';

    docs.sort((a: any, b: any) => {
      let cmp = 0;
      switch (sortKey) {
        case 'filename':
          cmp = (a.filename || '').localeCompare(b.filename || '');
          break;
        case 'client':
          cmp = (a.user?.name || '').localeCompare(b.user?.name || '');
          break;
        case 'status':
          cmp = getStatus(a).localeCompare(getStatus(b));
          break;
        case 'date':
          cmp = getDate(a).localeCompare(getDate(b));
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return docs;
  }, [docsData?.data, sortKey, sortDir]);

  // Upload template
  const uploadTemplate = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('name', uploadName.trim());
      fd.append('description', uploadDesc.trim());
      fd.append('pdf', uploadFile!);
      return api.post('/admin/document-templates', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: (res) => {
      setShowUpload(false);
      setUploadName('');
      setUploadDesc('');
      setUploadFile(null);
      setUploadError('');
      qc.invalidateQueries({ queryKey: ['document-templates'] });
      navigate(`/admin/documents/templates/${res.data.data.id}/edit`);
    },
    onError: (e: any) => setUploadError(e.response?.data?.message || 'Upload failed.'),
  });

  // Use template
  const createFromTemplate = useMutation({
    mutationFn: (templateId: number) =>
      api.post(`/admin/document-templates/${templateId}/use`, { client_id: Number(useClientId) }),
    onSuccess: (res) => {
      setUseModal(null);
      setUseClientId('');
      qc.invalidateQueries({ queryKey: ['admin-documents'] });
      // Open the newly created document in preview so admin can review & send
      setPreviewDoc(res.data.data);
    },
    onError: (e: any) => setUseError(e.response?.data?.message || 'Failed.'),
  });

  // Delete template
  const deleteTemplate = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/document-templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['document-templates'] }),
  });

  // Upload document to client
  const uploadDocument = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('file', docUploadFile!);
      fd.append('type', docUploadType);
      return api.post(`/admin/clients/${docUploadClient}/documents`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      setShowDocUpload(false);
      setDocUploadFile(null);
      setDocUploadClient('');
      setDocUploadType('other');
      setDocUploadError('');
      qc.invalidateQueries({ queryKey: ['admin-documents'] });
    },
    onError: (e: any) => setDocUploadError(e.response?.data?.message || 'Upload failed.'),
  });

  // Rename document
  const renameDoc = useMutation({
    mutationFn: ({ id, filename }: { id: number; filename: string }) =>
      api.patch(`/admin/documents/${id}/rename`, { filename }),
    onSuccess: () => {
      setRenameId(null);
      setRenameValue('');
      qc.invalidateQueries({ queryKey: ['admin-documents'] });
    },
  });

  // Delete document
  const deleteDoc = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/documents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-documents'] }),
  });

  // Send for signing
  const [sendError, setSendError] = useState('');
  const sendDoc = useMutation({
    mutationFn: (docId: number) => api.post(`/admin/documents/${docId}/send`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-documents'] }); setSendError(''); },
    onError: (e: any) => setSendError(e.response?.data?.message || 'Failed to send.'),
  });

  const docStatus = (doc: any): string => {
    if (doc.signed_at) return 'signed';
    if (doc.sent_at) return 'sent';
    return doc.status || 'draft';
  };

  const canSend = (doc: any): boolean => {
    if (!doc.template_id) return true;
    return (doc.template?.fields?.length ?? 0) > 0;
  };
  const needsFields = (doc: any): boolean => {
    return !!doc.template_id && (doc.template?.fields?.length ?? 0) === 0;
  };

  const tabs = [
    { key: 'all', label: 'All Documents' },
    { key: 'templates', label: 'Templates' },
    { key: 'drafts', label: 'Drafts' },
    { key: 'sent', label: 'Sent' },
    { key: 'signed', label: 'Signed' },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="page-title">Documents</h1>
        <div className="flex gap-2">
          {tab === 'templates' ? (
            <Button onClick={() => setShowUpload(true)}>+ New Template</Button>
          ) : (
            <Button onClick={() => { setShowDocUpload(true); setDocUploadError(''); }}>
              <Upload className="w-4 h-4 mr-1.5" /> Upload Document
            </Button>
          )}
        </div>
      </div>

      {sendError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700 flex items-center justify-between">
          <span>{sendError}</span>
          <button onClick={() => setSendError('')} className="text-red-400 hover:text-red-600 ml-3">&times;</button>
        </div>
      )}

      {/* Tabs + search + client filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex rounded-lg border border-taupe/50 overflow-hidden text-sm w-fit overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 font-medium whitespace-nowrap transition-colors ${
                tab === t.key ? 'bg-espresso text-cream' : 'text-espresso hover:bg-cream'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab !== 'templates' && (
          <>
            <Input
              placeholder="Search documents..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="sm:max-w-xs"
            />
            <select
              value={clientFilter}
              onChange={e => setClientFilter(e.target.value)}
              className="border border-taupe/30 rounded-lg px-3 py-2 text-sm text-espresso focus:outline-none focus:ring-2 focus:ring-gold/40 sm:max-w-xs"
            >
              <option value="">All Clients</option>
              {(clients ?? []).map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </>
        )}
      </div>

      {/* Templates tab */}
      {tab === 'templates' && (
        templatesLoading ? <PageLoader /> : (
          <div className="space-y-3">
            {(templates ?? []).length === 0 ? (
              <Card>
                <p className="text-center py-8 text-taupe">No templates yet. Upload a PDF to create your first template.</p>
              </Card>
            ) : (
              <Card padding="none">
                <table className="w-full text-sm table-fixed">
                  <thead>
                    <tr className="border-b border-cream text-left">
                      <th className="px-4 py-3 font-semibold text-espresso w-[40%]">Template</th>
                      <th className="px-4 py-3 font-semibold text-espresso w-[12%]">Fields</th>
                      <th className="px-4 py-3 font-semibold text-espresso w-[10%]">Used</th>
                      <th className="px-4 py-3 font-semibold text-espresso w-[16%]">Created</th>
                      <th className="px-4 py-3 w-[22%]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((t: any) => (
                      <tr key={t.id} className="border-b border-cream last:border-0 hover:bg-cream/50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-espresso break-words">{t.name}</div>
                          <div className="text-xs text-taupe break-words">{t.pdf_filename}</div>
                        </td>
                        <td className="px-4 py-3 text-taupe">{t.fields_count} fields</td>
                        <td className="px-4 py-3 text-taupe">{t.documents_count}x</td>
                        <td className="px-4 py-3 text-xs text-taupe">
                          {t.created_at ? format(new Date(t.created_at), 'MMM d, yyyy') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setUseModal(t); setUseClientId(''); setUseError(''); }}
                              className="text-gold hover:text-gold/80 text-sm font-medium"
                            >
                              Use
                            </button>
                            <button
                              onClick={() => navigate(`/admin/documents/templates/${t.id}/edit`)}
                              className="text-blue hover:underline text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete "${t.name}"?`)) deleteTemplate.mutate(t.id);
                              }}
                              className="text-red-400 hover:text-red-600 text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </div>
        )
      )}

      {/* Documents tabs (all, drafts, sent, signed) */}
      {tab !== 'templates' && (
        docsLoading ? <PageLoader /> : docsError ? (
          <Card>
            <div className="text-center py-8">
              <p className="text-red-600 text-sm font-medium">Failed to load documents.</p>
              <p className="text-xs text-taupe mt-1">{(docsErrorObj as any)?.response?.data?.message || (docsErrorObj as any)?.message || 'Unknown error'}</p>
            </div>
          </Card>
        ) : (
          <Card padding="none">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="border-b border-cream text-left">
                  <SortHeader label="Document" sortKey="filename" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortHeader label="Client" sortKey="client" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortHeader label="Status" sortKey="status" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortHeader label="Date" sortKey="date" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <th className="px-4 py-3 w-[160px]"></th>
                </tr>
              </thead>
              <tbody>
                {sortedDocs.map((doc: any) => {
                  const st = docStatus(doc);
                  const isRenaming = renameId === doc.id;
                  return (
                    <tr key={doc.id} className="border-b border-cream last:border-0 hover:bg-cream/50">
                      <td className="px-4 py-3">
                        {isRenaming ? (
                          <div className="flex items-center gap-1">
                            <input
                              autoFocus
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && renameValue.trim()) {
                                  renameDoc.mutate({ id: doc.id, filename: renameValue.trim() });
                                } else if (e.key === 'Escape') {
                                  setRenameId(null);
                                }
                              }}
                              className="border border-gold/60 rounded px-2 py-1 text-sm text-espresso w-full focus:outline-none focus:ring-2 focus:ring-gold/40"
                            />
                            <button
                              onClick={() => renameValue.trim() && renameDoc.mutate({ id: doc.id, filename: renameValue.trim() })}
                              className="text-green-600 hover:text-green-800 flex-shrink-0"
                              title="Save"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setRenameId(null)}
                              className="text-taupe hover:text-espresso flex-shrink-0"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div className="font-medium text-espresso break-words">{doc.filename}</div>
                            {doc.template && (
                              <div className="text-xs text-taupe break-words">From: {doc.template.name}</div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-taupe break-words">{doc.user?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusBadge(st)}>{st}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-taupe whitespace-nowrap">
                        {doc.signed_at
                          ? format(new Date(doc.signed_at), 'MMM d, yyyy')
                          : doc.sent_at
                          ? format(new Date(doc.sent_at), 'MMM d, yyyy')
                          : doc.created_at
                          ? format(new Date(doc.created_at), 'MMM d, yyyy')
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {st === 'draft' && canSend(doc) && (
                            <button
                              onClick={() => { setSendError(''); sendDoc.mutate(doc.id); }}
                              className="text-gold hover:text-gold/80 text-sm font-medium"
                            >
                              Send
                            </button>
                          )}
                          {st === 'draft' && needsFields(doc) && (
                            <button
                              onClick={() => navigate(`/admin/documents/templates/${doc.template_id}/edit`)}
                              className="text-red-500 hover:text-red-700 text-xs font-medium"
                              title="Define signing fields before sending"
                            >
                              Define Fields
                            </button>
                          )}
                          <button
                            onClick={() => setPreviewDoc(doc)}
                            className="text-blue hover:underline text-sm"
                          >
                            View
                          </button>
                          <button
                            onClick={() => { setRenameId(doc.id); setRenameValue(doc.filename); }}
                            className="text-taupe hover:text-espresso"
                            title="Rename"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete "${doc.filename}"? This cannot be undone.`)) {
                                deleteDoc.mutate(doc.id);
                              }
                            }}
                            className="text-red-400 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {sortedDocs.length === 0 && (
              <div className="text-center py-12 text-taupe">No documents found.</div>
            )}
          </Card>
        )
      )}

      {/* Upload Template Modal */}
      <Modal open={showUpload} onClose={() => setShowUpload(false)} title="New Document Template">
        <div className="space-y-4">
          <p className="text-sm text-taupe">
            Upload a document. PDF templates can have form fields (name, signature, date, etc.) added in the next step.
          </p>
          <Input
            label="Template Name"
            value={uploadName}
            onChange={e => setUploadName(e.target.value)}
            placeholder="e.g. Service Agreement, Liability Waiver"
          />
          <Input
            label="Description (optional)"
            value={uploadDesc}
            onChange={e => setUploadDesc(e.target.value)}
            placeholder="Brief description..."
          />
          <div>
            <label className="block text-sm font-medium text-espresso mb-1">File</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.heic"
              onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-espresso file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-cream file:text-espresso hover:file:bg-cream/70"
            />
            <p className="text-xs text-taupe mt-1">PDF, Word (.doc, .docx), JPG, PNG, HEIC — max 20 MB</p>
          </div>
          {uploadError && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{uploadError}</div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowUpload(false)}>Cancel</Button>
            <Button
              loading={uploadTemplate.isPending}
              disabled={!uploadName.trim() || !uploadFile}
              onClick={() => uploadTemplate.mutate()}
            >
              Upload & Define Fields
            </Button>
          </div>
        </div>
      </Modal>

      {/* Use Template Modal */}
      <Modal open={!!useModal} onClose={() => setUseModal(null)} title={`Use Template: ${useModal?.name ?? ''}`}>
        <div className="space-y-4">
          <p className="text-sm text-taupe">
            Select a client to create a copy of this template. The document will be linked to the client as a draft.
          </p>
          <div>
            <label className="block text-sm font-medium text-espresso mb-1">Client</label>
            <select
              value={useClientId}
              onChange={e => setUseClientId(e.target.value)}
              className="w-full border border-taupe/30 rounded-lg px-3 py-2 text-sm text-espresso focus:outline-none focus:ring-2 focus:ring-gold/40"
            >
              <option value="">Select a client...</option>
              {(clients ?? []).map((c: any) => (
                <option key={c.id} value={c.id}>{c.name} — {c.email}</option>
              ))}
            </select>
          </div>
          {useModal?.fields_count > 0 ? (
            <div className="text-xs text-taupe bg-cream/50 rounded-lg px-3 py-2">
              This template has {useModal.fields_count} form field{useModal.fields_count !== 1 ? 's' : ''} that will be pre-filled with the client's information.
            </div>
          ) : (
            <div className="text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-800">
              This template has no signing fields defined. You won't be able to send the document for signing until you{' '}
              <button
                className="underline font-medium"
                onClick={() => { setUseModal(null); navigate(`/admin/documents/templates/${useModal?.id}/edit`); }}
              >
                define fields
              </button>.
            </div>
          )}
          {useError && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{useError}</div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setUseModal(null)}>Cancel</Button>
            <Button
              loading={createFromTemplate.isPending}
              disabled={!useClientId}
              onClick={() => useModal && createFromTemplate.mutate(useModal.id)}
            >
              Create & Preview
            </Button>
          </div>
        </div>
      </Modal>

      {/* Upload Document Modal */}
      <Modal open={showDocUpload} onClose={() => setShowDocUpload(false)} title="Upload Document">
        <div className="space-y-4">
          <p className="text-sm text-taupe">
            Upload a document (PDF, Word, or image) and assign it to a client.
          </p>
          <div>
            <label className="block text-sm font-medium text-espresso mb-1">Client</label>
            <select
              value={docUploadClient}
              onChange={e => setDocUploadClient(e.target.value)}
              className="w-full border border-taupe/30 rounded-lg px-3 py-2 text-sm text-espresso focus:outline-none focus:ring-2 focus:ring-gold/40"
            >
              <option value="">Select a client...</option>
              {(clients ?? []).map((c: any) => (
                <option key={c.id} value={c.id}>{c.name} — {c.email}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-espresso mb-1">Document Type</label>
            <select
              value={docUploadType}
              onChange={e => setDocUploadType(e.target.value)}
              className="w-full border border-taupe/30 rounded-lg px-3 py-2 text-sm text-espresso focus:outline-none focus:ring-2 focus:ring-gold/40"
            >
              <option value="vaccination_record">Vaccination Record</option>
              <option value="vet_record">Vet Record</option>
              <option value="service_agreement">Service Agreement</option>
              <option value="liability_waiver">Liability Waiver</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-espresso mb-1">File</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.heic"
              onChange={e => setDocUploadFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-espresso file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-cream file:text-espresso hover:file:bg-cream/70"
            />
            <p className="text-xs text-taupe mt-1">PDF, Word (.doc, .docx), JPG, PNG, HEIC — max 10 MB</p>
          </div>
          {docUploadError && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{docUploadError}</div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowDocUpload(false)}>Cancel</Button>
            <Button
              loading={uploadDocument.isPending}
              disabled={!docUploadClient || !docUploadFile}
              onClick={() => uploadDocument.mutate()}
            >
              Upload
            </Button>
          </div>
        </div>
      </Modal>

      {/* Document Preview Modal */}
      <Modal open={!!previewDoc} onClose={() => setPreviewDoc(null)} title={previewDoc?.filename ?? 'Document Preview'} size="2xl">
        {previewDoc && (() => {
          const st = docStatus(previewDoc);
          return (
            <div className="space-y-4">
              {/* Document info */}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Badge variant={statusBadge(st)}>{st}</Badge>
                {previewDoc.user?.name && (
                  <span className="text-taupe">Client: <strong className="text-espresso">{previewDoc.user.name}</strong></span>
                )}
                {previewDoc.template && (
                  <span className="text-taupe">Template: <strong className="text-espresso">{previewDoc.template.name}</strong></span>
                )}
                {previewDoc.signed_at && (
                  <span className="text-taupe">Signed: <strong className="text-espresso">{format(new Date(previewDoc.signed_at), 'MMM d, yyyy')}</strong></span>
                )}
                {previewDoc.signer_name && (
                  <span className="text-taupe">By: <strong className="text-espresso">{previewDoc.signer_name}</strong></span>
                )}
              </div>

              {/* Warning: needs fields */}
              {st === 'draft' && needsFields(previewDoc) && (
                <div className="text-sm bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-amber-800">
                  This document was created from a template but has no signing fields defined yet. Please define fields on the template before sending for signature.
                </div>
              )}

              {/* PDF preview */}
              <DocumentPreviewFrame docId={previewDoc.id} />

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-cream">
                <div className="flex gap-2">
                  {st === 'draft' && canSend(previewDoc) && (
                    <Button
                      onClick={() => { setSendError(''); sendDoc.mutate(previewDoc.id); setPreviewDoc(null); }}
                      loading={sendDoc.isPending}
                    >
                      Send for Signing
                    </Button>
                  )}
                  {st === 'draft' && needsFields(previewDoc) && (
                    <Button
                      variant="outline"
                      onClick={() => { setPreviewDoc(null); navigate(`/admin/documents/templates/${previewDoc.template_id}/edit`); }}
                    >
                      Define Fields First
                    </Button>
                  )}
                  {previewDoc.signed_pdf_path && (
                    <button
                      onClick={async () => {
                        const res = await api.get(`/documents/${previewDoc.id}`, { responseType: 'blob' });
                        const url = URL.createObjectURL(res.data);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = previewDoc.filename || 'document.pdf';
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="inline-flex items-center px-4 py-2 rounded-lg border border-taupe/30 text-sm font-medium text-espresso hover:bg-cream transition-colors"
                    >
                      Download Certificate
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setPreviewDoc(null); navigate(`/admin/clients/${previewDoc.user_id}`); }}
                    className="text-sm text-blue hover:underline"
                  >
                    Go to Client
                  </button>
                  <Button variant="outline" onClick={() => setPreviewDoc(null)}>Close</Button>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
