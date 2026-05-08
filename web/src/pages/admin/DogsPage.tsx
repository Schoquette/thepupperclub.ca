import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { PageLoader } from '@/components/ui/LoadingSpinner';

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
    return <img src={url} alt="Dog" className="h-10 w-10 rounded-full object-cover flex-shrink-0" />;
  }
  return <div className="h-10 w-10 rounded-full bg-cream flex items-center justify-center text-lg flex-shrink-0">🐕</div>;
}

function DogTags({ dog }: { dog: any }) {
  return (
    <div className="flex flex-wrap gap-1">
      {!dog.is_active && <Badge variant="red">Pending Review</Badge>}
      {dog.is_archived && <Badge variant="gray">Archived</Badge>}
      {dog.bite_history && <Badge variant="red">Bite History</Badge>}
      {dog.has_expired_vaccinations && <Badge variant="gold">Vaccines Expiring</Badge>}
      {dog.off_leash_approved && <Badge variant="green">Off-Leash Approved</Badge>}
      {dog.buddy_walks_ok && <Badge variant="green">Buddy Walks OK</Badge>}
      {dog.media_consent && <Badge variant="blue">Media Consent</Badge>}
    </div>
  );
}

type StatusFilter = 'all' | 'active' | 'archived';

export default function AdminDogsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [clientFilter, setClientFilter] = useState('');
  const [breedFilter, setBreedFilter] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: clientsData } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => api.get('/admin/clients').then(r => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-dogs', debouncedSearch, statusFilter, clientFilter, breedFilter],
    queryFn: () => api.get('/admin/dogs', {
      params: {
        search: debouncedSearch || undefined,
        user_id: clientFilter || undefined,
        breed: breedFilter || undefined,
        ...(statusFilter === 'active' ? { active: '1' } : {}),
        ...(statusFilter === 'archived' ? { archived: '1' } : {}),
      },
    }).then(r => r.data),
  });

  const dogs = data?.data ?? [];

  // Build unique breed list from current results for dropdown
  const breeds = useMemo(() => {
    const set = new Set<string>();
    dogs.forEach((d: any) => { if (d.breed) set.add(d.breed); });
    return Array.from(set).sort();
  }, [dogs]);

  const hasFilters = !!(clientFilter || breedFilter || statusFilter !== 'active');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Dogs</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search dog, breed, or client..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />

        {/* Status tabs */}
        <div className="flex rounded-lg border border-taupe/50 overflow-hidden text-sm w-fit">
          {([['all', 'All'], ['active', 'Active'], ['archived', 'Archived']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setStatusFilter(val)}
              className={`px-3 py-1.5 font-medium transition-colors ${
                statusFilter === val ? 'bg-espresso text-cream' : 'text-espresso hover:bg-cream'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Client dropdown */}
        <select
          value={clientFilter}
          onChange={e => setClientFilter(e.target.value)}
          className="text-sm border border-taupe/50 rounded-lg px-3 py-1.5 bg-white text-espresso focus:ring-1 focus:ring-gold"
        >
          <option value="">All Clients</option>
          {clientsData?.map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Breed dropdown */}
        {breeds.length > 1 && (
          <select
            value={breedFilter}
            onChange={e => setBreedFilter(e.target.value)}
            className="text-sm border border-taupe/50 rounded-lg px-3 py-1.5 bg-white text-espresso focus:ring-1 focus:ring-gold"
          >
            <option value="">All Breeds</option>
            {breeds.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        )}

        {hasFilters && (
          <button
            onClick={() => { setClientFilter(''); setBreedFilter(''); setStatusFilter('active'); }}
            className="text-xs text-taupe hover:text-espresso underline"
          >
            Reset filters
          </button>
        )}
      </div>

      {isLoading ? <PageLoader /> : (
        <>
          {/* Desktop table */}
          <Card padding="none" className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cream text-left">
                    <th className="px-6 py-4 font-semibold text-espresso">Dog</th>
                    <th className="px-6 py-4 font-semibold text-espresso">Breed</th>
                    <th className="px-6 py-4 font-semibold text-espresso">Client</th>
                    <th className="px-6 py-4 font-semibold text-espresso">Status</th>
                    <th className="px-6 py-4 font-semibold text-espresso">Tags</th>
                    <th className="px-6 py-4 font-semibold text-espresso">Medications</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {dogs.map((dog: any) => (
                    <tr key={dog.id} className="border-b border-cream last:border-0 hover:bg-cream/50">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <DogPhoto dogId={dog.id} hasPhoto={!!dog.photo_path} />
                          <div className="font-medium text-espresso">{dog.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-taupe">{dog.breed || '—'}</td>
                      <td className="px-6 py-3">
                        <Link
                          to={`/admin/clients/${dog.user_id}`}
                          className="text-espresso font-medium hover:underline"
                          onClick={e => e.stopPropagation()}
                        >
                          {dog.user?.name ?? '—'}
                        </Link>
                      </td>
                      <td className="px-6 py-3">
                        {dog.is_archived ? (
                          <Badge variant="gray">Archived</Badge>
                        ) : dog.is_active ? (
                          <Badge variant="green">Active</Badge>
                        ) : (
                          <Badge variant="gold">Pending</Badge>
                        )}
                      </td>
                      <td className="px-6 py-3"><DogTags dog={dog} /></td>
                      <td className="px-6 py-3 text-xs text-taupe">
                        {dog.medications?.length > 0
                          ? dog.medications.map((m: any) => m.name).join(', ')
                          : '—'}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <Link
                            to={`/admin/clients/${dog.user_id}?tab=dogs`}
                            className="text-blue hover:underline text-sm whitespace-nowrap"
                            onClick={e => e.stopPropagation()}
                          >
                            View Dog →
                          </Link>
                          <Link
                            to={`/admin/clients/${dog.user_id}`}
                            className="text-taupe hover:text-espresso hover:underline text-sm whitespace-nowrap"
                            onClick={e => e.stopPropagation()}
                          >
                            View Client →
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {dogs.length === 0 && (
              <div className="text-center py-12 text-taupe">No dogs found.</div>
            )}
          </Card>

          {/* Mobile card list */}
          <div className="md:hidden space-y-3">
            {dogs.map((dog: any) => (
              <Card key={dog.id}>
                <div className="flex items-center gap-3 mb-2">
                  <DogPhoto dogId={dog.id} hasPhoto={!!dog.photo_path} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-espresso">{dog.name}</span>
                      {dog.is_archived ? (
                        <Badge variant="gray">Archived</Badge>
                      ) : dog.is_active ? (
                        <Badge variant="green">Active</Badge>
                      ) : (
                        <Badge variant="gold">Pending</Badge>
                      )}
                    </div>
                    <div className="text-xs text-taupe">{dog.breed || '—'}</div>
                  </div>
                  <div className="text-right text-xs">
                    <Link to={`/admin/clients/${dog.user_id}`} className="text-espresso font-medium hover:underline">
                      {dog.user?.name ?? '—'}
                    </Link>
                  </div>
                </div>
                <DogTags dog={dog} />
                {dog.medications?.length > 0 && (
                  <p className="text-xs text-taupe mt-2">💊 {dog.medications.map((m: any) => m.name).join(', ')}</p>
                )}
                <div className="flex gap-3 mt-2 pt-2 border-t border-cream">
                  <Link to={`/admin/clients/${dog.user_id}?tab=dogs`} className="text-blue hover:underline text-xs">
                    View Dog →
                  </Link>
                  <Link to={`/admin/clients/${dog.user_id}`} className="text-taupe hover:underline text-xs">
                    View Client →
                  </Link>
                </div>
              </Card>
            ))}
            {dogs.length === 0 && (
              <div className="text-center py-12 text-taupe">No dogs found.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
