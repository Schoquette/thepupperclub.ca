import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/LoadingSpinner';

type Tab = 'profile' | 'dogs' | 'documents' | 'access';

interface ProfileForm {
  name: string;
  status: string;
  phone: string;
  address: string;
  city: string;
  province: string;
  postal_code: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  billing_method: string;
  subscription_tier: string;
  subscription_start_date: string;
  subscription_end_date: string;
  notes: string;
}

function buildForm(client: any): ProfileForm {
  const p = client?.client_profile ?? {};
  return {
    name:                    client?.name ?? '',
    status:                  client?.status ?? 'active',
    phone:                   p.phone ?? '',
    address:                 p.address ?? '',
    city:                    p.city ?? '',
    province:                p.province ?? '',
    postal_code:             p.postal_code ?? '',
    emergency_contact_name:  p.emergency_contact_name ?? '',
    emergency_contact_phone: p.emergency_contact_phone ?? '',
    billing_method:          p.billing_method ?? 'credit_card',
    subscription_tier:       p.subscription_tier ?? '',
    subscription_start_date: p.subscription_start_date?.split('T')[0] ?? '',
    subscription_end_date:   p.subscription_end_date?.split('T')[0] ?? '',
    notes:                   p.notes ?? '',
  };
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between py-1.5">
      <dt className="text-taupe">{label}</dt>
      <dd className="text-espresso font-medium text-right max-w-[60%]">{value || '—'}</dd>
    </div>
  );
}

function FormField({
  label, name, form, onChange, type = 'text',
}: {
  label: string;
  name: keyof ProfileForm;
  form: ProfileForm;
  onChange: (name: keyof ProfileForm, value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <Input
        type={type}
        value={form[name]}
        onChange={e => onChange(name, e.target.value)}
      />
    </div>
  );
}

export default function AdminClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('profile');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProfileForm | null>(null);

  const { data: client, isLoading } = useQuery({
    queryKey: ['admin-client', id],
    queryFn: () => api.get(`/admin/clients/${id}`).then(r => r.data.data),
  });

  const { data: homeAccess } = useQuery({
    queryKey: ['admin-client-access', id],
    queryFn: () => api.get(`/admin/clients/${id}/home-access`).then(r => r.data.data),
    enabled: tab === 'access',
  });

  // Sync form when client data loads
  useEffect(() => {
    if (client) setForm(buildForm(client));
  }, [client]);

  const resend = useMutation({
    mutationFn: () => api.post(`/admin/clients/${id}/resend-invite`),
  });

  const save = useMutation({
    mutationFn: (f: ProfileForm) => api.patch(`/admin/clients/${id}`, {
      name:   f.name,
      status: f.status,
      profile: {
        phone:                   f.phone || null,
        address:                 f.address || null,
        city:                    f.city || null,
        province:                f.province || null,
        postal_code:             f.postal_code || null,
        emergency_contact_name:  f.emergency_contact_name || null,
        emergency_contact_phone: f.emergency_contact_phone || null,
        billing_method:          f.billing_method || null,
        subscription_tier:       f.subscription_tier || null,
        subscription_start_date: f.subscription_start_date || null,
        subscription_end_date:   f.subscription_end_date || null,
        notes:                   f.notes || null,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-client', id] });
      setEditing(false);
    },
  });

  const handleChange = (name: keyof ProfileForm, value: string) => {
    setForm(prev => prev ? { ...prev, [name]: value } : prev);
  };

  const handleCancel = () => {
    setForm(buildForm(client));
    setEditing(false);
  };

  if (isLoading) return <PageLoader />;
  if (!client) return <div className="text-center py-12 text-taupe">Client not found.</div>;

  const p = client.client_profile ?? {};

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
            onClick={() => { setTab(t); setEditing(false); }}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t ? 'border-gold text-gold' : 'border-transparent text-taupe hover:text-espresso'
            }`}
          >
            {t === 'access' ? 'Home Access' : t}
          </button>
        ))}
      </div>

      {/* ── Profile tab ───────────────────────────────────────────────────── */}
      {tab === 'profile' && form && (
        <div className="space-y-6">
          {/* Edit / Save / Cancel actions */}
          <div className="flex justify-end gap-2">
            {editing ? (
              <>
                <Button variant="outline" size="sm" onClick={handleCancel}>Cancel</Button>
                <Button size="sm" loading={save.isPending} onClick={() => save.mutate(form)}>
                  Save Changes
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                Edit Profile
              </Button>
            )}
          </div>

          {save.isError && (
            <p className="text-sm text-red-600">
              {(save.error as any)?.response?.data?.message ?? 'Save failed. Please try again.'}
            </p>
          )}

          {editing ? (
            /* ── Edit mode ────────────────────────────────────────────────── */
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader title="Account" />
                <div className="space-y-4">
                  <FormField label="Full Name" name="name" form={form} onChange={handleChange} />
                  <div>
                    <label className="label">Status</label>
                    <select
                      className="input"
                      value={form.status}
                      onChange={e => handleChange('status', e.target.value)}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                </div>
              </Card>

              <Card>
                <CardHeader title="Contact Info" />
                <div className="space-y-4">
                  <FormField label="Phone" name="phone" form={form} onChange={handleChange} type="tel" />
                  <FormField label="Address" name="address" form={form} onChange={handleChange} />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="City" name="city" form={form} onChange={handleChange} />
                    <FormField label="Province" name="province" form={form} onChange={handleChange} />
                  </div>
                  <FormField label="Postal Code" name="postal_code" form={form} onChange={handleChange} />
                </div>
              </Card>

              <Card>
                <CardHeader title="Emergency Contact" />
                <div className="space-y-4">
                  <FormField label="Name" name="emergency_contact_name" form={form} onChange={handleChange} />
                  <FormField label="Phone" name="emergency_contact_phone" form={form} onChange={handleChange} type="tel" />
                </div>
              </Card>

              <Card>
                <CardHeader title="Billing & Subscription" />
                <div className="space-y-4">
                  <div>
                    <label className="label">Billing Method</label>
                    <select
                      className="input"
                      value={form.billing_method}
                      onChange={e => handleChange('billing_method', e.target.value)}
                    >
                      <option value="credit_card">Credit Card</option>
                      <option value="e_transfer">E-Transfer</option>
                      <option value="cash">Cash</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Subscription Tier</label>
                    <select
                      className="input"
                      value={form.subscription_tier}
                      onChange={e => handleChange('subscription_tier', e.target.value)}
                    >
                      <option value="">None</option>
                      <option value="basic">Basic</option>
                      <option value="standard">Standard</option>
                      <option value="premium">Premium</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Start Date" name="subscription_start_date" form={form} onChange={handleChange} type="date" />
                    <FormField label="End Date" name="subscription_end_date" form={form} onChange={handleChange} type="date" />
                  </div>
                </div>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader title="Admin Notes" />
                <textarea
                  className="input min-h-24 resize-y"
                  placeholder="Internal notes about this client…"
                  value={form.notes}
                  onChange={e => handleChange('notes', e.target.value)}
                />
              </Card>
            </div>
          ) : (
            /* ── Read mode ────────────────────────────────────────────────── */
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader title="Contact Info" />
                <dl className="space-y-1 text-sm">
                  <Field label="Phone" value={p.phone} />
                  <Field label="Address" value={p.address} />
                  <Field label="City" value={p.city} />
                  <Field label="Province" value={p.province} />
                  <Field label="Postal Code" value={p.postal_code} />
                </dl>
              </Card>

              <Card>
                <CardHeader title="Emergency Contact" />
                <dl className="space-y-1 text-sm">
                  <Field label="Name" value={p.emergency_contact_name} />
                  <Field label="Phone" value={p.emergency_contact_phone} />
                </dl>
              </Card>

              <Card>
                <CardHeader title="Billing & Subscription" />
                <dl className="space-y-1 text-sm">
                  <Field label="Billing Method" value={p.billing_method?.replace('_', ' ')} />
                  <Field label="Subscription Tier" value={p.subscription_tier} />
                  <Field label="Start Date" value={p.subscription_start_date} />
                  <Field label="End Date" value={p.subscription_end_date} />
                </dl>
              </Card>

              {p.notes && (
                <Card>
                  <CardHeader title="Admin Notes" />
                  <p className="text-sm text-espresso whitespace-pre-wrap">{p.notes}</p>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Dogs tab ──────────────────────────────────────────────────────── */}
      {tab === 'dogs' && (
        <div className="grid gap-4 sm:grid-cols-2">
          {client.dogs?.map((dog: any) => (
            <Card key={dog.id}>
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-full bg-cream flex items-center justify-center text-2xl">🐕</div>
                <div className="flex-1">
                  <div className="font-semibold text-espresso">{dog.name}</div>
                  <div className="text-sm text-taupe">{dog.breed} · {dog.size}</div>
                  <div className="flex gap-2 mt-2 flex-wrap">
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

      {/* ── Documents tab ─────────────────────────────────────────────────── */}
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

      {/* ── Home Access tab ───────────────────────────────────────────────── */}
      {tab === 'access' && (
        <Card>
          <CardHeader title="Home Access" subtitle="Codes are encrypted and only visible here." />
          {homeAccess ? (
            <dl className="space-y-3 text-sm">
              {[
                ['Entry Instructions', homeAccess.entry_instructions],
                ['Lockbox Code',       homeAccess.lockbox_code],
                ['Door Code',          homeAccess.door_code],
                ['Alarm Code',         homeAccess.alarm_code],
                ['Key Location',       homeAccess.key_location],
                ['Parking',            homeAccess.parking_instructions],
                ['Notes',              homeAccess.notes],
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
