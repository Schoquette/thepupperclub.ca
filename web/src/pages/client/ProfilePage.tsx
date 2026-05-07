import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ProvinceSelect } from '@/components/ui/ProvinceSelect';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { CheckCircle, Dog, CreditCard, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

const DAY_OPTIONS = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
];

const TIME_OPTIONS = [
  { value: 'morning_7_10', label: 'Morning (7–10am)' },
  { value: 'midday_11_2', label: 'Midday (11am–2pm)' },
  { value: 'afternoon_3_6', label: 'Afternoon (3–6pm)' },
  { value: 'evening_6_9', label: 'Evening (6–9pm)' },
];

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

  const [confirmError, setConfirmError] = useState('');

  const confirmProfile = useMutation({
    mutationFn: () => api.post('/client/profile/confirm'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-profile'] });
      setConfirmed(true);
      setConfirmError('');
    },
    onError: (err: any) => {
      setConfirmError(err.response?.data?.message || 'Failed to confirm profile. Please try again.');
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

      {/* Visit Preferences */}
      <VisitPreferencesCard profile={p} />

      {/* Home Access */}
      <HomeAccessCard />

      {/* Confirm button — shown when admin submitted intake but client hasn't confirmed */}
      {needsReview && !editing && (
        <div className="space-y-2">
          {confirmError && <p className="text-sm text-red-600 text-right">{confirmError}</p>}
          <div className="flex justify-end gap-3">
            <Button
              loading={confirmProfile.isPending}
              onClick={() => confirmProfile.mutate()}
            >
              Confirm Profile
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Visit Preferences ─────────────────────────────────────────────────────────

function VisitPreferencesCard({ profile }: { profile: any }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [days, setDays] = useState<string[]>(profile?.preferred_walk_days ?? []);
  const [times, setTimes] = useState<string[]>(profile?.preferred_walk_times ?? []);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    setDays(profile?.preferred_walk_days ?? []);
    setTimes(profile?.preferred_walk_times ?? []);
  }, [profile]);

  const save = useMutation({
    mutationFn: () => api.patch('/client/profile', { preferred_walk_days: days, preferred_walk_times: times }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-profile'] });
      setEditing(false);
      setSuccessMsg('Saved!');
      setTimeout(() => setSuccessMsg(''), 2500);
    },
    onError: () => {},
  });

  const toggleDay = (d: string) => setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  const toggleTime = (t: string) => setTimes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  const dayLabels = Object.fromEntries(DAY_OPTIONS.map(o => [o.value, o.label]));
  const timeLabels = Object.fromEntries(TIME_OPTIONS.map(o => [o.value, o.label]));

  return (
    <Card>
      <CardHeader
        title="Visit Preferences"
        action={
          <div className="flex items-center gap-2">
            {successMsg && <span className="text-sm text-green-600 font-medium">{successMsg}</span>}
            {editing ? (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setEditing(false); setDays(profile?.preferred_walk_days ?? []); setTimes(profile?.preferred_walk_times ?? []); }}>Cancel</Button>
                <Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>Save</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
            )}
          </div>
        }
      />
      {editing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-espresso mb-2">Preferred Days</label>
            <div className="flex gap-2 flex-wrap">
              {DAY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleDay(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    days.includes(opt.value)
                      ? 'bg-gold text-white border-gold'
                      : 'border-taupe text-espresso hover:border-gold/60 hover:bg-cream'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-espresso mb-2">Preferred Time Slots</label>
            <div className="flex gap-2 flex-wrap">
              {TIME_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleTime(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    times.includes(opt.value)
                      ? 'bg-gold text-white border-gold'
                      : 'border-taupe text-espresso hover:border-gold/60 hover:bg-cream'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-taupe">Preferred Days</dt>
            <dd className="text-espresso font-medium">
              {(profile?.preferred_walk_days ?? []).length > 0
                ? (profile.preferred_walk_days as string[]).map(d => dayLabels[d] || d).join(', ')
                : '—'}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-taupe">Preferred Times</dt>
            <dd className="text-espresso font-medium">
              {(profile?.preferred_walk_times ?? []).length > 0
                ? (profile.preferred_walk_times as string[]).map(t => timeLabels[t] || t).join(', ')
                : '—'}
            </dd>
          </div>
        </dl>
      )}
    </Card>
  );
}

// ── Home Access ───────────────────────────────────────────────────────────────

function HomeAccessCard() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const { data: access, isLoading } = useQuery({
    queryKey: ['client-home-access'],
    queryFn: () => api.get('/client/home-access').then(r => r.data.data),
  });

  const [form, setForm] = useState({
    entry_instructions: '',
    lockbox_code: '',
    door_code: '',
    alarm_code: '',
    key_location: '',
    parking_instructions: '',
    notes: '',
  });

  useEffect(() => {
    if (access) {
      setForm({
        entry_instructions: access.entry_instructions ?? '',
        lockbox_code: access.lockbox_code === '****' ? '' : (access.lockbox_code ?? ''),
        door_code: access.door_code === '****' ? '' : (access.door_code ?? ''),
        alarm_code: access.alarm_code === '****' ? '' : (access.alarm_code ?? ''),
        key_location: access.key_location ?? '',
        parking_instructions: access.parking_instructions ?? '',
        notes: access.notes ?? '',
      });
    }
  }, [access]);

  const save = useMutation({
    mutationFn: () => {
      // Don't send masked values — only send if changed
      const payload = { ...form };
      if (!payload.lockbox_code) delete (payload as any).lockbox_code;
      if (!payload.door_code) delete (payload as any).door_code;
      if (!payload.alarm_code) delete (payload as any).alarm_code;
      return api.patch('/client/home-access', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-home-access'] });
      setEditing(false);
      setSuccessMsg('Saved!');
      setTimeout(() => setSuccessMsg(''), 2500);
    },
    onError: () => {},
  });

  const startEdit = () => {
    setForm({
      entry_instructions: access?.entry_instructions ?? '',
      lockbox_code: '',
      door_code: '',
      alarm_code: '',
      key_location: access?.key_location ?? '',
      parking_instructions: access?.parking_instructions ?? '',
      notes: access?.notes ?? '',
    });
    setEditing(true);
  };

  if (isLoading) return null;

  const fields: [string, string | null][] = [
    ['Entry Instructions', access?.entry_instructions],
    ['Lockbox Code', access?.lockbox_code],
    ['Door Code', access?.door_code],
    ['Alarm Code', access?.alarm_code],
    ['Key Location', access?.key_location],
    ['Parking', access?.parking_instructions],
    ['Notes', access?.notes],
  ];

  return (
    <Card>
      <CardHeader
        title="Home Access"
        action={
          <div className="flex items-center gap-2">
            {successMsg && <span className="text-sm text-green-600 font-medium">{successMsg}</span>}
            {editing ? (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                <Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>Save</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={startEdit}>Edit</Button>
            )}
          </div>
        }
      />
      {editing ? (
        <div className="space-y-3">
          <Input label="Entry Instructions" value={form.entry_instructions} onChange={e => setForm(f => ({ ...f, entry_instructions: e.target.value }))} placeholder="How to get into the home" />
          <div className="grid grid-cols-3 gap-3">
            <Input label="Lockbox Code" value={form.lockbox_code} onChange={e => setForm(f => ({ ...f, lockbox_code: e.target.value }))} placeholder={access?.lockbox_code ? 'Leave blank to keep current' : ''} />
            <Input label="Door Code" value={form.door_code} onChange={e => setForm(f => ({ ...f, door_code: e.target.value }))} placeholder={access?.door_code ? 'Leave blank to keep current' : ''} />
            <Input label="Alarm Code" value={form.alarm_code} onChange={e => setForm(f => ({ ...f, alarm_code: e.target.value }))} placeholder={access?.alarm_code ? 'Leave blank to keep current' : ''} />
          </div>
          <Input label="Key Location" value={form.key_location} onChange={e => setForm(f => ({ ...f, key_location: e.target.value }))} placeholder="Under the mat, in the mailbox…" />
          <Input label="Parking Instructions" value={form.parking_instructions} onChange={e => setForm(f => ({ ...f, parking_instructions: e.target.value }))} placeholder="Driveway, street parking…" />
          <Input label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Anything else we should know" />
        </div>
      ) : (
        <dl className="space-y-3 text-sm">
          {fields.map(([label, value]) => (
            <div key={label} className="flex justify-between">
              <dt className="text-taupe">{label}</dt>
              <dd className="text-espresso font-medium">{value || '—'}</dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}
