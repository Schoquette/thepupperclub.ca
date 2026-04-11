import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
      {dog.bite_history && <Badge variant="red">Bite History</Badge>}
      {dog.has_expired_vaccinations && <Badge variant="gold">Vaccines Expiring</Badge>}
      {dog.off_leash_approved && <Badge variant="green">Off-Leash Approved</Badge>}
      {dog.buddy_walks_ok && <Badge variant="green">Buddy Walks OK</Badge>}
      {dog.media_consent && <Badge variant="blue">Media Consent</Badge>}
    </div>
  );
}

export default function AdminDogsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-dogs', debouncedSearch],
    queryFn: () => api.get('/admin/dogs', { params: { search: debouncedSearch || undefined } }).then(r => r.data),
  });

  const dogs = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Dogs</h1>
      </div>

      <Input
        placeholder="Search by dog name..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="max-w-xs"
      />

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
                    <th className="px-6 py-4 font-semibold text-espresso">Tags</th>
                    <th className="px-6 py-4 font-semibold text-espresso">Medications</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {dogs.map((dog: any) => (
                    <tr
                      key={dog.id}
                      className="border-b border-cream last:border-0 hover:bg-cream/50 cursor-pointer"
                      onClick={() => navigate(`/admin/clients/${dog.user_id}`)}
                    >
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <DogPhoto dogId={dog.id} hasPhoto={!!dog.photo_path} />
                          <div className="font-medium text-espresso">{dog.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-taupe">{dog.breed || '—'}</td>
                      <td className="px-6 py-3">
                        <div className="text-espresso font-medium">{dog.user?.name ?? '—'}</div>
                      </td>
                      <td className="px-6 py-3"><DogTags dog={dog} /></td>
                      <td className="px-6 py-3 text-xs text-taupe">
                        {dog.medications?.length > 0
                          ? dog.medications.map((m: any) => m.name).join(', ')
                          : '—'}
                      </td>
                      <td className="px-6 py-3">
                        <button className="text-blue hover:underline text-sm">View Client →</button>
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
              <Card
                key={dog.id}
                className="cursor-pointer active:bg-cream/50"
                onClick={() => navigate(`/admin/clients/${dog.user_id}`)}
              >
                <div className="flex items-center gap-3 mb-2">
                  <DogPhoto dogId={dog.id} hasPhoto={!!dog.photo_path} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-espresso">{dog.name}</div>
                    <div className="text-xs text-taupe">{dog.breed || '—'}</div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="text-espresso font-medium">{dog.user?.name ?? '—'}</div>
                  </div>
                </div>
                <DogTags dog={dog} />
                {dog.medications?.length > 0 && (
                  <p className="text-xs text-taupe mt-2">💊 {dog.medications.map((m: any) => m.name).join(', ')}</p>
                )}
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
