import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageLoader } from '@/components/ui/LoadingSpinner';

export default function AdminClientsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-clients', filter, search],
    queryFn: () => api.get('/admin/clients', { params: { filter, search } }).then(r => r.data),
  });

  const invite = useMutation({
    mutationFn: (data: { name: string; email: string }) =>
      api.post('/admin/clients/invite', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-clients'] });
      setInviteModal(false);
      setInviteName(''); setInviteEmail(''); setInviteError('');
    },
    onError: (e: any) => setInviteError(e.response?.data?.message || 'Could not send invite.'),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Clients</h1>
        <Button onClick={() => setInviteModal(true)}>+ Invite Client</Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Input
          placeholder="Search name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex rounded-lg border border-taupe overflow-hidden text-sm">
          {['', 'active', 'pending', 'inactive'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 font-medium transition-colors ${
                filter === f ? 'bg-espresso text-cream' : 'text-espresso hover:bg-cream'
              }`}
            >
              {f === '' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? <PageLoader /> : (
        <Card padding="none">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cream text-left">
                <th className="px-6 py-4 font-semibold text-espresso">Client</th>
                <th className="px-6 py-4 font-semibold text-espresso">Status</th>
                <th className="px-6 py-4 font-semibold text-espresso">Dogs</th>
                <th className="px-6 py-4 font-semibold text-espresso">Tier</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {data?.data?.map((client: any) => (
                <tr key={client.id} className="border-b border-cream last:border-0 hover:bg-cream/50 cursor-pointer"
                  onClick={() => navigate(`/admin/clients/${client.id}`)}>
                  <td className="px-6 py-4">
                    <div className="font-medium text-espresso">{client.name}</div>
                    <div className="text-taupe text-xs">{client.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={statusBadge(client.status)}>{client.status}</Badge>
                  </td>
                  <td className="px-6 py-4 text-taupe">{client.dogs_count ?? 0}</td>
                  <td className="px-6 py-4 text-taupe text-xs">{client.client_profile?.subscription_tier || '—'}</td>
                  <td className="px-6 py-4">
                    <button className="text-blue hover:underline text-sm">View →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.data?.length === 0 && (
            <div className="text-center py-12 text-taupe">No clients found.</div>
          )}
        </Card>
      )}

      {/* Invite modal */}
      <Modal open={inviteModal} onClose={() => setInviteModal(false)} title="Invite Client">
        <div className="space-y-4">
          <Input
            label="Full name"
            value={inviteName}
            onChange={e => setInviteName(e.target.value)}
            placeholder="Jane Smith"
          />
          <Input
            label="Email address"
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="jane@example.com"
          />
          {inviteError && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{inviteError}</div>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setInviteModal(false)}>Cancel</Button>
            <Button
              loading={invite.isPending}
              onClick={() => invite.mutate({ name: inviteName, email: inviteEmail })}
            >
              Send Invitation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
