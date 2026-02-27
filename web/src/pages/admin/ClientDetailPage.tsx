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

// ── Profile form ──────────────────────────────────────────────────────────────

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

function buildProfileForm(client: any): ProfileForm {
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

// ── Dog form ──────────────────────────────────────────────────────────────────

interface Medication { name: string; dosage: string; frequency: string; notes: string }
interface DogForm {
  name: string;
  breed: string;
  date_of_birth: string;
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
}

function buildDogForm(dog?: any): DogForm {
  return {
    name:               dog?.name ?? '',
    breed:              dog?.breed ?? '',
    date_of_birth:      dog?.date_of_birth?.split('T')[0] ?? '',
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
  };
}

function dogPayload(f: DogForm, userId: number) {
  return {
    user_id:            userId,
    name:               f.name,
    breed:              f.breed || null,
    date_of_birth:      f.date_of_birth || null,
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
  onChange: (n: keyof ProfileForm, v: string) => void;
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
          <label className="label">Date of Birth</label>
          <Input type="date" value={form.date_of_birth} onChange={e => onChange({ date_of_birth: e.target.value })} />
        </div>
        <div>
          <label className="label">Weight (kg)</label>
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
    },
  });

  const remove = useMutation({
    mutationFn: (recordId: number) => api.delete(`/admin/dogs/${dogId}/vaccinations/${recordId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vaccinations', dogId] }),
  });

  const vaccinations: any[] = data ?? [];

  return (
    <div className="mt-3 pt-3 border-t border-cream">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-taupe uppercase tracking-wide">Vaccinations</span>
        {!adding && (
          <button onClick={() => setAdding(true)} className="text-xs text-blue hover:underline">+ Add</button>
        )}
      </div>

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

function DogCard({ dog, clientId, onSaved }: { dog: any; clientId: number; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<DogForm>(buildDogForm(dog));

  useEffect(() => { setForm(buildDogForm(dog)); }, [dog]);

  const update = useMutation({
    mutationFn: (f: DogForm) => api.patch(`/admin/dogs/${dog.id}`, dogPayload(f, clientId)),
    onSuccess: () => { setEditing(false); onSaved(); },
  });

  const activate = useMutation({
    mutationFn: () => api.patch(`/admin/dogs/${dog.id}`, dogPayload({ ...buildDogForm(dog), is_active: true }, clientId)),
    onSuccess: onSaved,
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
        <div className="h-12 w-12 rounded-full bg-cream flex items-center justify-center text-2xl flex-shrink-0">🐕</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-semibold text-espresso">{dog.name}</div>
              <div className="text-sm text-taupe">
                {[dog.breed, dog.size, dog.sex].filter(Boolean).join(' · ') || '—'}
              </div>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              {!dog.is_active && (
                <Button size="sm" variant="outline" loading={activate.isPending} onClick={() => activate.mutate()}>
                  Activate
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
            </div>
          </div>
          <div className="flex gap-2 mt-2 flex-wrap">
            {!dog.is_active && <Badge variant="red">Pending Review</Badge>}
            {dog.bite_history && <Badge variant="red">⚠️ Bite History</Badge>}
            {dog.has_expired_vaccinations && <Badge variant="gold">Vaccines Expiring</Badge>}
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

// ── Documents tab ─────────────────────────────────────────────────────────────

const DOC_TYPES = [
  { value: 'vaccination_record', label: 'Vaccination Record' },
  { value: 'vet_record',         label: 'Vet Record' },
  { value: 'service_agreement',  label: 'Service Agreement' },
  { value: 'liability_waiver',   label: 'Liability Waiver' },
  { value: 'other',              label: 'Other' },
];

function DocumentsTab({ clientId, client, onChanged }: { clientId: number; client: any; onChanged: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('other');
  const [dogId, setDogId] = useState('');
  const [uploadError, setUploadError] = useState('');

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
    onSuccess: onChanged,
  });

  const handleDelete = (doc: any) => {
    if (!window.confirm(`Delete "${doc.filename}"? This cannot be undone.`)) return;
    deleteDoc.mutate(doc.id);
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
      {/* Document list */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display text-espresso">Documents</h2>
          <Button size="sm" variant="outline" onClick={() => { setUploading(v => !v); setUploadError(''); }}>
            {uploading ? 'Cancel' : '+ Upload'}
          </Button>
        </div>

        {client.documents?.length > 0 ? (
          <div className="space-y-1">
            {client.documents.map((doc: any) => (
              <div key={doc.id} className="flex items-center gap-3 py-2.5 border-b border-cream last:border-0">
                <div className="text-xl">{fileIcon(doc.mime_type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-espresso truncate">{doc.filename}</div>
                  <div className="text-xs text-taupe capitalize">
                    {doc.type.replace(/_/g, ' ')}
                    {doc.dog && <span> · {doc.dog.name}</span>}
                    {' · '}uploaded by {doc.uploaded_by}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button
                    onClick={() => handleDownload(doc)}
                    className="text-blue text-sm hover:underline"
                  >
                    Download
                  </button>
                  <button
                    onClick={() => handleDelete(doc)}
                    disabled={deleteDoc.isPending}
                    className="text-taupe hover:text-red-500 text-sm transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
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

  const resend = useMutation({
    mutationFn: () => api.post(`/admin/clients/${id}/resend-invite`),
  });

  const saveProfile = useMutation({
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-client', id] }); setEditing(false); },
  });

  const saveAccess = useMutation({
    mutationFn: (f: HomeAccessForm) => api.patch(`/admin/clients/${id}/home-access`, f),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-client-access', id] });
      setEditingAccess(false);
    },
  });

  const handleProfileChange = (name: keyof ProfileForm, value: string) =>
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
          <div className="flex justify-end gap-2">
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
                <CardHeader title="Billing & Subscription" />
                <div className="space-y-4">
                  <div>
                    <label className="label">Billing Method</label>
                    <select className="input" value={form.billing_method} onChange={e => handleProfileChange('billing_method', e.target.value)}>
                      <option value="credit_card">Credit Card</option>
                      <option value="e_transfer">E-Transfer</option>
                      <option value="cash">Cash</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Subscription Tier</label>
                    <select className="input" value={form.subscription_tier} onChange={e => handleProfileChange('subscription_tier', e.target.value)}>
                      <option value="">None</option>
                      <option value="basic">Basic</option>
                      <option value="standard">Standard</option>
                      <option value="premium">Premium</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Start Date" name="subscription_start_date" form={form} onChange={handleProfileChange} type="date" />
                    <FormField label="End Date" name="subscription_end_date" form={form} onChange={handleProfileChange} type="date" />
                  </div>
                </div>
              </Card>

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
        <div className="space-y-4">
          {client.dogs?.map((dog: any) => (
            <DogCard key={dog.id} dog={dog} clientId={Number(id)} onSaved={refreshClient} />
          ))}
          <AddDogCard clientId={Number(id)} onSaved={refreshClient} />
        </div>
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
              ] as const).map(({ label, key, multiline }) => (
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
    </div>
  );
}
