import { FormEvent, useState } from 'react';
import api from '@/lib/api';
import AuthImage from '@/components/AuthImage';
import type { CommunityPet } from '@/contexts/AuthContext';

type Species = 'dog' | 'cat' | 'other';

interface Props {
  pet?: CommunityPet | null;
  onClose: () => void;
  onSaved: () => void;
}

const DOG_SIZES = [
  { value: 'toy',    label: 'Toy' },
  { value: 'small',  label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large',  label: 'Large' },
  { value: 'xl',     label: 'XL' },
];

const ENERGY_LEVELS = [
  { value: 'low',    label: 'Calm / low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High energy' },
];

type TriValue = 'yes' | 'no' | 'unsure' | '';

export default function PetForm({ pet, onClose, onSaved }: Props) {
  const isEdit = !!pet;
  const [species, setSpecies] = useState<Species>(pet?.species ?? 'dog');
  const [speciesOther, setSpeciesOther] = useState(pet?.species_other ?? '');
  const [name, setName] = useState(pet?.name ?? '');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [removeExistingPhoto, setRemoveExistingPhoto] = useState(false);

  const [ageYears, setAgeYears] = useState<string>(pet?.age_years?.toString() ?? '');
  const [sex, setSex] = useState<'' | 'male' | 'female' | 'unknown'>(pet?.sex ?? '');
  const [spayedNeutered, setSpayedNeutered] = useState<TriValue>(
    pet?.spayed_neutered === true ? 'yes' :
    pet?.spayed_neutered === false ? 'no' :
    pet ? 'unsure' : '',
  );
  const [notes, setNotes] = useState(pet?.notes ?? '');
  const [careInstructions, setCareInstructions] = useState(pet?.care_instructions ?? '');

  // Species-specific (kept in species_data JSON).
  const sd = pet?.species_data ?? {};
  const [breed, setBreed]               = useState<string>(sd.breed ?? '');
  const [size, setSize]                 = useState<string>(sd.size ?? '');
  const [energy, setEnergy]             = useState<string>(sd.energy ?? '');
  const [goodWithDogs, setGoodWithDogs] = useState<TriValue>(sd.good_with_dogs ?? '');
  const [goodWithCats, setGoodWithCats] = useState<TriValue>(sd.good_with_cats ?? '');
  const [goodWithKids, setGoodWithKids] = useState<TriValue>(sd.good_with_kids ?? '');
  // Cat-specific
  const [indoor, setIndoor]                 = useState<TriValue>(sd.indoor ?? '');
  const [shyWithStrangers, setShyWithStrangers] = useState<TriValue>(sd.shy ?? '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
    setRemoveExistingPhoto(false);
  };

  const triToBool = (v: TriValue): boolean | null =>
    v === 'yes' ? true : v === 'no' ? false : null;

  const buildSpeciesData = () => {
    if (species === 'dog') {
      return {
        breed: breed.trim() || null,
        size:  size || null,
        energy: energy || null,
        good_with_dogs: goodWithDogs || null,
        good_with_cats: goodWithCats || null,
        good_with_kids: goodWithKids || null,
      };
    }
    if (species === 'cat') {
      return {
        breed: breed.trim() || null,
        indoor: indoor || null,
        shy: shyWithStrangers || null,
      };
    }
    return {};
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    if (species === 'other' && !speciesOther.trim()) {
      setError('Tell us what kind of pet (e.g. rabbit, bird).');
      return;
    }
    setSaving(true);
    setError('');

    const fd = new FormData();
    fd.append('species', species);
    if (species === 'other') fd.append('species_other', speciesOther.trim());
    fd.append('name', name.trim());
    if (ageYears.trim()) fd.append('age_years', ageYears.trim());
    if (sex) fd.append('sex', sex);
    const sn = triToBool(spayedNeutered);
    if (sn !== null) fd.append('spayed_neutered', sn ? '1' : '0');
    if (notes.trim()) fd.append('notes', notes.trim());
    if (careInstructions.trim()) fd.append('care_instructions', careInstructions.trim());
    fd.append('species_data', JSON.stringify(buildSpeciesData()));
    if (photoFile) fd.append('photo', photoFile);
    if (removeExistingPhoto && !photoFile) fd.append('remove_photo', '1');

    try {
      if (isEdit && pet) {
        fd.append('_method', 'PATCH');
        await api.post(`/community/pets/${pet.id}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await api.post('/community/pets', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      onSaved();
    } catch (err: any) {
      const data = err.response?.data;
      const first = data?.errors ? Object.values(data.errors).flat()[0] : null;
      setError((first as string) ?? data?.message ?? 'Couldn’t save that pet.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/40 px-4 py-8 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full p-7" onClick={(e) => e.stopPropagation()}>
        <p className="label-caps text-blue mb-2">{isEdit ? 'Edit pet' : 'Add a pet'}</p>
        <h2 className="font-display text-xl text-espresso mb-5">Tell us about your pet</h2>

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="field-label">Species</label>
            <div className="flex flex-wrap gap-2">
              {(['dog', 'cat', 'other'] as Species[]).map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setSpecies(s)}
                  className={`px-4 py-2 rounded-full border-2 text-sm transition ${
                    species === s
                      ? 'bg-blue text-white border-blue'
                      : 'bg-transparent text-espresso border-taupe/40 hover:border-blue'
                  }`}
                >
                  {s === 'dog' ? 'Dog' : s === 'cat' ? 'Cat' : 'Other'}
                </button>
              ))}
            </div>
          </div>

          {species === 'other' && (
            <div>
              <label className="field-label" htmlFor="species_other">What kind?</label>
              <input
                id="species_other"
                value={speciesOther}
                onChange={(e) => setSpeciesOther(e.target.value)}
                placeholder="rabbit, bird, fish…"
                className="field-input"
                maxLength={60}
              />
            </div>
          )}

          <div>
            <label className="field-label" htmlFor="pet_name">Name</label>
            <input
              id="pet_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field-input"
              maxLength={80}
              required
            />
          </div>

          <div>
            <label className="field-label">Photo (optional)</label>
            <div className="flex items-center gap-3">
              {photoPreview ? (
                <img src={photoPreview} alt="" className="w-16 h-16 rounded-full object-cover" />
              ) : (pet?.photo_url && !removeExistingPhoto) ? (
                <AuthImage
                  src={pet.photo_url}
                  alt={pet.name}
                  className="w-16 h-16 rounded-full object-cover"
                  fallback={<div className="w-16 h-16 rounded-full bg-cream" />}
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-cream flex items-center justify-center text-2xl">🐾</div>
              )}
              <label className="text-sm text-blue hover:underline cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={onPhotoChange} />
                {photoFile ? 'Choose different photo' : (pet?.photo_url && !removeExistingPhoto) ? 'Replace photo' : 'Add a photo'}
              </label>
              {(pet?.photo_url && !photoFile && !removeExistingPhoto) && (
                <button type="button" onClick={() => setRemoveExistingPhoto(true)} className="text-sm text-taupe hover:text-red-500">
                  Remove
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label" htmlFor="pet_age">Age (years)</label>
              <input
                id="pet_age"
                type="number"
                min={0}
                max={50}
                value={ageYears}
                onChange={(e) => setAgeYears(e.target.value)}
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="pet_sex">Sex</label>
              <select
                id="pet_sex"
                value={sex}
                onChange={(e) => setSex(e.target.value as any)}
                className="field-input"
              >
                <option value="">—</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="unknown">Not sure</option>
              </select>
            </div>
          </div>

          <div>
            <label className="field-label">Spayed / neutered?</label>
            <TriRadio value={spayedNeutered} setValue={setSpayedNeutered} />
          </div>

          {species === 'dog' && (
            <>
              <div>
                <label className="field-label" htmlFor="pet_breed">Breed</label>
                <input
                  id="pet_breed"
                  value={breed}
                  onChange={(e) => setBreed(e.target.value)}
                  className="field-input"
                  placeholder="Mix, Border Collie, etc."
                />
              </div>
              <div>
                <label className="field-label">Size</label>
                <div className="flex flex-wrap gap-2">
                  {DOG_SIZES.map((opt) => (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => setSize(opt.value === size ? '' : opt.value)}
                      className={`px-3 py-1.5 rounded-full border-2 text-sm transition ${
                        size === opt.value
                          ? 'bg-blue text-white border-blue'
                          : 'bg-transparent text-espresso border-taupe/40 hover:border-blue'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="field-label">Energy level</label>
                <div className="flex flex-wrap gap-2">
                  {ENERGY_LEVELS.map((opt) => (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => setEnergy(opt.value === energy ? '' : opt.value)}
                      className={`px-3 py-1.5 rounded-full border-2 text-sm transition ${
                        energy === opt.value
                          ? 'bg-blue text-white border-blue'
                          : 'bg-transparent text-espresso border-taupe/40 hover:border-blue'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="field-label">Good with other dogs?</label>
                <TriRadio value={goodWithDogs} setValue={setGoodWithDogs} />
              </div>
              <div>
                <label className="field-label">Good with cats?</label>
                <TriRadio value={goodWithCats} setValue={setGoodWithCats} />
              </div>
              <div>
                <label className="field-label">Good with kids?</label>
                <TriRadio value={goodWithKids} setValue={setGoodWithKids} />
              </div>
            </>
          )}

          {species === 'cat' && (
            <>
              <div>
                <label className="field-label" htmlFor="cat_breed">Breed (optional)</label>
                <input
                  id="cat_breed"
                  value={breed}
                  onChange={(e) => setBreed(e.target.value)}
                  className="field-input"
                  placeholder="Tabby, Siamese, mixed…"
                />
              </div>
              <div>
                <label className="field-label">Indoor only?</label>
                <TriRadio value={indoor} setValue={setIndoor} />
              </div>
              <div>
                <label className="field-label">Shy with strangers?</label>
                <TriRadio value={shyWithStrangers} setValue={setShyWithStrangers} />
              </div>
            </>
          )}

          <div>
            <label className="field-label" htmlFor="pet_notes">Personality / general notes</label>
            <textarea
              id="pet_notes"
              rows={3}
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything a neighbour would love to know — what they enjoy, what makes them happy."
              className="field-input resize-none"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="pet_care">Care instructions</label>
            <textarea
              id="pet_care"
              rows={3}
              maxLength={1500}
              value={careInstructions}
              onChange={(e) => setCareInstructions(e.target.value)}
              placeholder="Feeding schedule, medications, what to avoid, anything important."
              className="field-input resize-none"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="label-caps text-taupe hover:text-espresso px-3">Cancel</button>
            <button type="submit" disabled={saving} className="btn-blue disabled:opacity-60">
              {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Add pet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TriRadio({ value, setValue }: { value: TriValue; setValue: (v: TriValue) => void }) {
  const opts: { v: TriValue; label: string }[] = [
    { v: 'yes',    label: 'Yes' },
    { v: 'no',     label: 'No' },
    { v: 'unsure', label: 'Not sure' },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {opts.map((o) => (
        <button
          type="button"
          key={o.v}
          onClick={() => setValue(value === o.v ? '' : o.v)}
          className={`px-3 py-1.5 rounded-full border-2 text-sm transition ${
            value === o.v
              ? 'bg-blue text-white border-blue'
              : 'bg-transparent text-espresso border-taupe/40 hover:border-blue'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
