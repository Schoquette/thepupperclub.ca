import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { Dog } from 'lucide-react';
import { PawIcon } from '@/components/ui/PawIcon';

const SIZE_OPTIONS = [
  { value: '', label: 'Select size...' },
  { value: 'toy', label: 'Toy (under 10 lbs)' },
  { value: 'small', label: 'Small (under 20 lbs)' },
  { value: 'medium', label: 'Medium (20–55 lbs)' },
  { value: 'large', label: 'Large (55–90 lbs)' },
  { value: 'extra_large', label: 'Extra Large (90+ lbs)' },
];

const SIZE_LABELS: Record<string, string> = {
  toy: 'Toy (under 10 lbs)',
  small: 'Small (under 20 lbs)',
  medium: 'Medium (20–55 lbs)',
  large: 'Large (55–90 lbs)',
  extra_large: 'Extra Large (90+ lbs)',
  xl: 'Extra Large (90+ lbs)',
};

const SEX_OPTIONS = [
  { value: '', label: 'Select...' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

const ENERGY_OPTIONS = [
  { value: '', label: 'Select...' },
  { value: 'low', label: 'Low' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'high', label: 'High' },
  { value: 'very_high', label: 'Very High' },
];

const TREATS_OPTIONS = [
  { value: '', label: 'Select...' },
  { value: 'yes', label: 'Yes' },
  { value: 'limited', label: 'Limited / specific only' },
  { value: 'no', label: 'No' },
];

const WALK_STYLE_OPTIONS = ['On-leash only', 'Off-leash (trained recall)', 'Long-line / flexi', 'Sniff walks', 'Structured heel walks'];
const GEAR_OPTIONS = ['Harness', 'Collar', 'Gentle Leader / head halter', 'Martingale', 'Standard leash', 'Long line', 'Muzzle (if needed)'];

interface Medication {
  name: string;
  dosage: string;
}

const EMPTY_FORM = {
  name: '', breed: '', size: '', sex: '',
  date_of_birth: '', weight_kg: '',
  colour: '', microchip_number: '',
  spayed_neutered: false, special_instructions: '',
  vet_name: '', vet_phone: '', vet_address: '',
  bite_history: false, bite_history_notes: '', aggression_notes: '',
  // Intake fields
  personality_description: '',
  energy_level: '',
  interaction_dogs: '',
  interaction_strangers: '',
  interaction_children: '',
  triggers: '',
  medical_conditions: '',
  allergies: '',
  medications: [] as Medication[],
  administer_medication_on_visits: null as boolean | null,
  mobility_limitations: null as boolean | null,
  recent_surgeries: '',
  preferred_walk_style: [] as string[],
  preferred_gear: [] as string[],
  treats_allowed: '',
  treats_notes: '',
  training_commands: '',
  avoid_on_walks: '',
};

type DogForm = typeof EMPTY_FORM;

function dogToForm(dog: any): DogForm {
  return {
    name: dog.name ?? '',
    breed: dog.breed ?? '',
    size: dog.size ?? '',
    sex: dog.sex ?? '',
    date_of_birth: dog.date_of_birth ? dog.date_of_birth.slice(0, 10) : '',
    weight_kg: dog.weight_kg ?? '',
    colour: dog.colour ?? '',
    microchip_number: dog.microchip_number ?? '',
    spayed_neutered: !!dog.spayed_neutered,
    special_instructions: dog.special_instructions ?? '',
    vet_name: dog.vet_name ?? '',
    vet_phone: dog.vet_phone ?? '',
    vet_address: dog.vet_address ?? '',
    bite_history: !!dog.bite_history,
    bite_history_notes: dog.bite_history_notes ?? '',
    aggression_notes: dog.aggression_notes ?? '',
    personality_description: dog.personality_description ?? '',
    energy_level: dog.energy_level ?? '',
    interaction_dogs: dog.interaction_dogs ?? '',
    interaction_strangers: dog.interaction_strangers ?? '',
    interaction_children: dog.interaction_children ?? '',
    triggers: dog.triggers ?? '',
    medical_conditions: dog.medical_conditions ?? '',
    allergies: dog.allergies ?? '',
    medications: Array.isArray(dog.medications) ? dog.medications : [],
    administer_medication_on_visits: dog.administer_medication_on_visits ?? null,
    mobility_limitations: dog.mobility_limitations ?? null,
    recent_surgeries: dog.recent_surgeries ?? '',
    preferred_walk_style: Array.isArray(dog.preferred_walk_style) ? dog.preferred_walk_style : [],
    preferred_gear: Array.isArray(dog.preferred_gear) ? dog.preferred_gear : [],
    treats_allowed: dog.treats_allowed ?? '',
    treats_notes: dog.treats_notes ?? '',
    training_commands: dog.training_commands ?? '',
    avoid_on_walks: dog.avoid_on_walks ?? '',
  };
}

function preparePayload(form: DogForm) {
  return {
    ...form,
    weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
  };
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between py-2 border-b border-cream last:border-0">
      <span className="text-sm text-taupe">{label}</span>
      <span className="text-sm font-medium text-espresso text-right max-w-[60%]">{value}</span>
    </div>
  );
}

function DogPhoto({ dogId, hasPhoto, size = 14 }: { dogId: number; hasPhoto: boolean; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!hasPhoto) { setSrc(null); return; }
    const token = localStorage.getItem('token');
    let url: string | null = null;
    fetch(`/api/client/dogs/${dogId}/photo`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (r.ok) return r.blob(); throw new Error(); })
      .then(blob => { url = URL.createObjectURL(blob); setSrc(url); })
      .catch(() => setSrc(null));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [dogId, hasPhoto]);

  const px = size * 4;
  if (!src) return <div className={`rounded-full bg-cream flex items-center justify-center flex-shrink-0`} style={{ width: px, height: px }}><Dog className="text-taupe" style={{ width: px * 0.5, height: px * 0.5 }} /></div>;
  return <img src={src} className="rounded-full object-cover flex-shrink-0" style={{ width: px, height: px }} alt="" />;
}

function DogPhotoUpload({ dog, onChanged }: { dog: any; onChanged: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!dog.photo_path) { setPreview(null); return; }
    const token = localStorage.getItem('token');
    let url: string | null = null;
    fetch(`/api/client/dogs/${dog.id}/photo`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (r.ok) return r.blob(); throw new Error(); })
      .then(blob => { url = URL.createObjectURL(blob); setPreview(url); })
      .catch(() => setPreview(null));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [dog.id, dog.photo_path]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    try {
      const form = new FormData();
      form.append('photo', file);
      await api.post(`/client/dogs/${dog.id}/photo`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      onChanged();
    } catch { /* keep preview */ }
    setUploading(false);
  };

  const handleDelete = async () => {
    await api.delete(`/client/dogs/${dog.id}/photo`);
    setPreview(null);
    onChanged();
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="h-24 w-24 rounded-full bg-cream flex items-center justify-center text-5xl cursor-pointer overflow-hidden relative group"
        onClick={() => fileRef.current?.click()}
      >
        {preview ? (
          <>
            <img src={preview} className="h-24 w-24 rounded-full object-cover" alt={dog.name} />
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
              <span className="text-white text-xs font-medium">Change</span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center">
            <Dog className="w-5 h-5 text-taupe" />
            <span className="text-[10px] text-taupe mt-0.5">Add photo</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center rounded-full">
            <div className="h-5 w-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); e.target.value = ''; }} />
      {preview && !uploading && (
        <button onClick={handleDelete} className="text-xs text-red-500 hover:underline">Remove photo</button>
      )}
    </div>
  );
}

// ── Reusable checkbox group for arrays ──
function CheckboxGroup({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <label key={opt} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
          selected.includes(opt) ? 'bg-blue/10 border-blue text-blue font-medium' : 'border-taupe/30 text-taupe hover:bg-cream'
        }`}>
          <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} className="sr-only" />
          {opt}
        </label>
      ))}
    </div>
  );
}

// ── Medications editor ──
function MedicationsEditor({ meds, onChange }: { meds: Medication[]; onChange: (m: Medication[]) => void }) {
  const addMed = () => onChange([...meds, { name: '', dosage: '' }]);
  const removeMed = (i: number) => onChange(meds.filter((_, idx) => idx !== i));
  const updateMed = (i: number, field: keyof Medication, val: string) => {
    const updated = [...meds];
    updated[i] = { ...updated[i], [field]: val };
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {meds.map((med, i) => (
        <div key={i} className="flex gap-2 items-start">
          <Input placeholder="Medication name" value={med.name} onChange={e => updateMed(i, 'name', e.target.value)} className="flex-1" />
          <Input placeholder="Dosage / frequency" value={med.dosage} onChange={e => updateMed(i, 'dosage', e.target.value)} className="flex-1" />
          <button onClick={() => removeMed(i)} className="text-red-400 hover:text-red-600 text-lg mt-2 px-1">&times;</button>
        </div>
      ))}
      <button onClick={addMed} className="text-xs text-blue hover:underline font-medium">+ Add medication</button>
    </div>
  );
}

// ── Dog form fields (shared between Add and Edit) ──
function DogFormFields({ form, setForm }: { form: DogForm; setForm: React.Dispatch<React.SetStateAction<DogForm>> }) {
  return (
    <>
      {/* Basic Info */}
      <Card>
        <h3 className="font-display text-espresso text-sm mb-4">Basic Info</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input label="Breed" value={form.breed} onChange={e => setForm(f => ({ ...f, breed: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select label="Size" value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))} options={SIZE_OPTIONS} />
            <Select label="Sex" value={form.sex} onChange={e => setForm(f => ({ ...f, sex: e.target.value }))} options={SEX_OPTIONS} />
            <Input label="Weight (lbs)" type="number" value={form.weight_kg} onChange={e => setForm(f => ({ ...f, weight_kg: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Date of Birth" type="date" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} />
            <Input label="Colour / Markings" value={form.colour} onChange={e => setForm(f => ({ ...f, colour: e.target.value }))} />
          </div>
          <Input label="Microchip Number" value={form.microchip_number} onChange={e => setForm(f => ({ ...f, microchip_number: e.target.value }))} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.spayed_neutered} onChange={e => setForm(f => ({ ...f, spayed_neutered: e.target.checked }))} className="rounded accent-gold" />
            <span className="text-sm text-espresso">Spayed / Neutered</span>
          </label>
        </div>
      </Card>

      {/* Personality & Behaviour */}
      <Card>
        <h3 className="font-display text-espresso text-sm mb-4">Personality & Behaviour</h3>
        <div className="space-y-4">
          <Textarea label="Personality Description" rows={2} value={form.personality_description} onChange={e => setForm(f => ({ ...f, personality_description: e.target.value }))} placeholder="How would you describe your dog's personality?" />
          <Select label="Energy Level" value={form.energy_level} onChange={e => setForm(f => ({ ...f, energy_level: e.target.value }))} options={ENERGY_OPTIONS} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Textarea label="With Other Dogs" rows={2} value={form.interaction_dogs} onChange={e => setForm(f => ({ ...f, interaction_dogs: e.target.value }))} placeholder="Friendly, selective, reactive..." />
            <Textarea label="With Strangers" rows={2} value={form.interaction_strangers} onChange={e => setForm(f => ({ ...f, interaction_strangers: e.target.value }))} placeholder="Friendly, shy, cautious..." />
            <Textarea label="With Children" rows={2} value={form.interaction_children} onChange={e => setForm(f => ({ ...f, interaction_children: e.target.value }))} placeholder="Good, avoid, supervised..." />
          </div>
          <Textarea label="Triggers / Fears" rows={2} value={form.triggers} onChange={e => setForm(f => ({ ...f, triggers: e.target.value }))} placeholder="Loud noises, other dogs, skateboards..." />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.bite_history} onChange={e => setForm(f => ({ ...f, bite_history: e.target.checked }))} className="rounded accent-gold" />
            <span className="text-sm text-espresso">Bite History</span>
          </label>
          {form.bite_history && (
            <Textarea label="Bite History Details" rows={2} value={form.bite_history_notes} onChange={e => setForm(f => ({ ...f, bite_history_notes: e.target.value }))} />
          )}
          <Textarea label="Aggression Notes" rows={2} value={form.aggression_notes} onChange={e => setForm(f => ({ ...f, aggression_notes: e.target.value }))} placeholder="Any notes about reactivity or aggression..." />
        </div>
      </Card>

      {/* Medical */}
      <Card>
        <h3 className="font-display text-espresso text-sm mb-4">Medical</h3>
        <div className="space-y-4">
          <Textarea label="Medical Conditions" rows={2} value={form.medical_conditions} onChange={e => setForm(f => ({ ...f, medical_conditions: e.target.value }))} placeholder="Any ongoing conditions..." />
          <Textarea label="Allergies" rows={2} value={form.allergies} onChange={e => setForm(f => ({ ...f, allergies: e.target.value }))} placeholder="Food or environmental allergies..." />
          <div>
            <label className="block text-sm font-medium text-espresso mb-1">Medications</label>
            <MedicationsEditor meds={form.medications} onChange={m => setForm(f => ({ ...f, medications: m }))} />
          </div>
          {form.medications.length > 0 && (
            <div>
              <span className="text-sm text-espresso mr-4">Administer medication on visits?</span>
              <label className="inline-flex items-center gap-1 mr-3 cursor-pointer">
                <input type="radio" name="admin_med" checked={form.administer_medication_on_visits === true} onChange={() => setForm(f => ({ ...f, administer_medication_on_visits: true }))} className="accent-gold" />
                <span className="text-sm text-espresso">Yes</span>
              </label>
              <label className="inline-flex items-center gap-1 cursor-pointer">
                <input type="radio" name="admin_med" checked={form.administer_medication_on_visits === false} onChange={() => setForm(f => ({ ...f, administer_medication_on_visits: false }))} className="accent-gold" />
                <span className="text-sm text-espresso">No</span>
              </label>
            </div>
          )}
          <div>
            <span className="text-sm text-espresso mr-4">Mobility limitations?</span>
            <label className="inline-flex items-center gap-1 mr-3 cursor-pointer">
              <input type="radio" name="mobility" checked={form.mobility_limitations === true} onChange={() => setForm(f => ({ ...f, mobility_limitations: true }))} className="accent-gold" />
              <span className="text-sm text-espresso">Yes</span>
            </label>
            <label className="inline-flex items-center gap-1 cursor-pointer">
              <input type="radio" name="mobility" checked={form.mobility_limitations === false} onChange={() => setForm(f => ({ ...f, mobility_limitations: false }))} className="accent-gold" />
              <span className="text-sm text-espresso">No</span>
            </label>
          </div>
          <Textarea label="Recent Surgeries" rows={2} value={form.recent_surgeries} onChange={e => setForm(f => ({ ...f, recent_surgeries: e.target.value }))} placeholder="Any recent procedures..." />
        </div>
      </Card>

      {/* Veterinarian */}
      <Card>
        <h3 className="font-display text-espresso text-sm mb-4">Veterinarian</h3>
        <div className="space-y-3">
          <Input label="Vet Name" value={form.vet_name} onChange={e => setForm(f => ({ ...f, vet_name: e.target.value }))} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Vet Phone" value={form.vet_phone} onChange={e => setForm(f => ({ ...f, vet_phone: e.target.value }))} />
            <Input label="Vet Address" value={form.vet_address} onChange={e => setForm(f => ({ ...f, vet_address: e.target.value }))} />
          </div>
        </div>
      </Card>

      {/* Walk Preferences */}
      <Card>
        <h3 className="font-display text-espresso text-sm mb-4">Walk Preferences</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-espresso mb-2">Preferred Walk Style</label>
            <CheckboxGroup options={WALK_STYLE_OPTIONS} selected={form.preferred_walk_style} onChange={v => setForm(f => ({ ...f, preferred_walk_style: v }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-espresso mb-2">Gear / Equipment</label>
            <CheckboxGroup options={GEAR_OPTIONS} selected={form.preferred_gear} onChange={v => setForm(f => ({ ...f, preferred_gear: v }))} />
          </div>
          <Select label="Treats Allowed" value={form.treats_allowed} onChange={e => setForm(f => ({ ...f, treats_allowed: e.target.value }))} options={TREATS_OPTIONS} />
          {(form.treats_allowed === 'yes' || form.treats_allowed === 'limited') && (
            <Textarea label="Treats Notes" rows={2} value={form.treats_notes} onChange={e => setForm(f => ({ ...f, treats_notes: e.target.value }))} placeholder="Preferences, restrictions..." />
          )}
          <Textarea label="Training Commands" rows={2} value={form.training_commands} onChange={e => setForm(f => ({ ...f, training_commands: e.target.value }))} placeholder="Sit, stay, leave it, etc." />
          <Textarea label="Things to Avoid on Walks" rows={2} value={form.avoid_on_walks} onChange={e => setForm(f => ({ ...f, avoid_on_walks: e.target.value }))} placeholder="Specific areas, triggers, other dogs..." />
        </div>
      </Card>

      {/* Special Instructions */}
      <Card>
        <h3 className="font-display text-espresso text-sm mb-4">Additional Notes</h3>
        <Textarea
          label="Special Instructions"
          rows={3}
          value={form.special_instructions}
          onChange={e => setForm(f => ({ ...f, special_instructions: e.target.value }))}
          placeholder="Anything else we should know..."
        />
      </Card>
    </>
  );
}

export default function ClientDogsPage() {
  const qc = useQueryClient();
  const [addModal, setAddModal] = useState(false);
  const [selectedDog, setSelectedDog] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const { data: dogs, isLoading } = useQuery({
    queryKey: ['client-dogs'],
    queryFn: () => api.get('/client/dogs').then(r => r.data.data),
  });

  const addDog = useMutation({
    mutationFn: () => api.post('/client/dogs', preparePayload(form)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-dogs'] });
      setAddModal(false);
      setForm(EMPTY_FORM);
    },
  });

  const [saveError, setSaveError] = useState('');

  const updateDog = useMutation({
    mutationFn: () => api.post(`/client/dogs/${selectedDog.id}/update`, preparePayload(editForm)),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['client-dogs'] });
      setSelectedDog(res.data.data);
      setEditing(false);
      setConfirmModal(false);
      setSaveError('');
    },
    onError: (e: any) => {
      setConfirmModal(false);
      const status = e.response?.status;
      const detail = e.response?.data?.message || e.response?.data?.error || JSON.stringify(e.response?.data);
      setSaveError(`Save failed (${status || 'network error'}): ${detail || e.message}`);
    },
  });

  const openDetail = (dog: any) => {
    setSelectedDog(dog);
    setEditing(false);
  };

  const startEdit = () => {
    setEditForm(dogToForm(selectedDog));
    setEditing(true);
  };

  const handleSave = () => {
    setConfirmModal(true);
  };

  const confirmSave = () => {
    updateDog.mutate();
  };

  if (isLoading) return <PageLoader />;

  // ── Detail / Edit view ──
  if (selectedDog) {
    const dog = selectedDog;
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedDog(null)} className="text-taupe hover:text-espresso text-sm">
            &larr; Back
          </button>
          <h1 className="font-display text-xl text-espresso flex-1">{dog.name}</h1>
          {!editing && (
            <Button size="sm" variant="outline" onClick={startEdit}>Edit</Button>
          )}
        </div>

        {saveError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">{saveError}</div>
        )}

        {!editing ? (
          /* ── Read-only detail ── */
          <>
            <Card>
              <div className="flex items-center gap-4 mb-4">
                <DogPhotoUpload dog={dog} onChanged={() => qc.invalidateQueries({ queryKey: ['client-dogs'] })} />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg font-semibold text-espresso">{dog.name}</span>
                    {!dog.is_active && <Badge variant="gold">Pending Review</Badge>}
                    {dog.bite_history && <Badge variant="red">Bite History</Badge>}
                    {dog.off_leash_approved && <Badge variant="green">Off-Leash Approved</Badge>}
                    {dog.buddy_walks_ok && <Badge variant="green">Buddy Walks OK</Badge>}
                    {dog.media_consent && <Badge variant="blue">Media Consent</Badge>}
                  </div>
                  <div className="text-sm text-taupe mt-0.5">
                    {[dog.breed, dog.sex ? (dog.sex === 'male' ? 'Male' : 'Female') : null].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </div>

              <div className="space-y-0">
                <DetailRow label="Breed" value={dog.breed} />
                <DetailRow label="Size" value={SIZE_LABELS[dog.size] ?? dog.size} />
                <DetailRow label="Sex" value={dog.sex === 'male' ? 'Male' : dog.sex === 'female' ? 'Female' : null} />
                <DetailRow label="Date of Birth" value={dog.date_of_birth ? new Date(dog.date_of_birth).toLocaleDateString('en-CA') : null} />
                <DetailRow label="Weight" value={dog.weight_kg ? `${dog.weight_kg} lbs` : null} />
                <DetailRow label="Colour" value={dog.colour} />
                <DetailRow label="Microchip" value={dog.microchip_number} />
                <DetailRow label="Spayed/Neutered" value={dog.spayed_neutered ? 'Yes' : 'No'} />
              </div>
            </Card>

            {/* Personality & Behaviour */}
            {(dog.personality_description || dog.energy_level || dog.interaction_dogs || dog.interaction_strangers || dog.interaction_children || dog.triggers || dog.bite_history || dog.bite_history_notes || dog.aggression_notes) && (
              <Card>
                <h3 className="font-display text-espresso text-sm mb-3">Personality & Behaviour</h3>
                <DetailRow label="Personality" value={dog.personality_description} />
                <DetailRow label="Energy Level" value={dog.energy_level ? dog.energy_level.charAt(0).toUpperCase() + dog.energy_level.slice(1).replace('_', ' ') : null} />
                <DetailRow label="With Other Dogs" value={dog.interaction_dogs} />
                <DetailRow label="With Strangers" value={dog.interaction_strangers} />
                <DetailRow label="With Children" value={dog.interaction_children} />
                <DetailRow label="Triggers / Fears" value={dog.triggers} />
                <DetailRow label="Bite History" value={dog.bite_history ? 'Yes' : null} />
                <DetailRow label="Bite History Notes" value={dog.bite_history_notes} />
                <DetailRow label="Aggression Notes" value={dog.aggression_notes} />
              </Card>
            )}

            {/* Medical */}
            {(dog.medical_conditions || dog.allergies || (dog.medications?.length > 0) || dog.recent_surgeries || dog.mobility_limitations !== null || dog.administer_medication_on_visits !== null) && (
              <Card>
                <h3 className="font-display text-espresso text-sm mb-3">Medical</h3>
                <DetailRow label="Medical Conditions" value={dog.medical_conditions} />
                <DetailRow label="Allergies" value={dog.allergies} />
                {dog.medications?.length > 0 && (
                  <div className="py-2 border-b border-cream">
                    <span className="text-sm text-taupe">Medications</span>
                    <div className="mt-1 space-y-1">
                      {dog.medications.map((m: any, i: number) => (
                        <div key={i} className="text-sm text-espresso">
                          <span className="font-medium">{m.name}</span>
                          {m.dosage && <span className="text-taupe"> — {m.dosage}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {dog.administer_medication_on_visits !== null && (
                  <DetailRow label="Administer Meds on Visits" value={dog.administer_medication_on_visits ? 'Yes' : 'No'} />
                )}
                {dog.mobility_limitations !== null && (
                  <DetailRow label="Mobility Limitations" value={dog.mobility_limitations ? 'Yes' : 'No'} />
                )}
                <DetailRow label="Recent Surgeries" value={dog.recent_surgeries} />
              </Card>
            )}

            {/* Vet info */}
            {(dog.vet_name || dog.vet_phone || dog.vet_address) && (
              <Card>
                <h3 className="font-display text-espresso text-sm mb-3">Veterinarian</h3>
                <DetailRow label="Vet Name" value={dog.vet_name} />
                <DetailRow label="Vet Phone" value={dog.vet_phone} />
                <DetailRow label="Vet Address" value={dog.vet_address} />
              </Card>
            )}

            {/* Walk Preferences */}
            {(dog.preferred_walk_style?.length > 0 || dog.preferred_gear?.length > 0 || dog.treats_allowed || dog.training_commands || dog.avoid_on_walks) && (
              <Card>
                <h3 className="font-display text-espresso text-sm mb-3">Walk Preferences</h3>
                {dog.preferred_walk_style?.length > 0 && (
                  <div className="py-2 border-b border-cream">
                    <span className="text-sm text-taupe">Walk Style</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {dog.preferred_walk_style.map((s: string) => (
                        <span key={s} className="text-xs bg-blue/10 text-blue px-2 py-0.5 rounded-full">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {dog.preferred_gear?.length > 0 && (
                  <div className="py-2 border-b border-cream">
                    <span className="text-sm text-taupe">Gear / Equipment</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {dog.preferred_gear.map((g: string) => (
                        <span key={g} className="text-xs bg-blue/10 text-blue px-2 py-0.5 rounded-full">{g}</span>
                      ))}
                    </div>
                  </div>
                )}
                <DetailRow label="Treats Allowed" value={dog.treats_allowed ? dog.treats_allowed.charAt(0).toUpperCase() + dog.treats_allowed.slice(1) : null} />
                <DetailRow label="Treats Notes" value={dog.treats_notes} />
                <DetailRow label="Training Commands" value={dog.training_commands} />
                <DetailRow label="Avoid on Walks" value={dog.avoid_on_walks} />
              </Card>
            )}

            {/* Special instructions */}
            {dog.special_instructions && (
              <Card>
                <h3 className="font-display text-espresso text-sm mb-2">Special Instructions</h3>
                <p className="text-sm text-taupe whitespace-pre-wrap">{dog.special_instructions}</p>
              </Card>
            )}

            {/* Vaccination records */}
            {dog.vaccination_records?.length > 0 && (
              <Card>
                <h3 className="font-display text-espresso text-sm mb-3">Vaccination Records</h3>
                <div className="space-y-2">
                  {dog.vaccination_records.map((v: any) => (
                    <div key={v.id} className="flex justify-between text-sm border-b border-cream last:border-0 py-1.5">
                      <span className="text-espresso font-medium">{v.vaccine_name}</span>
                      <div className="text-right text-taupe text-xs">
                        <div>Given: {v.date_given ? new Date(v.date_given).toLocaleDateString('en-CA') : '—'}</div>
                        {v.expiry_date && <div>Expires: {new Date(v.expiry_date).toLocaleDateString('en-CA')}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        ) : (
          /* ── Edit form ── */
          <>
            <DogFormFields form={editForm} setForm={setEditForm} />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              <Button disabled={!editForm.name} onClick={handleSave}>Save Changes</Button>
            </div>
          </>
        )}

        {/* Confirm modal */}
        <Modal open={confirmModal} onClose={() => setConfirmModal(false)} title="Confirm Changes">
          <div className="space-y-4">
            <p className="text-sm text-espresso">
              Are you sure you want to save these changes to <strong>{selectedDog?.name}</strong>'s profile?
            </p>
            <div className="bg-cream/60 rounded-lg p-3">
              <p className="text-xs text-taupe">
                Your walker will be notified of these changes in your messages.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setConfirmModal(false)}>Cancel</Button>
              <Button loading={updateDog.isPending} onClick={confirmSave}>Confirm</Button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // ── Dog list ──
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl text-espresso">My Dogs</h1>
        <Button size="sm" onClick={() => setAddModal(true)}>+ Add Dog</Button>
      </div>

      {dogs?.length === 0 && (
        <Card>
          <div className="text-center py-8">
            <PawIcon className="w-10 h-10 text-taupe mx-auto mb-2" />
            <p className="text-taupe text-sm">No dogs added yet.</p>
            <Button size="sm" className="mt-4" onClick={() => setAddModal(true)}>Add Your First Dog</Button>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {dogs?.map((dog: any) => (
          <Card key={dog.id}>
            <button
              onClick={() => openDetail(dog)}
              className="w-full text-left flex items-start gap-4"
            >
              <DogPhoto dogId={dog.id} hasPhoto={!!dog.photo_path} size={14} />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-espresso">{dog.name}</span>
                  {!dog.is_active && <Badge variant="gold">Pending Review</Badge>}
                  {dog.bite_history && <Badge variant="red">Bite History</Badge>}
                  {dog.off_leash_approved && <Badge variant="green">Off-Leash Approved</Badge>}
                  {dog.buddy_walks_ok && <Badge variant="green">Buddy Walks OK</Badge>}
                  {dog.media_consent && <Badge variant="blue">Media Consent</Badge>}
                </div>
                <div className="text-sm text-taupe mt-0.5 truncate">
                  {[dog.breed, SIZE_LABELS[dog.size] ?? dog.size, dog.sex === 'male' ? 'Male' : dog.sex === 'female' ? 'Female' : null].filter(Boolean).join(' · ')}
                </div>
                {dog.special_instructions && (
                  <p className="text-xs text-taupe mt-2 bg-cream rounded-lg p-2 line-clamp-2">{dog.special_instructions}</p>
                )}
              </div>
              <span className="text-taupe text-sm mt-1">&rsaquo;</span>
            </button>
          </Card>
        ))}
      </div>

      {/* Add Dog Modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add a Dog" size="lg">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <DogFormFields form={form} setForm={setForm} />
          <p className="text-xs text-taupe">New dogs are pending review by Sophie before their first appointment.</p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setAddModal(false)}>Cancel</Button>
            <Button loading={addDog.isPending} disabled={!form.name} onClick={() => addDog.mutate()}>Add Dog</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
