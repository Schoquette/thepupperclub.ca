import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ProvinceSelect } from '@/components/ui/ProvinceSelect';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { CheckCircle, Dog, CreditCard, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ClientProfilePage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [updateError, setUpdateError] = useState('');

  const { data: profile, isLoading } = useQuery({
    queryKey: ['client-profile'],
    queryFn: () => api.get('/client/profile').then(r => r.data.data),
  });

  const [form, setForm] = useState<Record<string, any>>({});

  const update = useMutation({
    mutationFn: () => api.patch('/client/profile', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-profile'] });
      setEditing(false);
      setUpdateError('');
    },
    onError: (err: any) => {
      setUpdateError(err.response?.data?.message || 'Failed to save changes. Please try again.');
    },
  });

  const confirmProfile = useMutation({
    mutationFn: () => api.post('/client/profile/confirm'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-profile'] });
      setConfirmed(true);
    },
  });

  if (isLoading) return <PageLoader />;

  const p = profile?.client_profile ?? {};
  const needsConfirmation = !p.profile_confirmed_at;
  const hasIntake = !!p.intake_submitted_at;
  const needsReview = needsConfirmation && hasIntake;

  if (confirmed) {
    return (
      <div className="text-center py-16 space-y-4">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
        <h1 className="font-display text-2xl text-espresso">Profile Confirmed!</h1>
        <p className="text-taupe">Thank you for reviewing your profile. You're all set!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl text-espresso">My Profile</h1>

      {/* Review banner — shown when admin has submitted intake but client hasn't confirmed */}
      {needsReview && (
        <div className="bg-gold/5 border border-gold/20 rounded-xl p-4">
          <div className="font-semibold text-espresso text-sm">Please review your profile</div>
          <p className="text-xs text-taupe mt-1">
            Sophie has filled out your profile based on your intake form. Please review the information below, make any corrections, and click Confirm when everything looks good.
          </p>
        </div>
      )}

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
                  secondary_contact_name: p.secondary_contact_name ?? '',
                  secondary_contact_email: p.secondary_contact_email ?? '',
                  secondary_contact_phone: p.secondary_contact_phone ?? '',
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
              <ProvinceSelect value={form.province} onChange={v => setForm(f => ({ ...f, province: v }))} />
              <Input label="Postal Code" value={form.postal_code} onChange={e => setForm(f => ({ ...f, postal_code: e.target.value }))} />
            </div>
            <div className="pt-2 border-t border-cream">
              <p className="text-sm font-semibold text-espresso mb-3">Emergency Contact</p>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Name" value={form.emergency_contact_name} onChange={e => setForm(f => ({ ...f, emergency_contact_name: e.target.value }))} />
                <Input label="Phone" value={form.emergency_contact_phone} onChange={e => setForm(f => ({ ...f, emergency_contact_phone: e.target.value }))} />
              </div>
            </div>

            <div className="pt-2 border-t border-cream">
              <p className="text-sm font-semibold text-espresso mb-3">Secondary Contact</p>
              <div className="space-y-3">
                <Input label="Name" value={form.secondary_contact_name} onChange={e => setForm(f => ({ ...f, secondary_contact_name: e.target.value }))} />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Phone" value={form.secondary_contact_phone} onChange={e => setForm(f => ({ ...f, secondary_contact_phone: e.target.value }))} />
                  <Input label="Email" type="email" value={form.secondary_contact_email} onChange={e => setForm(f => ({ ...f, secondary_contact_email: e.target.value }))} />
                </div>
              </div>
            </div>
            {updateError && <p className="text-sm text-red-500">{updateError}</p>}
          </div>
        ) : (
          <div className="space-y-4">
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

            {/* Secondary contact */}
            {(p.secondary_contact_name || p.secondary_contact_phone || p.secondary_contact_email) && (
              <div className="pt-3 border-t border-cream">
                <p className="text-sm font-semibold text-espresso mb-2">Secondary Contact</p>
                <dl className="space-y-3 text-sm">
                  {[
                    ['Name', p.secondary_contact_name],
                    ['Phone', p.secondary_contact_phone],
                    ['Email', p.secondary_contact_email],
                  ].map(([label, value]) => value ? (
                    <div key={String(label)} className="flex justify-between">
                      <dt className="text-taupe">{label}</dt>
                      <dd className="text-espresso font-medium">{value}</dd>
                    </div>
                  ) : null)}
                </dl>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Quick links */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { to: '/client/dogs', icon: Dog, label: 'My Dogs', desc: 'View & edit dogs' },
          { to: '/client/billing', icon: CreditCard, label: 'Billing', desc: 'Payment & plan' },
          { to: '/client/settings', icon: Settings, label: 'Settings', desc: 'Password & prefs' },
        ].map(link => (
          <Link
            key={link.to}
            to={link.to}
            className="flex flex-col items-center gap-1.5 rounded-xl bg-cream/60 border border-taupe/20 p-5 text-center hover:bg-blue/5 hover:border-blue/30 transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-blue/10 flex items-center justify-center group-hover:bg-blue/20 transition-colors">
              <link.icon className="w-5 h-5 text-blue" />
            </div>
            <span className="text-sm font-semibold text-espresso">{link.label}</span>
            <span className="text-[11px] text-taupe">{link.desc}</span>
          </Link>
        ))}
      </div>

      {/* Confirm button — shown when admin submitted intake but client hasn't confirmed */}
      {needsReview && !editing && (
        <div className="flex justify-end gap-3">
          <Button
            loading={confirmProfile.isPending}
            onClick={() => confirmProfile.mutate()}
          >
            Confirm Profile
          </Button>
        </div>
      )}
    </div>
  );
}
