import React, { useState } from 'react';
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


export default function AdminDocumentsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'all' | 'templates' | 'signed' | 'sent' | 'drafts'>('all');
  const [search, setSearch] = useState('');

  // Upload template modal
  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');

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
  const { data: docsData, isLoading: docsLoading } = useQuery({
    queryKey: ['admin-documents', statusFilter, search],
    queryFn: () => api.get('/admin/documents', { params: { status: statusFilter, search: search || undefined } }).then(r => r.data),
    enabled: tab !== 'templates',
  });

  // Clients for picker
  const { data: clients } = useQuery({
    queryKey: ['admin-clients-simple'],
    queryFn: () => api.get('/admin/clients').then(r => r.data.data),
  });

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
      navigate(`/admin/clients/${res.data.data.user_id}`);
    },
    onError: (e: any) => setUseError(e.response?.data?.message || 'Failed.'),
  });

  // Delete template
  const deleteTemplate = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/document-templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['document-templates'] }),
  });

  // Send for signing
  const sendDoc = useMutation({
    mutationFn: (docId: number) => api.post(`/admin/documents/${docId}/send`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-documents'] }),
  });

  const docStatus = (doc: any): string => {
    if (doc.signed_at) return 'signed';
    if (doc.sent_at) return 'sent';
    return doc.status || 'draft';
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
        {tab === 'templates' && (
          <Button onClick={() => setShowUpload(true)}>+ New Template</Button>
        )}
      </div>

      {/* Tabs + search */}
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
          <Input
            placeholder="Search documents or clients..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="sm:max-w-xs"
          />
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
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-cream text-left">
                        <th className="px-6 py-4 font-semibold text-espresso">Template</th>
                        <th className="px-6 py-4 font-semibold text-espresso">Fields</th>
                        <th className="px-6 py-4 font-semibold text-espresso">Used</th>
                        <th className="px-6 py-4 font-semibold text-espresso">Created</th>
                        <th className="px-6 py-4"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {templates.map((t: any) => (
                        <tr key={t.id} className="border-b border-cream last:border-0 hover:bg-cream/50">
                          <td className="px-6 py-4">
                            <div className="font-medium text-espresso">{t.name}</div>
                            <div className="text-xs text-taupe">{t.pdf_filename}</div>
                          </td>
                          <td className="px-6 py-4 text-taupe">{t.fields_count} fields</td>
                          <td className="px-6 py-4 text-taupe">{t.documents_count}x</td>
                          <td className="px-6 py-4 text-xs text-taupe">
                            {t.created_at ? format(new Date(t.created_at), 'MMM d, yyyy') : '—'}
                          </td>
                          <td className="px-6 py-4">
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
                </div>
              </Card>
            )}
          </div>
        )
      )}

      {/* Documents tabs (all, drafts, sent, signed) */}
      {tab !== 'templates' && (
        docsLoading ? <PageLoader /> : (
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cream text-left">
                    <th className="px-6 py-4 font-semibold text-espresso">Document</th>
                    <th className="px-6 py-4 font-semibold text-espresso">Client</th>
                    <th className="px-6 py-4 font-semibold text-espresso">Status</th>
                    <th className="px-6 py-4 font-semibold text-espresso">Date</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {(docsData?.data ?? []).map((doc: any) => {
                    const st = docStatus(doc);
                    return (
                      <tr key={doc.id} className="border-b border-cream last:border-0 hover:bg-cream/50">
                        <td className="px-6 py-4">
                          <div className="font-medium text-espresso">{doc.filename}</div>
                          {doc.template && (
                            <div className="text-xs text-taupe">From: {doc.template.name}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-taupe">{doc.user?.name ?? '—'}</td>
                        <td className="px-6 py-4">
                          <Badge variant={statusBadge(st)}>{st}</Badge>
                        </td>
                        <td className="px-6 py-4 text-xs text-taupe">
                          {doc.signed_at
                            ? format(new Date(doc.signed_at), 'MMM d, yyyy')
                            : doc.sent_at
                            ? format(new Date(doc.sent_at), 'MMM d, yyyy')
                            : doc.created_at
                            ? format(new Date(doc.created_at), 'MMM d, yyyy')
                            : '—'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            {st === 'draft' && (
                              <button
                                onClick={() => sendDoc.mutate(doc.id)}
                                className="text-gold hover:text-gold/80 text-sm font-medium"
                              >
                                Send
                              </button>
                            )}
                            <button
                              onClick={() => setPreviewDoc(doc)}
                              className="text-blue hover:underline text-sm"
                            >
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {(docsData?.data ?? []).length === 0 && (
              <div className="text-center py-12 text-taupe">No documents found.</div>
            )}
          </Card>
        )
      )}

      {/* Upload Template Modal */}
      <Modal open={showUpload} onClose={() => setShowUpload(false)} title="New Document Template">
        <div className="space-y-4">
          <p className="text-sm text-taupe">
            Upload a PDF document. You'll be able to add form fields (name, signature, date, etc.) in the next step.
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
            <label className="block text-sm font-medium text-espresso mb-1">PDF File</label>
            <input
              type="file"
              accept=".pdf"
              onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-espresso file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-cream file:text-espresso hover:file:bg-cream/70"
            />
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
          {useModal?.fields_count > 0 && (
            <div className="text-xs text-taupe bg-cream/50 rounded-lg px-3 py-2">
              This template has {useModal.fields_count} form field{useModal.fields_count !== 1 ? 's' : ''} that will be pre-filled with the client's information.
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
              Create Draft
            </Button>
          </div>
        </div>
      </Modal>

      {/* Document Preview Modal */}
      <Modal open={!!previewDoc} onClose={() => setPreviewDoc(null)} title={previewDoc?.filename ?? 'Document Preview'} size="2xl">
        {previewDoc && (() => {
          const apiBase = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:8000';
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

              {/* PDF preview */}
              <div className="border border-cream rounded-lg overflow-hidden bg-gray-100">
                <iframe
                  src={`${apiBase}/api/documents/${previewDoc.id}?inline=1`}
                  className="w-full border-0"
                  style={{ height: 560 }}
                  title="Document preview"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-cream">
                <div className="flex gap-2">
                  {st === 'draft' && (
                    <Button
                      onClick={() => { sendDoc.mutate(previewDoc.id); setPreviewDoc(null); }}
                      loading={sendDoc.isPending}
                    >
                      Send for Signing
                    </Button>
                  )}
                  {previewDoc.signed_pdf_path && (
                    <a
                      href={`${apiBase}/api/documents/${previewDoc.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-2 rounded-lg border border-taupe/30 text-sm font-medium text-espresso hover:bg-cream transition-colors"
                    >
                      Download Certificate
                    </a>
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
