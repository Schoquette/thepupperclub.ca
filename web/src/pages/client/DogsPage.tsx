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
  { value: 'small', label: 'Small (under 10 kg)' },
  { value: 'medium', label: 'Medium (10–25 kg)' },
  { value: 'large', label: 'Large (25–40 kg)' },
  { value: 'extra_large', label: 'Extra Large (40+ kg)' },
];

const SIZE_LABELS: Record<string, string> = {
  small: 'Small (under 10 kg)',
  medium: 'Medium (10–25 kg)',
  large: 'Large (25–40 kg)',
  extra_large: 'Extra Large (40+ kg)',
};

const SEX_OPTIONS = [
  { value: '', label: 'Select...' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

const EMPTY_FORM = {
  name: '', breed: '', size: '', sex: '',
  date_of_birth: '', weight_kg: '',
  colour: '', microchip_number: '',
  spayed_neutered: false, special_instructions: '',
  vet_name: '', vet_phone: '', vet_address: '',
  bite_history: false, bite_history_notes: '', aggression_notes: '',
};

function dogToForm(dog: any) {
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
    mutationFn: () => api.post('/client/dogs', { ...form, weight_kg: form.weight_kg ? Number(form.weight_kg) : null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-dogs'] });
      setAddModal(false);
      setForm(EMPTY_FORM);
    },
  });

  const updateDog = useMutation({
    mutationFn: () => api.patch(`/client/dogs/${selectedDog.id}`, {
      ...editForm,
      weight_kg: editForm.weight_kg ? Number(editForm.weight_kg) : null,
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['client-dogs'] });
      setSelectedDog(res.data.data);
      setEditing(false);
      setConfirmModal(false);
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

            {/* Vet info */}
            {(dog.vet_name || dog.vet_phone || dog.vet_address) && (
              <Card>
                <h3 className="font-display text-espresso text-sm mb-3">Veterinarian</h3>
                <DetailRow label="Vet Name" value={dog.vet_name} />
                <DetailRow label="Vet Phone" value={dog.vet_phone} />
                <DetailRow label="Vet Address" value={dog.vet_address} />
              </Card>
            )}

            {/* Special instructions */}
            {dog.special_instructions && (
              <Card>
                <h3 className="font-display text-espresso text-sm mb-2">Special Instructions</h3>
                <p className="text-sm text-taupe whitespace-pre-wrap">{dog.special_instructions}</p>
              </Card>
            )}

            {/* Medications */}
            {dog.medications?.length > 0 && (
              <Card>
                <h3 className="font-display text-espresso text-sm mb-2">Medications</h3>
                <div className="space-y-1">
                  {dog.medications.map((m: any, i: number) => (
                    <div key={i} className="text-sm text-taupe">
                      <span className="font-medium text-espresso">{m.name}</span>
                      {m.dosage && <span> — {m.dosage}</span>}
                      {m.frequency && <span> ({m.frequency})</span>}
                    </div>
                  ))}
                </div>
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

            {/* Notes */}
            {(dog.bite_history_notes || dog.aggression_notes) && (
              <Card>
                <h3 className="font-display text-espresso text-sm mb-2">Behaviour Notes</h3>
                {dog.bite_history_notes && (
                  <div className="mb-2">
                    <span className="text-xs font-semibold text-red-600">Bite History:</span>
                    <p className="text-sm text-taupe">{dog.bite_history_notes}</p>
                  </div>
                )}
                {dog.aggression_notes && (
                  <div>
                    <span className="text-xs font-semibold text-espresso">Aggression Notes:</span>
                    <p className="text-sm text-taupe">{dog.aggression_notes}</p>
                  </div>
                )}
              </Card>
            )}
          </>
        ) : (
          /* ── Edit form ── */
          <>
            <Card>
              <h3 className="font-display text-espresso text-sm mb-4">Basic Info</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="Name *" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                  <Input label="Breed" value={editForm.breed} onChange={e => setEditForm(f => ({ ...f, breed: e.target.value }))} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Select label="Size" value={editForm.size} onChange={e => setEditForm(f => ({ ...f, size: e.target.value }))} options={SIZE_OPTIONS} />
                  <Select label="Sex" value={editForm.sex} onChange={e => setEditForm(f => ({ ...f, sex: e.target.value }))} options={SEX_OPTIONS} />
                  <Input label="Weight (lbs)" type="number" value={editForm.weight_kg} onChange={e => setEditForm(f => ({ ...f, weight_kg: e.target.value }))} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="Date of Birth" type="date" value={editForm.date_of_birth} onChange={e => setEditForm(f => ({ ...f, date_of_birth: e.target.value }))} />
                  <Input label="Colour" value={editForm.colour} onChange={e => setEditForm(f => ({ ...f, colour: e.target.value }))} />
                </div>
                <Input label="Microchip Number" value={editForm.microchip_number} onChange={e => setEditForm(f => ({ ...f, microchip_number: e.target.value }))} />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editForm.spayed_neutered} onChange={e => setEditForm(f => ({ ...f, spayed_neutered: e.target.checked }))} className="rounded accent-gold" />
                  <span className="text-sm text-espresso">Spayed/Neutered</span>
                </label>
              </div>
            </Card>

            <Card>
              <h3 className="font-display text-espresso text-sm mb-4">Veterinarian</h3>
              <div className="space-y-3">
                <Input label="Vet Name" value={editForm.vet_name} onChange={e => setEditForm(f => ({ ...f, vet_name: e.target.value }))} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="Vet Phone" value={editForm.vet_phone} onChange={e => setEditForm(f => ({ ...f, vet_phone: e.target.value }))} />
                  <Input label="Vet Address" value={editForm.vet_address} onChange={e => setEditForm(f => ({ ...f, vet_address: e.target.value }))} />
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="font-display text-espresso text-sm mb-4">Care Instructions</h3>
              <Textarea
                label="Special Instructions"
                rows={3}
                value={editForm.special_instructions}
                onChange={e => setEditForm(f => ({ ...f, special_instructions: e.target.value }))}
                placeholder="Allergies, fears, behaviour notes..."
              />
            </Card>

            <Card>
              <h3 className="font-display text-espresso text-sm mb-4">Behaviour</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editForm.bite_history} onChange={e => setEditForm(f => ({ ...f, bite_history: e.target.checked }))} className="rounded accent-gold" />
                  <span className="text-sm text-espresso">Bite History</span>
                </label>
                {editForm.bite_history && (
                  <Textarea
                    label="Bite History Details"
                    rows={2}
                    value={editForm.bite_history_notes}
                    onChange={e => setEditForm(f => ({ ...f, bite_history_notes: e.target.value }))}
                  />
                )}
                <Textarea
                  label="Aggression Notes"
                  rows={2}
                  value={editForm.aggression_notes}
                  onChange={e => setEditForm(f => ({ ...f, aggression_notes: e.target.value }))}
                  placeholder="Any notes about reactivity or aggression..."
                />
              </div>
            </Card>

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
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input label="Breed" value={form.breed} onChange={e => setForm(f => ({ ...f, breed: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select label="Size" value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))} options={SIZE_OPTIONS} />
            <Select label="Sex" value={form.sex} onChange={e => setForm(f => ({ ...f, sex: e.target.value }))}
              options={SEX_OPTIONS} />
            <Input label="Weight (lbs)" type="number" value={form.weight_kg} onChange={e => setForm(f => ({ ...f, weight_kg: e.target.value }))} />
          </div>
          <Input label="Date of Birth" type="date" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Vet Name" value={form.vet_name} onChange={e => setForm(f => ({ ...f, vet_name: e.target.value }))} />
            <Input label="Vet Phone" value={form.vet_phone} onChange={e => setForm(f => ({ ...f, vet_phone: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.spayed_neutered} onChange={e => setForm(f => ({ ...f, spayed_neutered: e.target.checked }))} className="rounded accent-gold" />
            <span className="text-sm text-espresso">Spayed/Neutered</span>
          </label>
          <Textarea
            label="Special instructions"
            rows={3}
            value={form.special_instructions}
            onChange={e => setForm(f => ({ ...f, special_instructions: e.target.value }))}
            placeholder="Allergies, fears, behaviour notes..."
          />
          <p className="text-xs text-taupe">New dogs are pending review by Sophie before their first appointment.</p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setAddModal(false)}>Cancel</Button>
            <Button loading={addDog.isPending} disabled={!form.name} onClick={() => addDog.mutate()}>Add Dog</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
