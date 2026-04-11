import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import AddressAutocomplete, { type AddressFields } from '@/components/ui/AddressAutocomplete';

interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: 'superadmin' | 'admin';
  status: 'active' | 'inactive';
  created_at: string;
  home_address?: string | null;
  home_street?: string | null;
  home_city?: string | null;
  home_province?: string | null;
  home_postal_code?: string | null;
}

const emptyAddress: AddressFields = { street: '', city: '', province: '', postal_code: '' };

function memberToAddress(m: TeamMember): AddressFields {
  return {
    street: m.home_street || '',
    city: m.home_city || '',
    province: m.home_province || '',
    postal_code: m.home_postal_code || '',
  };
}

function formatAddress(m: TeamMember): string {
  if (m.home_street) {
    return [m.home_street, m.home_city, m.home_province, m.home_postal_code].filter(Boolean).join(', ');
  }
  return m.home_address || '';
}

export default function TeamPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isSuperAdmin = user?.role === 'superadmin' || user?.email === 'sophie@thepupperclub.ca';

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newAddress, setNewAddress] = useState<AddressFields>(emptyAddress);
  const [tempPassword, setTempPassword] = useState('');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAddress, setEditAddress] = useState<AddressFields>(emptyAddress);

  const { data: team, isLoading } = useQuery<TeamMember[]>({
    queryKey: ['admin-team'],
    queryFn: () => api.get('/admin/team').then(r => r.data.data),
  });

  const addMember = useMutation({
    mutationFn: () => api.post('/admin/team', {
      name: newName,
      email: newEmail,
      home_street: newAddress.street || null,
      home_city: newAddress.city || null,
      home_province: newAddress.province || null,
      home_postal_code: newAddress.postal_code || null,
    }),
    onSuccess: (res) => {
      setTempPassword(res.data.temp_password);
      setNewName('');
      setNewEmail('');
      setNewAddress(emptyAddress);
      qc.invalidateQueries({ queryKey: ['admin-team'] });
    },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Failed to add team member.'),
  });

  const updateAddress = useMutation({
    mutationFn: ({ id, address }: { id: number; address: AddressFields }) =>
      api.patch(`/admin/team/${id}`, {
        home_street: address.street || null,
        home_city: address.city || null,
        home_province: address.province || null,
        home_postal_code: address.postal_code || null,
      }),
    onSuccess: () => {
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ['admin-team'] });
    },
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch(`/admin/team/${id}`, { status: status === 'active' ? 'inactive' : 'active' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-team'] }),
  });

  const resetPassword = useMutation({
    mutationFn: (id: number) => api.post(`/admin/team/${id}/reset-password`),
    onSuccess: (res) => {
      setTempPassword(res.data.temp_password);
    },
  });

  const removeMember = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/team/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-team'] }),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Team</h1>
        {isSuperAdmin && (
          <Button onClick={() => { setShowAdd(true); setError(''); setTempPassword(''); }}>
            Add Team Member
          </Button>
        )}
      </div>

      {/* Temp password display */}
      {tempPassword && (
        <div className="bg-gold/10 border border-gold/30 rounded-xl px-5 py-4">
          <div className="text-sm font-semibold text-espresso mb-1">Temporary Password</div>
          <div className="font-mono text-lg text-gold select-all">{tempPassword}</div>
          <p className="text-xs text-taupe mt-2">
            Share this with the team member. They should change it after first login.
          </p>
          <button
            onClick={() => setTempPassword('')}
            className="text-xs text-taupe hover:text-espresso underline mt-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Team list */}
      <Card>
        <div className="divide-y divide-cream">
          {(team ?? []).map(member => (
            <div key={member.id} className="py-4 px-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-gold flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-espresso">
                      {member.name}
                      {member.role === 'superadmin' && (
                        <span className="ml-2 text-xs font-normal text-gold">Super Admin</span>
                      )}
                    </div>
                    <div className="text-sm text-taupe">{member.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={member.status === 'active' ? 'success' : 'neutral'}>
                    {member.status}
                  </Badge>
                  {isSuperAdmin && member.role !== 'superadmin' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleStatus.mutate({ id: member.id, status: member.status })}
                        className="text-xs text-taupe hover:text-espresso underline"
                      >
                        {member.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => resetPassword.mutate(member.id)}
                        className="text-xs text-taupe hover:text-espresso underline"
                      >
                        Reset Password
                      </button>
                      <button
                        onClick={() => { if (confirm('Remove this team member?')) removeMember.mutate(member.id); }}
                        className="text-xs text-red-400 hover:text-red-600 underline"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {/* Home address */}
              <div className="ml-14 mt-2">
                {editingId === member.id ? (
                  <div className="space-y-3">
                    <AddressAutocomplete
                      value={editAddress}
                      onChange={setEditAddress}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateAddress.mutate({ id: member.id, address: editAddress })}
                        className="text-xs text-gold hover:text-gold/80 font-medium"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs text-taupe hover:text-espresso"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-taupe">
                      {formatAddress(member) || 'No home address set'}
                    </span>
                    {isSuperAdmin && (
                      <button
                        onClick={() => {
                          setEditingId(member.id);
                          setEditAddress(memberToAddress(member));
                        }}
                        className="text-xs text-gold hover:text-gold/80 underline"
                      >
                        {formatAddress(member) ? 'Edit' : 'Add'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {(team ?? []).length === 0 && (
            <p className="text-center text-taupe py-8">No team members yet.</p>
          )}
        </div>
      </Card>

      {/* Add team member modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Team Member">
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-lg">{error}</div>
          )}
          <Input
            label="Name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Full name"
          />
          <Input
            label="Email"
            type="email"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            placeholder="email@example.com"
          />
          <AddressAutocomplete
            label="Home Address"
            value={newAddress}
            onChange={setNewAddress}
          />
          <p className="text-xs text-taupe">
            Home address is used for automatic mileage calculation. Start typing to search Canadian addresses.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button
              loading={addMember.isPending}
              disabled={!newName || !newEmail}
              onClick={() => { setError(''); addMember.mutate(); }}
            >
              Add Member
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
