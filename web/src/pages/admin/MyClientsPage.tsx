import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/LoadingSpinner';

export default function MyClientsPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['my-clients'],
    queryFn: () => api.get('/admin/my/clients', { params: { per_page: 200 } }).then(r => r.data.data ?? []),
  });

  const clients = (data ?? []).filter((c: any) =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const openDetail = (client: any) => {
    api.get(`/admin/my/clients/${client.id}`).then(r => setSelected(r.data.data));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display text-espresso">My Clients</h1>
        <p className="text-sm text-taupe mt-1">Clients you have assigned visits with — read-only.</p>
      </div>

      <Input
        placeholder="Search clients..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {isLoading ? <PageLoader /> : clients.length === 0 ? (
        <Card><p className="text-taupe text-sm">No assigned clients yet.</p></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c: any) => (
            <Card key={c.id} onClick={() => openDetail(c)} className="cursor-pointer hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-espresso">{c.name}</div>
                  <div className="text-sm text-taupe">{c.email}</div>
                </div>
                <Badge variant={statusBadge(c.status)}>{c.status}</Badge>
              </div>
              {c.dogs?.length > 0 && (
                <div className="mt-3 text-sm text-gold">
                  🐕 {c.dogs.map((d: any) => d.name).join(', ')}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name} size="lg">
        {selected && (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-taupe">Email</div>
                <div className="text-espresso font-medium">{selected.email}</div>
              </div>
              {selected.client_profile?.phone && (
                <div>
                  <div className="text-taupe">Phone</div>
                  <div className="text-espresso font-medium">{selected.client_profile.phone}</div>
                </div>
              )}
              {selected.client_profile?.address && (
                <div className="sm:col-span-2">
                  <div className="text-taupe">Address</div>
                  <div className="text-espresso font-medium">
                    {[selected.client_profile.address, selected.client_profile.city, selected.client_profile.province, selected.client_profile.postal_code].filter(Boolean).join(', ')}
                  </div>
                </div>
              )}
              {selected.client_profile?.emergency_contact_name && (
                <div>
                  <div className="text-taupe">Emergency Contact</div>
                  <div className="text-espresso font-medium">
                    {selected.client_profile.emergency_contact_name}
                    {selected.client_profile.emergency_contact_phone && ` · ${selected.client_profile.emergency_contact_phone}`}
                  </div>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-espresso mb-3">Dogs</h3>
              {(!selected.dogs || selected.dogs.length === 0) ? (
                <p className="text-sm text-taupe">No dogs on file.</p>
              ) : (
                <div className="space-y-4">
                  {selected.dogs.map((d: any) => (
                    <div key={d.id} className="border border-cream rounded-lg p-4 text-sm space-y-2">
                      <div className="font-semibold text-espresso">{d.name}</div>
                      <div className="text-taupe">
                        {[d.breed, d.size, d.sex].filter(Boolean).join(' · ')}
                      </div>
                      {d.bite_history && (
                        <div className="text-red-600">
                          ⚠ Bite history{d.bite_history_notes ? `: ${d.bite_history_notes}` : ''}
                        </div>
                      )}
                      {d.aggression_notes && (
                        <div className="text-red-600">⚠ {d.aggression_notes}</div>
                      )}
                      {d.medications?.length > 0 && (
                        <div>
                          <span className="text-taupe">Medications: </span>
                          {d.medications.map((m: any) => `${m.name} (${m.dosage}, ${m.frequency})`).join('; ')}
                        </div>
                      )}
                      {d.special_instructions && (
                        <div>
                          <span className="text-taupe">Care notes: </span>{d.special_instructions}
                        </div>
                      )}
                      {(d.vet_name || d.vet_phone) && (
                        <div className="text-taupe">
                          Vet: {[d.vet_name, d.vet_phone].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
