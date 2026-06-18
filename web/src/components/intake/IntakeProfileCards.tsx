/**
 * Shared editable cards that mirror the intake form sections, used on
 * both the client ProfilePage and the admin ClientDetailPage so both
 * views show every intake field with the same look + behaviour.
 *
 * Each card is self-contained: it owns its own edit state and PATCH.
 * `mode` tells it where to write — 'client' hits /client/profile,
 * 'admin' hits /admin/clients/{clientId} with a `profile` payload.
 */
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';

type Mode = 'client' | 'admin';
type Profile = Record<string, any>;

interface BaseProps {
  profile: Profile;
  mode: Mode;
  clientId?: number;
}

// ── Option constants (kept in sync with IntakeFormPage) ──────────────────────

const WALK_DAYS_OPTIONS = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
];

const WALK_LENGTH_OPTIONS = [
  { value: '30_min', label: '30 min' },
  { value: '60_min', label: '60 min' },
];

const WALK_TIME_OPTIONS = [
  { value: 'early_morning', label: 'Early Morning (6–9 AM)' },
  { value: 'morning', label: 'Morning (9 AM–12 PM)' },
  { value: 'midday', label: 'Midday (12–3 PM)' },
  { value: 'afternoon', label: 'Afternoon (3–6 PM)' },
  { value: 'evening', label: 'Evening (6–9 PM)' },
];

const CARE_OPTIONS = [
  { value: 'paw_wipes_balm', label: 'Paw Wipes & Balm' },
  { value: 'light_brushing', label: 'Light Brushing' },
  { value: 'face_wipes', label: 'Face Wipes' },
  { value: 'massage', label: 'Massage' },
  { value: 'tooth_brushing', label: 'Tooth Brushing' },
  { value: 'nail_clipping', label: 'Nail Clipping' },
  { value: 'feeding', label: 'Feeding' },
  { value: 'medication', label: 'Medication Administration' },
  { value: 'indoor_enrichment', label: 'Indoor Enrichment' },
  { value: 'appointment_transport', label: 'Appointment Transport' },
];

const UPDATE_METHOD_OPTIONS = [
  { value: 'app_report', label: 'App Report' },
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
];

const REPORT_DETAIL_OPTIONS = [
  { value: 'simple_checklist', label: 'Simple Checklist' },
  { value: 'short_summary', label: 'Short Summary' },
  { value: 'detailed_notes_photos', label: 'Detailed Notes & Photos' },
];

const REFERRAL_OPTIONS = [
  { value: '', label: '—' },
  { value: 'referral', label: 'Referral from Friend / Family' },
  { value: 'online_search', label: 'Online Search' },
  { value: 'flyer', label: 'Flyer' },
  { value: 'local_business', label: 'Local Business' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'other', label: 'Other' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Wrap a save call so both modes look the same to the card. */
function usePatchProfile(mode: Mode, clientId?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (changes: Profile) =>
      mode === 'admin'
        ? api.patch(`/admin/clients/${clientId}`, { profile: changes })
        : api.patch('/client/profile', changes),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: mode === 'admin' ? ['admin-client', clientId] : ['client-profile'],
      });
    },
  });
}

function labelOf<T extends { value: string; label: string }>(opts: T[], v?: string | null) {
  if (!v) return '—';
  return opts.find(o => o.value === v)?.label ?? v;
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
        active
          ? 'bg-gold text-white border-gold'
          : 'border-taupe text-espresso hover:border-gold/60 hover:bg-cream'
      }`}
    >
      {children}
    </button>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="text-taupe shrink-0">{label}</dt>
      <dd className="text-espresso font-medium text-right">{value || '—'}</dd>
    </div>
  );
}

function MultilineRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="text-sm">
      <p className="text-taupe mb-1">{label}</p>
      <p className="text-espresso whitespace-pre-line leading-relaxed">{value || '—'}</p>
    </div>
  );
}

// ── Cards ────────────────────────────────────────────────────────────────────

export function VetInformationCard({ profile, mode, clientId }: BaseProps) {
  const save = usePatchProfile(mode, clientId);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    vet_clinic_name: profile.vet_clinic_name ?? '',
    vet_phone:       profile.vet_phone ?? '',
    vet_address:     profile.vet_address ?? '',
  });
  useEffect(() => {
    setForm({
      vet_clinic_name: profile.vet_clinic_name ?? '',
      vet_phone:       profile.vet_phone ?? '',
      vet_address:     profile.vet_address ?? '',
    });
  }, [profile.vet_clinic_name, profile.vet_phone, profile.vet_address]);

  const onSave = () => {
    save.mutate(form, { onSuccess: () => setEditing(false) });
  };

  return (
    <Card>
      <CardHeader
        title="Vet Information"
        action={
          editing ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" loading={save.isPending} onClick={onSave}>Save</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
          )
        }
      />
      {editing ? (
        <div className="space-y-3">
          <Input label="Clinic name" value={form.vet_clinic_name} onChange={e => setForm(f => ({ ...f, vet_clinic_name: e.target.value }))} />
          <Input label="Phone" type="tel" value={form.vet_phone} onChange={e => setForm(f => ({ ...f, vet_phone: e.target.value }))} />
          <Input label="Address" value={form.vet_address} onChange={e => setForm(f => ({ ...f, vet_address: e.target.value }))} />
        </div>
      ) : (
        <dl className="space-y-3">
          <Row label="Clinic" value={profile.vet_clinic_name} />
          <Row label="Phone" value={profile.vet_phone} />
          <Row label="Address" value={profile.vet_address} />
        </dl>
      )}
    </Card>
  );
}

export function VisitPreferencesCard({ profile, mode, clientId }: BaseProps) {
  const save = usePatchProfile(mode, clientId);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    preferred_walk_days:      profile.preferred_walk_days ?? [],
    preferred_walk_times:     profile.preferred_walk_times ?? [],
    preferred_walk_length:    profile.preferred_walk_length ?? '',
    customized_care_options:  profile.customized_care_options ?? [],
    food_storage_location:    profile.food_storage_location ?? '',
  });
  useEffect(() => {
    setForm({
      preferred_walk_days:      profile.preferred_walk_days ?? [],
      preferred_walk_times:     profile.preferred_walk_times ?? [],
      preferred_walk_length:    profile.preferred_walk_length ?? '',
      customized_care_options:  profile.customized_care_options ?? [],
      food_storage_location:    profile.food_storage_location ?? '',
    });
  }, [
    profile.preferred_walk_days, profile.preferred_walk_times, profile.preferred_walk_length,
    profile.customized_care_options, profile.food_storage_location,
  ]);

  const toggleIn = (key: 'preferred_walk_days' | 'preferred_walk_times' | 'customized_care_options', v: string) =>
    setForm(f => ({
      ...f,
      [key]: (f[key] as string[]).includes(v)
        ? (f[key] as string[]).filter(x => x !== v)
        : [...(f[key] as string[]), v],
    }));

  const onSave = () => save.mutate(form, { onSuccess: () => setEditing(false) });

  const dayLabel  = (v: string) => WALK_DAYS_OPTIONS.find(o => o.value === v)?.label ?? v;
  const timeLabel = (v: string) => WALK_TIME_OPTIONS.find(o => o.value === v)?.label ?? v;
  const careLabel = (v: string) => CARE_OPTIONS.find(o => o.value === v)?.label ?? v;

  return (
    <Card>
      <CardHeader
        title="Visit Preferences"
        action={
          editing ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" loading={save.isPending} onClick={onSave}>Save</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
          )
        }
      />
      {editing ? (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-espresso mb-2">Preferred days</label>
            <div className="flex gap-2 flex-wrap">
              {WALK_DAYS_OPTIONS.map(opt => (
                <Pill key={opt.value} active={form.preferred_walk_days.includes(opt.value)} onClick={() => toggleIn('preferred_walk_days', opt.value)}>{opt.label}</Pill>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-espresso mb-2">Preferred times</label>
            <div className="flex gap-2 flex-wrap">
              {WALK_TIME_OPTIONS.map(opt => (
                <Pill key={opt.value} active={form.preferred_walk_times.includes(opt.value)} onClick={() => toggleIn('preferred_walk_times', opt.value)}>{opt.label}</Pill>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-espresso mb-2">Preferred visit length</label>
            <div className="flex gap-2 flex-wrap">
              {WALK_LENGTH_OPTIONS.map(opt => (
                <Pill key={opt.value} active={form.preferred_walk_length === opt.value} onClick={() => setForm(f => ({ ...f, preferred_walk_length: f.preferred_walk_length === opt.value ? '' : opt.value }))}>{opt.label}</Pill>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-espresso mb-2">Customized care add-ons</label>
            <div className="flex gap-2 flex-wrap">
              {CARE_OPTIONS.map(opt => (
                <Pill key={opt.value} active={form.customized_care_options.includes(opt.value)} onClick={() => toggleIn('customized_care_options', opt.value)}>{opt.label}</Pill>
              ))}
            </div>
          </div>
          <Input label="Food storage location" value={form.food_storage_location} onChange={e => setForm(f => ({ ...f, food_storage_location: e.target.value }))} placeholder="e.g. pantry, cupboard above the fridge" />
        </div>
      ) : (
        <dl className="space-y-3">
          <Row label="Preferred days" value={(profile.preferred_walk_days ?? []).map(dayLabel).join(', ')} />
          <Row label="Preferred times" value={(profile.preferred_walk_times ?? []).map(timeLabel).join(', ')} />
          <Row label="Visit length" value={labelOf(WALK_LENGTH_OPTIONS, profile.preferred_walk_length)} />
          <Row label="Customized care" value={(profile.customized_care_options ?? []).map(careLabel).join(', ')} />
          <Row label="Food storage" value={profile.food_storage_location} />
        </dl>
      )}
    </Card>
  );
}

export function CareGoalsCard({ profile, mode, clientId }: BaseProps) {
  const save = usePatchProfile(mode, clientId);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    what_great_care_looks_like: profile.what_great_care_looks_like ?? '',
    biggest_concern:            profile.biggest_concern ?? '',
    comfort_factors:            profile.comfort_factors ?? '',
    referral_source:            profile.referral_source ?? '',
  });
  useEffect(() => {
    setForm({
      what_great_care_looks_like: profile.what_great_care_looks_like ?? '',
      biggest_concern:            profile.biggest_concern ?? '',
      comfort_factors:            profile.comfort_factors ?? '',
      referral_source:            profile.referral_source ?? '',
    });
  }, [
    profile.what_great_care_looks_like, profile.biggest_concern,
    profile.comfort_factors, profile.referral_source,
  ]);

  const onSave = () => save.mutate(form, { onSuccess: () => setEditing(false) });

  return (
    <Card>
      <CardHeader
        title="Care Goals & Context"
        action={
          editing ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" loading={save.isPending} onClick={onSave}>Save</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
          )
        }
      />
      {editing ? (
        <div className="space-y-3">
          <Textarea label="What does great care look like?" rows={3} value={form.what_great_care_looks_like} onChange={e => setForm(f => ({ ...f, what_great_care_looks_like: e.target.value }))} />
          <Textarea label="Biggest concern" rows={2} value={form.biggest_concern} onChange={e => setForm(f => ({ ...f, biggest_concern: e.target.value }))} />
          <Textarea label="What makes you comfortable" rows={2} value={form.comfort_factors} onChange={e => setForm(f => ({ ...f, comfort_factors: e.target.value }))} />
          <div>
            <label className="block text-sm font-medium text-espresso mb-1">How did you hear about us?</label>
            <select className="input w-full" value={form.referral_source} onChange={e => setForm(f => ({ ...f, referral_source: e.target.value }))}>
              {REFERRAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <MultilineRow label="What great care looks like" value={profile.what_great_care_looks_like} />
          <MultilineRow label="Biggest concern" value={profile.biggest_concern} />
          <MultilineRow label="Comfort factors" value={profile.comfort_factors} />
          <Row label="Heard about us" value={labelOf(REFERRAL_OPTIONS, profile.referral_source)} />
        </div>
      )}
    </Card>
  );
}

export function CommunicationCard({ profile, mode, clientId }: BaseProps) {
  const save = usePatchProfile(mode, clientId);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    notify_app:              profile.notify_app ?? true,
    notify_email:            profile.notify_email ?? false,
    notify_sms:              profile.notify_sms ?? false,
    preferred_update_method: (profile.preferred_update_method ?? []) as string[],
    report_detail_level:     profile.report_detail_level ?? '',
  });
  useEffect(() => {
    setForm({
      notify_app:              profile.notify_app ?? true,
      notify_email:            profile.notify_email ?? false,
      notify_sms:              profile.notify_sms ?? false,
      preferred_update_method: (profile.preferred_update_method ?? []) as string[],
      report_detail_level:     profile.report_detail_level ?? '',
    });
  }, [
    profile.notify_app, profile.notify_email, profile.notify_sms,
    profile.preferred_update_method, profile.report_detail_level,
  ]);

  const toggleUpdateMethod = (v: string) =>
    setForm(f => ({
      ...f,
      preferred_update_method: f.preferred_update_method.includes(v)
        ? f.preferred_update_method.filter(x => x !== v)
        : [...f.preferred_update_method, v],
    }));

  const onSave = () => save.mutate(form, { onSuccess: () => setEditing(false) });

  return (
    <Card>
      <CardHeader
        title="Communication Preferences"
        action={
          editing ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" loading={save.isPending} onClick={onSave}>Save</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
          )
        }
      />
      {editing ? (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-espresso mb-2">Notification channels</p>
            <div className="space-y-2">
              {[
                { key: 'notify_app',   label: 'App notifications' },
                { key: 'notify_email', label: 'Email' },
                { key: 'notify_sms',   label: 'SMS (one-way)' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm text-espresso">
                  <input
                    type="checkbox"
                    checked={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-espresso mb-2">Preferred update method(s)</label>
            <div className="flex gap-2 flex-wrap">
              {UPDATE_METHOD_OPTIONS.map(opt => (
                <Pill key={opt.value} active={form.preferred_update_method.includes(opt.value)} onClick={() => toggleUpdateMethod(opt.value)}>{opt.label}</Pill>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-espresso mb-2">Report detail level</label>
            <div className="flex gap-2 flex-wrap">
              {REPORT_DETAIL_OPTIONS.map(opt => (
                <Pill key={opt.value} active={form.report_detail_level === opt.value} onClick={() => setForm(f => ({ ...f, report_detail_level: f.report_detail_level === opt.value ? '' : opt.value }))}>{opt.label}</Pill>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <dl className="space-y-3">
          <Row
            label="Notification channels"
            value={[
              (profile.notify_app ?? true) ? 'App' : null,
              profile.notify_email ? 'Email' : null,
              profile.notify_sms ? 'SMS' : null,
            ].filter(Boolean).join(', ') || 'None'}
          />
          <Row
            label="Preferred update method"
            value={(profile.preferred_update_method ?? [])
              .map((v: string) => UPDATE_METHOD_OPTIONS.find(o => o.value === v)?.label ?? v)
              .join(', ')}
          />
          <Row label="Report detail level" value={labelOf(REPORT_DETAIL_OPTIONS, profile.report_detail_level)} />
        </dl>
      )}
    </Card>
  );
}

export function GeneralNotesCard({ profile, mode, clientId }: BaseProps) {
  const save = usePatchProfile(mode, clientId);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(profile.additional_notes ?? '');
  useEffect(() => { setText(profile.additional_notes ?? ''); }, [profile.additional_notes]);

  const onSave = () => save.mutate({ additional_notes: text }, { onSuccess: () => setEditing(false) });

  return (
    <Card>
      <CardHeader
        title="General Notes"
        action={
          editing ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" loading={save.isPending} onClick={onSave}>Save</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
          )
        }
      />
      {editing ? (
        <Textarea
          rows={6}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Anything else worth noting — household quirks, schedule notes, special requests…"
        />
      ) : (
        <p className="text-sm text-espresso whitespace-pre-line leading-relaxed">
          {profile.additional_notes || <span className="text-taupe">No notes on file.</span>}
        </p>
      )}
    </Card>
  );
}

/** Convenience: render every intake card in one go, in the canonical order. */
export function IntakeProfileSections(props: BaseProps) {
  return (
    <>
      <VetInformationCard {...props} />
      <VisitPreferencesCard {...props} />
      <CareGoalsCard {...props} />
      <CommunicationCard {...props} />
      <GeneralNotesCard {...props} />
    </>
  );
}
