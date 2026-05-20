import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { useAuth, type CommunityPet } from '@/contexts/AuthContext';
import AuthImage from '@/components/AuthImage';
import PetForm from '@/components/PetForm';
import PageShell from '@/components/PageShell';
import PhotoCropper from '@/components/PhotoCropper';
import AddressAutocomplete from '@/components/AddressAutocomplete';

const AVAILABILITY_OPTIONS: { value: string; label: string }[] = [
  { value: 'mornings', label: 'Mornings' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'evenings', label: 'Evenings' },
  { value: 'weekends', label: 'Weekends' },
  { value: 'ad_hoc',   label: 'Ad hoc' },
];

const CARE_OPTIONS: { value: string; label: string }[] = [
  { value: 'dog_walk',  label: 'Dog walks' },
  { value: 'drop_in',   label: 'Drop-in feeds & visits' },
  { value: 'overnight', label: 'Overnight stays' },
  { value: 'multi_day', label: 'Multi-day care' },
];

const SPECIES_LABEL: Record<CommunityPet['species'], string> = {
  dog: 'Dog', cat: 'Cat', other: 'Other',
};

const RADIUS_MAX = 15000;

function radiusLabelFor(meters: number): string {
  if (meters >= RADIUS_MAX) return '15 km+ (no limit)';
  if (meters <= 500)  return 'In your building or block';
  if (meters <= 1000) return 'Less than 1 km';
  if (meters <= 2000) return 'About 2 km';
  if (meters <= 5000) return 'About 5 km';
  if (meters <= 10000) return 'About 10 km';
  return 'Up to 15 km';
}

export default function ProfileSetupPage() {
  const navigate = useNavigate();
  const { member, refreshMember } = useAuth();

  const [introduction, setIntroduction] = useState(member?.introduction ?? '');
  const [availability, setAvailability]         = useState<string[]>(member?.availability ?? []);
  const [needAvailability, setNeedAvailability] = useState<string[]>(member?.need_availability ?? []);
  const [careOffered, setCareOffered]           = useState<string[]>(member?.care_offered ?? []);
  const [careNeeded, setCareNeeded]             = useState<string[]>(member?.care_needed ?? []);
  const [radius, setRadius] = useState(member?.radius_meters ?? 1000);
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Member photo
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [pickedForCrop, setPickedForCrop] = useState<File | null>(null);

  // Pets
  const [petModal, setPetModal] = useState<{ open: boolean; pet: CommunityPet | null }>({ open: false, pet: null });

  const toggleIn = (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    setter((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setPickedForCrop(file);
    e.target.value = '';
  };

  const applyCroppedPhoto = (cropped: File) => {
    setPhotoFile(cropped);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(URL.createObjectURL(cropped));
    setPickedForCrop(null);
  };

  const uploadPhoto = async () => {
    if (!photoFile) return;
    setPhotoBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('photo', photoFile);
      await api.post('/community/profile/photo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPhotoFile(null);
      if (photoPreview) { URL.revokeObjectURL(photoPreview); setPhotoPreview(null); }
      await refreshMember();
    } catch (err: any) {
      const data = err.response?.data;
      const first = data?.errors ? Object.values(data.errors).flat()[0] : null;
      setError((first as string) ?? data?.message ?? 'Couldn’t upload that photo.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    if (!member?.photo_url) return;
    if (!confirm('Remove your photo?')) return;
    setPhotoBusy(true);
    try {
      await api.delete('/community/profile/photo');
      await refreshMember();
    } catch {
      setError('Couldn’t remove your photo.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const deletePet = async (pet: CommunityPet) => {
    if (!confirm(`Remove ${pet.name}?`)) return;
    try {
      await api.delete(`/community/pets/${pet.id}`);
      await refreshMember();
    } catch {
      setError(`Couldn’t remove ${pet.name}.`);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (introduction.trim().length < 20) {
      setError('A short introduction helps neighbours feel comfortable connecting — at least a sentence or two.');
      return;
    }
    if (!address.trim()) {
      setError('We need your address to find neighbours nearby. It’s never shown to other members.');
      return;
    }
    setSaving(true);
    try {
      await api.patch('/community/profile', {
        introduction: introduction.trim(),
        availability,
        need_availability: needAvailability,
        care_offered: careOffered,
        care_needed:  careNeeded,
        radius_meters: radius,
        address: address.trim(),
      });
      await refreshMember();
      navigate('/discover', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'We couldn’t save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const radiusLabel = radiusLabelFor(radius);
  const pets = member?.pets ?? [];
  const hasSavedPhoto = !!member?.photo_url;

  return (
    <PageShell back="/settings" crumbs={[{ label: 'Home', to: '/home' }, { label: 'Settings', to: '/settings' }, { label: 'Edit profile' }]}>
        <h1 className="font-display text-3xl text-espresso mb-3">Tell us a little about you.</h1>
        <p className="text-espresso/80 leading-relaxed mb-10">
          A short profile helps neighbours feel comfortable connecting. None of
          your contact details &mdash; phone, email, address &mdash; are ever
          shown to other members. Your photo and pet names stay hidden until
          you and a neighbour both verify and connect.
        </p>

        {/* ────────── Your photo ────────── */}
        <section className="mb-10">
          <h2 className="group-heading">Your photo</h2>
          <p className="group-sub">
            A friendly headshot helps neighbours recognise you once you&rsquo;ve
            connected. Hidden from anonymous browse.
          </p>
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-cream flex items-center justify-center text-3xl">
              {photoPreview ? (
                <img src={photoPreview} alt="" className="w-full h-full object-cover" />
              ) : hasSavedPhoto ? (
                <AuthImage
                  src={member!.photo_url}
                  alt={member!.name}
                  className="w-full h-full object-cover"
                  fallback={<span>🙂</span>}
                />
              ) : (
                <span>🙂</span>
              )}
            </div>
            <div className="flex flex-col gap-2 items-start">
              <label className="text-sm text-blue hover:underline cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={onPhotoChange} />
                {hasSavedPhoto ? 'Choose a different photo' : 'Choose a photo'}
              </label>
              {photoFile && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={uploadPhoto}
                    disabled={photoBusy}
                    className="btn-blue disabled:opacity-60"
                    style={{ padding: '7px 16px', fontSize: 12 }}
                  >
                    {photoBusy ? 'Uploading...' : 'Save photo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPickedForCrop(photoFile)}
                    className="text-xs text-blue hover:underline"
                  >
                    Re-frame
                  </button>
                </div>
              )}
              {hasSavedPhoto && !photoFile && (
                <button
                  type="button"
                  onClick={removePhoto}
                  disabled={photoBusy}
                  className="text-xs text-taupe hover:text-red-500"
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ────────── Your pets ────────── */}
        <section className="border-t border-taupe/30 pt-7 mb-10">
          <div className="flex items-center justify-between mb-1">
            <h2 className="group-heading mb-0">Your pets</h2>
            <button
              type="button"
              onClick={() => setPetModal({ open: true, pet: null })}
              className="text-sm text-blue hover:underline"
            >
              + Add a pet
            </button>
          </div>
          <p className="group-sub">
            Add the pets in your home. Neighbours see pet <em>counts</em> on
            anonymous browse, and the full pet info only once you&rsquo;ve
            connected.
          </p>

          {pets.length === 0 ? (
            <p className="text-sm text-taupe italic">No pets added yet.</p>
          ) : (
            <ul className="space-y-3">
              {pets.map((p) => (
                <li key={p.id} className="bg-white border border-taupe/20 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-cream flex items-center justify-center text-xl shrink-0">
                    {p.photo_url ? (
                      <AuthImage src={p.photo_url} alt={p.name} className="w-full h-full object-cover" fallback={<span>🐾</span>} />
                    ) : (
                      <span>🐾</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-base text-espresso truncate">{p.name}</p>
                    <p className="text-xs text-taupe">
                      {p.species === 'other' && p.species_other ? p.species_other : SPECIES_LABEL[p.species]}
                      {typeof p.age_years === 'number' ? ` · ${p.age_years} yr` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPetModal({ open: true, pet: p })}
                      className="text-sm text-blue hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePet(p)}
                      className="text-sm text-taupe hover:text-red-500"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <form onSubmit={onSubmit} className="space-y-8">
          <div className="border-t border-taupe/30 pt-7">
            <label htmlFor="intro" className="field-label">Introduction</label>
            <textarea
              id="intro"
              rows={4}
              maxLength={600}
              value={introduction}
              onChange={(e) => setIntroduction(e.target.value)}
              placeholder="A sentence or two about you. Mention your pets, if any, and your experience caring for animals."
              className="field-input resize-none"
            />
            <p className="text-xs text-taupe mt-2 text-right">{introduction.length}/600</p>
          </div>

          {/* ────────── What you can give ────────── */}
          <section className="border-t border-taupe/30 pt-7">
            <h2 className="group-heading">What you can give</h2>
            <p className="group-sub">
              How and when you&rsquo;re open to helping a neighbour. Leave
              everything empty if you only want to receive help.
            </p>

            <div className="space-y-6">
              <div>
                <div className="field-label">When you're typically free to help</div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {AVAILABILITY_OPTIONS.map((opt) => {
                    const selected = availability.includes(opt.value);
                    return (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={() => toggleIn(setAvailability, opt.value)}
                        className={`px-4 py-2 rounded-full border-2 text-sm transition ${
                          selected
                            ? 'bg-blue text-white border-blue'
                            : 'bg-transparent text-espresso border-taupe/40 hover:border-blue'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="field-label">Care you can offer</div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {CARE_OPTIONS.map((opt) => {
                    const selected = careOffered.includes(opt.value);
                    return (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={() => toggleIn(setCareOffered, opt.value)}
                        className={`px-4 py-2 rounded-full border-2 text-sm transition ${
                          selected
                            ? 'bg-blue text-white border-blue'
                            : 'bg-transparent text-espresso border-taupe/40 hover:border-blue'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* ────────── What you need ────────── */}
          <section className="border-t border-taupe/30 pt-7">
            <h2 className="group-heading">What you need</h2>
            <p className="group-sub">
              How and when you might ask a neighbour for help with your own
              pets. Leave everything empty if you only want to give help.
            </p>

            <div className="space-y-6">
              <div>
                <div className="field-label">When you typically need care</div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {AVAILABILITY_OPTIONS.map((opt) => {
                    const selected = needAvailability.includes(opt.value);
                    return (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={() => toggleIn(setNeedAvailability, opt.value)}
                        className={`px-4 py-2 rounded-full border-2 text-sm transition ${
                          selected
                            ? 'bg-blue text-white border-blue'
                            : 'bg-transparent text-espresso border-taupe/40 hover:border-blue'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="field-label">Care you sometimes need</div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {CARE_OPTIONS.map((opt) => {
                    const selected = careNeeded.includes(opt.value);
                    return (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={() => toggleIn(setCareNeeded, opt.value)}
                        className={`px-4 py-2 rounded-full border-2 text-sm transition ${
                          selected
                            ? 'bg-blue text-white border-blue'
                            : 'bg-transparent text-espresso border-taupe/40 hover:border-blue'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="radius" className="field-label mb-0">Neighbour radius</label>
              <span className="text-sm text-espresso">{radiusLabel}</span>
            </div>
            <input
              id="radius"
              type="range"
              min={250}
              max={RADIUS_MAX}
              step={250}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full accent-blue"
            />
            <div className="flex justify-between text-xs text-taupe mt-1">
              <span>250 m</span>
              <span>15 km+</span>
            </div>
          </div>

          <div>
            <label htmlFor="address" className="field-label">Your home address</label>
            <AddressAutocomplete
              id="address"
              value={address}
              onChange={setAddress}
              required
              placeholder="Start typing your address..."
            />
            <p className="text-xs text-taupe mt-2 leading-relaxed">
              Pick your address from the suggestions so we can place you
              correctly. Your address is geocoded once, stored only as a
              coarse area (about a ±600m cell), and is <strong>never
              visible</strong> to other members &mdash; they only see
              approximate distance (e.g. &ldquo;Less than 500m away&rdquo;).
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end pt-2">
            <button type="submit" disabled={saving} className="btn-blue disabled:opacity-60">
              {saving ? 'Saving...' : 'Save & Continue'}
            </button>
          </div>
        </form>
      {petModal.open && (
        <PetForm
          pet={petModal.pet}
          onClose={() => setPetModal({ open: false, pet: null })}
          onSaved={async () => {
            setPetModal({ open: false, pet: null });
            await refreshMember();
          }}
        />
      )}

      {pickedForCrop && (
        <PhotoCropper
          file={pickedForCrop}
          onCancel={() => setPickedForCrop(null)}
          onConfirm={applyCroppedPhoto}
        />
      )}
    </PageShell>
  );
}
