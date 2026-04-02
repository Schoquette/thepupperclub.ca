import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';

const TYPE_LABELS: Record<string, string> = {
  vaccination_record: 'Vaccination Record',
  vet_record:         'Vet Record',
  service_agreement:  'Service Agreement',
  liability_waiver:   'Liability Waiver',
  intake_form:        'Intake Form',
  other:              'Other',
};

function fileIcon(mime: string) {
  if (mime === 'application/pdf') return '📄';
  if (mime.startsWith('image/')) return '🖼️';
  return '📎';
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState('other');
  const [uploadError, setUploadError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['client-documents'],
    queryFn: () => api.get('/client/documents').then(r => r.data),
  });

  const docs: any[] = data?.data ?? [];

  const upload = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append('file', uploadFile!);
      form.append('type', uploadType);
      return api.post('/client/documents', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-documents'] });
      setUploading(false);
      setUploadFile(null);
      setUploadType('other');
      setUploadError('');
    },
    onError: (err: any) => {
      setUploadError(err.response?.data?.message ?? 'Upload failed.');
    },
  });

  const handleView = async (doc: any) => {
    const res = await api.get(`/documents/${doc.id}`, {
      responseType: 'blob',
      params: { inline: 1 },
    });
    const url = URL.createObjectURL(new Blob([res.data], { type: doc.mime_type }));
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const handleDownload = async (doc: any) => {
    const res = await api.get(`/documents/${doc.id}`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display text-espresso">My Documents</h1>
        <button
          onClick={() => { setUploading(v => !v); setUploadError(''); }}
          className="text-sm font-medium text-gold hover:underline"
        >
          {uploading ? 'Cancel' : '+ Upload'}
        </button>
      </div>

      {/* Upload form */}
      {uploading && (
        <Card>
          <h2 className="font-display text-espresso mb-4">Upload Document</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-espresso mb-1">File</label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.heic,.docx"
                onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-taupe file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-espresso file:text-cream hover:file:bg-espresso/90"
              />
              <p className="text-xs text-taupe mt-1">PDF, JPG, PNG, HEIC, DOCX — max 10 MB</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-espresso mb-1">Document Type</label>
              <select
                value={uploadType}
                onChange={e => setUploadType(e.target.value)}
                className="w-full border border-taupe/30 rounded-lg px-3 py-2 text-sm text-espresso focus:outline-none focus:ring-2 focus:ring-gold/40"
              >
                <option value="vaccination_record">Vaccination Record</option>
                <option value="vet_record">Vet Record</option>
                <option value="service_agreement">Service Agreement</option>
                <option value="liability_waiver">Liability Waiver</option>
                <option value="other">Other</option>
              </select>
            </div>
            {uploadError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{uploadError}</p>
            )}
            <button
              disabled={!uploadFile || upload.isPending}
              onClick={() => upload.mutate()}
              className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                uploadFile && !upload.isPending
                  ? 'bg-espresso text-cream hover:bg-espresso/90'
                  : 'bg-taupe/20 text-taupe cursor-not-allowed'
              }`}
            >
              {upload.isPending ? 'Uploading…' : 'Upload Document'}
            </button>
          </div>
        </Card>
      )}

      {/* Document list */}
      <Card>
        {isLoading ? (
          <p className="text-center py-8 text-taupe">Loading…</p>
        ) : docs.length === 0 ? (
          <div className="text-center py-10">
            <div className="text-4xl mb-3">📂</div>
            <p className="text-taupe text-sm">No documents on file yet.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {docs.map((doc: any) => (
              <div key={doc.id} className="flex items-center gap-3 py-3 border-b border-cream last:border-0">
                <div className="text-2xl flex-shrink-0">{fileIcon(doc.mime_type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-espresso truncate">{doc.filename}</div>
                  <div className="text-xs text-taupe mt-0.5">
                    {TYPE_LABELS[doc.type] ?? doc.type.replace(/_/g, ' ')}
                    {doc.dog && <span> · {doc.dog.name}</span>}
                    <span> · {formatBytes(doc.size_bytes)}</span>
                  </div>
                  {/* Signature status */}
                  {doc.signed_at ? (
                    <div className="text-xs text-green-700 font-medium mt-0.5">
                      ✓ Signed {new Date(doc.signed_at).toLocaleDateString('en-CA')}
                    </div>
                  ) : doc.signature_requested_at ? (
                    <div className="text-xs text-gold font-medium mt-0.5">
                      ⏳ Awaiting your signature
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button
                    onClick={() => handleView(doc)}
                    className="text-sm text-blue hover:underline font-medium"
                  >
                    View
                  </button>
                  <button
                    onClick={() => handleDownload(doc)}
                    className="text-sm text-taupe hover:text-espresso hover:underline"
                  >
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Pending signature nudge */}
      {docs.some((d: any) => d.signature_requested_at && !d.signed_at) && (
        <div className="bg-gold/10 border border-gold/30 rounded-xl p-4">
          <p className="text-sm font-medium text-espresso">
            You have a document awaiting your signature.
          </p>
          <p className="text-xs text-taupe mt-1">
            Check your messages for the signing link, or contact The Pupper Club.
          </p>
        </div>
      )}
    </div>
  );
}
