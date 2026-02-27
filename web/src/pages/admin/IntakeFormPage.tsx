import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageLoader } from '@/components/ui/LoadingSpinner';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Medication {
  name: string;
  dosage: string;
}

interface DogData {
  id?: number;
  name: string;
  breed: string;
  colour: string;
  date_of_birth: string;
  weight_kg: string;
  size: string;
  sex: string;
  microchip_number: string;
  spayed_neutered: boolean;
  personality_description: string;
  energy_level: string;
  interaction_dogs: string;
  interaction_strangers: string;
  interaction_children: string;
  triggers: string;
  bite_history: boolean;
  bite_history_notes: string;
  medical_conditions: string;
  allergies: string;
  medications: Medication[];
  administer_medication_on_visits: boolean | null;
  mobility_limitations: boolean | null;
  recent_surgeries: string;
  preferred_walk_style: string[];
  preferred_gear: string[];
  treats_allowed: string;
  treats_notes: string;
  training_commands: string;
  avoid_on_walks: string;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  province: string;
  postal_code: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
  vet_clinic_name: string;
  vet_phone: string;
  vet_address: string;
  home_access: {
    entry_instructions: string;
    lockbox_code: string;
    door_code: string;
    alarm_code: string;
    key_location: string;
    parking_instructions: string;
    notes: string;
  };
  food_storage_location: string;
  customized_care_options: string[];
  preferred_update_method: string[];
  report_detail_level: string;
  what_great_care_looks_like: string;
  biggest_concern: string;
  comfort_factors: string;
  preferred_walk_days: string[];
  preferred_walk_length: string;
  preferred_walk_times: string[];
  billing_method: string;
  referral_source: string;
  additional_notes: string;
  dogs: DogData[];
}

// ── Empty state builders ───────────────────────────────────────────────────────

function emptyDog(partial?: Partial<DogData>): DogData {
  return {
    name: '',
    breed: '',
    colour: '',
    date_of_birth: '',
    weight_kg: '',
    size: '',
    sex: '',
    microchip_number: '',
    spayed_neutered: false,
    personality_description: '',
    energy_level: '',
    interaction_dogs: '',
    interaction_strangers: '',
    interaction_children: '',
    triggers: '',
    bite_history: false,
    bite_history_notes: '',
    medical_conditions: '',
    allergies: '',
    medications: [],
    administer_medication_on_visits: null,
    mobility_limitations: null,
    recent_surgeries: '',
    preferred_walk_style: [],
    preferred_gear: [],
    treats_allowed: '',
    treats_notes: '',
    training_commands: '',
    avoid_on_walks: '',
    ...partial,
  };
}

function buildForm(data: any): FormData {
  const p = data?.client_profile ?? {};
  const ha = data?.home_access ?? {};
  const dogs: DogData[] = (data?.dogs ?? []).map((d: any) => emptyDog({
    id: d.id,
    name: d.name ?? '',
    breed: d.breed ?? '',
    colour: d.colour ?? '',
    date_of_birth: d.date_of_birth?.split('T')[0] ?? '',
    weight_kg: d.weight_kg != null ? String(d.weight_kg) : '',
    size: d.size ?? '',
    sex: d.sex ?? '',
    microchip_number: d.microchip_number ?? '',
    spayed_neutered: d.spayed_neutered ?? false,
    personality_description: d.personality_description ?? '',
    energy_level: d.energy_level ?? '',
    interaction_dogs: d.interaction_dogs ?? '',
    interaction_strangers: d.interaction_strangers ?? '',
    interaction_children: d.interaction_children ?? '',
    triggers: d.triggers ?? '',
    bite_history: d.bite_history ?? false,
    bite_history_notes: d.bite_history_notes ?? '',
    medical_conditions: d.medical_conditions ?? '',
    allergies: d.allergies ?? '',
    medications: d.medications ?? [],
    administer_medication_on_visits: d.administer_medication_on_visits ?? null,
    mobility_limitations: d.mobility_limitations ?? null,
    recent_surgeries: d.recent_surgeries ?? '',
    preferred_walk_style: d.preferred_walk_style ?? [],
    preferred_gear: d.preferred_gear ?? [],
    treats_allowed: d.treats_allowed ?? '',
    treats_notes: d.treats_notes ?? '',
    training_commands: d.training_commands ?? '',
    avoid_on_walks: d.avoid_on_walks ?? '',
  }));

  return {
    name: data?.name ?? '',
    email: data?.email ?? '',
    phone: p.phone ?? '',
    address: p.address ?? '',
    city: p.city ?? '',
    province: p.province ?? '',
    postal_code: p.postal_code ?? '',
    emergency_contact_name: p.emergency_contact_name ?? '',
    emergency_contact_phone: p.emergency_contact_phone ?? '',
    emergency_contact_relationship: p.emergency_contact_relationship ?? '',
    vet_clinic_name: p.vet_clinic_name ?? '',
    vet_phone: p.vet_phone ?? '',
    vet_address: p.vet_address ?? '',
    home_access: {
      entry_instructions: ha.entry_instructions ?? '',
      lockbox_code: ha.lockbox_code ?? '',
      door_code: ha.door_code ?? '',
      alarm_code: ha.alarm_code ?? '',
      key_location: ha.key_location ?? '',
      parking_instructions: ha.parking_instructions ?? '',
      notes: ha.notes ?? '',
    },
    food_storage_location: p.food_storage_location ?? '',
    customized_care_options: p.customized_care_options ?? [],
    preferred_update_method: p.preferred_update_method ?? [],
    report_detail_level: p.report_detail_level ?? '',
    what_great_care_looks_like: p.what_great_care_looks_like ?? '',
    biggest_concern: p.biggest_concern ?? '',
    comfort_factors: p.comfort_factors ?? '',
    preferred_walk_days: p.preferred_walk_days ?? [],
    preferred_walk_length: p.preferred_walk_length ?? '',
    preferred_walk_times: p.preferred_walk_times ?? [],
    billing_method: p.billing_method ?? '',
    referral_source: p.referral_source ?? '',
    additional_notes: p.additional_notes ?? '',
    dogs,
  };
}

// ── Reusable field primitives ──────────────────────────────────────────────────

const fieldCls = 'border border-taupe rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 w-full bg-white text-espresso placeholder-taupe/60 transition-all';
const readCls  = 'text-sm text-espresso';
const labelCls = 'text-sm font-medium text-espresso block mb-1';

function Label({ children }: { children: React.ReactNode }) {
  return <span className={labelCls}>{children}</span>;
}

function ReadValue({ value }: { value?: string | null }) {
  return <p className={`${readCls} min-h-[1.25rem]`}>{value || <span className="text-taupe/50">—</span>}</p>;
}

function ReadBool({ value }: { value: boolean | null | undefined }) {
  if (value === null || value === undefined) return <p className={readCls}><span className="text-taupe/50">—</span></p>;
  return <p className={readCls}>{value ? 'Yes' : 'No'}</p>;
}

function ReadList({ values }: { values: string[] }) {
  if (!values?.length) return <p className={readCls}><span className="text-taupe/50">—</span></p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map(v => (
        <span key={v} className="px-2 py-0.5 bg-cream rounded-full text-xs text-espresso capitalize">
          {v.replace(/_/g, ' ')}
        </span>
      ))}
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

// Pill-style radio group
function RadioGroup({
  label,
  options,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
}) {
  if (readOnly) {
    const opt = options.find(o => o.value === value);
    return (
      <FieldRow label={label}>
        <ReadValue value={opt?.label} />
      </FieldRow>
    );
  }
  return (
    <FieldRow label={label}>
      <div className="flex flex-wrap gap-2 mt-1">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
              value === opt.value
                ? 'bg-gold text-white border-gold'
                : 'border-taupe text-espresso hover:border-gold/60 hover:bg-cream'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </FieldRow>
  );
}

// Pill-style checkbox group
function CheckboxGroup({
  label,
  options,
  values,
  onChange,
  readOnly,
}: {
  label: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (v: string[]) => void;
  readOnly: boolean;
}) {
  const toggle = (v: string) => {
    if (values.includes(v)) {
      onChange(values.filter(x => x !== v));
    } else {
      onChange([...values, v]);
    }
  };

  if (readOnly) {
    const selected = options.filter(o => values.includes(o.value)).map(o => o.label);
    return (
      <FieldRow label={label}>
        {selected.length ? (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {selected.map(s => (
              <span key={s} className="px-2 py-0.5 bg-cream rounded-full text-xs text-espresso">{s}</span>
            ))}
          </div>
        ) : <ReadValue />}
      </FieldRow>
    );
  }

  return (
    <FieldRow label={label}>
      <div className="flex flex-wrap gap-2 mt-1">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
              values.includes(opt.value)
                ? 'bg-gold text-white border-gold'
                : 'border-taupe text-espresso hover:border-gold/60 hover:bg-cream'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </FieldRow>
  );
}

// Boolean radio (Yes / No / — )
function BoolRadio({
  label,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  readOnly: boolean;
}) {
  if (readOnly) {
    return (
      <FieldRow label={label}>
        <ReadBool value={value} />
      </FieldRow>
    );
  }
  return (
    <FieldRow label={label}>
      <div className="flex gap-2 mt-1">
        {[{ v: true, l: 'Yes' }, { v: false, l: 'No' }].map(({ v, l }) => (
          <button
            key={l}
            type="button"
            onClick={() => onChange(v as boolean)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
              value === v
                ? 'bg-gold text-white border-gold'
                : 'border-taupe text-espresso hover:border-gold/60 hover:bg-cream'
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </FieldRow>
  );
}

// ── Section heading ────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-lg text-espresso border-b border-cream pb-2 mb-4">
      {children}
    </h2>
  );
}

// ── Section wrapper card ───────────────────────────────────────────────────────

function SectionCard({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <div id={id} className="bg-white rounded-2xl shadow-card p-6 space-y-4">
      {children}
    </div>
  );
}

// ── Dog card ───────────────────────────────────────────────────────────────────

const WALK_STYLE_OPTIONS = [
  { value: 'sniff_focused', label: 'Sniff Focused' },
  { value: 'structured_training', label: 'Structured Training' },
  { value: 'social', label: 'Social' },
  { value: 'indoor_outdoor', label: 'Indoor/Outdoor' },
  { value: 'low_stimulation', label: 'Low Stimulation' },
  { value: 'high_activity', label: 'High Activity' },
  { value: 'off_leash', label: 'Off Leash' },
];

const GEAR_OPTIONS = [
  { value: 'collar', label: 'Collar' },
  { value: 'harness', label: 'Harness' },
  { value: 'slip_lead', label: 'Slip Lead' },
  { value: 'gentle_leader', label: 'Gentle Leader' },
];

const SIZE_OPTIONS = [
  { value: '', label: 'Select…' },
  { value: 'toy', label: 'Toy' },
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
  { value: 'xl', label: 'XL' },
];

const SEX_OPTIONS = [
  { value: '', label: 'Select…' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

const ENERGY_OPTIONS = [
  { value: 'very_calm', label: 'Very Calm' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'high_energy', label: 'High Energy' },
  { value: 'varies', label: 'Varies' },
];

const DOG_OPTIONS = [
  { value: 'loves', label: 'Loves Dogs' },
  { value: 'selective', label: 'Selective' },
  { value: 'prefers_avoid', label: 'Prefers to Avoid' },
  { value: 'reactive', label: 'Reactive' },
];

const STRANGER_OPTIONS = [
  { value: 'friendly', label: 'Friendly' },
  { value: 'shy', label: 'Shy' },
  { value: 'protective', label: 'Protective' },
  { value: 'nervous', label: 'Nervous' },
];

const CHILDREN_OPTIONS = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'unsure', label: 'Unsure' },
  { value: 'avoid', label: 'Avoid' },
];

const TREATS_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'only_specific', label: 'Only Specific' },
  { value: 'no', label: 'No' },
];

function DogCard({
  dog,
  index,
  readOnly,
  onChange,
  onRemove,
}: {
  dog: DogData;
  index: number;
  readOnly: boolean;
  onChange: (index: number, updated: DogData) => void;
  onRemove: (index: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const set = useCallback(
    (partial: Partial<DogData>) => onChange(index, { ...dog, ...partial }),
    [index, dog, onChange]
  );

  const toggleArr = (key: 'preferred_walk_style' | 'preferred_gear', val: string) => {
    const arr = dog[key];
    set({ [key]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] });
  };

  const addMed = () => set({ medications: [...dog.medications, { name: '', dosage: '' }] });
  const removeMed = (i: number) => set({ medications: dog.medications.filter((_, idx) => idx !== i) });
  const updateMed = (i: number, k: keyof Medication, v: string) =>
    set({ medications: dog.medications.map((m, idx) => idx === i ? { ...m, [k]: v } : m) });

  const dogTitle = dog.name.trim() || `Dog ${index + 1}`;
  const isNew = !dog.id;

  return (
    <div className="bg-white rounded-2xl border border-cream shadow-card">
      {/* Card header */}
      <div
        className="bg-cream rounded-t-2xl px-5 py-3 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🐾</span>
          <span className="font-display text-espresso text-base">{dogTitle}</span>
          {dog.bite_history && (
            <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">Bite History</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isNew && !readOnly && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onRemove(index); }}
              className="px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
            >
              Remove Dog
            </button>
          )}
          <span className="text-taupe text-sm select-none">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="p-5 space-y-6">
          {/* ── Basic Info ─────────────────────────────────────────────────── */}
          <div>
            <h3 className="text-sm font-semibold text-taupe uppercase tracking-wide mb-3">Basic Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldRow label="Name">
                {readOnly
                  ? <ReadValue value={dog.name} />
                  : <input className={fieldCls} value={dog.name} onChange={e => set({ name: e.target.value })} placeholder="Buddy" />
                }
              </FieldRow>
              <FieldRow label="Breed">
                {readOnly
                  ? <ReadValue value={dog.breed} />
                  : <input className={fieldCls} value={dog.breed} onChange={e => set({ breed: e.target.value })} placeholder="Golden Retriever" />
                }
              </FieldRow>
              <FieldRow label="Colour">
                {readOnly
                  ? <ReadValue value={dog.colour} />
                  : <input className={fieldCls} value={dog.colour} onChange={e => set({ colour: e.target.value })} placeholder="Golden" />
                }
              </FieldRow>
              <FieldRow label="Date of Birth">
                {readOnly
                  ? <ReadValue value={dog.date_of_birth} />
                  : <input type="date" className={fieldCls} value={dog.date_of_birth} onChange={e => set({ date_of_birth: e.target.value })} />
                }
              </FieldRow>
              <FieldRow label="Weight (kg)">
                {readOnly
                  ? <ReadValue value={dog.weight_kg ? `${dog.weight_kg} kg` : undefined} />
                  : <input type="number" step="0.1" min="0" className={fieldCls} value={dog.weight_kg} onChange={e => set({ weight_kg: e.target.value })} placeholder="12.5" />
                }
              </FieldRow>
              <FieldRow label="Size">
                {readOnly
                  ? <ReadValue value={SIZE_OPTIONS.find(o => o.value === dog.size)?.label} />
                  : (
                    <select className={fieldCls} value={dog.size} onChange={e => set({ size: e.target.value })}>
                      {SIZE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  )
                }
              </FieldRow>
              <FieldRow label="Sex">
                {readOnly
                  ? <ReadValue value={SEX_OPTIONS.find(o => o.value === dog.sex)?.label} />
                  : (
                    <select className={fieldCls} value={dog.sex} onChange={e => set({ sex: e.target.value })}>
                      {SEX_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  )
                }
              </FieldRow>
              <FieldRow label="Microchip Number">
                {readOnly
                  ? <ReadValue value={dog.microchip_number} />
                  : <input className={fieldCls} value={dog.microchip_number} onChange={e => set({ microchip_number: e.target.value })} placeholder="Optional" />
                }
              </FieldRow>
            </div>
            <div className="mt-4">
              {readOnly
                ? (
                  <FieldRow label="Spayed / Neutered">
                    <ReadBool value={dog.spayed_neutered} />
                  </FieldRow>
                )
                : (
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={dog.spayed_neutered}
                      onChange={e => set({ spayed_neutered: e.target.checked })}
                      className="h-4 w-4 rounded border-taupe text-gold focus:ring-gold"
                    />
                    <span className="text-sm text-espresso">Spayed / Neutered</span>
                  </label>
                )
              }
            </div>
          </div>

          {/* ── Personality ────────────────────────────────────────────────── */}
          <div>
            <h3 className="text-sm font-semibold text-taupe uppercase tracking-wide mb-3">Personality</h3>
            <div className="space-y-4">
              <FieldRow label="Personality Description">
                {readOnly
                  ? <ReadValue value={dog.personality_description} />
                  : <textarea className={`${fieldCls} resize-none`} rows={3} value={dog.personality_description} onChange={e => set({ personality_description: e.target.value })} placeholder="Describe your dog's personality…" />
                }
              </FieldRow>
              <RadioGroup label="Energy Level" options={ENERGY_OPTIONS} value={dog.energy_level} onChange={v => set({ energy_level: v })} readOnly={readOnly} />
              <RadioGroup label="Interaction with Other Dogs" options={DOG_OPTIONS} value={dog.interaction_dogs} onChange={v => set({ interaction_dogs: v })} readOnly={readOnly} />
              <RadioGroup label="Interaction with Strangers" options={STRANGER_OPTIONS} value={dog.interaction_strangers} onChange={v => set({ interaction_strangers: v })} readOnly={readOnly} />
              <RadioGroup label="Interaction with Children" options={CHILDREN_OPTIONS} value={dog.interaction_children} onChange={v => set({ interaction_children: v })} readOnly={readOnly} />
              <FieldRow label="Triggers">
                {readOnly
                  ? <ReadValue value={dog.triggers} />
                  : <textarea className={`${fieldCls} resize-none`} rows={2} value={dog.triggers} onChange={e => set({ triggers: e.target.value })} placeholder="e.g. skateboards, loud noises…" />
                }
              </FieldRow>
              {readOnly ? (
                <FieldRow label="Bite History">
                  <ReadBool value={dog.bite_history} />
                </FieldRow>
              ) : (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={dog.bite_history}
                    onChange={e => set({ bite_history: e.target.checked })}
                    className="h-4 w-4 rounded border-taupe text-gold focus:ring-gold"
                  />
                  <span className="text-sm text-espresso font-medium">Bite History</span>
                </label>
              )}
              {(dog.bite_history || readOnly) && (
                <FieldRow label="Bite History Notes">
                  {readOnly
                    ? <ReadValue value={dog.bite_history_notes} />
                    : <textarea className={`${fieldCls} resize-none`} rows={2} value={dog.bite_history_notes} onChange={e => set({ bite_history_notes: e.target.value })} placeholder="Describe the incident(s)…" />
                  }
                </FieldRow>
              )}
            </div>
          </div>

          {/* ── Health ─────────────────────────────────────────────────────── */}
          <div>
            <h3 className="text-sm font-semibold text-taupe uppercase tracking-wide mb-3">Health</h3>
            <div className="space-y-4">
              <FieldRow label="Medical Conditions">
                {readOnly
                  ? <ReadValue value={dog.medical_conditions} />
                  : <textarea className={`${fieldCls} resize-none`} rows={2} value={dog.medical_conditions} onChange={e => set({ medical_conditions: e.target.value })} placeholder="e.g. hip dysplasia, epilepsy…" />
                }
              </FieldRow>
              <FieldRow label="Allergies">
                {readOnly
                  ? <ReadValue value={dog.allergies} />
                  : <textarea className={`${fieldCls} resize-none`} rows={2} value={dog.allergies} onChange={e => set({ allergies: e.target.value })} placeholder="e.g. chicken, grass…" />
                }
              </FieldRow>

              {/* Medications list */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Medications</Label>
                  {!readOnly && (
                    <button type="button" onClick={addMed} className="text-sm text-blue hover:underline font-medium">
                      + Add Medication
                    </button>
                  )}
                </div>
                {dog.medications.length === 0 && (
                  <p className="text-sm text-taupe/60">No medications listed.</p>
                )}
                {dog.medications.map((med, i) => (
                  <div key={i} className="flex gap-2 mb-2 items-end">
                    {i === 0 && !readOnly && (
                      <div className="grid grid-cols-2 gap-2 flex-1">
                        <div className="text-xs text-taupe mb-1">Medication Name</div>
                        <div className="text-xs text-taupe mb-1">Dosage</div>
                      </div>
                    )}
                    <div className="flex gap-2 flex-1 items-start">
                      {readOnly ? (
                        <p className="text-sm text-espresso">{med.name}{med.dosage ? ` — ${med.dosage}` : ''}</p>
                      ) : (
                        <>
                          <div className="flex-1">
                            {i === 0 && <div className="text-xs text-taupe mb-1">Medication Name</div>}
                            <input className={fieldCls} placeholder="e.g. Apoquel" value={med.name} onChange={e => updateMed(i, 'name', e.target.value)} />
                          </div>
                          <div className="flex-1">
                            {i === 0 && <div className="text-xs text-taupe mb-1">Dosage</div>}
                            <input className={fieldCls} placeholder="e.g. 16mg twice daily" value={med.dosage} onChange={e => updateMed(i, 'dosage', e.target.value)} />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeMed(i)}
                            className={`text-taupe hover:text-red-500 text-xl leading-none flex-shrink-0 ${i === 0 ? 'mt-5' : ''}`}
                          >
                            ×
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <BoolRadio label="Administer Medication on Visits?" value={dog.administer_medication_on_visits} onChange={v => set({ administer_medication_on_visits: v })} readOnly={readOnly} />
              <BoolRadio label="Mobility Limitations?" value={dog.mobility_limitations} onChange={v => set({ mobility_limitations: v })} readOnly={readOnly} />
              <FieldRow label="Recent Surgeries / Injuries">
                {readOnly
                  ? <ReadValue value={dog.recent_surgeries} />
                  : <textarea className={`${fieldCls} resize-none`} rows={2} value={dog.recent_surgeries} onChange={e => set({ recent_surgeries: e.target.value })} placeholder="Include date and details…" />
                }
              </FieldRow>
            </div>
          </div>

          {/* ── Walking Preferences ────────────────────────────────────────── */}
          <div>
            <h3 className="text-sm font-semibold text-taupe uppercase tracking-wide mb-3">Walking Preferences</h3>
            <div className="space-y-4">
              <CheckboxGroup
                label="Preferred Walk Style"
                options={WALK_STYLE_OPTIONS}
                values={dog.preferred_walk_style}
                onChange={v => set({ preferred_walk_style: v })}
                readOnly={readOnly}
              />
              <CheckboxGroup
                label="Preferred Gear"
                options={GEAR_OPTIONS}
                values={dog.preferred_gear}
                onChange={v => set({ preferred_gear: v })}
                readOnly={readOnly}
              />
              <RadioGroup label="Treats Allowed?" options={TREATS_OPTIONS} value={dog.treats_allowed} onChange={v => set({ treats_allowed: v })} readOnly={readOnly} />
              {(dog.treats_allowed === 'only_specific' || (readOnly && dog.treats_notes)) && (
                <FieldRow label="Specific Treats Allowed">
                  {readOnly
                    ? <ReadValue value={dog.treats_notes} />
                    : <input className={fieldCls} value={dog.treats_notes} onChange={e => set({ treats_notes: e.target.value })} placeholder="e.g. single-ingredient beef treats only" />
                  }
                </FieldRow>
              )}
              <FieldRow label="Known Training Commands">
                {readOnly
                  ? <ReadValue value={dog.training_commands} />
                  : <textarea className={`${fieldCls} resize-none`} rows={2} value={dog.training_commands} onChange={e => set({ training_commands: e.target.value })} placeholder="e.g. sit, stay, leave it…" />
                }
              </FieldRow>
              <FieldRow label="Avoid on Walks">
                {readOnly
                  ? <ReadValue value={dog.avoid_on_walks} />
                  : <textarea className={`${fieldCls} resize-none`} rows={2} value={dog.avoid_on_walks} onChange={e => set({ avoid_on_walks: e.target.value })} placeholder="e.g. dog parks, off-leash areas…" />
                }
              </FieldRow>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section nav tabs ───────────────────────────────────────────────────────────

const SECTION_LABELS = [
  { id: 'section-1', label: 'Owner' },
  { id: 'section-2', label: 'Vet' },
  { id: 'section-3', label: 'Dogs' },
  { id: 'section-4', label: 'Home Access' },
  { id: 'section-5', label: 'Care Options' },
  { id: 'section-6', label: 'Communication' },
];

function SectionNav() {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
      {SECTION_LABELS.map((s, i) => (
        <button
          key={s.id}
          type="button"
          onClick={() => scrollTo(s.id)}
          className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border border-taupe/40 text-espresso hover:border-gold hover:text-gold transition-colors whitespace-nowrap"
        >
          <span className="text-taupe/60 mr-1">{i + 1}.</span>{s.label}
        </button>
      ))}
    </div>
  );
}

// ── Customized Care Options ────────────────────────────────────────────────────

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
  { value: 'morning_7_10', label: 'Morning (7–10am)' },
  { value: 'midday_11_2', label: 'Midday (11am–2pm)' },
  { value: 'afternoon_3_6', label: 'Afternoon (3–6pm)' },
  { value: 'evening_6_9', label: 'Evening (6–9pm)' },
];

const BILLING_OPTIONS = [
  { value: '', label: 'Select…' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'e_transfer', label: 'E-Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'ach', label: 'ACH / Direct Debit' },
];

const REFERRAL_OPTIONS = [
  { value: '', label: 'Select…' },
  { value: 'referral', label: 'Referral from Friend / Family' },
  { value: 'online_search', label: 'Online Search' },
  { value: 'flyer', label: 'Flyer' },
  { value: 'local_business', label: 'Local Business' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'other', label: 'Other' },
];

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function IntakeFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState<FormData | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const savedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Query ──────────────────────────────────────────────────────────────────

  const { data: clientData, isLoading } = useQuery({
    queryKey: ['admin-intake', id],
    queryFn: () => api.get(`/admin/clients/${id}/intake`).then(r => r.data.data),
  });

  useEffect(() => {
    if (clientData) {
      setForm(buildForm(clientData));
      setIsDirty(false);
    }
  }, [clientData]);

  const isSubmitted = Boolean(clientData?.client_profile?.intake_submitted_at);
  const submittedAt: string | null = clientData?.client_profile?.intake_submitted_at ?? null;
  const readOnly = isSubmitted;

  // ── Mutations ──────────────────────────────────────────────────────────────

  const saveDraft = useMutation({
    mutationFn: (f: FormData) => api.put(`/admin/clients/${id}/intake`, f),
    onSuccess: () => {
      setIsDirty(false);
      setSavedFlash(true);
      if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);
      savedFlashTimer.current = setTimeout(() => setSavedFlash(false), 2500);
      qc.invalidateQueries({ queryKey: ['admin-intake', id] });
    },
  });

  const submitForm = useMutation({
    mutationFn: (f: FormData) => api.post(`/admin/clients/${id}/intake/submit`, f),
    onSuccess: () => {
      setShowSubmitModal(false);
      setIsDirty(false);
      qc.invalidateQueries({ queryKey: ['admin-intake', id] });
    },
  });

  const resendInvite = useMutation({
    mutationFn: () => api.post(`/admin/clients/${id}/resend-invite`),
    onSuccess: () => {
      setInviteSent(true);
      setTimeout(() => setInviteSent(false), 3000);
    },
  });

  // ── Form helpers ───────────────────────────────────────────────────────────

  const update = useCallback((partial: Partial<FormData>) => {
    setForm(prev => prev ? { ...prev, ...partial } : prev);
    setIsDirty(true);
  }, []);

  const updateField = useCallback((key: keyof FormData, value: any) => {
    setForm(prev => prev ? { ...prev, [key]: value } : prev);
    setIsDirty(true);
  }, []);

  const updateHomeAccess = useCallback((key: keyof FormData['home_access'], value: string) => {
    setForm(prev => {
      if (!prev) return prev;
      return { ...prev, home_access: { ...prev.home_access, [key]: value } };
    });
    setIsDirty(true);
  }, []);

  const updateDog = useCallback((index: number, updated: DogData) => {
    setForm(prev => {
      if (!prev) return prev;
      const dogs = [...prev.dogs];
      dogs[index] = updated;
      return { ...prev, dogs };
    });
    setIsDirty(true);
  }, []);

  const addDog = () => {
    setForm(prev => prev ? { ...prev, dogs: [...prev.dogs, emptyDog()] } : prev);
    setIsDirty(true);
  };

  const removeDog = (index: number) => {
    setForm(prev => {
      if (!prev) return prev;
      return { ...prev, dogs: prev.dogs.filter((_, i) => i !== index) };
    });
    setIsDirty(true);
  };

  const toggleArr = (key: 'customized_care_options' | 'preferred_update_method' | 'preferred_walk_days' | 'preferred_walk_times', val: string) => {
    if (!form) return;
    const arr = form[key] as string[];
    updateField(key, arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  };

  // ── Loading / error ────────────────────────────────────────────────────────

  if (isLoading || !form) return <PageLoader />;

  const clientName = form.name || clientData?.name || 'Client';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-cream">
      {/* ── Sticky Header ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white border-b border-cream px-6 py-3 flex items-center justify-between gap-4 flex-wrap shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/admin/clients/${id}`)}
            className="text-taupe hover:text-espresso text-sm font-medium transition-colors"
          >
            ← Back to Client
          </button>
          <span className="text-taupe/40">|</span>
          <h1 className="font-display text-espresso text-base">
            Intake Form — {clientName}
          </h1>
          {isSubmitted ? (
            <span className="px-2.5 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
              Submitted ✓
            </span>
          ) : (
            <span className="px-2.5 py-0.5 bg-cream border border-taupe/30 text-taupe rounded-full text-xs font-medium">
              Draft
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Save indicator */}
          {!readOnly && (
            <span className={`text-xs transition-all duration-300 ${
              savedFlash ? 'text-green-600' : isDirty ? 'text-taupe' : 'text-transparent'
            }`}>
              {savedFlash ? 'Saved' : 'Unsaved changes'}
            </span>
          )}

          {/* Send / Resend Invite */}
          <Button
            variant="outline"
            size="sm"
            loading={resendInvite.isPending}
            onClick={() => resendInvite.mutate()}
          >
            {inviteSent ? 'Sent!' : isSubmitted ? 'Resend Invite' : 'Send Invite'}
          </Button>

          {/* Save Draft */}
          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              loading={saveDraft.isPending}
              disabled={!isDirty}
              onClick={() => form && saveDraft.mutate(form)}
            >
              Save Draft
            </Button>
          )}

          {/* Submit */}
          {!readOnly && (
            <Button
              size="sm"
              disabled={isSubmitted}
              onClick={() => setShowSubmitModal(true)}
            >
              Submit Form
            </Button>
          )}
        </div>
      </div>

      {/* ── Error banners ──────────────────────────────────────────────────── */}
      {saveDraft.isError && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-2 text-sm text-red-700">
          {(saveDraft.error as any)?.response?.data?.message ?? 'Failed to save draft. Please try again.'}
        </div>
      )}
      {submitForm.isError && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-2 text-sm text-red-700">
          {(submitForm.error as any)?.response?.data?.message ?? 'Failed to submit. Please try again.'}
        </div>
      )}

      {/* ── Submission info banner ─────────────────────────────────────────── */}
      {isSubmitted && submittedAt && (
        <div className="bg-green-50 border-b border-green-200 px-6 py-2 text-sm text-green-700">
          This intake form was submitted on {new Date(submittedAt).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}. All fields are read-only.
        </div>
      )}

      {/* ── Page body ──────────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Section nav */}
        <SectionNav />

        {/* ── Section 1: Owner Information ─────────────────────────────────── */}
        <SectionCard id="section-1">
          <SectionHeading>1. Owner Information</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldRow label="Full Name">
              {readOnly
                ? <ReadValue value={form.name} />
                : <input className={fieldCls} value={form.name} onChange={e => update({ name: e.target.value })} placeholder="Jane Smith" />
              }
            </FieldRow>
            <FieldRow label="Email">
              {readOnly
                ? <ReadValue value={form.email} />
                : <input type="email" className={fieldCls} value={form.email} onChange={e => update({ email: e.target.value })} placeholder="jane@example.com" />
              }
            </FieldRow>
            <FieldRow label="Phone">
              {readOnly
                ? <ReadValue value={form.phone} />
                : <input type="tel" className={fieldCls} value={form.phone} onChange={e => update({ phone: e.target.value })} placeholder="(416) 555-0100" />
              }
            </FieldRow>
            <FieldRow label="Street Address">
              {readOnly
                ? <ReadValue value={form.address} />
                : <input className={fieldCls} value={form.address} onChange={e => update({ address: e.target.value })} placeholder="123 Main St" />
              }
            </FieldRow>
            <FieldRow label="City">
              {readOnly
                ? <ReadValue value={form.city} />
                : <input className={fieldCls} value={form.city} onChange={e => update({ city: e.target.value })} placeholder="Toronto" />
              }
            </FieldRow>
            <FieldRow label="Province">
              {readOnly
                ? <ReadValue value={form.province} />
                : <input className={fieldCls} value={form.province} onChange={e => update({ province: e.target.value })} placeholder="ON" />
              }
            </FieldRow>
            <FieldRow label="Postal Code">
              {readOnly
                ? <ReadValue value={form.postal_code} />
                : <input className={fieldCls} value={form.postal_code} onChange={e => update({ postal_code: e.target.value })} placeholder="M5V 2N4" />
              }
            </FieldRow>
          </div>

          <div className="pt-2 border-t border-cream">
            <p className="text-sm font-semibold text-espresso mb-3">Emergency Contact</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldRow label="Name">
                {readOnly
                  ? <ReadValue value={form.emergency_contact_name} />
                  : <input className={fieldCls} value={form.emergency_contact_name} onChange={e => update({ emergency_contact_name: e.target.value })} placeholder="John Smith" />
                }
              </FieldRow>
              <FieldRow label="Phone">
                {readOnly
                  ? <ReadValue value={form.emergency_contact_phone} />
                  : <input type="tel" className={fieldCls} value={form.emergency_contact_phone} onChange={e => update({ emergency_contact_phone: e.target.value })} placeholder="(416) 555-0101" />
                }
              </FieldRow>
              <FieldRow label="Relationship">
                {readOnly
                  ? <ReadValue value={form.emergency_contact_relationship} />
                  : <input className={fieldCls} value={form.emergency_contact_relationship} onChange={e => update({ emergency_contact_relationship: e.target.value })} placeholder="Spouse, Parent, Friend…" />
                }
              </FieldRow>
            </div>
          </div>
        </SectionCard>

        {/* ── Section 2: Veterinarian ──────────────────────────────────────── */}
        <SectionCard id="section-2">
          <SectionHeading>2. Veterinarian</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldRow label="Clinic Name">
              {readOnly
                ? <ReadValue value={form.vet_clinic_name} />
                : <input className={fieldCls} value={form.vet_clinic_name} onChange={e => update({ vet_clinic_name: e.target.value })} placeholder="Riverside Animal Hospital" />
              }
            </FieldRow>
            <FieldRow label="Phone">
              {readOnly
                ? <ReadValue value={form.vet_phone} />
                : <input type="tel" className={fieldCls} value={form.vet_phone} onChange={e => update({ vet_phone: e.target.value })} placeholder="(416) 555-0200" />
              }
            </FieldRow>
          </div>
          <FieldRow label="Address">
            {readOnly
              ? <ReadValue value={form.vet_address} />
              : <textarea className={`${fieldCls} resize-none`} rows={2} value={form.vet_address} onChange={e => update({ vet_address: e.target.value })} placeholder="456 Vet Ave, Toronto ON M4B 1Z5" />
            }
          </FieldRow>
        </SectionCard>

        {/* ── Section 3: Dog(s) Details ────────────────────────────────────── */}
        <div id="section-3" className="space-y-4">
          <div className="flex items-center justify-between">
            <SectionHeading>3. Dog(s) Details</SectionHeading>
          </div>

          {form.dogs.length === 0 && (
            <div className="bg-white rounded-2xl shadow-card p-6 text-center text-taupe">
              No dogs on record. {!readOnly && 'Add a dog below.'}
            </div>
          )}

          {form.dogs.map((dog, i) => (
            <DogCard
              key={dog.id ?? `new-${i}`}
              dog={dog}
              index={i}
              readOnly={readOnly}
              onChange={updateDog}
              onRemove={removeDog}
            />
          ))}

          {!readOnly && (
            <button
              type="button"
              onClick={addDog}
              className="w-full rounded-2xl border-2 border-dashed border-taupe/40 py-5 text-sm text-taupe hover:border-gold hover:text-gold transition-colors font-medium"
            >
              + Add Another Dog
            </button>
          )}
        </div>

        {/* ── Section 4: Home Access & Logistics ──────────────────────────── */}
        <SectionCard id="section-4">
          <SectionHeading>4. Home Access & Logistics</SectionHeading>
          <p className="text-xs text-taupe -mt-2">Codes are encrypted at rest.</p>

          <div className="space-y-4">
            <FieldRow label="Entry Instructions">
              {readOnly
                ? <ReadValue value={form.home_access.entry_instructions} />
                : <textarea className={`${fieldCls} resize-none`} rows={3} value={form.home_access.entry_instructions} onChange={e => updateHomeAccess('entry_instructions', e.target.value)} placeholder="Describe how to enter the home…" />
              }
            </FieldRow>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldRow label="Lockbox Code">
                {readOnly
                  ? <ReadValue value={form.home_access.lockbox_code} />
                  : <input className={`${fieldCls} font-mono`} value={form.home_access.lockbox_code} onChange={e => updateHomeAccess('lockbox_code', e.target.value)} placeholder="e.g. 1234" />
                }
              </FieldRow>
              <FieldRow label="Door Code">
                {readOnly
                  ? <ReadValue value={form.home_access.door_code} />
                  : <input className={`${fieldCls} font-mono`} value={form.home_access.door_code} onChange={e => updateHomeAccess('door_code', e.target.value)} placeholder="e.g. *1234#" />
                }
              </FieldRow>
              <FieldRow label="Alarm Code">
                {readOnly
                  ? <ReadValue value={form.home_access.alarm_code} />
                  : <input className={`${fieldCls} font-mono`} value={form.home_access.alarm_code} onChange={e => updateHomeAccess('alarm_code', e.target.value)} placeholder="e.g. 5678 then #" />
                }
              </FieldRow>
              <FieldRow label="Key Location">
                {readOnly
                  ? <ReadValue value={form.home_access.key_location} />
                  : <input className={fieldCls} value={form.home_access.key_location} onChange={e => updateHomeAccess('key_location', e.target.value)} placeholder="e.g. under front mat" />
                }
              </FieldRow>
            </div>
            <FieldRow label="Parking Instructions">
              {readOnly
                ? <ReadValue value={form.home_access.parking_instructions} />
                : <textarea className={`${fieldCls} resize-none`} rows={2} value={form.home_access.parking_instructions} onChange={e => updateHomeAccess('parking_instructions', e.target.value)} placeholder="e.g. visitor parking in lot B" />
              }
            </FieldRow>
            <FieldRow label="Home Access Notes">
              {readOnly
                ? <ReadValue value={form.home_access.notes} />
                : <textarea className={`${fieldCls} resize-none`} rows={2} value={form.home_access.notes} onChange={e => updateHomeAccess('notes', e.target.value)} placeholder="Any other relevant information…" />
              }
            </FieldRow>
            <FieldRow label="Food Storage Location">
              {readOnly
                ? <ReadValue value={form.food_storage_location} />
                : <textarea className={`${fieldCls} resize-none`} rows={2} value={form.food_storage_location} onChange={e => update({ food_storage_location: e.target.value })} placeholder="e.g. dog food in pantry, second shelf" />
              }
            </FieldRow>
          </div>
        </SectionCard>

        {/* ── Section 5: Customized Care Options ──────────────────────────── */}
        <SectionCard id="section-5">
          <SectionHeading>5. Customized Care Options</SectionHeading>
          <p className="text-sm text-taupe -mt-2 mb-2">Select all add-on services that apply.</p>
          {readOnly ? (
            <ReadList values={form.customized_care_options.map(v => CARE_OPTIONS.find(o => o.value === v)?.label ?? v)} />
          ) : (
            <div className="flex flex-wrap gap-2">
              {CARE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleArr('customized_care_options', opt.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    form.customized_care_options.includes(opt.value)
                      ? 'bg-gold text-white border-gold'
                      : 'border-taupe text-espresso hover:border-gold/60 hover:bg-cream'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        {/* ── Section 6: Communication & Scheduling ───────────────────────── */}
        <SectionCard id="section-6">
          <SectionHeading>6. Communication & Scheduling Preferences</SectionHeading>

          <div className="space-y-5">
            {/* Update method */}
            <CheckboxGroup
              label="Preferred Update Method"
              options={UPDATE_METHOD_OPTIONS}
              values={form.preferred_update_method}
              onChange={v => updateField('preferred_update_method', v)}
              readOnly={readOnly}
            />

            {/* Report detail */}
            <RadioGroup
              label="Report Detail Level"
              options={REPORT_DETAIL_OPTIONS}
              value={form.report_detail_level}
              onChange={v => updateField('report_detail_level', v)}
              readOnly={readOnly}
            />

            <FieldRow label="What Does Great Care Look Like to You?">
              {readOnly
                ? <ReadValue value={form.what_great_care_looks_like} />
                : <textarea className={`${fieldCls} resize-none`} rows={3} value={form.what_great_care_looks_like} onChange={e => update({ what_great_care_looks_like: e.target.value })} placeholder="Tell us what you value most in a pet care provider…" />
              }
            </FieldRow>

            <FieldRow label="Biggest Concern About Pet Care">
              {readOnly
                ? <ReadValue value={form.biggest_concern} />
                : <textarea className={`${fieldCls} resize-none`} rows={2} value={form.biggest_concern} onChange={e => update({ biggest_concern: e.target.value })} placeholder="What worries you most when leaving your pet with someone?" />
              }
            </FieldRow>

            <FieldRow label="What Puts You at Ease?">
              {readOnly
                ? <ReadValue value={form.comfort_factors} />
                : <textarea className={`${fieldCls} resize-none`} rows={2} value={form.comfort_factors} onChange={e => update({ comfort_factors: e.target.value })} placeholder="e.g. photos, live tracking, same walker each time…" />
              }
            </FieldRow>

            <div className="pt-3 border-t border-cream">
              <p className="text-sm font-semibold text-espresso mb-3">Scheduling Preferences</p>

              {/* Walk days */}
              <div className="space-y-4">
                <div>
                  <Label>Preferred Walk Days</Label>
                  {readOnly ? (
                    <ReadList values={form.preferred_walk_days.map(v => WALK_DAYS_OPTIONS.find(o => o.value === v)?.label ?? v)} />
                  ) : (
                    <div className="flex gap-2 mt-1">
                      {WALK_DAYS_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => toggleArr('preferred_walk_days', opt.value)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                            form.preferred_walk_days.includes(opt.value)
                              ? 'bg-gold text-white border-gold'
                              : 'border-taupe text-espresso hover:border-gold/60 hover:bg-cream'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <RadioGroup
                  label="Preferred Walk Length"
                  options={WALK_LENGTH_OPTIONS}
                  value={form.preferred_walk_length}
                  onChange={v => updateField('preferred_walk_length', v)}
                  readOnly={readOnly}
                />

                <CheckboxGroup
                  label="Preferred Walk Times"
                  options={WALK_TIME_OPTIONS}
                  values={form.preferred_walk_times}
                  onChange={v => updateField('preferred_walk_times', v)}
                  readOnly={readOnly}
                />
              </div>
            </div>

            <div className="pt-3 border-t border-cream">
              <p className="text-sm font-semibold text-espresso mb-3">Billing & Referral</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FieldRow label="Billing Method">
                  {readOnly
                    ? <ReadValue value={BILLING_OPTIONS.find(o => o.value === form.billing_method)?.label} />
                    : (
                      <select className={fieldCls} value={form.billing_method} onChange={e => update({ billing_method: e.target.value })}>
                        {BILLING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    )
                  }
                </FieldRow>
                <FieldRow label="How Did You Hear About Us?">
                  {readOnly
                    ? <ReadValue value={REFERRAL_OPTIONS.find(o => o.value === form.referral_source)?.label} />
                    : (
                      <select className={fieldCls} value={form.referral_source} onChange={e => update({ referral_source: e.target.value })}>
                        {REFERRAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    )
                  }
                </FieldRow>
              </div>
            </div>

            <FieldRow label="Additional Notes">
              {readOnly
                ? <ReadValue value={form.additional_notes} />
                : <textarea className={`${fieldCls} resize-none`} rows={3} value={form.additional_notes} onChange={e => update({ additional_notes: e.target.value })} placeholder="Anything else we should know?" />
              }
            </FieldRow>
          </div>
        </SectionCard>

        {/* ── Footer action area ──────────────────────────────────────────── */}
        {!readOnly && (
          <div className="flex justify-end gap-3 pb-10">
            <Button
              variant="outline"
              loading={saveDraft.isPending}
              disabled={!isDirty}
              onClick={() => form && saveDraft.mutate(form)}
            >
              Save Draft
            </Button>
            <Button onClick={() => setShowSubmitModal(true)}>
              Submit Form
            </Button>
          </div>
        )}
      </div>

      {/* ── Submit confirmation modal ───────────────────────────────────────── */}
      <Modal
        open={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        title="Submit Intake Form"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-espresso">
            Are you sure you want to submit this intake form for <strong>{clientName}</strong>? Once submitted, the form will be locked and cannot be edited.
          </p>
          {submitForm.isError && (
            <p className="text-sm text-red-600">
              {(submitForm.error as any)?.response?.data?.message ?? 'Submission failed. Please try again.'}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowSubmitModal(false)}>
              Cancel
            </Button>
            <Button
              loading={submitForm.isPending}
              onClick={() => form && submitForm.mutate(form)}
            >
              Confirm Submit
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
