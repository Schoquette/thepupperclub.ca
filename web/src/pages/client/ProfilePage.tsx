import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageLoader } from '@/components/ui/LoadingSpinner';

export default function ClientProfilePage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['client-profile'],
    queryFn: () => api.get('/client/profile').then(r => r.data.data),
  });

  const [form, setForm] = useState<Record<string, string>>({});

  const update = useMutation({
    mutationFn: () => api.patch('/client/profile', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-profile'] });
      setEditing(false);
    },
  });

  if (isLoading) return <PageLoader />;

  const p = profile?.client_profile ?? {};

  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl text-espresso">My Profile</h1>

      <Card>
        <CardHeader
          title="Contact Information"
          action={
            editing ? (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                <Button size="sm" loading={update.isPending} onClick={() => update.mutate()}>Save</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => {
                setForm({
                  name: profile?.name ?? '',
                  phone: p.phone ?? '',
                  address: p.address ?? '',
                  city: p.city ?? '',
                  province: p.province ?? '',
                  postal_code: p.postal_code ?? '',
                  emergency_contact_name: p.emergency_contact_name ?? '',
                  emergency_contact_phone: p.emergency_contact_phone ?? '',
                });
                setEditing(true);
              }}>
                Edit
              </Button>
            )
          }
        />
        {editing ? (
          <div className="space-y-4">
            <Input label="Full name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input label="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            <Input label="Address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            <div className="grid grid-cols-3 gap-3">
              <Input label="City" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
              <Input label="Province" maxLength={2} value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))} />
              <Input label="Postal Code" value={form.postal_code} onChange={e => setForm(f => ({ ...f, postal_code: e.target.value }))} />
            </div>
            <div className="pt-2 border-t border-cream">
              <p className="text-sm font-semibold text-espresso mb-3">Emergency Contact</p>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Name" value={form.emergency_contact_name} onChange={e => setForm(f => ({ ...f, emergency_contact_name: e.target.value }))} />
                <Input label="Phone" value={form.emergency_contact_phone} onChange={e => setForm(f => ({ ...f, emergency_contact_phone: e.target.value }))} />
              </div>
            </div>
          </div>
        ) : (
          <dl className="space-y-3 text-sm">
            {[
              ['Name', profile?.name],
              ['Phone', p.phone],
              ['Address', p.address],
              ['City', p.city],
              ['Province', p.province],
              ['Postal Code', p.postal_code],
              ['Emergency Contact', p.emergency_contact_name],
              ['Emergency Phone', p.emergency_contact_phone],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex justify-between">
                <dt className="text-taupe">{label}</dt>
                <dd className="text-espresso font-medium">{value || '—'}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>
    </div>
  );
}
