import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/LoadingSpinner';

export default function AdminClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'profile' | 'dogs' | 'documents' | 'access'>('profile');

  const { data: client, isLoading } = useQuery({
    queryKey: ['admin-client', id],
    queryFn: () => api.get(`/admin/clients/${id}`).then(r => r.data.data),
  });

  const { data: homeAccess } = useQuery({
    queryKey: ['admin-client-access', id],
    queryFn: () => api.get(`/admin/clients/${id}/home-access`).then(r => r.data.data),
    enabled: tab === 'access',
  });

  const resend = useMutation({
    mutationFn: () => api.post(`/admin/clients/${id}/resend-invite`),
  });

  if (isLoading) return <PageLoader />;
  if (!client) return <div className="text-center py-12 text-taupe">Client not found.</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/admin/clients')} className="text-taupe hover:text-espresso">← Back</button>
        <div className="flex-1">
          <h1 className="page-title">{client.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={statusBadge(client.status)}>{client.status}</Badge>
            <span className="text-taupe text-sm">{client.email}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/admin/inbox/${client.id}`)}>
            💬 Message
          </Button>
          {client.status === 'pending' && (
            <Button variant="outline" size="sm" loading={resend.isPending} onClick={() => resend.mutate()}>
              Resend Invite
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-taupe/30">
        {(['profile', 'dogs', 'documents', 'access'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t ? 'border-gold text-gold' : 'border-transparent text-taupe hover:text-espresso'
            }`}
          >
            {t === 'access' ? 'Home Access' : t}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === 'profile' && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader title="Contact Info" />
            <dl className="space-y-3 text-sm">
              {[
                ['Phone', client.client_profile?.phone],
                ['Address', client.client_profile?.address],
                ['City', client.client_profile?.city],
                ['Province', client.client_profile?.province],
                ['Postal Code', client.client_profile?.postal_code],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between">
                  <dt className="text-taupe">{label}</dt>
                  <dd className="text-espresso font-medium">{value || '—'}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card>
            <CardHeader title="Emergency Contact" />
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-taupe">Name</dt>
                <dd className="text-espresso font-medium">{client.client_profile?.emergency_contact_name || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-taupe">Phone</dt>
                <dd className="text-espresso font-medium">{client.client_profile?.emergency_contact_phone || '—'}</dd>
              </div>
            </dl>
          </Card>
          <Card>
            <CardHeader title="Billing" />
            <dl className="space-y-3 text-sm">
              {[
                ['Method', client.client_profile?.billing_method?.replace('_', ' ')],
                ['Tier', client.client_profile?.subscription_tier],
                ['Start Date', client.client_profile?.subscription_start_date],
                ['End Date', client.client_profile?.subscription_end_date],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between">
                  <dt className="text-taupe">{label}</dt>
                  <dd className="text-espresso font-medium">{value || '—'}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      )}

      {/* Dogs tab */}
      {tab === 'dogs' && (
        <div className="grid gap-4 sm:grid-cols-2">
          {client.dogs?.map((dog: any) => (
            <Card key={dog.id}>
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-full bg-cream flex items-center justify-center text-2xl">🐕</div>
                <div className="flex-1">
                  <div className="font-semibold text-espresso">{dog.name}</div>
                  <div className="text-sm text-taupe">{dog.breed} · {dog.size}</div>
                  <div className="flex gap-2 mt-2">
                    {!dog.is_active && <Badge variant="red">Pending Review</Badge>}
                    {dog.bite_history && <Badge variant="red">⚠️ Bite History</Badge>}
                    {dog.has_expired_vaccinations && <Badge variant="gold">Vaccines Expiring</Badge>}
                  </div>
                </div>
              </div>
            </Card>
          ))}
          {!client.dogs?.length && (
            <div className="col-span-2 text-center py-8 text-taupe">No dogs on file.</div>
          )}
        </div>
      )}

      {/* Documents tab */}
      {tab === 'documents' && (
        <Card>
          <CardHeader title="Documents" />
          {client.documents?.length ? (
            <div className="space-y-2">
              {client.documents.map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between py-2 border-b border-cream last:border-0">
                  <div>
                    <div className="text-sm font-medium text-espresso">{doc.filename}</div>
                    <div className="text-xs text-taupe">{doc.type.replace(/_/g, ' ')} · uploaded by {doc.uploaded_by}</div>
                  </div>
                  <a href={doc.signed_url} target="_blank" rel="noopener noreferrer"
                    className="text-blue text-sm hover:underline">
                    Download
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-taupe">No documents on file.</p>
          )}
        </Card>
      )}

      {/* Home Access tab */}
      {tab === 'access' && (
        <Card>
          <CardHeader title="Home Access" subtitle="Codes are encrypted and only visible here." />
          {homeAccess ? (
            <dl className="space-y-3 text-sm">
              {[
                ['Entry Instructions', homeAccess.entry_instructions],
                ['Lockbox Code', homeAccess.lockbox_code],
                ['Door Code', homeAccess.door_code],
                ['Alarm Code', homeAccess.alarm_code],
                ['Key Location', homeAccess.key_location],
                ['Parking', homeAccess.parking_instructions],
                ['Notes', homeAccess.notes],
              ].map(([label, value]) => value && (
                <div key={String(label)} className="flex gap-4">
                  <dt className="w-36 text-taupe flex-shrink-0">{label}</dt>
                  <dd className="text-espresso font-mono bg-cream rounded px-2 py-0.5">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-center py-8 text-taupe">No home access info on file.</p>
          )}
        </Card>
      )}
    </div>
  );
}
