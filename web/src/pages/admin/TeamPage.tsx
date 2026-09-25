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
  email: string | null;
  role: 'superadmin' | 'admin';
  status: 'active' | 'inactive';
  color?: string | null;
  created_at: string;
  home_address?: string | null;
  home_street?: string | null;
  home_city?: string | null;
  home_province?: string | null;
  home_postal_code?: string | null;
}

// Preset swatches for calendar colour-coding by team member.
const COLOR_PRESETS = [
  { value: '#6492D8', label: 'Blue' },
  { value: '#9B6BD6', label: 'Purple' },
  { value: '#4FA37D', label: 'Green' },
  { value: '#D97757', label: 'Orange' },
  { value: '#D65C7A', label: 'Pink' },
  { value: '#5CB8B2', label: 'Teal' },
];

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
  const [newColor, setNewColor] = useState<string>(COLOR_PRESETS[0].value);
  const [newAddress, setNewAddress] = useState<AddressFields>(emptyAddress);
  const [tempPassword, setTempPassword] = useState('');
  const [addSuccessMsg, setAddSuccessMsg] = useState('');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAddress, setEditAddress] = useState<AddressFields>(emptyAddress);
  const [teamSuccess, setTeamSuccess] = useState('');

  const { data: team, isLoading } = useQuery<TeamMember[]>({
    queryKey: ['admin-team'],
    queryFn: () => api.get('/admin/team').then(r => r.data.data),
  });

  const addMember = useMutation({
    mutationFn: () => api.post('/admin/team', {
      name: newName,
      email: newEmail || null,
      color: newColor || null,
      home_street: newAddress.street || null,
      home_city: newAddress.city || null,
      home_province: newAddress.province || null,
      home_postal_code: newAddress.postal_code || null,
    }),
    onSuccess: (res) => {
      setTempPassword(res.data.temp_password || '');
      setAddSuccessMsg(res.data.message || '');
      setNewName('');
      setNewEmail('');
      setNewColor(COLOR_PRESETS[0].value);
      setNewAddress(emptyAddress);
      qc.invalidateQueries({ queryKey: ['admin-team'] });
    },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Failed to add team member.'),
  });

  const [addressError, setAddressError] = useState('');

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
      setAddressError('');
      qc.invalidateQueries({ queryKey: ['admin-team'] });
      setTeamSuccess('Address saved!'); setTimeout(() => setTeamSuccess(''), 2500);
    },
    onError: (e: any) => setAddressError(e.response?.data?.message ?? 'Failed to save address.'),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch(`/admin/team/${id}`, { status: status === 'active' ? 'inactive' : 'active' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-team'] }); setTeamSuccess('Status updated!'); setTimeout(() => setTeamSuccess(''), 2500); },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Failed to update status.'),
  });

  const [colorPickerId, setColorPickerId] = useState<number | null>(null);
  const updateColor = useMutation({
    mutationFn: ({ id, color }: { id: number; color: string }) =>
      api.patch(`/admin/team/${id}`, { color }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-team'] });
      setColorPickerId(null);
      setTeamSuccess('Calendar colour updated!'); setTimeout(() => setTeamSuccess(''), 2500);
    },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Failed to update colour.'),
  });

  const resetPassword = useMutation({
    mutationFn: (id: number) => api.post(`/admin/team/${id}/reset-password`),
    onSuccess: (res) => {
      setTempPassword(res.data.temp_password);
    },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Failed to reset password.'),
  });

  const removeMember = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/team/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-team'] }); setTeamSuccess('Team member removed.'); setTimeout(() => setTeamSuccess(''), 2500); },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Failed to remove team member.'),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Team</h1>
        {isSuperAdmin && (
          <Button onClick={() => { setShowAdd(true); setError(''); setTempPassword(''); setAddSuccessMsg(''); }}>
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
            onClick={() => { setTempPassword(''); setAddSuccessMsg(''); }}
            className="text-xs text-taupe hover:text-espresso underline mt-2"
          >
            Dismiss
          </button>
        </div>
      )}
      {!tempPassword && addSuccessMsg && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-700 font-medium flex items-center justify-between">
          {addSuccessMsg}
          <button onClick={() => setAddSuccessMsg('')} className="text-green-600 hover:text-green-800 ml-3">&times;</button>
        </div>
      )}

      {teamSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-700 font-medium">{teamSuccess}</div>
      )}
      {error && !showAdd && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Team list */}
      <Card>
        <div className="divide-y divide-cream">
          {(team ?? []).map(member => (
            <div key={member.id} className="py-4 px-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ backgroundColor: member.color || '#C9A24D' }}
                  >
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-espresso">
                      {member.name}
                      {member.role === 'superadmin' && (
                        <span className="ml-2 text-xs font-normal text-gold">Super Admin</span>
                      )}
                    </div>
                    <div className="text-sm text-taupe">
                      {member.email || <span className="italic text-taupe/70">No login access yet</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={member.status === 'active' ? 'success' : 'neutral'}>
                    {member.status}
                  </Badge>
                  {isSuperAdmin && member.role !== 'superadmin' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setColorPickerId(colorPickerId === member.id ? null : member.id)}
                        className="text-xs text-taupe hover:text-espresso underline"
                      >
                        Colour
                      </button>
                      <button
                        onClick={() => toggleStatus.mutate({ id: member.id, status: member.status })}
                        disabled={toggleStatus.isPending}
                        className="text-xs text-taupe hover:text-espresso underline disabled:opacity-50"
                      >
                        {toggleStatus.isPending ? 'Updating...' : member.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => resetPassword.mutate(member.id)}
                        disabled={resetPassword.isPending}
                        className="text-xs text-taupe hover:text-espresso underline disabled:opacity-50"
                      >
                        {resetPassword.isPending ? 'Resetting...' : 'Reset Password'}
                      </button>
                      <button
                        onClick={() => { if (confirm('Remove this team member?')) removeMember.mutate(member.id); }}
                        disabled={removeMember.isPending}
                        className="text-xs text-red-400 hover:text-red-600 underline disabled:opacity-50"
                      >
                        {removeMember.isPending ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {/* Calendar colour picker */}
              {colorPickerId === member.id && (
                <div className="ml-14 mt-2 flex items-center gap-2">
                  {COLOR_PRESETS.map(preset => (
                    <button
                      key={preset.value}
                      title={preset.label}
                      onClick={() => updateColor.mutate({ id: member.id, color: preset.value })}
                      disabled={updateColor.isPending}
                      className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                        member.color === preset.value ? 'border-espresso' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: preset.value }}
                    />
                  ))}
                  <button
                    onClick={() => setColorPickerId(null)}
                    className="text-xs text-taupe hover:text-espresso ml-1"
                  >
                    Done
                  </button>
                </div>
              )}
              {/* Home address */}
              <div className="ml-14 mt-2">
                {editingId === member.id ? (
                  <div className="space-y-3">
                    <AddressAutocomplete
                      value={editAddress}
                      onChange={setEditAddress}
                    />
                    {addressError && (
                      <div className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{addressError}</div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setAddressError(''); updateAddress.mutate({ id: member.id, address: editAddress }); }}
                        className="text-xs text-gold hover:text-gold/80 font-medium"
                      >
                        {updateAddress.isPending ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setAddressError(''); }}
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
          <p className="text-xs text-taupe -mt-2">
            Leave blank to add them without portal login access — they'll still appear in the assignment dropdown and calendar. You can add an email and send an invite later.
          </p>
          <div>
            <label className="label mb-1.5 block">Calendar Colour</label>
            <div className="flex items-center gap-2">
              {COLOR_PRESETS.map(preset => (
                <button
                  key={preset.value}
                  type="button"
                  title={preset.label}
                  onClick={() => setNewColor(preset.value)}
                  className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                    newColor === preset.value ? 'border-espresso' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: preset.value }}
                />
              ))}
            </div>
          </div>
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
              disabled={!newName}
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
