import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { Pencil, ArrowUp, ArrowDown, Plus, Clock, AlertCircle, FileText, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

type Tab = 'profile' | 'dogs' | 'billing' | 'documents' | 'access';

// ── Profile form ──────────────────────────────────────────────────────────────

interface ProfileForm {
  name: string;
  email: string;
  status: string;
  phone: string;
  address: string;
  city: string;
  province: string;
  postal_code: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  secondary_contact_name: string;
  secondary_contact_email: string;
  secondary_notify_messages: boolean;
  secondary_notify_report_cards: boolean;
  secondary_notify_billing: boolean;
  secondary_notify_appointments: boolean;
  notify_app: boolean;
  notify_email: boolean;
  notify_sms: boolean;
  billing_method: string;
  subscription_tier: string;
  subscription_start_date: string;
  subscription_end_date: string;
  notes: string;
}

function buildProfileForm(client: any): ProfileForm {
  const p = client?.client_profile ?? {};
  return {
    name:                    client?.name ?? '',
    email:                   client?.email ?? '',
    status:                  client?.status ?? 'active',
    phone:                   p.phone ?? '',
    address:                 p.address ?? '',
    city:                    p.city ?? '',
    province:                p.province ?? '',
    postal_code:             p.postal_code ?? '',
    emergency_contact_name:  p.emergency_contact_name ?? '',
    emergency_contact_phone: p.emergency_contact_phone ?? '',
    secondary_contact_name:          p.secondary_contact_name ?? '',
    secondary_contact_email:         p.secondary_contact_email ?? '',
    secondary_notify_messages:       !!p.secondary_notify_messages,
    secondary_notify_report_cards:   !!p.secondary_notify_report_cards,
    secondary_notify_billing:        !!p.secondary_notify_billing,
    secondary_notify_appointments:   !!p.secondary_notify_appointments,
    notify_app:              p.notify_app ?? true,
    notify_email:            !!p.notify_email,
    notify_sms:              !!p.notify_sms,
    billing_method:          p.billing_method ?? 'credit_card',
    subscription_tier:       p.subscription_tier ?? '',
    subscription_start_date: p.subscription_start_date?.split('T')[0] ?? '',
    subscription_end_date:   p.subscription_end_date?.split('T')[0] ?? '',
    notes:                   p.notes ?? '',
  };
}

// ── Dog form ──────────────────────────────────────────────────────────────────

interface Medication { name: string; dosage: string; frequency: string; notes: string }
interface DogForm {
  name: string;
  breed: string;
  date_of_birth: string;
  adoptaversary: string;
  size: string;
  sex: string;
  weight_kg: string;
  colour: string;
  microchip_number: string;
  spayed_neutered: boolean;
  bite_history: boolean;
  bite_history_notes: string;
  aggression_notes: string;
  vet_name: string;
  vet_phone: string;
  vet_address: string;
  medications: Medication[];
  special_instructions: string;
  is_active: boolean;
  is_archived: boolean;
  off_leash_approved: boolean;
  media_consent: boolean;
  buddy_walks_ok: boolean;
}

function buildDogForm(dog?: any): DogForm {
  return {
    name:               dog?.name ?? '',
    breed:              dog?.breed ?? '',
    date_of_birth:      dog?.date_of_birth?.split('T')[0] ?? '',
    adoptaversary:      dog?.adoptaversary?.split('T')[0] ?? '',
    size:               dog?.size ?? '',
    sex:                dog?.sex ?? '',
    weight_kg:          dog?.weight_kg != null ? String(dog.weight_kg) : '',
    colour:             dog?.colour ?? '',
    microchip_number:   dog?.microchip_number ?? '',
    spayed_neutered:    dog?.spayed_neutered ?? false,
    bite_history:       dog?.bite_history ?? false,
    bite_history_notes: dog?.bite_history_notes ?? '',
    aggression_notes:   dog?.aggression_notes ?? '',
    vet_name:           dog?.vet_name ?? '',
    vet_phone:          dog?.vet_phone ?? '',
    vet_address:        dog?.vet_address ?? '',
    medications:        dog?.medications ?? [],
    special_instructions: dog?.special_instructions ?? '',
    is_active:          dog?.is_active ?? true,
    is_archived:        dog?.is_archived ?? false,
    off_leash_approved: dog?.off_leash_approved ?? false,
    media_consent:      dog?.media_consent ?? false,
    buddy_walks_ok:     dog?.buddy_walks_ok ?? false,
  };
}

function dogPayload(f: DogForm, userId: number) {
  return {
    user_id:            userId,
    name:               f.name,
    breed:              f.breed || null,
    date_of_birth:      f.date_of_birth || null,
    adoptaversary:      f.adoptaversary || null,
    size:               f.size || null,
    sex:                f.sex || null,
    weight_kg:          f.weight_kg ? Number(f.weight_kg) : null,
    colour:             f.colour || null,
    microchip_number:   f.microchip_number || null,
    spayed_neutered:    f.spayed_neutered,
    bite_history:       f.bite_history,
    bite_history_notes: f.bite_history_notes || null,
    aggression_notes:   f.aggression_notes || null,
    vet_name:           f.vet_name || null,
    vet_phone:          f.vet_phone || null,
    vet_address:        f.vet_address || null,
    medications:        f.medications.length ? f.medications : null,
    special_instructions: f.special_instructions || null,
    is_active:          f.is_active,
    is_archived:        f.is_archived,
    off_leash_approved: f.off_leash_approved,
    media_consent:      f.media_consent,
    buddy_walks_ok:     f.buddy_walks_ok,
  };
}

// ── Shared small components ───────────────────────────────────────────────────

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
  onChange: (n: keyof ProfileForm, v: string | boolean) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <Input type={type} value={form[name] as string} onChange={e => onChange(name, e.target.value)} />
    </div>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-taupe text-gold focus:ring-gold"
      />
      <span className="text-sm text-espresso">{label}</span>
    </label>
  );
}

// ── Dog edit form (used for both editing and adding) ──────────────────────────

function DogEditForm({
  form,
  onChange,
  onBoolChange,
  onMedChange,
  onAddMed,
  onRemoveMed,
}: {
  form: DogForm;
  onChange: (f: Partial<DogForm>) => void;
  onBoolChange: (k: keyof DogForm, v: boolean) => void;
  onMedChange: (i: number, k: keyof Medication, v: string) => void;
  onAddMed: () => void;
  onRemoveMed: (i: number) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Basic info */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Name *</label>
          <Input value={form.name} onChange={e => onChange({ name: e.target.value })} />
        </div>
        <div>
          <label className="label">Breed</label>
          <Input value={form.breed} onChange={e => onChange({ breed: e.target.value })} />
        </div>
        <div>
          <label className="label">Colour</label>
          <Input value={form.colour} onChange={e => onChange({ colour: e.target.value })} />
        </div>
        <div>
          <label className="label">Date of Birth (or est.)</label>
          <Input type="date" value={form.date_of_birth} onChange={e => onChange({ date_of_birth: e.target.value })} />
        </div>
        <div>
          <label className="label">Adopt-aversary</label>
          <Input type="date" value={form.adoptaversary} onChange={e => onChange({ adoptaversary: e.target.value })} />
        </div>
        <div>
          <label className="label">Weight (lbs)</label>
          <Input type="number" step="0.1" min="0" value={form.weight_kg} onChange={e => onChange({ weight_kg: e.target.value })} />
        </div>
        <div>
          <label className="label">Size</label>
          <select className="input" value={form.size} onChange={e => onChange({ size: e.target.value })}>
            <option value="">Select…</option>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
            <option value="extra_large">Extra Large</option>
          </select>
        </div>
        <div>
          <label className="label">Sex</label>
          <select className="input" value={form.sex} onChange={e => onChange({ sex: e.target.value })}>
            <option value="">Select…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <div>
          <label className="label">Microchip #</label>
          <Input value={form.microchip_number} onChange={e => onChange({ microchip_number: e.target.value })} />
        </div>
        <div className="flex items-end pb-1">
          <Checkbox label="Spayed / Neutered" checked={form.spayed_neutered} onChange={v => onBoolChange('spayed_neutered', v)} />
        </div>
      </div>

      {/* Status */}
      <div>
        <Checkbox label="Active (approved for walks)" checked={form.is_active} onChange={v => onBoolChange('is_active', v)} />
        <Checkbox label="Off-Leash Approved" checked={form.off_leash_approved} onChange={v => onBoolChange('off_leash_approved', v)} />
        <Checkbox label="Buddy Walks OK" checked={form.buddy_walks_ok} onChange={v => onBoolChange('buddy_walks_ok', v)} />
        <Checkbox label="Media Consent" checked={form.media_consent} onChange={v => onBoolChange('media_consent', v)} />
      </div>

      {/* Behaviour */}
      <div className="space-y-3">
        <Checkbox label="Bite History" checked={form.bite_history} onChange={v => onBoolChange('bite_history', v)} />
        {form.bite_history && (
          <div>
            <label className="label">Bite History Notes</label>
            <textarea className="input min-h-16 resize-y" value={form.bite_history_notes}
              onChange={e => onChange({ bite_history_notes: e.target.value })} />
          </div>
        )}
        <div>
          <label className="label">Aggression / Behaviour Notes</label>
          <textarea className="input min-h-16 resize-y" value={form.aggression_notes}
            onChange={e => onChange({ aggression_notes: e.target.value })} />
        </div>
      </div>

      {/* Vet info */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Vet Name</label>
          <Input value={form.vet_name} onChange={e => onChange({ vet_name: e.target.value })} />
        </div>
        <div>
          <label className="label">Vet Phone</label>
          <Input type="tel" value={form.vet_phone} onChange={e => onChange({ vet_phone: e.target.value })} />
        </div>
        <div className="col-span-2">
          <label className="label">Vet Address</label>
          <Input value={form.vet_address} onChange={e => onChange({ vet_address: e.target.value })} />
        </div>
      </div>

      {/* Medications */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Medications</label>
          <button type="button" onClick={onAddMed} className="text-sm text-blue hover:underline">+ Add</button>
        </div>
        {form.medications.map((med, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 mb-2 items-end">
            <div className="col-span-3">
              {i === 0 && <div className="text-xs text-taupe mb-1">Name</div>}
              <Input placeholder="Medication" value={med.name} onChange={e => onMedChange(i, 'name', e.target.value)} />
            </div>
            <div className="col-span-3">
              {i === 0 && <div className="text-xs text-taupe mb-1">Dosage</div>}
              <Input placeholder="50mg" value={med.dosage} onChange={e => onMedChange(i, 'dosage', e.target.value)} />
            </div>
            <div className="col-span-3">
              {i === 0 && <div className="text-xs text-taupe mb-1">Frequency</div>}
              <Input placeholder="Twice daily" value={med.frequency} onChange={e => onMedChange(i, 'frequency', e.target.value)} />
            </div>
            <div className="col-span-2">
              {i === 0 && <div className="text-xs text-taupe mb-1">Notes</div>}
              <Input placeholder="With food" value={med.notes} onChange={e => onMedChange(i, 'notes', e.target.value)} />
            </div>
            <div className="col-span-1 flex items-end pb-1">
              <button type="button" onClick={() => onRemoveMed(i)} className="text-taupe hover:text-red-500 text-lg leading-none">×</button>
            </div>
          </div>
        ))}
        {!form.medications.length && (
          <p className="text-sm text-taupe">No medications.</p>
        )}
      </div>

      {/* Special instructions */}
      <div>
        <label className="label">Special Instructions</label>
        <textarea className="input min-h-20 resize-y" value={form.special_instructions}
          onChange={e => onChange({ special_instructions: e.target.value })} />
      </div>
    </div>
  );
}

// ── Vaccination records section ────────────────────────────────────────────────

function VaccinationSection({ dogId }: { dogId: number }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [vacForm, setVacForm] = useState({ vaccine_name: '', administered_date: '', expiry_date: '' });
  const [vacSuccess, setVacSuccess] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['vaccinations', dogId],
    queryFn: () => api.get(`/admin/dogs/${dogId}/vaccinations`).then(r => r.data.data),
  });

  const create = useMutation({
    mutationFn: () => api.post(`/admin/dogs/${dogId}/vaccinations`, vacForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vaccinations', dogId] });
      setAdding(false);
      setVacForm({ vaccine_name: '', administered_date: '', expiry_date: '' });
      setVacSuccess('Saved!'); setTimeout(() => setVacSuccess(''), 2500);
    },
  });

  const remove = useMutation({
    mutationFn: (recordId: number) => api.delete(`/admin/dogs/${dogId}/vaccinations/${recordId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vaccinations', dogId] }); setVacSuccess('Removed!'); setTimeout(() => setVacSuccess(''), 2500); },
  });

  const vaccinations: any[] = data ?? [];

  return (
    <div className="mt-3 pt-3 border-t border-cream">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-taupe uppercase tracking-wide">Vaccinations</span>
        <div className="flex items-center gap-2">
          {vacSuccess && <span className="text-xs text-green-600 font-medium">{vacSuccess}</span>}
          {!adding && (
            <button onClick={() => setAdding(true)} className="text-xs text-blue hover:underline">+ Add</button>
          )}
        </div>
      </div>
      {create.isError && <p className="text-xs text-red-600">{(create.error as any)?.response?.data?.message || 'Failed to save.'}</p>}
      {remove.isError && <p className="text-xs text-red-600">{(remove.error as any)?.response?.data?.message || 'Failed to remove.'}</p>}

      {isLoading ? (
        <p className="text-xs text-taupe">Loading…</p>
      ) : vaccinations.length === 0 && !adding ? (
        <p className="text-xs text-taupe">No vaccination records on file.</p>
      ) : (
        <div className="space-y-1">
          {vaccinations.map((v: any) => {
            const expired = v.expiry_date && new Date(v.expiry_date) < new Date();
            return (
              <div key={v.id} className="flex items-center justify-between gap-2 text-xs">
                <span className={`font-medium ${expired ? 'text-red-600' : 'text-espresso'}`}>
                  {v.vaccine_name}
                  {expired && <span className="ml-1 text-red-500">(expired)</span>}
                </span>
                <span className="text-taupe">
                  {v.administered_date ? new Date(v.administered_date).toLocaleDateString('en-CA') : '—'}
                  {v.expiry_date && ` → ${new Date(v.expiry_date).toLocaleDateString('en-CA')}`}
                </span>
                <button
                  onClick={() => remove.mutate(v.id)}
                  className="text-taupe hover:text-red-500 transition-colors ml-1"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {adding && (
        <div className="mt-2 space-y-2 p-3 bg-cream/50 rounded-lg">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="text-xs text-taupe mb-1">Vaccine</div>
              <input
                className="input text-xs py-1.5"
                placeholder="e.g. Rabies"
                value={vacForm.vaccine_name}
                onChange={e => setVacForm(f => ({ ...f, vaccine_name: e.target.value }))}
              />
            </div>
            <div>
              <div className="text-xs text-taupe mb-1">Administered</div>
              <input
                type="date"
                className="input text-xs py-1.5"
                value={vacForm.administered_date}
                onChange={e => setVacForm(f => ({ ...f, administered_date: e.target.value }))}
              />
            </div>
            <div>
              <div className="text-xs text-taupe mb-1">Expires</div>
              <input
                type="date"
                className="input text-xs py-1.5"
                value={vacForm.expiry_date}
                onChange={e => setVacForm(f => ({ ...f, expiry_date: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setAdding(false); setVacForm({ vaccine_name: '', administered_date: '', expiry_date: '' }); }}
              className="text-xs text-taupe hover:text-espresso"
            >
              Cancel
            </button>
            <Button
              size="sm"
              loading={create.isPending}
              disabled={!vacForm.vaccine_name || !vacForm.administered_date}
              onClick={() => create.mutate()}
            >
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Dog card (read + inline edit) ─────────────────────────────────────────────

function DogPhoto({ dogId, hasPhoto }: { dogId: number; hasPhoto: boolean }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!hasPhoto) { setUrl(null); return; }
    let cancelled = false;
    api.get(`/admin/dogs/${dogId}/photo`, { responseType: 'blob' })
      .then(r => { if (!cancelled) setUrl(URL.createObjectURL(r.data)); })
      .catch(() => {});
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [dogId, hasPhoto]); // eslint-disable-line

  if (url) {
    return <img src={url} alt="Dog" className="h-12 w-12 rounded-full object-cover flex-shrink-0" />;
  }
  return <div className="h-12 w-12 rounded-full bg-cream flex items-center justify-center text-2xl flex-shrink-0">🐕</div>;
}

function DogPhotoUpload({ dogId, hasPhoto, onChanged }: { dogId: number; hasPhoto: boolean; onChanged: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoMsg, setPhotoMsg] = useState('');
  const [photoError, setPhotoError] = useState('');

  useEffect(() => {
    if (!hasPhoto) { setPreview(null); return; }
    let cancelled = false;
    api.get(`/admin/dogs/${dogId}/photo`, { responseType: 'blob' })
      .then(r => { if (!cancelled) setPreview(URL.createObjectURL(r.data)); })
      .catch(() => {});
    return () => { cancelled = true; if (preview) URL.revokeObjectURL(preview); };
  }, [dogId, hasPhoto]); // eslint-disable-line

  const upload = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('photo', file);
      return api.post(`/admin/dogs/${dogId}/photo`, fd);
    },
    onSuccess: () => { onChanged(); setPhotoError(''); setPhotoMsg('Photo uploaded!'); setTimeout(() => setPhotoMsg(''), 2500); },
    onError: (e: any) => setPhotoError(e.response?.data?.message || 'Upload failed.'),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/admin/dogs/${dogId}/photo`),
    onSuccess: () => { setPreview(null); onChanged(); setPhotoError(''); setPhotoMsg('Photo removed!'); setTimeout(() => setPhotoMsg(''), 2500); },
    onError: (e: any) => setPhotoError(e.response?.data?.message || 'Failed to remove photo.'),
  });

  return (
    <div className="flex items-center gap-4 mb-4">
      {preview ? (
        <img src={preview} alt="Dog" className="h-20 w-20 rounded-xl object-cover" />
      ) : (
        <div className="h-20 w-20 rounded-xl bg-cream flex items-center justify-center text-3xl">🐕</div>
      )}
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="text-xs text-blue hover:underline text-left"
        >
          {upload.isPending ? 'Uploading...' : preview ? 'Change photo' : 'Upload photo'}
        </button>
        {preview && (
          <button
            type="button"
            onClick={() => remove.mutate()}
            className="text-xs text-red-400 hover:text-red-600 text-left"
          >
            {remove.isPending ? 'Removing...' : 'Remove photo'}
          </button>
        )}
        {photoMsg && <span className="text-xs text-green-600 font-medium">{photoMsg}</span>}
        {photoError && <span className="text-xs text-red-600">{photoError}</span>}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) {
            setPreview(URL.createObjectURL(file));
            upload.mutate(file);
          }
          e.target.value = '';
        }}
      />
    </div>
  );
}

// ── Subscription Card (Stripe-connected) ─────────────────────────────────────

function SubscriptionCard({ clientId, clientProfile, onChanged }: { clientId: number; clientProfile: any; onChanged: () => void }) {
  const qc = useQueryClient();
  const [selectedPrice, setSelectedPrice] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [walksEditing, setWalksEditing] = useState(false);
  const [billingEditing, setBillingEditing] = useState(false);
  const [error, setError] = useState('');
  const [subSuccess, setSubSuccess] = useState('');

  // Pause state
  const [showPause, setShowPause] = useState(false);
  const [pauseFrom, setPauseFrom] = useState('');
  const [pauseUntil, setPauseUntil] = useState('');
  const [pauseBilling, setPauseBilling] = useState(true);
  const [prorateOnResume, setProrateOnResume] = useState(false);

  const { data: stripeRes } = useQuery({
    queryKey: ['stripe-products'],
    queryFn: () => api.get('/admin/stripe/products').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const stripeProducts = stripeRes?.data ?? [];
  const stripeMessage = stripeRes?.message ?? '';

  const { data: history } = useQuery({
    queryKey: ['subscription-history', clientId],
    queryFn: () => api.get(`/admin/clients/${clientId}/subscription-history`).then(r => r.data.data),
  });

  const subscribe = useMutation({
    mutationFn: ({ priceId, effective }: { priceId: string; effective?: string }) =>
      api.post(`/admin/clients/${clientId}/subscribe`, {
        stripe_price_id: priceId,
        effective_date: effective || undefined,
      }),
    onSuccess: () => { onChanged(); setError(''); setSelectedPrice(''); setEffectiveDate(''); qc.invalidateQueries({ queryKey: ['subscription-history', clientId] }); setSubSuccess('Plan updated!'); setTimeout(() => setSubSuccess(''), 2500); },
    onError: (err: any) => { setError(err.response?.data?.message ?? 'Failed to subscribe.'); setSubSuccess(''); },
  });

  const cancelSub = useMutation({
    mutationFn: (immediate: boolean) => api.post(`/admin/clients/${clientId}/cancel-subscription`, { immediate }),
    onSuccess: () => { onChanged(); setError(''); qc.invalidateQueries({ queryKey: ['subscription-history', clientId] }); setSubSuccess('Subscription cancelled.'); setTimeout(() => setSubSuccess(''), 2500); },
    onError: (err: any) => { setError(err.response?.data?.message ?? 'Failed to cancel.'); setSubSuccess(''); },
  });

  const pauseSub = useMutation({
    mutationFn: () => api.post(`/admin/clients/${clientId}/pause-subscription`, {
      paused_from: pauseFrom,
      paused_until: pauseUntil,
      pause_billing: pauseBilling,
      prorate_on_resume: prorateOnResume,
    }),
    onSuccess: () => {
      onChanged(); setError(''); setShowPause(false);
      setPauseFrom(''); setPauseUntil(''); setPauseBilling(true); setProrateOnResume(false);
      qc.invalidateQueries({ queryKey: ['subscription-history', clientId] });
      setSubSuccess('Subscription paused!'); setTimeout(() => setSubSuccess(''), 2500);
    },
    onError: (err: any) => { setError(err.response?.data?.message ?? 'Failed to pause.'); setSubSuccess(''); },
  });

  const updateWalks = useMutation({
    mutationFn: (walks: number | null) => api.patch(`/admin/clients/${clientId}`, { profile: { walks_per_week: walks } }),
    onSuccess: () => { onChanged(); setWalksEditing(false); setSubSuccess('Updated!'); setTimeout(() => setSubSuccess(''), 2500); },
    onError: (err: any) => { setError(err.response?.data?.message ?? 'Failed to update.'); },
  });

  const updateBilling = useMutation({
    mutationFn: (method: string) => api.patch(`/admin/clients/${clientId}`, { profile: { billing_method: method } }),
    onSuccess: () => { onChanged(); setBillingEditing(false); setSubSuccess('Updated!'); setTimeout(() => setSubSuccess(''), 2500); },
    onError: (err: any) => { setError(err.response?.data?.message ?? 'Failed to update.'); },
  });

  const resumeSub = useMutation({
    mutationFn: () => api.post(`/admin/clients/${clientId}/resume-subscription`),
    onSuccess: (res) => {
      onChanged(); setError('');
      qc.invalidateQueries({ queryKey: ['subscription-history', clientId] });
      const credit = res.data?.proration_credit;
      setSubSuccess(credit ? `Resumed! $${credit} proration credit created.` : 'Subscription resumed!');
      setTimeout(() => setSubSuccess(''), 2500);
    },
    onError: (err: any) => { setError(err.response?.data?.message ?? 'Failed to resume.'); setSubSuccess(''); },
  });

  const cp = clientProfile ?? {};
  const billingMethod: string = cp.billing_method ?? 'credit_card';
  const hasSubscription = !!cp.stripe_subscription_id || !!cp.subscription_plan;

  // Build flat list of recurring prices from products (exclude one-time prices)
  const allPrices: { priceId: string; label: string; amount: number }[] = [];
  stripeProducts?.forEach((product: any) => {
    product.prices?.forEach((price: any) => {
      if (!price.interval) return; // skip one-time prices
      allPrices.push({
        priceId: price.id,
        label: `${product.name}${price.nickname ? ` — ${price.nickname}` : ''} ($${price.amount}/${price.interval})`,
        amount: price.amount,
      });
    });
  });

  return (
    <Card>
      <CardHeader title="Subscription" />
      {hasSubscription ? (
        <div className="space-y-3">
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-taupe">Plan</span>
              <span className="font-semibold text-espresso">{cp.subscription_plan}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-taupe">Amount</span>
              <span className="font-semibold text-espresso">${Number(cp.subscription_amount).toFixed(2)}/mo</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-taupe">Billing</span>
              {billingEditing ? (
                <div className="flex items-center gap-1.5">
                  <select
                    className="border border-taupe/30 rounded px-2 py-0.5 text-sm"
                    defaultValue={billingMethod}
                    onChange={e => updateBilling.mutate(e.target.value)}
                  >
                    <option value="credit_card">Credit Card</option>
                    <option value="e_transfer">E-Transfer</option>
                    <option value="interac_pad">Interac/PAD</option>
                    <option value="cash">Cash</option>
                  </select>
                  <button className="text-xs text-taupe hover:text-espresso" onClick={() => setBillingEditing(false)}>cancel</button>
                </div>
              ) : (
                <button
                  className="font-semibold text-espresso hover:text-gold transition-colors"
                  onClick={() => setBillingEditing(true)}
                >
                  {{ credit_card: 'Credit Card', e_transfer: 'E-Transfer', interac_pad: 'Interac/PAD', cash: 'Cash' }[billingMethod] ?? billingMethod}
                  {!cp.stripe_subscription_id && <span className="text-xs text-taupe ml-1">(local)</span>}
                </button>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-taupe">Walks/week</span>
              {walksEditing ? (
                <div className="flex items-center gap-1.5">
                  <select
                    className="border border-taupe/30 rounded px-2 py-0.5 text-sm w-16"
                    defaultValue={cp.walks_per_week ?? ''}
                    onChange={e => {
                      const v = e.target.value ? parseInt(e.target.value) : null;
                      updateWalks.mutate(v);
                    }}
                  >
                    <option value="">—</option>
                    {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <button className="text-xs text-taupe hover:text-espresso" onClick={() => setWalksEditing(false)}>cancel</button>
                </div>
              ) : (
                <button
                  className="font-semibold text-espresso hover:text-gold transition-colors"
                  onClick={() => setWalksEditing(true)}
                >
                  {cp.walks_per_week ? `${cp.walks_per_week}/week` : 'Not set'}
                </button>
              )}
            </div>
            {cp.next_billing_date && (
              <div className="flex justify-between">
                <span className="text-taupe">Next billing</span>
                <span className="text-espresso">{new Date(cp.next_billing_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
            )}
            {cp.subscription_end_date && (
              <div className="flex justify-between">
                <span className="text-taupe">Cancels on</span>
                <span className="text-red-500 font-medium">{cp.subscription_end_date?.split('T')[0]}</span>
              </div>
            )}
            {cp.subscription_paused_from && (
              <>
                <div className="flex justify-between">
                  <span className="text-taupe">Paused</span>
                  <span className="text-orange-500 font-medium">
                    {new Date(cp.subscription_paused_from).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {' — '}
                    {new Date(cp.subscription_paused_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-taupe">Billing</span>
                  <span className={`font-medium ${cp.pause_billing ? 'text-orange-500' : 'text-green-600'}`}>
                    {cp.pause_billing ? 'Paused' : 'Continues (prorate on resume)'}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Resume button if paused */}
          {cp.subscription_paused_from && (
            <div className="pt-3 border-t border-cream">
              <Button
                size="sm"
                loading={resumeSub.isPending}
                onClick={() => { if (confirm('Resume this subscription now?')) resumeSub.mutate(); }}
              >
                Resume Subscription Now
              </Button>
            </div>
          )}

          {/* Change plan */}
          <div className="pt-3 border-t border-cream space-y-2">
            <label className="label">Change Plan</label>
            <select
              className="input"
              value={selectedPrice}
              onChange={e => setSelectedPrice(e.target.value)}
            >
              <option value="">Select a plan…</option>
              {allPrices.map(p => (
                <option key={p.priceId} value={p.priceId}>{p.label}</option>
              ))}
            </select>
            {selectedPrice && (
              <div>
                <label className="label">Effective Date</label>
                <input
                  type="date"
                  className="input"
                  value={effectiveDate}
                  onChange={e => setEffectiveDate(e.target.value)}
                />
                <p className="text-xs text-taupe mt-1">
                  Leave blank for immediate. If set, the next invoice will include a pro-rated adjustment.
                </p>
              </div>
            )}
            <Button
              size="sm"
              disabled={!selectedPrice}
              loading={subscribe.isPending}
              onClick={() => selectedPrice && subscribe.mutate({ priceId: selectedPrice, effective: effectiveDate })}
            >
              Update Plan
            </Button>
          </div>

          {/* Pause subscription */}
          {!cp.subscription_paused_from && (
            <div className="pt-3 border-t border-cream">
              {showPause ? (
                <div className="space-y-3 bg-cream/50 rounded-lg p-3 border border-cream">
                  <p className="text-xs font-semibold text-taupe uppercase tracking-wide">Pause Subscription</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label">Pause From</label>
                      <input type="date" className="input" value={pauseFrom} onChange={e => setPauseFrom(e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Resume On</label>
                      <input type="date" className="input" value={pauseUntil} onChange={e => setPauseUntil(e.target.value)} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={pauseBilling} onChange={e => setPauseBilling(e.target.checked)} className="h-4 w-4 rounded border-taupe text-gold focus:ring-gold" />
                    <span className="text-sm text-espresso">Pause billing during this period</span>
                  </label>
                  {!pauseBilling && (
                    <label className="flex items-center gap-2 cursor-pointer ml-6">
                      <input type="checkbox" checked={prorateOnResume} onChange={e => setProrateOnResume(e.target.checked)} className="h-4 w-4 rounded border-taupe text-gold focus:ring-gold" />
                      <span className="text-sm text-espresso">Prorate next bill (credit for paused days)</span>
                    </label>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" loading={pauseSub.isPending} disabled={!pauseFrom || !pauseUntil} onClick={() => pauseSub.mutate()}>
                      Confirm Pause
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowPause(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => { setShowPause(true); setPauseFrom(new Date().toISOString().split('T')[0]); }}>
                  Pause Subscription
                </Button>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button size="sm" variant="outline" loading={cancelSub.isPending} onClick={() => {
              if (confirm('Cancel subscription at the end of the current billing period?')) cancelSub.mutate(false);
            }}>
              Cancel at Period End
            </Button>
            <Button size="sm" variant="outline" className="text-red-500 border-red-300 hover:bg-red-50" loading={cancelSub.isPending} onClick={() => {
              if (confirm('Cancel subscription immediately? This cannot be undone.')) cancelSub.mutate(true);
            }}>
              Cancel Now
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-taupe">No active subscription.</p>
          {billingMethod === 'credit_card' && !cp.stripe_payment_method_id && (
            <p className="text-xs text-red-500">Client must add a card on file before subscribing via credit card.</p>
          )}

          {/* Editable billing info */}
          <div className="text-sm space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-taupe">Billing method</span>
              {billingEditing ? (
                <div className="flex items-center gap-1.5">
                  <select
                    className="border border-taupe/30 rounded px-2 py-0.5 text-sm"
                    defaultValue={billingMethod}
                    onChange={e => updateBilling.mutate(e.target.value)}
                  >
                    <option value="credit_card">Credit Card</option>
                    <option value="e_transfer">E-Transfer</option>
                    <option value="interac_pad">Interac/PAD</option>
                    <option value="cash">Cash</option>
                  </select>
                  <button className="text-xs text-taupe hover:text-espresso" onClick={() => setBillingEditing(false)}>cancel</button>
                </div>
              ) : (
                <button
                  className="font-semibold text-espresso hover:text-gold transition-colors inline-flex items-center gap-1"
                  onClick={() => setBillingEditing(true)}
                >
                  {{ credit_card: 'Credit Card', e_transfer: 'E-Transfer', interac_pad: 'Interac/PAD', cash: 'Cash' }[billingMethod] ?? billingMethod}
                  <Pencil className="w-3 h-3 text-taupe" />
                </button>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-taupe">Walks/week</span>
              {walksEditing ? (
                <div className="flex items-center gap-1.5">
                  <select
                    className="border border-taupe/30 rounded px-2 py-0.5 text-sm w-16"
                    defaultValue={cp.walks_per_week ?? ''}
                    onChange={e => {
                      const v = e.target.value ? parseInt(e.target.value) : null;
                      updateWalks.mutate(v);
                    }}
                  >
                    <option value="">—</option>
                    {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <button className="text-xs text-taupe hover:text-espresso" onClick={() => setWalksEditing(false)}>cancel</button>
                </div>
              ) : (
                <button
                  className="font-semibold text-espresso hover:text-gold transition-colors inline-flex items-center gap-1"
                  onClick={() => setWalksEditing(true)}
                >
                  {cp.walks_per_week ? `${cp.walks_per_week}/week` : 'Not set'}
                  <Pencil className="w-3 h-3 text-taupe" />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-cream">
            <label className="label">Start Subscription</label>
            <select
              className="input"
              value={selectedPrice}
              onChange={e => setSelectedPrice(e.target.value)}
            >
              <option value="">Select a plan…</option>
              {allPrices.map(p => (
                <option key={p.priceId} value={p.priceId}>{p.label}</option>
              ))}
            </select>
            {allPrices.length === 0 && (
              <p className="text-xs text-red-500">
                {stripeMessage || 'No plans found. Make sure Stripe has active products with monthly recurring prices.'}
                {stripeRes?.debug && <span className="block mt-1 text-taupe">({stripeRes.debug.products_count} products, {stripeRes.debug.prices_count} prices found in Stripe)</span>}
              </p>
            )}
            {selectedPrice && (
              <div>
                <label className="label">Start Date</label>
                <input
                  type="date"
                  className="input"
                  value={effectiveDate}
                  onChange={e => setEffectiveDate(e.target.value)}
                />
                <p className="text-xs text-taupe mt-1">
                  Leave blank to start today. The billing cycle will repeat monthly from this date.
                </p>
              </div>
            )}
            <div>
              <Button
                size="sm"
                disabled={!selectedPrice || (billingMethod === 'credit_card' && !cp.stripe_payment_method_id)}
                loading={subscribe.isPending}
                onClick={() => selectedPrice && subscribe.mutate({ priceId: selectedPrice, effective: effectiveDate })}
              >
                Subscribe
              </Button>
            </div>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      {subSuccess && <p className="text-sm text-green-600 font-medium mt-2">{subSuccess}</p>}

      {/* Plan change history */}
      {history && history.length > 0 && (
        <div className="mt-4 pt-4 border-t border-cream">
          <p className="text-xs font-semibold text-taupe uppercase tracking-wide mb-3">Plan History</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-taupe text-left border-b border-cream">
                <th className="pb-1.5 pr-3 font-medium w-24">Date</th>
                <th className="pb-1.5 pr-3 font-medium">Action</th>
                <th className="pb-1.5 pr-3 font-medium">Plan</th>
                <th className="pb-1.5 pr-3 font-medium">Amount</th>
                <th className="pb-1.5 font-medium text-right">By</th>
              </tr>
            </thead>
            <tbody className="max-h-48 overflow-y-auto">
              {history.map((h: any) => {
                const actionLabels: Record<string, string> = {
                  created: 'Started',
                  upgraded: 'Upgraded',
                  downgraded: 'Downgraded',
                  updated: 'Changed',
                  paused: 'Paused',
                  resumed: 'Resumed',
                  canceled: 'Canceled (EOP)',
                  canceled_immediate: 'Canceled',
                };
                const actionColors: Record<string, string> = {
                  created: 'text-green-600',
                  upgraded: 'text-blue-600',
                  downgraded: 'text-orange-600',
                  updated: 'text-espresso',
                  paused: 'text-orange-500',
                  resumed: 'text-green-600',
                  canceled: 'text-red-500',
                  canceled_immediate: 'text-red-600',
                };
                const planLabel = h.old_plan && h.new_plan
                  ? `${h.old_plan} → ${h.new_plan}`
                  : h.new_plan ?? h.old_plan ?? '—';
                return (
                  <tr key={h.id} className="border-b border-cream/50">
                    <td className="py-2 pr-3 text-taupe whitespace-nowrap">
                      {new Date(h.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                    </td>
                    <td className={`py-2 pr-3 font-semibold whitespace-nowrap ${actionColors[h.action] ?? 'text-espresso'}`}>
                      {actionLabels[h.action] ?? h.action}
                    </td>
                    <td className="py-2 pr-3 text-espresso">
                      {planLabel}
                      {h.effective_date && (
                        <span className="text-taupe/60 ml-1">
                          eff. {new Date(h.effective_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-taupe whitespace-nowrap">
                      {h.new_amount ? `$${Number(h.new_amount).toFixed(2)}/mo` : '—'}
                      {h.proration_amount && Number(h.proration_amount) !== 0 && (
                        <span className={`ml-1 ${Number(h.proration_amount) > 0 ? 'text-blue-600' : 'text-green-600'}`}>
                          ({Number(h.proration_amount) > 0 ? '+' : ''}${Number(h.proration_amount).toFixed(2)})
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-taupe/60 text-right whitespace-nowrap">
                      {h.changed_by_user ? h.changed_by_user.name.split(' ')[0] : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

const SIZE_LABELS: Record<string, string> = {
  toy: 'Toy (under 10 lbs)', small: 'Small (under 20 lbs)', medium: 'Medium (20–55 lbs)', large: 'Large (55–90 lbs)', extra_large: 'Extra Large (90+ lbs)', xl: 'Extra Large (90+ lbs)',
};

function fmtVal(val: string | null | undefined): string | null {
  if (!val) return null;
  const s = val.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ProfileRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 py-0.5">
      <span className="text-taupe flex-shrink-0">{label}:</span>
      <span className="text-espresso">{value}</span>
    </div>
  );
}

function DogCard({ dog, clientId, onSaved }: { dog: any; clientId: number; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [form, setForm] = useState<DogForm>(buildDogForm(dog));

  useEffect(() => { setForm(buildDogForm(dog)); }, [dog]);

  const [dogSaveMsg, setDogSaveMsg] = useState('');
  const update = useMutation({
    mutationFn: (f: DogForm) => api.patch(`/admin/dogs/${dog.id}`, dogPayload(f, clientId)),
    onSuccess: () => { setEditing(false); onSaved(); setDogSaveMsg('Saved!'); setTimeout(() => setDogSaveMsg(''), 2500); },
  });

  const [justActivated, setJustActivated] = useState(false);
  const activate = useMutation({
    mutationFn: () => api.patch(`/admin/dogs/${dog.id}`, dogPayload({ ...buildDogForm(dog), is_active: true }, clientId)),
    onSuccess: () => { setJustActivated(true); onSaved(); setTimeout(() => setJustActivated(false), 2500); },
  });

  const [archiveMsg, setArchiveMsg] = useState('');
  const archive = useMutation({
    mutationFn: (archived: boolean) => api.patch(`/admin/dogs/${dog.id}`, dogPayload({ ...buildDogForm(dog), is_archived: archived }, clientId)),
    onSuccess: (_, archived) => { setArchiveMsg(archived ? 'Archived!' : 'Unarchived!'); onSaved(); setTimeout(() => setArchiveMsg(''), 2500); },
    onError: (e: any) => { setArchiveMsg((e as any).response?.data?.message || 'Archive failed.'); setTimeout(() => setArchiveMsg(''), 4000); },
  });

  const handleChange = (partial: Partial<DogForm>) => setForm(prev => ({ ...prev, ...partial }));
  const handleBool = (k: keyof DogForm, v: boolean) => setForm(prev => ({ ...prev, [k]: v }));
  const handleMedChange = (i: number, k: keyof Medication, v: string) =>
    setForm(prev => ({ ...prev, medications: prev.medications.map((m, idx) => idx === i ? { ...m, [k]: v } : m) }));
  const handleAddMed = () => setForm(prev => ({ ...prev, medications: [...prev.medications, { name: '', dosage: '', frequency: '', notes: '' }] }));
  const handleRemoveMed = (i: number) => setForm(prev => ({ ...prev, medications: prev.medications.filter((_, idx) => idx !== i) }));

  if (editing) {
    return (
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-espresso text-base">Editing {dog.name}</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setForm(buildDogForm(dog)); setEditing(false); }}>Cancel</Button>
            <Button size="sm" loading={update.isPending} onClick={() => update.mutate(form)}>Save</Button>
          </div>
        </div>
        {update.isError && (
          <p className="text-sm text-red-600 mb-3">
            {(update.error as any)?.response?.data?.message ?? 'Save failed.'}
          </p>
        )}
        <DogPhotoUpload dogId={dog.id} hasPhoto={!!dog.photo_path} onChanged={onSaved} />
        <DogEditForm
          form={form}
          onChange={handleChange}
          onBoolChange={handleBool}
          onMedChange={handleMedChange}
          onAddMed={handleAddMed}
          onRemoveMed={handleRemoveMed}
        />
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-start gap-3">
        <DogPhoto dogId={dog.id} hasPhoto={!!dog.photo_path} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-semibold text-espresso">{dog.name}</div>
              <div className="text-sm text-taupe">
                {[dog.breed, dog.size, dog.sex].filter(Boolean).join(' · ') || '—'}
              </div>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              {!dog.is_active && !justActivated && (
                <Button size="sm" variant="outline" loading={activate.isPending} onClick={() => activate.mutate()}>
                  Activate
                </Button>
              )}
              {justActivated && (
                <span className="text-sm font-medium text-green-600 px-2 py-1">Activated!</span>
              )}
              {dogSaveMsg && !justActivated && (
                <span className="text-sm font-medium text-green-600 px-2 py-1">{dogSaveMsg}</span>
              )}
              <Button
                size="sm"
                variant="outline"
                loading={archive.isPending}
                onClick={() => archive.mutate(!dog.is_archived)}
              >
                {dog.is_archived ? 'Unarchive' : 'Archive'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowProfile(true)}>Full Profile</Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
            </div>
          </div>
          {activate.isError && (
            <p className="text-xs text-red-600 mt-1">{(activate.error as any)?.response?.data?.message || 'Activation failed.'}</p>
          )}
          {archiveMsg && (
            <p className={`text-xs mt-1 ${archiveMsg.includes('!') ? 'text-green-600' : 'text-red-600'}`}>{archiveMsg}</p>
          )}
          <div className="flex gap-2 mt-2 flex-wrap">
            {dog.is_archived && <Badge variant="red">Archived</Badge>}
            {!dog.is_active && !justActivated && !dog.is_archived && <Badge variant="red">Pending Review</Badge>}
            {justActivated && <Badge variant="green">Active</Badge>}
            {dog.bite_history && <Badge variant="red">Bite History</Badge>}
            {dog.has_expired_vaccinations && <Badge variant="gold">Vaccines Expiring</Badge>}
            {dog.off_leash_approved && <Badge variant="green">Off-Leash Approved</Badge>}
            {dog.buddy_walks_ok && <Badge variant="green">Buddy Walks OK</Badge>}
            {dog.media_consent && <Badge variant="blue">Media Consent</Badge>}
          </div>
          {dog.special_instructions && (
            <p className="text-xs text-taupe mt-2 line-clamp-2">{dog.special_instructions}</p>
          )}
          {dog.medications?.length > 0 && (
            <p className="text-xs text-taupe mt-1">💊 {dog.medications.map((m: any) => m.name).join(', ')}</p>
          )}
          <VaccinationSection dogId={dog.id} />
        </div>
      </div>

      {/* Full Profile Modal */}
      <Modal open={showProfile} onClose={() => setShowProfile(false)} title={`${dog.name} — Full Profile`}>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Tags */}
          <div className="flex gap-2 flex-wrap">
            {dog.is_archived && <Badge variant="red">Archived</Badge>}
            {!dog.is_archived && (dog.is_active ? <Badge variant="green">Active</Badge> : <Badge variant="red">Pending Review</Badge>)}
            {dog.bite_history && <Badge variant="red">Bite History</Badge>}
            {dog.has_expired_vaccinations && <Badge variant="gold">Vaccines Expiring</Badge>}
            {dog.off_leash_approved && <Badge variant="green">Off-Leash Approved</Badge>}
            {dog.buddy_walks_ok && <Badge variant="green">Buddy Walks OK</Badge>}
            {dog.media_consent && <Badge variant="blue">Media Consent</Badge>}
          </div>

          {/* Basic info */}
          <div>
            <h4 className="text-xs font-semibold text-gold uppercase tracking-widest mb-2">Basic Info</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <ProfileRow label="Breed" value={dog.breed} />
              <ProfileRow label="Size" value={SIZE_LABELS[dog.size] ?? dog.size} />
              <ProfileRow label="Sex" value={dog.sex === 'male' ? 'Male' : dog.sex === 'female' ? 'Female' : null} />
              <ProfileRow label="Date of Birth (or est.)" value={dog.date_of_birth ? new Date(dog.date_of_birth).toLocaleDateString('en-CA') : null} />
              {dog.adoptaversary && <ProfileRow label="Adopt-aversary" value={new Date(dog.adoptaversary).toLocaleDateString('en-CA')} />}
              <ProfileRow label="Weight" value={dog.weight_kg ? `${dog.weight_kg} lbs` : null} />
              <ProfileRow label="Colour" value={dog.colour} />
              <ProfileRow label="Microchip" value={dog.microchip_number} />
              <ProfileRow label="Spayed/Neutered" value={dog.spayed_neutered ? 'Yes' : 'No'} />
            </div>
          </div>

          {/* Behaviour */}
          {(dog.bite_history || dog.bite_history_notes || dog.aggression_notes) && (
            <div>
              <h4 className="text-xs font-semibold text-gold uppercase tracking-widest mb-2">Behaviour</h4>
              <div className="text-sm space-y-1">
                {dog.bite_history_notes && <ProfileRow label="Bite History Notes" value={dog.bite_history_notes} />}
                {dog.aggression_notes && <ProfileRow label="Aggression Notes" value={dog.aggression_notes} />}
              </div>
            </div>
          )}

          {/* Personality & Walk Preferences (intake fields) */}
          {(dog.personality_description || dog.energy_level || dog.interaction_dogs || dog.triggers) && (
            <div>
              <h4 className="text-xs font-semibold text-gold uppercase tracking-widest mb-2">Personality & Preferences</h4>
              <div className="text-sm space-y-1">
                <ProfileRow label="Personality" value={dog.personality_description} />
                <ProfileRow label="Energy Level" value={fmtVal(dog.energy_level)} />
                <ProfileRow label="With Dogs" value={fmtVal(dog.interaction_dogs)} />
                <ProfileRow label="With Strangers" value={fmtVal(dog.interaction_strangers)} />
                <ProfileRow label="With Children" value={fmtVal(dog.interaction_children)} />
                <ProfileRow label="Triggers" value={dog.triggers} />
                <ProfileRow label="Walk Style" value={Array.isArray(dog.preferred_walk_style) ? dog.preferred_walk_style.map((s: string) => fmtVal(s)).join(', ') : fmtVal(dog.preferred_walk_style)} />
                <ProfileRow label="Gear" value={Array.isArray(dog.preferred_gear) ? dog.preferred_gear.map((g: string) => fmtVal(g)).join(', ') : fmtVal(dog.preferred_gear)} />
                <ProfileRow label="Treats Allowed" value={fmtVal(dog.treats_allowed)} />
                <ProfileRow label="Treats Notes" value={dog.treats_notes} />
                <ProfileRow label="Training Commands" value={dog.training_commands} />
                <ProfileRow label="Avoid on Walks" value={dog.avoid_on_walks} />
              </div>
            </div>
          )}

          {/* Health */}
          {(dog.medical_conditions || dog.allergies || dog.medications?.length > 0 || dog.recent_surgeries) && (
            <div>
              <h4 className="text-xs font-semibold text-gold uppercase tracking-widest mb-2">Health</h4>
              <div className="text-sm space-y-1">
                <ProfileRow label="Medical Conditions" value={dog.medical_conditions} />
                <ProfileRow label="Allergies" value={dog.allergies} />
                <ProfileRow label="Mobility Limitations" value={dog.mobility_limitations ? 'Yes' : null} />
                <ProfileRow label="Recent Surgeries" value={dog.recent_surgeries} />
                <ProfileRow label="Administer Meds on Visits" value={dog.administer_medication_on_visits ? 'Yes' : null} />
              </div>
              {dog.medications?.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs font-medium text-taupe mb-1">Medications</div>
                  <div className="space-y-1">
                    {dog.medications.map((m: any, i: number) => (
                      <div key={i} className="bg-cream rounded-lg p-2 text-xs">
                        <span className="font-medium text-espresso">{m.name}</span>
                        {m.dosage && <span className="text-taupe"> — {m.dosage}</span>}
                        {m.frequency && <span className="text-taupe"> ({m.frequency})</span>}
                        {m.notes && <div className="text-taupe mt-0.5">{m.notes}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Vet */}
          {(dog.vet_name || dog.vet_phone) && (
            <div>
              <h4 className="text-xs font-semibold text-gold uppercase tracking-widest mb-2">Veterinarian</h4>
              <div className="text-sm space-y-1">
                <ProfileRow label="Clinic" value={dog.vet_name} />
                <ProfileRow label="Phone" value={dog.vet_phone} />
                <ProfileRow label="Address" value={dog.vet_address} />
              </div>
            </div>
          )}

          {/* Special instructions */}
          {dog.special_instructions && (
            <div>
              <h4 className="text-xs font-semibold text-gold uppercase tracking-widest mb-2">Special Instructions</h4>
              <p className="text-sm text-espresso whitespace-pre-wrap">{dog.special_instructions}</p>
            </div>
          )}
        </div>
      </Modal>
    </Card>
  );
}

// ── Add Dog form ──────────────────────────────────────────────────────────────

function AddDogCard({ clientId, onSaved }: { clientId: number; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<DogForm>(buildDogForm());

  const create = useMutation({
    mutationFn: (f: DogForm) => api.post('/admin/dogs', dogPayload(f, clientId)),
    onSuccess: () => { setOpen(false); setForm(buildDogForm()); onSaved(); },
  });

  const handleChange = (partial: Partial<DogForm>) => setForm(prev => ({ ...prev, ...partial }));
  const handleBool = (k: keyof DogForm, v: boolean) => setForm(prev => ({ ...prev, [k]: v }));
  const handleMedChange = (i: number, k: keyof Medication, v: string) =>
    setForm(prev => ({ ...prev, medications: prev.medications.map((m, idx) => idx === i ? { ...m, [k]: v } : m) }));
  const handleAddMed = () => setForm(prev => ({ ...prev, medications: [...prev.medications, { name: '', dosage: '', frequency: '', notes: '' }] }));
  const handleRemoveMed = (i: number) => setForm(prev => ({ ...prev, medications: prev.medications.filter((_, idx) => idx !== i) }));

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border-2 border-dashed border-taupe/40 py-6 text-sm text-taupe hover:border-gold hover:text-gold transition-colors"
      >
        + Add Dog
      </button>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-espresso text-base">New Dog</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setOpen(false); setForm(buildDogForm()); }}>Cancel</Button>
          <Button size="sm" loading={create.isPending} onClick={() => create.mutate(form)}>Add Dog</Button>
        </div>
      </div>
      {create.isError && (
        <p className="text-sm text-red-600 mb-3">
          {(create.error as any)?.response?.data?.message ?? 'Failed to add dog.'}
        </p>
      )}
      <DogEditForm
        form={form}
        onChange={handleChange}
        onBoolChange={handleBool}
        onMedChange={handleMedChange}
        onAddMed={handleAddMed}
        onRemoveMed={handleRemoveMed}
      />
    </Card>
  );
}

// ── Billing tab ──────────────────────────────────────────────────────────────

function ClientBillingTab({ clientId }: { clientId: number }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['client-billing-summary', clientId],
    queryFn: () => api.get(`/admin/clients/${clientId}/billing-summary`).then(r => r.data.data),
  });

  const [selectedAddOns, setSelectedAddOns] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [addToInvoiceOpen, setAddToInvoiceOpen] = useState(false);

  const toggleAddOn = (id: number) => {
    setSelectedAddOns(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = (ids: number[]) => {
    setSelectedAddOns(prev => {
      const allSelected = ids.every(id => prev.has(id));
      if (allSelected) return new Set();
      return new Set(ids);
    });
  };

  const buildLineItems = (addOns: any[]) =>
    addOns.map((a: any) => ({
      description: a.service_type.replace(/_/g, ' ') + (a.dogs ? ` (${a.dogs})` : ''),
      quantity: 1,
      unit_price: a.billing_amount,
      service_date: a.preferred_date,
    }));

  const handleCreateNewInvoice = async () => {
    if (!data) return;
    const selected = data.add_ons.filter((a: any) => !a.billed && selectedAddOns.has(a.id));
    if (!selected.length) return;
    setBusy(true);
    try {
      const res = await api.post('/admin/invoices', {
        user_id: clientId,
        line_items: buildLineItems(selected),
      });
      queryClient.invalidateQueries({ queryKey: ['client-billing-summary', clientId] });
      setSelectedAddOns(new Set());
      navigate(`/admin/invoices/${res.data.data.id}`);
    } finally {
      setBusy(false);
    }
  };

  const handleAddToInvoice = async (invoiceId: number) => {
    if (!data) return;
    const selected = data.add_ons.filter((a: any) => !a.billed && selectedAddOns.has(a.id));
    if (!selected.length) return;
    setBusy(true);
    try {
      await api.post(`/admin/invoices/${invoiceId}/add-items`, {
        line_items: buildLineItems(selected),
      });
      queryClient.invalidateQueries({ queryKey: ['client-billing-summary', clientId] });
      setSelectedAddOns(new Set());
      setAddToInvoiceOpen(false);
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <PageLoader />;
  if (!data) return <p className="text-taupe text-sm p-4">Unable to load billing data.</p>;

  const { subscription, add_ons, invoices } = data;
  const allInvoices: any[] = invoices ?? [];

  const overdue = allInvoices.filter((i: any) => i.status === 'overdue');
  const open = allInvoices.filter((i: any) => ['draft', 'sent'].includes(i.status));
  const past = allInvoices.filter((i: any) => ['paid', 'void'].includes(i.status));
  const editableInvoices = allInvoices.filter((i: any) => ['draft', 'sent'].includes(i.status));

  const unbilledAddOns: any[] = (add_ons ?? []).filter((a: any) => !a.billed);
  const hasSelection = selectedAddOns.size > 0;

  const statusColor = (s: string) => {
    switch (s) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'sent': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'draft': return 'bg-gray-100 text-gray-600';
      case 'void': return 'bg-gray-100 text-gray-400';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const InvoiceRow = ({ inv }: { inv: any }) => {
    const editable = ['draft', 'sent'].includes(inv.status);
    return (
      <div className="flex items-center justify-between p-3 rounded-lg hover:bg-[#F6F3EE] transition-colors group">
        <Link to={`/admin/invoices/${inv.id}`} className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-[#3B2F2A]">{inv.invoice_number}</span>
            <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${statusColor(inv.status)}`}>
              {inv.status}
            </span>
          </div>
          <div className="text-xs text-[#C8BFB6] mt-0.5">
            {inv.created_at ? format(new Date(inv.created_at), 'MMM d, yyyy') : '—'}
            {inv.billing_period_start && inv.billing_period_end
              ? ` · ${format(new Date(inv.billing_period_start), 'MMM d')} – ${format(new Date(inv.billing_period_end), 'MMM d')}`
              : ''}
            {inv.line_items?.length ? ` · ${inv.line_items.length} item${inv.line_items.length > 1 ? 's' : ''}` : ''}
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm text-[#3B2F2A]">${Number(inv.total ?? 0).toFixed(2)}</span>
          {editable && (
            <button
              onClick={() => navigate(`/admin/invoices/${inv.id}`)}
              className="text-xs text-[#C9A24D] hover:underline font-medium opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Edit
            </button>
          )}
          <ExternalLink className="w-3.5 h-3.5 text-[#C8BFB6] opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex justify-end">
        <Link to={`/admin/invoices/new?client=${clientId}`}>
          <Button size="sm"><Plus className="w-4 h-4 mr-1" /> New Invoice</Button>
        </Link>
      </div>

      {/* Upcoming Bill Preview */}
      {subscription && (
        <Card>
          <CardHeader title="Upcoming Bill" subtitle={subscription.paused ? 'Subscription paused' : undefined} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-[10px] uppercase font-display text-[#C8BFB6]">Plan</div>
              <div className="text-sm font-medium text-[#3B2F2A] mt-0.5">{subscription.plan}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-display text-[#C8BFB6]">Amount</div>
              <div className="text-sm font-medium text-[#3B2F2A] mt-0.5">${Number(subscription.amount).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-display text-[#C8BFB6]">Next Billing</div>
              <div className="text-sm font-medium text-[#3B2F2A] mt-0.5">
                {subscription.next_billing_date
                  ? format(new Date(subscription.next_billing_date + 'T00:00:00'), 'MMM d, yyyy')
                  : '—'}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-display text-[#C8BFB6]">Payment Method</div>
              <div className="text-sm font-medium text-[#3B2F2A] mt-0.5 capitalize">
                {subscription.billing_method?.replace(/_/g, ' ') ?? '—'}
              </div>
            </div>
          </div>
          {unbilledAddOns.length > 0 && (
            <div className="bg-[#FFF8E1] border border-[#C9A24D]/30 rounded-lg p-3 text-xs text-[#3B2F2A]">
              <strong>{unbilledAddOns.length} unbilled add-on{unbilledAddOns.length > 1 ? 's' : ''}</strong> totalling $
              {unbilledAddOns.reduce((s: number, a: any) => s + Number(a.billing_amount ?? 0), 0).toFixed(2)} can be
              added to an existing invoice or billed separately.
            </div>
          )}
        </Card>
      )}

      {/* Overdue */}
      {overdue.length > 0 && (
        <Card>
          <CardHeader
            title={`Overdue (${overdue.length})`}
            action={<AlertCircle className="w-4 h-4 text-red-500" />}
          />
          <div className="divide-y divide-[#F6F3EE]">
            {overdue.map((inv: any) => <InvoiceRow key={inv.id} inv={inv} />)}
          </div>
        </Card>
      )}

      {/* Open / Upcoming Invoices */}
      {open.length > 0 && (
        <Card>
          <CardHeader title={`Open & Upcoming (${open.length})`} />
          <div className="divide-y divide-[#F6F3EE]">
            {open.map((inv: any) => <InvoiceRow key={inv.id} inv={inv} />)}
          </div>
        </Card>
      )}

      {/* Add-ons */}
      {(add_ons ?? []).length > 0 && (
        <Card>
          <CardHeader title={`Add-ons (${(add_ons ?? []).length})`} />

          {/* Action buttons when unbilled items are selected */}
          {unbilledAddOns.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-4 relative">
              <span className="text-xs text-[#C8BFB6]">
                {hasSelection ? `${selectedAddOns.size} selected` : 'Select add-ons below'}
              </span>
              <div className="ml-auto flex gap-2">
                {editableInvoices.length > 0 && (
                  <div className="relative">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!hasSelection || busy}
                      onClick={() => setAddToInvoiceOpen(!addToInvoiceOpen)}
                    >
                      Add to Existing Invoice
                    </Button>
                    {addToInvoiceOpen && hasSelection && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-[#C8BFB6]/50 rounded-lg shadow-lg z-20 min-w-[240px]">
                        <div className="p-2 border-b border-[#F6F3EE] text-xs text-[#C8BFB6] font-medium">
                          Choose an invoice:
                        </div>
                        {editableInvoices.map((inv: any) => (
                          <button
                            key={inv.id}
                            onClick={() => handleAddToInvoice(inv.id)}
                            disabled={busy}
                            className="w-full text-left px-3 py-2 hover:bg-[#F6F3EE] transition-colors flex items-center justify-between"
                          >
                            <div>
                              <div className="text-sm font-medium text-[#3B2F2A]">{inv.invoice_number}</div>
                              <div className="text-[10px] text-[#C8BFB6]">
                                {inv.status} · ${Number(inv.total ?? 0).toFixed(2)}
                              </div>
                            </div>
                            <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${statusColor(inv.status)}`}>
                              {inv.status}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <Button
                  size="sm"
                  disabled={!hasSelection || busy}
                  loading={busy}
                  onClick={handleCreateNewInvoice}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Create New Invoice
                </Button>
              </div>
            </div>
          )}

          <div className="divide-y divide-[#F6F3EE]">
            {(add_ons ?? []).map((addon: any) => (
              <div key={addon.id} className="flex items-center gap-3 p-3">
                {/* Checkbox for unbilled items */}
                {!addon.billed ? (
                  <input
                    type="checkbox"
                    checked={selectedAddOns.has(addon.id)}
                    onChange={() => toggleAddOn(addon.id)}
                    className="w-4 h-4 rounded border-[#C8BFB6] text-[#C9A24D] focus:ring-[#C9A24D] cursor-pointer shrink-0"
                  />
                ) : (
                  <div className="w-4 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#3B2F2A]">
                      {addon.service_type?.replace(/_/g, ' ')}
                    </span>
                    {addon.billed ? (
                      <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                        addon.paid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {addon.paid ? 'Paid' : addon.invoice_status ?? 'Billed'}
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                        Unbilled
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#C8BFB6] mt-0.5">
                    {addon.preferred_date ? format(new Date(addon.preferred_date + 'T00:00:00'), 'MMM d, yyyy') : '—'}
                    {addon.dogs ? ` · ${addon.dogs}` : ''}
                    {addon.notes ? ` · ${addon.notes.slice(0, 50)}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-sm text-[#3B2F2A]">
                    ${Number(addon.billing_amount ?? 0).toFixed(2)}
                  </span>
                  {addon.invoice_id && (
                    <Link to={`/admin/invoices/${addon.invoice_id}`} className="text-xs text-blue hover:underline">
                      {addon.invoice_number}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Select all toggle for unbilled */}
          {unbilledAddOns.length > 1 && (
            <div className="px-3 py-2 border-t border-[#F6F3EE]">
              <button
                onClick={() => toggleAll(unbilledAddOns.map((a: any) => a.id))}
                className="text-xs text-[#C9A24D] hover:underline font-medium"
              >
                {unbilledAddOns.every((a: any) => selectedAddOns.has(a.id)) ? 'Deselect all' : 'Select all unbilled'}
              </button>
            </div>
          )}
        </Card>
      )}

      {/* Past Invoices */}
      <Card>
        <CardHeader title={`Past Invoices (${past.length})`} />
        {past.length > 0 ? (
          <div className="divide-y divide-[#F6F3EE]">
            {past.map((inv: any) => <InvoiceRow key={inv.id} inv={inv} />)}
          </div>
        ) : (
          <p className="p-4 text-sm text-[#C8BFB6]">No past invoices.</p>
        )}
      </Card>
    </div>
  );
}

// ── Documents tab ─────────────────────────────────────────────────────────────

const DOC_TYPES = [
  { value: 'vaccination_record', label: 'Vaccination Record' },
  { value: 'vet_record',         label: 'Vet Record' },
  { value: 'service_agreement',  label: 'Service Agreement' },
  { value: 'liability_waiver',   label: 'Liability Waiver' },
  { value: 'other',              label: 'Other' },
];

type DocSortKey = 'filename' | 'type' | 'status' | 'date';
type DocSortDir = 'asc' | 'desc';

function DocumentsTab({ clientId, client, onChanged }: { clientId: number; client: any; onChanged: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('other');
  const [dogId, setDogId] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [signingUrl, setSigningUrl] = useState<string | null>(null);
  const [docSearch, setDocSearch] = useState('');
  const [docSort, setDocSort] = useState<DocSortKey>('date');
  const [docSortDir, setDocSortDir] = useState<DocSortDir>('desc');
  const [statusFilter, setStatusFilter] = useState('');

  const handleDocSort = (key: DocSortKey) => {
    if (docSort === key) {
      setDocSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setDocSort(key);
      setDocSortDir('asc');
    }
  };

  const getDocStatus = (doc: any) => {
    if (doc.signed_at) return 'signed';
    if (doc.signature_requested_at) return 'sent';
    return 'draft';
  };

  const filteredDocs = useMemo(() => {
    let docs = [...(client.documents ?? [])];
    if (docSearch.trim()) {
      const q = docSearch.toLowerCase();
      docs = docs.filter((d: any) => d.filename?.toLowerCase().includes(q) || d.type?.toLowerCase().includes(q));
    }
    if (statusFilter) {
      docs = docs.filter((d: any) => getDocStatus(d) === statusFilter);
    }
    docs.sort((a: any, b: any) => {
      let cmp = 0;
      switch (docSort) {
        case 'filename': cmp = (a.filename || '').localeCompare(b.filename || ''); break;
        case 'type': cmp = (a.type || '').localeCompare(b.type || ''); break;
        case 'status': cmp = getDocStatus(a).localeCompare(getDocStatus(b)); break;
        case 'date': cmp = (a.signed_at || a.created_at || '').localeCompare(b.signed_at || b.created_at || ''); break;
      }
      return docSortDir === 'asc' ? cmp : -cmp;
    });
    return docs;
  }, [client.documents, docSearch, statusFilter, docSort, docSortDir]);

  const [docActionMsg, setDocActionMsg] = useState('');
  const requestSignature = useMutation({
    mutationFn: (docId: number) =>
      api.post(`/admin/clients/${clientId}/documents/${docId}/request-signature`).then(r => r.data),
    onSuccess: (data) => {
      setSigningUrl(data.signing_url);
      onChanged();
    },
    onError: (e: any) => { setDocActionMsg(''); setUploadError(e.response?.data?.message || 'Failed to request signature.'); },
  });

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url).catch(() => {});
    alert('Signing link copied to clipboard!');
  };

  const handleDownloadCertificate = async (doc: any) => {
    const res = await api.get(`/admin/clients/${clientId}/documents/${doc.id}/certificate`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `signed_${doc.filename}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const upload = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append('file', file!);
      form.append('type', docType);
      if (dogId) form.append('dog_id', dogId);
      return api.post(`/admin/clients/${clientId}/documents`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      setFile(null);
      setDocType('other');
      setDogId('');
      setUploading(false);
      setUploadError('');
      onChanged();
    },
    onError: (err: any) => {
      setUploadError(err.response?.data?.message ?? 'Upload failed.');
    },
  });

  const deleteDoc = useMutation({
    mutationFn: (docId: number) => api.delete(`/admin/clients/${clientId}/documents/${docId}`),
    onSuccess: () => { onChanged(); setDocActionMsg('Document deleted.'); setTimeout(() => setDocActionMsg(''), 2500); },
    onError: (e: any) => setUploadError(e.response?.data?.message || 'Failed to delete document.'),
  });

  const handleDelete = (doc: any) => {
    if (!window.confirm(`Delete "${doc.filename}"? This cannot be undone.`)) return;
    deleteDoc.mutate(doc.id);
  };

  const fetchDocBlob = async (doc: any, inline = false) => {
    const res = await api.get(`/documents/${doc.id}${inline ? '?inline=1' : ''}`, {
      responseType: 'blob',
    });
    return res.data;
  };

  const handleDownload = async (doc: any) => {
    try {
      const blob = await fetchDocBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Failed to download document. It may have been moved or deleted.');
    }
  };

  const handleView = async (doc: any) => {
    try {
      const blob = await fetchDocBlob(doc, true);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) {
      alert('Failed to load document.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Document list */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display text-espresso">Documents</h2>
          <Button size="sm" variant="outline" onClick={() => { setUploading(v => !v); setUploadError(''); }}>
            {uploading ? 'Cancel' : '+ Upload'}
          </Button>
        </div>

        {docActionMsg && <p className="text-sm text-green-600 font-medium mb-3">{docActionMsg}</p>}
        {uploadError && !uploading && <p className="text-sm text-red-600 mb-3">{uploadError}</p>}

        {/* Signing link popup */}
        {signingUrl && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-semibold text-green-800 mb-1">Signing link generated!</p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={signingUrl}
                className="flex-1 text-xs border border-green-200 rounded px-2 py-1 bg-white text-espresso"
              />
              <button
                onClick={() => handleCopyLink(signingUrl)}
                className="text-xs bg-green-700 text-white px-3 py-1 rounded hover:bg-green-800"
              >
                Copy
              </button>
              <button onClick={() => setSigningUrl(null)} className="text-green-600 hover:text-green-800 text-lg leading-none">×</button>
            </div>
            <p className="text-xs text-green-600 mt-1">This link has also been sent to the client in their conversation thread.</p>
          </div>
        )}

        {/* Search / filter controls */}
        {(client.documents?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <input
              placeholder="Search documents..."
              value={docSearch}
              onChange={e => setDocSearch(e.target.value)}
              className="border border-taupe/30 rounded-lg px-3 py-1.5 text-sm text-espresso focus:outline-none focus:ring-2 focus:ring-gold/40 w-48"
            />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="border border-taupe/30 rounded-lg px-3 py-1.5 text-sm text-espresso focus:outline-none focus:ring-2 focus:ring-gold/40"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="signed">Signed</option>
            </select>
          </div>
        )}

        {filteredDocs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="border-b border-cream text-left">
                  {([
                    ['filename', 'Document'],
                    ['type', 'Type'],
                    ['status', 'Status'],
                    ['date', 'Date'],
                  ] as const).map(([key, label]) => (
                    <th
                      key={key}
                      className="px-3 py-2 font-semibold text-espresso cursor-pointer select-none hover:bg-cream/30 transition-colors"
                      onClick={() => handleDocSort(key as DocSortKey)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {label}
                        {docSort === key && (docSortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                      </span>
                    </th>
                  ))}
                  <th className="px-3 py-2 w-[180px]"></th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.map((doc: any) => {
                  const st = getDocStatus(doc);
                  return (
                    <tr key={doc.id} className="border-b border-cream last:border-0 hover:bg-cream/50">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-lg flex-shrink-0">{fileIcon(doc.mime_type)}</span>
                          <span className="font-medium text-espresso break-words">{doc.filename}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-taupe capitalize break-words">{doc.type?.replace(/_/g, ' ')}</td>
                      <td className="px-3 py-2.5">
                        {st === 'signed' ? (
                          <span className="text-xs font-medium text-green-700">Signed</span>
                        ) : st === 'sent' ? (
                          <span className="text-xs font-medium text-gold">Pending</span>
                        ) : (
                          <span className="text-xs font-medium text-taupe">Draft</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-taupe whitespace-nowrap">
                        {doc.signed_at
                          ? new Date(doc.signed_at).toLocaleDateString('en-CA')
                          : doc.created_at
                          ? new Date(doc.created_at).toLocaleDateString('en-CA')
                          : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          {doc.mime_type === 'application/pdf' && !doc.signed_at && (
                            <button
                              onClick={() => requestSignature.mutate(doc.id)}
                              disabled={requestSignature.isPending}
                              className="text-xs text-gold hover:underline"
                            >
                              {doc.signature_requested_at ? 'Resend' : 'Request Signature'}
                            </button>
                          )}
                          {doc.signed_at && (
                            <button
                              onClick={() => handleDownloadCertificate(doc)}
                              className="text-xs text-green-700 hover:underline"
                            >
                              Certificate
                            </button>
                          )}
                          <button onClick={() => handleView(doc)} className="text-blue text-sm hover:underline">View</button>
                          <button onClick={() => handleDownload(doc)} className="text-blue text-sm hover:underline">Download</button>
                          <button
                            onClick={() => handleDelete(doc)}
                            disabled={deleteDoc.isPending}
                            className="text-taupe hover:text-red-500 text-sm transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (client.documents?.length ?? 0) > 0 ? (
          <p className="text-center py-8 text-taupe">No documents match your search.</p>
        ) : (
          <p className="text-center py-8 text-taupe">No documents on file.</p>
        )}
      </Card>

      {/* Upload form */}
      {uploading && (
        <Card>
          <CardHeader title="Upload Document" />
          <div className="space-y-4">
            <div>
              <label className="label">File</label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.heic,.docx"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-taupe file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-cream file:text-espresso hover:file:bg-taupe/20 cursor-pointer"
              />
              <p className="text-xs text-taupe mt-1">PDF, JPG, PNG, HEIC, or DOCX · max 10 MB</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Document Type</label>
                <select className="input" value={docType} onChange={e => setDocType(e.target.value)}>
                  {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Dog (optional)</label>
                <select className="input" value={dogId} onChange={e => setDogId(e.target.value)}>
                  <option value="">— Not dog-specific —</option>
                  {client.dogs?.map((dog: any) => (
                    <option key={dog.id} value={dog.id}>{dog.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
            <div className="flex justify-end">
              <Button
                loading={upload.isPending}
                disabled={!file}
                onClick={() => upload.mutate()}
              >
                Upload
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function fileIcon(mimeType: string): string {
  if (mimeType?.includes('pdf')) return '📄';
  if (mimeType?.includes('image')) return '🖼️';
  if (mimeType?.includes('word') || mimeType?.includes('docx')) return '📝';
  return '📎';
}

// ── Home access form ──────────────────────────────────────────────────────────

interface HomeAccessForm {
  [key: string]: string;
  entry_instructions: string;
  lockbox_code: string;
  door_code: string;
  alarm_code: string;
  key_location: string;
  parking_instructions: string;
  notes: string;
}

function buildHomeAccessForm(data?: any): HomeAccessForm {
  return {
    entry_instructions:   data?.entry_instructions   ?? '',
    lockbox_code:         data?.lockbox_code         ?? '',
    door_code:            data?.door_code            ?? '',
    alarm_code:           data?.alarm_code           ?? '',
    key_location:         data?.key_location         ?? '',
    parking_instructions: data?.parking_instructions ?? '',
    notes:                data?.notes                ?? '',
  };
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('profile');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [editingAccess, setEditingAccess] = useState(false);
  const [accessForm, setAccessForm] = useState<HomeAccessForm>(buildHomeAccessForm());

  const { data: client, isLoading } = useQuery({
    queryKey: ['admin-client', id],
    queryFn: () => api.get(`/admin/clients/${id}`).then(r => r.data.data),
  });

  const { data: homeAccess } = useQuery({
    queryKey: ['admin-client-access', id],
    queryFn: () => api.get(`/admin/clients/${id}/home-access`).then(r => r.data.data),
    enabled: tab === 'access',
  });

  useEffect(() => { if (client) setForm(buildProfileForm(client)); }, [client]);
  useEffect(() => { setAccessForm(buildHomeAccessForm(homeAccess)); }, [homeAccess]);

  const [inviteConfirm, setInviteConfirm] = useState('');
  const [resendError, setResendError] = useState('');
  const resend = useMutation({
    mutationFn: () => api.post(`/admin/clients/${id}/resend-invite`),
    onSuccess: () => { setInviteConfirm(client?.email || 'the client'); setResendError(''); },
    onError: (e: any) => setResendError(e.response?.data?.message || 'Failed to send invite.'),
  });

  const [showSetPassword, setShowSetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');

  const setPasswordMut = useMutation({
    mutationFn: (pw: string) => api.post(`/admin/clients/${id}/reset-password`, { password: pw }),
    onSuccess: (res: any) => {
      setPasswordMsg(res.data?.message || 'Password set.');
      setNewPassword('');
      qc.invalidateQueries({ queryKey: ['admin-client', id] });
    },
    onError: (err: any) => {
      setPasswordMsg(err.response?.data?.message || 'Failed to set password.');
    },
  });

  const saveProfile = useMutation({
    mutationFn: (f: ProfileForm) => api.patch(`/admin/clients/${id}`, {
      name:   f.name,
      email:  f.email,
      status: f.status,
      profile: {
        phone:                   f.phone || null,
        address:                 f.address || null,
        city:                    f.city || null,
        province:                f.province || null,
        postal_code:             f.postal_code || null,
        emergency_contact_name:  f.emergency_contact_name || null,
        emergency_contact_phone: f.emergency_contact_phone || null,
        secondary_contact_name:        f.secondary_contact_name || null,
        secondary_contact_email:       f.secondary_contact_email || null,
        secondary_notify_messages:     f.secondary_notify_messages,
        secondary_notify_report_cards: f.secondary_notify_report_cards,
        secondary_notify_billing:      f.secondary_notify_billing,
        secondary_notify_appointments: f.secondary_notify_appointments,
        notify_app:              f.notify_app,
        notify_email:            f.notify_email,
        notify_sms:              f.notify_sms,
        billing_method:          f.billing_method || null,
        subscription_tier:       f.subscription_tier || null,
        subscription_start_date: f.subscription_start_date || null,
        subscription_end_date:   f.subscription_end_date || null,
        notes:                   f.notes || null,
      },
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-client', id] }); setEditing(false); setProfileSuccess('Saved!'); setTimeout(() => setProfileSuccess(''), 2500); },
  });

  const [profileSuccess, setProfileSuccess] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const deleteClient = useMutation({
    mutationFn: () => api.delete(`/admin/clients/${id}`),
    onSuccess: () => navigate('/admin/clients'),
    onError: (e: any) => {
      setDeleteError(`Error ${e.response?.status}: ${e.response?.data?.message || JSON.stringify(e.response?.data) || e.message}`);
    },
  });

  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const toggleStatus = useMutation({
    mutationFn: (newStatus: string) => api.patch(`/admin/clients/${id}`, { status: newStatus }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-client', id] });
      setShowDeactivateConfirm(false);
    },
  });

  const [accessSuccess, setAccessSuccess] = useState('');
  const saveAccess = useMutation({
    mutationFn: (f: HomeAccessForm) => api.patch(`/admin/clients/${id}/home-access`, f),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-client-access', id] });
      setEditingAccess(false);
      setAccessSuccess('Saved!'); setTimeout(() => setAccessSuccess(''), 2500);
    },
  });

  const handleProfileChange = (name: keyof ProfileForm, value: string | boolean) =>
    setForm(prev => prev ? { ...prev, [name]: value } : prev);

  const handleProfileCancel = () => { setForm(buildProfileForm(client)); setEditing(false); };

  const refreshClient = () => qc.invalidateQueries({ queryKey: ['admin-client', id] });

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
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/admin/clients/${id}/intake`)}
          >
            {client.client_profile?.intake_submitted_at ? '📋 View Intake' : '📋 Intake Form'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setShowSetPassword(!showSetPassword); setPasswordMsg(''); setNewPassword(''); }}>
            Set Password
          </Button>
          {client.status === 'pending' && (
            <Button variant="outline" size="sm" loading={resend.isPending} onClick={() => resend.mutate()}>
              Resend Invite
            </Button>
          )}
          {client.status !== 'pending' && (
            <Button
              variant={client.status === 'active' ? 'danger' : 'outline'}
              size="sm"
              onClick={() => setShowDeactivateConfirm(true)}
            >
              {client.status === 'active' ? 'Deactivate' : 'Reactivate'}
            </Button>
          )}
        </div>
      </div>
      {resendError && <p className="text-sm text-red-600">{resendError}</p>}
      {profileSuccess && <p className="text-sm text-green-600 font-medium">{profileSuccess}</p>}

      {/* Set password inline form */}
      {showSetPassword && (
        <Card padding="sm">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Input
                label="New password for this client"
                type="text"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min 8 characters"
              />
            </div>
            <Button
              size="sm"
              loading={setPasswordMut.isPending}
              disabled={newPassword.length < 8}
              onClick={() => setPasswordMut.mutate(newPassword)}
            >
              Set Password
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowSetPassword(false)}>
              Cancel
            </Button>
          </div>
          {passwordMsg && (
            <p className={`text-sm mt-2 ${passwordMsg.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>{passwordMsg}</p>
          )}
        </Card>
      )}

      {/* Tabs */}
      <div className="flex border-b border-taupe/30">
        {(['profile', 'dogs', 'billing', 'documents', 'access'] as const).map(t => (
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
          <div className="flex justify-between">
            <div>
              {editing && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-sm text-red-500 hover:text-red-700 hover:underline"
                >
                  Delete Client
                </button>
              )}
            </div>
            <div className="flex gap-2">
              {editing ? (
                <>
                  <Button variant="outline" size="sm" onClick={handleProfileCancel}>Cancel</Button>
                  <Button size="sm" loading={saveProfile.isPending} onClick={() => saveProfile.mutate(form)}>
                    Save Changes
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit Profile</Button>
              )}
            </div>
          </div>

          {saveProfile.isError && (
            <p className="text-sm text-red-600">
              {(saveProfile.error as any)?.response?.data?.message ?? 'Save failed. Please try again.'}
            </p>
          )}

          {editing ? (
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader title="Account" />
                <div className="space-y-4">
                  <FormField label="Full Name" name="name" form={form} onChange={handleProfileChange} />
                  <FormField label="Email" name="email" form={form} onChange={handleProfileChange} type="email" />
                  <div>
                    <label className="label">Status</label>
                    <select className="input" value={form.status} onChange={e => handleProfileChange('status', e.target.value)}>
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
                  <FormField label="Phone" name="phone" form={form} onChange={handleProfileChange} type="tel" />
                  <FormField label="Address" name="address" form={form} onChange={handleProfileChange} />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="City" name="city" form={form} onChange={handleProfileChange} />
                    <FormField label="Province" name="province" form={form} onChange={handleProfileChange} />
                  </div>
                  <FormField label="Postal Code" name="postal_code" form={form} onChange={handleProfileChange} />
                </div>
              </Card>

              <Card>
                <CardHeader title="Emergency Contact" />
                <div className="space-y-4">
                  <FormField label="Name" name="emergency_contact_name" form={form} onChange={handleProfileChange} />
                  <FormField label="Phone" name="emergency_contact_phone" form={form} onChange={handleProfileChange} type="tel" />
                </div>
              </Card>

              <Card>
                <CardHeader title="Secondary Contact" />
                <div className="space-y-4">
                  <FormField label="Name" name="secondary_contact_name" form={form} onChange={handleProfileChange} />
                  <FormField label="Email" name="secondary_contact_email" form={form} onChange={handleProfileChange} type="email" />
                  {form.secondary_contact_email && (
                    <div>
                      <div className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2">Also notify for</div>
                      <div className="space-y-2">
                        {([
                          ['secondary_notify_messages', 'Messages'],
                          ['secondary_notify_report_cards', 'Report Cards'],
                          ['secondary_notify_billing', 'Billing & Invoices'],
                          ['secondary_notify_appointments', 'Appointments'],
                        ] as const).map(([key, label]) => (
                          <label key={key} className="flex items-center gap-2.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={!!form[key]}
                              onChange={e => handleProfileChange(key, e.target.checked)}
                              className="accent-gold"
                            />
                            <span className="text-sm text-espresso">{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              <Card>
                <CardHeader title="Notification Preferences" />
                <div>
                  <p className="text-xs text-taupe mb-3">How this client receives updates about appointments, messages, and more.</p>
                  <div className="space-y-2">
                    {([
                      ['notify_app', 'App notifications', 'Push notifications on their phone'],
                      ['notify_email', 'Email', 'Receive updates at their email address'],
                      ['notify_sms', 'Text message (SMS)', 'Receive updates via text to their phone number'],
                    ] as const).map(([key, label, desc]) => (
                      <label key={key} className="flex items-start gap-3 cursor-pointer p-2 rounded-lg hover:bg-cream/50">
                        <input
                          type="checkbox"
                          checked={!!form[key]}
                          onChange={e => handleProfileChange(key, e.target.checked)}
                          className="h-4 w-4 rounded border-taupe text-gold focus:ring-gold mt-0.5"
                        />
                        <div>
                          <span className="text-sm font-medium text-espresso">{label}</span>
                          <span className="block text-xs text-taupe">{desc}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </Card>

              <SubscriptionCard clientId={Number(id)} clientProfile={client?.client_profile} onChanged={refreshClient} />

              <Card className="md:col-span-2">
                <CardHeader title="Admin Notes" />
                <textarea
                  className="input min-h-24 resize-y"
                  placeholder="Internal notes about this client…"
                  value={form.notes}
                  onChange={e => handleProfileChange('notes', e.target.value)}
                />
              </Card>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader title="Contact Info" />
                <dl className="space-y-1 text-sm">
                  <Field label="Email" value={client.email} />
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
                <CardHeader title="Secondary Contact" />
                {p.secondary_contact_name || p.secondary_contact_email ? (
                  <>
                    <dl className="space-y-1 text-sm">
                      <Field label="Name" value={p.secondary_contact_name} />
                      <Field label="Email" value={p.secondary_contact_email} />
                    </dl>
                    {(p.secondary_notify_messages || p.secondary_notify_report_cards || p.secondary_notify_billing || p.secondary_notify_appointments) && (
                      <div className="mt-3 pt-3 border-t border-cream">
                        <div className="text-xs text-taupe mb-1.5">Also receives:</div>
                        <div className="flex flex-wrap gap-1.5">
                          {p.secondary_notify_messages && <span className="text-xs bg-gold/10 text-gold px-2 py-0.5 rounded-full">Messages</span>}
                          {p.secondary_notify_report_cards && <span className="text-xs bg-gold/10 text-gold px-2 py-0.5 rounded-full">Report Cards</span>}
                          {p.secondary_notify_billing && <span className="text-xs bg-gold/10 text-gold px-2 py-0.5 rounded-full">Billing</span>}
                          {p.secondary_notify_appointments && <span className="text-xs bg-gold/10 text-gold px-2 py-0.5 rounded-full">Appointments</span>}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-taupe italic">No secondary contact added yet.</p>
                )}
              </Card>

              <Card>
                <CardHeader title="Notification Preferences" />
                <div className="flex flex-wrap gap-2">
                  {(p.notify_app ?? true) && (
                    <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-gold/10 text-gold border border-gold/20">App</span>
                  )}
                  {p.notify_email && (
                    <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-gold/10 text-gold border border-gold/20">Email</span>
                  )}
                  {p.notify_sms && (
                    <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-gold/10 text-gold border border-gold/20">SMS</span>
                  )}
                  {!(p.notify_app ?? true) && !p.notify_email && !p.notify_sms && (
                    <span className="text-xs text-taupe italic">No channels selected</span>
                  )}
                </div>
              </Card>

              <SubscriptionCard clientId={Number(id)} clientProfile={client?.client_profile} onChanged={refreshClient} />

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
        <div className="space-y-4">
          {client.dogs?.map((dog: any) => (
            <DogCard key={dog.id} dog={dog} clientId={Number(id)} onSaved={refreshClient} />
          ))}
          <AddDogCard clientId={Number(id)} onSaved={refreshClient} />
        </div>
      )}

      {/* ── Billing tab ──────────────────────────────────────────────────── */}
      {tab === 'billing' && (
        <ClientBillingTab clientId={Number(id)} />
      )}

      {/* ── Documents tab ─────────────────────────────────────────────────── */}
      {tab === 'documents' && (
        <DocumentsTab clientId={Number(id)} client={client} onChanged={refreshClient} />
      )}

      {/* ── Home Access tab ───────────────────────────────────────────────── */}
      {tab === 'access' && (
        <Card>
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-lg font-display text-espresso">Home Access</h2>
              <p className="mt-1 text-sm text-taupe">Codes are encrypted at rest and only visible here.</p>
            </div>
            {editingAccess ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setAccessForm(buildHomeAccessForm(homeAccess)); setEditingAccess(false); }}>
                  Cancel
                </Button>
                <Button size="sm" loading={saveAccess.isPending} onClick={() => saveAccess.mutate(accessForm)}>
                  Save
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setEditingAccess(true)}>
                Edit
              </Button>
            )}
          </div>

          {saveAccess.isError && (
            <p className="text-sm text-red-600 mb-4">
              {(saveAccess.error as any)?.response?.data?.message ?? 'Save failed.'}
            </p>
          )}
          {accessSuccess && <p className="text-sm text-green-600 font-medium mb-4">{accessSuccess}</p>}

          {editingAccess ? (
            <div className="space-y-4">
              {([
                { label: 'Entry Instructions', key: 'entry_instructions', multiline: true },
                { label: 'Lockbox Code',       key: 'lockbox_code' },
                { label: 'Door Code',          key: 'door_code' },
                { label: 'Alarm Code',         key: 'alarm_code' },
                { label: 'Key Location',       key: 'key_location' },
                { label: 'Parking Instructions', key: 'parking_instructions', multiline: true },
                { label: 'Notes',              key: 'notes', multiline: true },
              ] as Array<{ label: string; key: string; multiline?: boolean }>).map(({ label, key, multiline }) => (
                <div key={key}>
                  <label className="label">{label}</label>
                  {multiline ? (
                    <textarea
                      className="input min-h-16 resize-y font-mono"
                      value={accessForm[key]}
                      onChange={e => setAccessForm(prev => ({ ...prev, [key]: e.target.value }))}
                    />
                  ) : (
                    <Input
                      className="font-mono"
                      value={accessForm[key]}
                      onChange={e => setAccessForm(prev => ({ ...prev, [key]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : homeAccess ? (
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
                  <dt className="w-40 text-taupe flex-shrink-0">{label}</dt>
                  <dd className="text-espresso font-mono bg-cream rounded px-2 py-0.5">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-center py-8 text-taupe">No home access info on file. Click Edit to add.</p>
          )}
        </Card>
      )}

      {/* Invite sent confirmation */}
      {inviteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4 text-center space-y-4">
            <div className="text-4xl">✉️</div>
            <h3 className="text-lg font-display text-espresso">Invite Sent!</h3>
            <p className="text-sm text-taupe">
              An invitation has been sent to <strong>{inviteConfirm}</strong>.
            </p>
            <Button onClick={() => setInviteConfirm('')}>Done</Button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeactivateConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4 space-y-4">
            <h3 className="text-lg font-display text-espresso">
              {client.status === 'active' ? 'Deactivate Client' : 'Reactivate Client'}
            </h3>
            <p className="text-sm text-taupe">
              {client.status === 'active'
                ? <>Are you sure you want to deactivate <strong>{client.name}</strong>? They will no longer be able to log in.</>
                : <>Reactivate <strong>{client.name}</strong>? They will be able to log in again.</>
              }
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowDeactivateConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant={client.status === 'active' ? 'danger' : 'primary'}
                size="sm"
                loading={toggleStatus.isPending}
                onClick={() => toggleStatus.mutate(client.status === 'active' ? 'inactive' : 'active')}
              >
                {client.status === 'active' ? 'Yes, Deactivate' : 'Yes, Reactivate'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4 space-y-4">
            <h3 className="text-lg font-display text-espresso">Delete Client</h3>
            <p className="text-sm text-taupe">
              Are you sure you want to permanently delete <strong>{client.name}</strong>? This will remove all their data including dogs, appointments, documents, and messages. This cannot be undone.
            </p>
            {deleteError && (
              <p className="text-sm text-red-600">{deleteError}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <button
                onClick={() => deleteClient.mutate()}
                disabled={deleteClient.isPending}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteClient.isPending ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
