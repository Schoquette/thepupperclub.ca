import React, { useState, useRef, useEffect } from 'react';
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

  // Create dropdown
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Quick Create modal
  const [quickModal, setQuickModal] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickEmail, setQuickEmail] = useState('');
  const [quickError, setQuickError] = useState('');

  // Intake flow modal (step 1: name + email)
  const [intakeModal, setIntakeModal] = useState(false);
  const [intakeName, setIntakeName] = useState('');
  const [intakeEmail, setIntakeEmail] = useState('');
  const [intakeError, setIntakeError] = useState('');

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-clients', filter, search],
    queryFn: () => api.get('/admin/clients', { params: { filter, search } }).then(r => r.data),
  });

  // Quick Create: create + send invite
  const quickCreate = useMutation({
    mutationFn: (d: { name: string; email: string }) => api.post('/admin/clients/invite', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-clients'] });
      setQuickModal(false);
      setQuickName(''); setQuickEmail(''); setQuickError('');
    },
    onError: (e: any) => setQuickError(e.response?.data?.message || 'Could not send invite.'),
  });

  // Intake flow: create draft client → navigate to intake form
  const createDraft = useMutation({
    mutationFn: (d: { name: string; email: string }) => api.post('/admin/clients/create-draft', d),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-clients'] });
      setIntakeModal(false);
      setIntakeName(''); setIntakeEmail(''); setIntakeError('');
      navigate(`/admin/clients/${res.data.data.id}/intake`);
    },
    onError: (e: any) => setIntakeError(e.response?.data?.message || 'Could not create client.'),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Clients</h1>

        {/* Create client dropdown */}
        <div className="relative" ref={dropdownRef}>
          <Button onClick={() => setDropdownOpen(v => !v)}>
            + New Client ▾
          </Button>
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-cream z-20 overflow-hidden">
              <button
                className="w-full text-left px-4 py-3 hover:bg-cream transition-colors text-sm"
                onClick={() => { setDropdownOpen(false); setQuickModal(true); }}
              >
                <div className="font-semibold text-espresso">⚡ Quick Create</div>
                <div className="text-taupe text-xs mt-0.5">Name + email, invite sent immediately</div>
              </button>
              <div className="border-t border-cream" />
              <button
                className="w-full text-left px-4 py-3 hover:bg-cream transition-colors text-sm"
                onClick={() => { setDropdownOpen(false); setIntakeModal(true); }}
              >
                <div className="font-semibold text-espresso">📋 Complete Intake Form</div>
                <div className="text-taupe text-xs mt-0.5">Build full profile, invite when ready</div>
              </button>
            </div>
          )}
        </div>
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
                <th className="px-6 py-4 font-semibold text-espresso">Intake</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {data?.data?.map((client: any) => (
                <tr
                  key={client.id}
                  className="border-b border-cream last:border-0 hover:bg-cream/50 cursor-pointer"
                  onClick={() => navigate(`/admin/clients/${client.id}`)}
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-espresso">{client.name}</div>
                    <div className="text-taupe text-xs">{client.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={statusBadge(client.status)}>{client.status}</Badge>
                  </td>
                  <td className="px-6 py-4 text-taupe">{client.dogs_count ?? 0}</td>
                  <td className="px-6 py-4 text-taupe text-xs">
                    {client.client_profile?.subscription_tier || '—'}
                  </td>
                  <td className="px-6 py-4">
                    {client.client_profile?.intake_submitted_at ? (
                      <span className="text-xs text-green-600 font-semibold">✓ Submitted</span>
                    ) : (
                      <button
                        className="text-xs text-blue hover:underline font-medium"
                        onClick={e => { e.stopPropagation(); navigate(`/admin/clients/${client.id}/intake`); }}
                      >
                        Open Form →
                      </button>
                    )}
                  </td>
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

      {/* Quick Create modal */}
      <Modal open={quickModal} onClose={() => setQuickModal(false)} title="Quick Create Client">
        <div className="space-y-4">
          <p className="text-sm text-taupe">Creates the client account and sends an invite email immediately.</p>
          <Input
            label="Full name"
            value={quickName}
            onChange={e => setQuickName(e.target.value)}
            placeholder="Jane Smith"
          />
          <Input
            label="Email address"
            type="email"
            value={quickEmail}
            onChange={e => setQuickEmail(e.target.value)}
            placeholder="jane@example.com"
          />
          {quickError && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{quickError}</div>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setQuickModal(false)}>Cancel</Button>
            <Button
              loading={quickCreate.isPending}
              onClick={() => quickCreate.mutate({ name: quickName, email: quickEmail })}
            >
              Send Invitation
            </Button>
          </div>
        </div>
      </Modal>

      {/* Intake Form modal — step 1: collect name + email */}
      <Modal open={intakeModal} onClose={() => setIntakeModal(false)} title="Complete Intake Form">
        <div className="space-y-4">
          <p className="text-sm text-taupe">
            Creates the client account without sending an invite. You can fill out the full intake form and send the invite whenever you're ready.
          </p>
          <Input
            label="Full name"
            value={intakeName}
            onChange={e => setIntakeName(e.target.value)}
            placeholder="Jane Smith"
          />
          <Input
            label="Email address"
            type="email"
            value={intakeEmail}
            onChange={e => setIntakeEmail(e.target.value)}
            placeholder="jane@example.com"
          />
          {intakeError && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{intakeError}</div>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setIntakeModal(false)}>Cancel</Button>
            <Button
              loading={createDraft.isPending}
              onClick={() => createDraft.mutate({ name: intakeName, email: intakeEmail })}
            >
              Start Intake Form →
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
