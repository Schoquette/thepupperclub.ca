import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import RichTextEditor from '@/components/ui/RichTextEditor';
import type { RichTextEditorHandle } from '@/components/ui/RichTextEditor';
import { format } from 'date-fns';

interface Template {
  id: number;
  name: string;
  subject: string;
  body: string;
  created_at: string;
}

interface SystemTemplate {
  key: string;
  name: string;
  description: string;
  tokens: string[];
  default_subject: string;
  default_body: string;
  custom_subject: string | null;
  custom_body: string | null;
  is_customized: boolean;
  updated_at: string | null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminBroadcastPage() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inlineImageInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<RichTextEditorHandle>(null);
  const [inlineUploading, setInlineUploading] = useState(false);

  // Compose state
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientMode, setRecipientMode] = useState<'all' | 'specific'>('all');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sendEmail, setSendEmail] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [success, setSuccess] = useState('');
  const [apiError, setApiError] = useState('');

  // Template state
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateTab, setTemplateTab] = useState<'system' | 'marketing'>('system');
  const [templateName, setTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showEditTemplate, setShowEditTemplate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editName, setEditName] = useState('');
  const [templateError, setTemplateError] = useState('');
  const [templateSuccess, setTemplateSuccess] = useState('');
  const [previewingSystemKey, setPreviewingSystemKey] = useState<string | null>(null);
  const [systemPreviewHtml, setSystemPreviewHtml] = useState('');
  const [systemPreviewLoading, setSystemPreviewLoading] = useState(false);
  const [editingSystem, setEditingSystem] = useState<SystemTemplate | null>(null);
  const [sysEditSubject, setSysEditSubject] = useState('');
  const [sysEditBody, setSysEditBody] = useState('');
  const sysEditorRef = useRef<RichTextEditorHandle>(null);

  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewTab, setPreviewTab] = useState<'app' | 'email'>('email');
  const [previewData, setPreviewData] = useState<{
    email_html: string;
    html_body: string;
    title: string;
    body: string;
    preview_user: { id: number; name: string } | null;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Data
  const { data: clientsData } = useQuery({
    queryKey: ['admin-clients-broadcast'],
    queryFn: () => api.get('/admin/clients').then(r => r.data.data),
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['broadcast-history'],
    queryFn: () => api.get('/admin/notifications/history').then(r => r.data),
  });

  const { data: templates } = useQuery<Template[]>({
    queryKey: ['broadcast-templates'],
    queryFn: () => api.get('/admin/broadcast-templates').then(r => r.data.data),
  });

  const { data: systemTemplates } = useQuery<SystemTemplate[]>({
    queryKey: ['system-templates'],
    queryFn: () => api.get('/admin/system-templates').then(r => r.data.data),
  });

  // Mutations
  const send = useMutation({
    mutationFn: (payload: { title: string; body: string; recipients: (string | number)[]; send_email: boolean; attachments: File[] }) => {
      const fd = new FormData();
      fd.append('title', payload.title);
      fd.append('body', payload.body);
      fd.append('send_email', payload.send_email ? '1' : '0');
      payload.recipients.forEach((r, i) => fd.append(`recipients[${i}]`, String(r)));
      payload.attachments.forEach(f => fd.append('attachments[]', f));
      return api.post('/admin/notifications/broadcast', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: (res) => {
      setSuccess(res.data.message ?? 'Broadcast sent!');
      setSubject('');
      setBody('');
      setSelectedIds([]);
      setAttachments([]);
      setApiError('');
      qc.invalidateQueries({ queryKey: ['broadcast-history'] });
    },
    onError: (err: any) => {
      setApiError(err.response?.data?.message ?? 'Failed to send broadcast.');
    },
  });

  const saveTemplate = useMutation({
    mutationFn: (payload: { name: string; subject: string; body: string; id?: number }) => {
      if (payload.id) {
        return api.patch(`/admin/broadcast-templates/${payload.id}`, payload);
      }
      return api.post('/admin/broadcast-templates', payload);
    },
    onSuccess: (_res, variables) => {
      setShowSaveTemplate(false);
      setShowEditTemplate(false);
      setTemplateName('');
      setEditingTemplate(null);
      setEditName('');
      setEditSubject('');
      setEditBody('');
      setTemplateError('');
      setTemplateSuccess(variables.id ? `Template "${variables.name}" updated.` : `Template "${variables.name}" saved.`);
      setTimeout(() => setTemplateSuccess(''), 4000);
      qc.invalidateQueries({ queryKey: ['broadcast-templates'] });
    },
    onError: (err: any) => {
      setTemplateError(err.response?.data?.message ?? 'Failed to save template.');
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/broadcast-templates/${id}`),
    onSuccess: () => {
      setTemplateSuccess('Template deleted.');
      setTimeout(() => setTemplateSuccess(''), 4000);
      qc.invalidateQueries({ queryKey: ['broadcast-templates'] });
    },
  });

  const saveSystemTemplate = useMutation({
    mutationFn: (payload: { key: string; subject: string; body: string }) =>
      api.put(`/admin/system-templates/${payload.key}`, { subject: payload.subject, body: payload.body }),
    onSuccess: () => {
      setEditingSystem(null);
      setTemplateSuccess('System template updated.');
      setTimeout(() => setTemplateSuccess(''), 4000);
      qc.invalidateQueries({ queryKey: ['system-templates'] });
    },
    onError: (err: any) => setTemplateError(err.response?.data?.message ?? 'Failed to save.'),
  });

  const resetSystemTemplate = useMutation({
    mutationFn: (key: string) => api.delete(`/admin/system-templates/${key}`),
    onSuccess: () => {
      setEditingSystem(null);
      setTemplateSuccess('Template reset to default.');
      setTimeout(() => setTemplateSuccess(''), 4000);
      qc.invalidateQueries({ queryKey: ['system-templates'] });
    },
  });

  const handleSend = () => {
    if (!subject.trim() || !body.trim()) return;
    setSuccess('');
    setApiError('');
    send.mutate({
      title: subject.trim(),
      body: body,
      recipients: recipientMode === 'all' ? ['all'] : selectedIds,
      send_email: sendEmail,
      attachments,
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) setAttachments(prev => [...prev, ...files]);
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleInlineImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setInlineUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await api.post('/admin/notifications/inline-image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res.data.url;
      editorRef.current?.insertHTML(
        `<img src="${url}" alt="${file.name}" style="max-width:100%;border-radius:8px;margin:8px 0;" />`
      );
    } catch {
      setApiError('Failed to upload image.');
    } finally {
      setInlineUploading(false);
    }
  };

  const handlePreview = async () => {
    if (!subject.trim() || !body.trim()) return;
    setPreviewLoading(true);
    try {
      const res = await api.post('/admin/notifications/preview', {
        title: subject.trim(),
        body,
      });
      setPreviewData(res.data);
      setShowPreview(true);
    } catch {
      setApiError('Failed to generate preview.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSaveNewTemplate = () => {
    const name = templateName.trim();
    if (!name || !subject.trim()) return;
    saveTemplate.mutate({ name, subject: subject.trim(), body });
  };

  const handleUpdateEditingTemplate = () => {
    if (!editingTemplate || !editName.trim() || !editSubject.trim()) return;
    saveTemplate.mutate({
      id: editingTemplate.id,
      name: editName.trim(),
      subject: editSubject.trim(),
      body: editBody,
    });
    setShowEditTemplate(false);
  };

  const useTemplate = (t: Template) => {
    setSubject(t.subject);
    setBody(t.body);
    setShowTemplates(false);
  };

  const openEditTemplate = (t: Template) => {
    setEditingTemplate(t);
    setEditName(t.name);
    setEditSubject(t.subject);
    setEditBody(t.body);
    setShowTemplates(false);
    setShowEditTemplate(true);
  };

  const duplicateTemplate = (t: Template) => {
    saveTemplate.mutate({
      name: `${t.name} (copy)`,
      subject: t.subject,
      body: t.body,
    });
  };

  const openSaveAsNew = () => {
    setTemplateName('');
    setTemplateError('');
    setShowSaveTemplate(true);
  };

  const openEditSystem = (st: SystemTemplate) => {
    setEditingSystem(st);
    setSysEditSubject(st.custom_subject ?? st.default_subject);
    setSysEditBody(st.custom_body ?? st.default_body);
    setTemplateError('');
    setShowTemplates(false);
  };

  const previewSystemTemplate = async (key: string) => {
    setSystemPreviewLoading(true);
    setPreviewingSystemKey(key);
    try {
      const res = await api.get(`/admin/system-templates/${key}/preview`);
      setSystemPreviewHtml(res.data.html);
    } catch {
      setSystemPreviewHtml('<p style="padding:24px;color:#999;">Failed to load preview.</p>');
    } finally {
      setSystemPreviewLoading(false);
    }
  };

  const toggleClient = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Deduplicate broadcast history
  const broadcasts = useMemo(() => {
    const all: any[] = historyData?.data ?? [];
    const seen = new Map<string, any & { count: number }>();
    for (const n of all) {
      if (n.data?.type !== 'broadcast') continue;
      const key = `${n.title}||${n.body}||${n.sent_at?.substring(0, 16)}`;
      if (seen.has(key)) {
        seen.get(key)!.count++;
      } else {
        seen.set(key, { ...n, count: 1 });
      }
    }
    return Array.from(seen.values());
  }, [historyData]);

  const canSend = subject.trim() && body.trim() && (recipientMode === 'all' || selectedIds.length > 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Broadcast</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowTemplates(true)}>
            Templates
          </Button>
        </div>
      </div>

      {/* Template confirmation toast */}
      {templateSuccess && (
        <div className="bg-green-50 text-green-700 text-sm font-medium px-4 py-2.5 rounded-lg flex items-center justify-between">
          <span>{templateSuccess}</span>
          <button onClick={() => setTemplateSuccess('')} className="text-green-500 hover:text-green-700 ml-3">&times;</button>
        </div>
      )}

      {/* Compose — Gmail-style */}
      <Card>
        <div className="space-y-4">
          {/* Recipients bar */}
          <div className="flex items-center gap-3 border-b border-cream pb-3">
            <span className="text-sm text-taupe font-medium w-10">To:</span>
            <div className="flex gap-2 flex-1">
              {(['all', 'specific'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setRecipientMode(mode)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    recipientMode === mode
                      ? 'bg-espresso text-cream border-espresso'
                      : 'border-taupe/30 text-espresso hover:bg-cream'
                  }`}
                >
                  {mode === 'all' ? 'All Clients' : 'Specific Clients'}
                </button>
              ))}
              {recipientMode === 'specific' && selectedIds.length > 0 && (
                <span className="text-xs text-taupe self-center ml-1">
                  {selectedIds.length} selected
                </span>
              )}
            </div>
          </div>

          {/* Client picker */}
          {recipientMode === 'specific' && (
            <div className="border border-cream rounded-lg divide-y divide-cream max-h-40 overflow-y-auto">
              {(clientsData ?? []).length === 0 && (
                <p className="text-sm text-taupe p-3">No clients found.</p>
              )}
              {(clientsData ?? []).map((c: any) => (
                <label key={c.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-cream/50">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(c.id)}
                    onChange={() => toggleClient(c.id)}
                    className="h-4 w-4 rounded border-taupe text-gold focus:ring-gold"
                  />
                  <span className="text-sm text-espresso">{c.name}</span>
                  <span className="text-xs text-taupe ml-auto">{c.email}</span>
                </label>
              ))}
            </div>
          )}

          {/* Subject line */}
          <div className="flex items-center gap-3 border-b border-cream pb-3">
            <span className="text-sm text-taupe font-medium w-10">Subj:</span>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Subject line"
              className="flex-1 text-sm text-espresso placeholder-taupe outline-none bg-transparent"
            />
          </div>

          {/* Rich text body */}
          <RichTextEditor
            ref={editorRef}
            value={body}
            onChange={setBody}
            placeholder="Write your message..."
            minHeight="250px"
          />

          {/* Tokens — click to insert at cursor */}
          <div className="flex items-center gap-2 flex-wrap text-xs text-taupe bg-cream/40 rounded-lg px-3 py-2">
            <span className="font-medium text-espresso">Insert token:</span>
            {[
              ['{client_first_name}', 'First name'],
              ['{client_name}', 'Full name'],
              ['{dog_name}', 'First dog'],
              ['{dog_names}', 'All dogs'],
            ].map(([token, label]) => (
              <button
                key={token}
                type="button"
                onClick={() => editorRef.current?.insertText(token)}
                className="bg-white border border-taupe/20 rounded px-1.5 py-0.5 font-mono hover:border-gold hover:text-gold transition-colors cursor-pointer"
                title={`${label} — click to insert`}
              >
                {token}
              </button>
            ))}
          </div>

          {/* Attachments & Insert Photo */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
              onChange={handleFileSelect}
              className="hidden"
            />
            <input
              ref={inlineImageInputRef}
              type="file"
              accept="image/*"
              onChange={handleInlineImage}
              className="hidden"
            />
            <div className="flex items-center gap-4">
              <button
                onClick={() => inlineImageInputRef.current?.click()}
                disabled={inlineUploading}
                className="inline-flex items-center gap-1.5 text-sm text-taupe hover:text-espresso transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {inlineUploading ? 'Uploading...' : 'Insert photo'}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 text-sm text-taupe hover:text-espresso transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                Attach files
              </button>
            </div>

            {attachments.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {attachments.map((file, i) => {
                  const isImage = file.type.startsWith('image/');
                  return (
                    <div key={i} className="flex items-center gap-2 bg-cream/50 rounded-lg px-3 py-2 text-sm">
                      {isImage ? (
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="w-8 h-8 rounded object-cover flex-shrink-0"
                        />
                      ) : (
                        <span className="w-8 h-8 rounded bg-taupe/10 flex items-center justify-center text-xs text-taupe flex-shrink-0">
                          {file.name.split('.').pop()?.toUpperCase()}
                        </span>
                      )}
                      <span className="text-espresso truncate flex-1">{file.name}</span>
                      <span className="text-xs text-taupe flex-shrink-0">{formatFileSize(file.size)}</span>
                      <button
                        onClick={() => removeAttachment(i)}
                        className="text-taupe hover:text-red-500 flex-shrink-0 ml-1"
                      >
                        &times;
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Options bar */}
          <div className="flex items-center justify-between border-t border-cream pt-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={e => setSendEmail(e.target.checked)}
                className="h-4 w-4 rounded border-taupe text-gold focus:ring-gold"
              />
              <span className="text-sm text-espresso">Also send as email</span>
            </label>

            <div className="flex gap-2">
              <Button variant="outline" onClick={openSaveAsNew} disabled={!subject.trim()}>
                Save as New Template
              </Button>
              <Button
                variant="outline"
                loading={previewLoading}
                disabled={!subject.trim() || !body.trim()}
                onClick={handlePreview}
              >
                Preview
              </Button>
              <Button
                loading={send.isPending}
                disabled={!canSend}
                onClick={handleSend}
              >
                Send Broadcast
              </Button>
            </div>
          </div>

          {success && (
            <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{success}</p>
          )}
          {apiError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{apiError}</p>
          )}
        </div>
      </Card>

      {/* History */}
      <div>
        <h2 className="text-lg font-display text-espresso mb-3">Sent</h2>
        {historyLoading ? (
          <PageLoader />
        ) : broadcasts.length === 0 ? (
          <Card>
            <p className="text-center py-8 text-taupe">No broadcasts sent yet.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {broadcasts.map((n: any, i: number) => (
              <Card key={i} padding="sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-espresso text-sm">{n.title}</div>
                    <div className="text-sm text-taupe mt-0.5 line-clamp-2">{n.body}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs text-taupe">
                      {n.sent_at ? format(new Date(n.sent_at), 'MMM d, yyyy · h:mm a') : '—'}
                    </div>
                    <div className="text-xs text-taupe mt-0.5">
                      {n.count} recipient{n.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Templates panel */}
      <Modal open={showTemplates} onClose={() => { setShowTemplates(false); setPreviewingSystemKey(null); }} title="Templates" size="lg">
        {/* Category tabs */}
        <div className="flex gap-1 border-b border-cream mb-4">
          {(['system', 'marketing'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => { setTemplateTab(tab); setPreviewingSystemKey(null); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                templateTab === tab
                  ? 'border-gold text-espresso'
                  : 'border-transparent text-taupe hover:text-espresso'
              }`}
            >
              {tab === 'system' ? 'System Templates' : 'Marketing Templates'}
            </button>
          ))}
        </div>

        {/* System Templates */}
        {templateTab === 'system' && (
          <div className="space-y-3">
            <p className="text-xs text-taupe">
              These templates are sent automatically by the system. You can edit any template or preview it with sample data.
            </p>
            {(systemTemplates ?? []).map(st => (
              <div key={st.key}>
                <div
                  className="border border-cream rounded-lg p-3 hover:bg-cream/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-espresso text-sm">{st.name}</span>
                        {st.is_customized && (
                          <span className="text-[10px] bg-gold/15 text-gold rounded-full px-2 py-0.5 font-medium">Customized</span>
                        )}
                      </div>
                      <div className="text-xs text-taupe mt-1">{st.description}</div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {st.tokens.map(v => (
                          <span key={v} className="text-[10px] bg-cream rounded px-1.5 py-0.5 font-mono text-taupe">
                            {v}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => openEditSystem(st)}
                        className="text-xs text-espresso hover:text-espresso/70 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => previewingSystemKey === st.key ? setPreviewingSystemKey(null) : previewSystemTemplate(st.key)}
                        className="text-xs text-gold hover:text-gold/80 font-medium"
                      >
                        {previewingSystemKey === st.key ? 'Hide' : 'Preview'}
                      </button>
                    </div>
                  </div>
                </div>
                {previewingSystemKey === st.key && (
                  <div className="border border-cream border-t-0 rounded-b-lg overflow-hidden bg-[#F6F3EE]">
                    {systemPreviewLoading ? (
                      <div className="text-center py-8 text-taupe text-sm">Loading preview...</div>
                    ) : (
                      <iframe
                        srcDoc={systemPreviewHtml}
                        title={`${st.name} preview`}
                        className="w-full border-0"
                        style={{ height: '480px' }}
                        sandbox="allow-same-origin"
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Marketing Templates */}
        {templateTab === 'marketing' && (
          <div className="space-y-3">
            <p className="text-xs text-taupe">
              Your custom templates for broadcast messages. Compose a message and click "Save as New Template" to create one.
            </p>
            {(templates ?? []).length === 0 ? (
              <p className="text-sm text-taupe py-4 text-center">No marketing templates saved yet.</p>
            ) : (
              (templates ?? []).map(t => (
                <div
                  key={t.id}
                  className="border border-cream rounded-lg p-3 hover:bg-cream/30 transition-colors"
                >
                  <div className="flex-1 min-w-0 mb-2">
                    <div className="font-semibold text-espresso text-sm">{t.name}</div>
                    <div className="text-xs text-taupe mt-0.5">Subject: {t.subject}</div>
                    <div
                      className="text-xs text-taupe mt-1 line-clamp-2"
                      dangerouslySetInnerHTML={{ __html: t.body }}
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap border-t border-cream pt-2">
                    <button
                      onClick={() => useTemplate(t)}
                      className="text-xs text-gold hover:text-gold/80 font-medium"
                    >
                      Use Template
                    </button>
                    <span className="text-cream">|</span>
                    <button
                      onClick={() => openEditTemplate(t)}
                      className="text-xs text-espresso hover:text-espresso/70 font-medium"
                    >
                      Edit
                    </button>
                    <span className="text-cream">|</span>
                    <button
                      onClick={() => duplicateTemplate(t)}
                      className="text-xs text-espresso hover:text-espresso/70 font-medium"
                    >
                      Duplicate
                    </button>
                    <span className="text-cream">|</span>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${t.name}"?`)) deleteTemplate.mutate(t.id);
                      }}
                      className="text-xs text-red-400 hover:text-red-600 font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </Modal>

      {/* Save as new template dialog */}
      <Modal open={showSaveTemplate} onClose={() => setShowSaveTemplate(false)} title="Save as New Template">
        <div className="space-y-4">
          {templateError && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-lg">{templateError}</div>
          )}
          <Input
            label="Template Name"
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
            placeholder="e.g. Holiday Schedule, Service Update"
          />
          <p className="text-xs text-taupe">
            The current subject and message body will be saved as a new template. This will not affect any existing templates.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowSaveTemplate(false)}>Cancel</Button>
            <Button
              loading={saveTemplate.isPending}
              disabled={!templateName.trim()}
              onClick={handleSaveNewTemplate}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit template dialog */}
      <Modal open={showEditTemplate} onClose={() => setShowEditTemplate(false)} title="Edit Template" size="lg">
        <div className="space-y-4">
          <Input
            label="Template Name"
            value={editName}
            onChange={e => setEditName(e.target.value)}
          />
          <Input
            label="Subject"
            value={editSubject}
            onChange={e => setEditSubject(e.target.value)}
          />
          <div>
            <label className="label">Body</label>
            <RichTextEditor
              value={editBody}
              onChange={setEditBody}
              placeholder="Template body..."
              minHeight="200px"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowEditTemplate(false)}>Cancel</Button>
            <Button
              loading={saveTemplate.isPending}
              disabled={!editName.trim() || !editSubject.trim()}
              onClick={handleUpdateEditingTemplate}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit system template modal */}
      <Modal open={!!editingSystem} onClose={() => setEditingSystem(null)} title={`Edit: ${editingSystem?.name ?? ''}`} size="lg">
        {editingSystem && (
          <div className="space-y-4">
            {templateError && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-lg">{templateError}</div>
            )}
            <Input
              label="Subject"
              value={sysEditSubject}
              onChange={e => setSysEditSubject(e.target.value)}
            />
            <div>
              <label className="label">Body</label>
              <RichTextEditor
                ref={sysEditorRef}
                value={sysEditBody}
                onChange={setSysEditBody}
                placeholder="Template body..."
                minHeight="250px"
              />
            </div>
            {/* Token insertion */}
            <div className="flex items-center gap-2 flex-wrap text-xs text-taupe bg-cream/40 rounded-lg px-3 py-2">
              <span className="font-medium text-espresso">Insert token:</span>
              {editingSystem.tokens.map(token => (
                <button
                  key={token}
                  type="button"
                  onClick={() => sysEditorRef.current?.insertText(token)}
                  className="bg-white border border-taupe/20 rounded px-1.5 py-0.5 font-mono hover:border-gold hover:text-gold transition-colors cursor-pointer"
                >
                  {token}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-cream">
              <div>
                {editingSystem.is_customized && (
                  <button
                    onClick={() => {
                      if (confirm('Reset this template to the default? Your customizations will be lost.')) {
                        resetSystemTemplate.mutate(editingSystem.key);
                      }
                    }}
                    className="text-xs text-red-400 hover:text-red-600 font-medium"
                  >
                    Reset to Default
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setEditingSystem(null)}>Cancel</Button>
                <Button
                  loading={saveSystemTemplate.isPending}
                  disabled={!sysEditSubject.trim() || !sysEditBody.trim()}
                  onClick={() => saveSystemTemplate.mutate({
                    key: editingSystem.key,
                    subject: sysEditSubject.trim(),
                    body: sysEditBody,
                  })}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Preview modal */}
      <Modal open={showPreview} onClose={() => setShowPreview(false)} title="Broadcast Preview" size="2xl">
        {previewData && (
          <div className="space-y-4">
            {/* Preview-as indicator */}
            {previewData.preview_user && (
              <div className="text-xs text-taupe bg-cream/50 rounded-lg px-3 py-2">
                Previewing as: <strong className="text-espresso">{previewData.preview_user.name}</strong>
                <span className="ml-1">(tokens replaced with this client's data)</span>
              </div>
            )}

            {/* Tab switcher */}
            <div className="flex gap-1 border-b border-cream">
              {(['email', 'app'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setPreviewTab(tab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    previewTab === tab
                      ? 'border-gold text-espresso'
                      : 'border-transparent text-taupe hover:text-espresso'
                  }`}
                >
                  {tab === 'email' ? 'Email' : 'In-App Message'}
                </button>
              ))}
            </div>

            {/* Email preview */}
            {previewTab === 'email' && (
              <div className="border border-cream rounded-lg overflow-hidden bg-[#F6F3EE]">
                <iframe
                  srcDoc={previewData.email_html}
                  title="Email preview"
                  className="w-full border-0"
                  style={{ height: '520px' }}
                  sandbox="allow-same-origin"
                />
              </div>
            )}

            {/* In-app preview */}
            {previewTab === 'app' && (
              <div className="bg-cream/30 rounded-lg p-6 flex justify-center">
                <div className="w-full max-w-md space-y-3">
                  {/* Notification card — matches MessageBubble rendering */}
                  <div className="rounded-2xl overflow-hidden shadow-card border border-cream">
                    <div className="bg-blue px-4 py-2.5 flex items-center gap-2">
                      <span className="text-white text-sm">🐾</span>
                      <span className="font-display text-white text-sm tracking-wide flex-1">{previewData.title}</span>
                    </div>
                    <div className="bg-white p-4">
                      <div
                        className="text-sm text-espresso leading-relaxed [&_a]:text-blue [&_a]:underline [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-1 [&_p]:mb-2 [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:pl-5 [&_ol]:mb-2 [&_li]:mb-0.5 [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-2"
                        dangerouslySetInnerHTML={{ __html: previewData.html_body }}
                      />
                      <div className="text-xs text-taupe mt-3">just now</div>
                    </div>
                  </div>

                  {/* Attachment previews — shown as separate photo bubbles */}
                  {attachments.length > 0 && (
                    <div className="space-y-2">
                      {attachments.map((f, i) => {
                        const isImage = f.type.startsWith('image/');
                        return (
                          <div key={i} className="flex justify-start">
                            <div>
                              {isImage ? (
                                <img
                                  src={URL.createObjectURL(f)}
                                  alt={f.name}
                                  className="rounded-2xl max-h-48 max-w-[18rem] object-cover shadow-card"
                                />
                              ) : (
                                <div className="bg-white rounded-2xl shadow-card border border-cream px-4 py-3 flex items-center gap-2">
                                  <span className="w-8 h-8 rounded bg-taupe/10 flex items-center justify-center text-[10px] text-taupe font-bold">
                                    {f.name.split('.').pop()?.toUpperCase()}
                                  </span>
                                  <span className="text-sm text-espresso">{f.name}</span>
                                </div>
                              )}
                              <div className="text-xs text-taupe mt-1">just now</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2 border-t border-cream">
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                Back to Edit
              </Button>
              <Button
                loading={send.isPending}
                disabled={!canSend}
                onClick={() => {
                  setShowPreview(false);
                  handleSend();
                }}
              >
                Send Broadcast
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
