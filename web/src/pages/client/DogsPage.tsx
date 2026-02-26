import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageLoader } from '@/components/ui/LoadingSpinner';

const SIZE_OPTIONS = [
  { value: '', label: 'Select size...' },
  { value: 'small', label: 'Small (under 10 kg)' },
  { value: 'medium', label: 'Medium (10–25 kg)' },
  { value: 'large', label: 'Large (25–40 kg)' },
  { value: 'extra_large', label: 'Extra Large (40+ kg)' },
];

export default function ClientDogsPage() {
  const qc = useQueryClient();
  const [addModal, setAddModal] = useState(false);
  const [form, setForm] = useState({
    name: '', breed: '', size: '', sex: '',
    date_of_birth: '', weight_kg: '',
    spayed_neutered: false, special_instructions: '',
    vet_name: '', vet_phone: '',
  });

  const { data: dogs, isLoading } = useQuery({
    queryKey: ['client-dogs'],
    queryFn: () => api.get('/client/dogs').then(r => r.data.data),
  });

  const addDog = useMutation({
    mutationFn: () => api.post('/client/dogs', { ...form, weight_kg: form.weight_kg ? Number(form.weight_kg) : null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-dogs'] });
      setAddModal(false);
      setForm({ name: '', breed: '', size: '', sex: '', date_of_birth: '', weight_kg: '', spayed_neutered: false, special_instructions: '', vet_name: '', vet_phone: '' });
    },
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl text-espresso">My Dogs</h1>
        <Button size="sm" onClick={() => setAddModal(true)}>+ Add Dog</Button>
      </div>

      {dogs?.length === 0 && (
        <Card>
          <div className="text-center py-8">
            <div className="text-4xl mb-2">🐕</div>
            <p className="text-taupe text-sm">No dogs added yet.</p>
            <Button size="sm" className="mt-4" onClick={() => setAddModal(true)}>Add Your First Dog</Button>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {dogs?.map((dog: any) => (
          <Card key={dog.id}>
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-full bg-cream flex items-center justify-center text-3xl flex-shrink-0">🐕</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-espresso">{dog.name}</span>
                  {!dog.is_active && <Badge variant="gold">Pending Review</Badge>}
                  {dog.bite_history && <Badge variant="red">⚠️ Bite History</Badge>}
                </div>
                <div className="text-sm text-taupe mt-0.5">
                  {[dog.breed, dog.size, dog.sex].filter(Boolean).join(' · ')}
                </div>
                {dog.special_instructions && (
                  <p className="text-xs text-taupe mt-2 bg-cream rounded-lg p-2">{dog.special_instructions}</p>
                )}
                {dog.medications?.length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs font-semibold text-espresso">Medications: </span>
                    <span className="text-xs text-taupe">{dog.medications.map((m: any) => m.name).join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Add Dog Modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add a Dog" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input label="Breed" value={form.breed} onChange={e => setForm(f => ({ ...f, breed: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Select label="Size" value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))} options={SIZE_OPTIONS} />
            <Select label="Sex" value={form.sex} onChange={e => setForm(f => ({ ...f, sex: e.target.value }))}
              options={[{ value: '', label: 'Select...' }, { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
            <Input label="Weight (kg)" type="number" value={form.weight_kg} onChange={e => setForm(f => ({ ...f, weight_kg: e.target.value }))} />
          </div>
          <Input label="Date of Birth" type="date" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
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
