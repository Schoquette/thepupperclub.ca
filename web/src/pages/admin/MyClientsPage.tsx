import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/LoadingSpinner';

const DAY_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

const TIME_LABELS: Record<string, string> = {
  early_morning: 'Early Morning (6–9am)', morning: 'Morning (9am–12pm)', midday: 'Midday (12–3pm)',
  afternoon: 'Afternoon (3–6pm)', evening: 'Evening (6–9pm)', all_day: 'All day',
};

export default function MyClientsPage() {
  const navigate = useNavigate();
  const { id: routeId } = useParams<{ id: string }>();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [homeAccess, setHomeAccess] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['my-clients'],
    queryFn: () => api.get('/admin/my/clients', { params: { per_page: 200 } }).then(r => r.data.data ?? []),
  });

  const clients = (data ?? []).filter((c: any) =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const openDetail = (clientId: number) => {
    navigate(`/admin/clients/${clientId}`);
  };

  const closeDetail = () => {
    setSelected(null);
    setHomeAccess(null);
    navigate('/admin/clients');
  };

  // Deep-link support: /admin/clients/:id opens the detail modal directly
  // (e.g. from a calendar event's client/dog name).
  useEffect(() => {
    if (!routeId) { setSelected(null); setHomeAccess(null); return; }
    api.get(`/admin/my/clients/${routeId}`).then(r => setSelected(r.data.data)).catch(() => navigate('/admin/clients'));
    api.get(`/admin/clients/${routeId}/home-access`).then(r => setHomeAccess(r.data.data)).catch(() => setHomeAccess(null));
  }, [routeId]); // eslint-disable-line

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display text-espresso">My Clients</h1>
        <p className="text-sm text-taupe mt-1">Clients you have assigned visits with — read-only. Billing and documents are not shown here.</p>
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
            <Card key={c.id} onClick={() => openDetail(c.id)} className="cursor-pointer hover:shadow-md transition-shadow">
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

      <Modal open={!!selected} onClose={closeDetail} title={selected?.name} size="lg">
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
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([selected.client_profile.address, selected.client_profile.city, selected.client_profile.province, selected.client_profile.postal_code].filter(Boolean).join(', '))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue hover:text-gold transition-colors underline font-medium"
                  >
                    {[selected.client_profile.address, selected.client_profile.city, selected.client_profile.province, selected.client_profile.postal_code].filter(Boolean).join(', ')}
                  </a>
                </div>
              )}
              {selected.client_profile?.emergency_contact_name && (
                <div>
                  <div className="text-taupe">Emergency Contact</div>
                  <div className="text-espresso font-medium">
                    {selected.client_profile.emergency_contact_name}
                    {selected.client_profile.emergency_contact_relationship && ` (${selected.client_profile.emergency_contact_relationship})`}
                    {selected.client_profile.emergency_contact_phone && ` · ${selected.client_profile.emergency_contact_phone}`}
                  </div>
                </div>
              )}
              {selected.client_profile?.secondary_contact_name && (
                <div>
                  <div className="text-taupe">Secondary Contact</div>
                  <div className="text-espresso font-medium">
                    {selected.client_profile.secondary_contact_name}
                    {selected.client_profile.secondary_contact_phone && ` · ${selected.client_profile.secondary_contact_phone}`}
                    {selected.client_profile.secondary_contact_email && ` · ${selected.client_profile.secondary_contact_email}`}
                  </div>
                </div>
              )}
              {(selected.client_profile?.vet_clinic_name || selected.client_profile?.vet_phone) && (
                <div>
                  <div className="text-taupe">Vet Clinic</div>
                  <div className="text-espresso font-medium">
                    {[selected.client_profile.vet_clinic_name, selected.client_profile.vet_phone].filter(Boolean).join(' · ')}
                  </div>
                  {selected.client_profile.vet_address && (
                    <div className="text-taupe text-xs mt-0.5">{selected.client_profile.vet_address}</div>
                  )}
                </div>
              )}
              {selected.client_profile?.food_storage_location && (
                <div>
                  <div className="text-taupe">Food Storage</div>
                  <div className="text-espresso font-medium">{selected.client_profile.food_storage_location}</div>
                </div>
              )}
              {(selected.client_profile?.preferred_walk_days?.length > 0 || selected.client_profile?.preferred_walk_times?.length > 0) && (
                <div className="sm:col-span-2">
                  <div className="text-taupe">Preferred Visit Times</div>
                  <div className="text-espresso font-medium">
                    {(selected.client_profile.preferred_walk_days ?? []).map((d: string) => DAY_LABELS[d] ?? d).join(', ')}
                    {selected.client_profile.preferred_walk_days?.length > 0 && selected.client_profile.preferred_walk_times?.length > 0 && ' — '}
                    {(selected.client_profile.preferred_walk_times ?? []).map((t: string) => TIME_LABELS[t] ?? t).join(', ')}
                  </div>
                </div>
              )}
            </div>

            {(selected.client_profile?.what_great_care_looks_like || selected.client_profile?.biggest_concern || selected.client_profile?.comfort_factors || selected.client_profile?.customized_care_options || selected.client_profile?.additional_notes) && (
              <div>
                <h3 className="text-sm font-semibold text-espresso mb-2">Care Preferences</h3>
                <div className="space-y-2 text-sm">
                  {selected.client_profile.what_great_care_looks_like && (
                    <p><span className="text-taupe">What great care looks like: </span>{selected.client_profile.what_great_care_looks_like}</p>
                  )}
                  {selected.client_profile.biggest_concern && (
                    <p><span className="text-taupe">Biggest concern: </span>{selected.client_profile.biggest_concern}</p>
                  )}
                  {selected.client_profile.comfort_factors && (
                    <p><span className="text-taupe">Comfort factors: </span>{selected.client_profile.comfort_factors}</p>
                  )}
                  {selected.client_profile.customized_care_options && (
                    <p><span className="text-taupe">Customized care: </span>{selected.client_profile.customized_care_options}</p>
                  )}
                  {selected.client_profile.additional_notes && (
                    <p className="bg-cream rounded-lg p-3">{selected.client_profile.additional_notes}</p>
                  )}
                </div>
              </div>
            )}

            {/* Home Access -- needed to actually get into the property */}
            {homeAccess && (homeAccess.entry_instructions || homeAccess.lockbox_code || homeAccess.door_code || homeAccess.alarm_code || homeAccess.key_location || homeAccess.parking_instructions || homeAccess.notes) && (
              <div>
                <h3 className="text-sm font-semibold text-espresso mb-2">Home Access</h3>
                <div className="bg-gold/5 border border-gold/20 rounded-lg p-4 space-y-2 text-sm">
                  {[
                    ['Entry Instructions', homeAccess.entry_instructions],
                    ['Lockbox Code', homeAccess.lockbox_code],
                    ['Door Code', homeAccess.door_code],
                    ['Alarm Code', homeAccess.alarm_code],
                    ['Key Location', homeAccess.key_location],
                    ['Parking Instructions', homeAccess.parking_instructions],
                    ['Notes', homeAccess.notes],
                  ].filter(([, val]) => !!val).map(([label, val]) => (
                    <div key={label as string}>
                      <span className="text-taupe">{label}: </span>
                      <span className="text-espresso font-medium">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
