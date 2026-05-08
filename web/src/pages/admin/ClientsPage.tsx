import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageLoader } from '@/components/ui/LoadingSpinner';

type SortKey = 'name' | 'dogs' | 'plan' | 'billing_method' | 'next_billing' | 'intake' | 'status';
type SortDir = 'asc' | 'desc';

function SortHeader({ label, sortKey, currentKey, currentDir, onSort }: {
  label: string; sortKey: SortKey; currentKey: SortKey; currentDir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = currentKey === sortKey;
  return (
    <th
      className="px-6 py-4 font-semibold text-espresso cursor-pointer select-none hover:text-gold transition-colors whitespace-nowrap"
      onClick={() => onSort(sortKey)}
    >
      {label}
      <span className="ml-1 text-[10px]">
        {active ? (currentDir === 'asc' ? '▲' : '▼') : '⇅'}
      </span>
    </th>
  );
}

export default function AdminClientsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filter, setFilter] = useState('active');
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Create dropdown
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Quick Create modal
  const [quickModal, setQuickModal] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickEmail, setQuickEmail] = useState('');
  const [quickError, setQuickError] = useState('');
  const [inviteSent, setInviteSent] = useState('');

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

  // Build unique plan list for filter dropdown
  const plans = useMemo(() => {
    const set = new Set<string>();
    (data?.data ?? []).forEach((c: any) => {
      const plan = c.client_profile?.subscription_plan;
      if (plan) set.add(plan);
    });
    return Array.from(set).sort();
  }, [data]);

  // Filter by plan + sort
  const clients = useMemo(() => {
    let list = data?.data ?? [];
    if (planFilter) {
      list = list.filter((c: any) => c.client_profile?.subscription_plan === planFilter);
    }

    const getValue = (c: any, key: SortKey): string => {
      switch (key) {
        case 'name': return (c.name ?? '').toLowerCase();
        case 'dogs': return (c.dogs?.map((d: any) => d.name).join(', ') ?? '').toLowerCase();
        case 'plan': return (c.client_profile?.subscription_plan ?? '').toLowerCase();
        case 'billing_method': return (c.client_profile?.billing_method ?? '').toLowerCase();
        case 'next_billing': return c.client_profile?.next_billing_date ?? '';
        case 'intake': return c.client_profile?.intake_submitted_at ? '1' : '0';
        case 'status': return c.status ?? '';
        default: return '';
      }
    };

    return [...list].sort((a: any, b: any) => {
      const va = getValue(a, sortKey);
      const vb = getValue(b, sortKey);
      const cmp = va.localeCompare(vb);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, planFilter, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const hasFilters = !!(planFilter);

  // Quick Create: create + send invite
  const quickCreate = useMutation({
    mutationFn: (d: { name: string; email: string }) => api.post('/admin/clients/invite', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-clients'] });
      setQuickModal(false);
      setInviteSent(quickEmail);
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

  const billingMethodLabel = (m: string | null) => {
    switch (m) {
      case 'credit_card': return 'Credit Card';
      case 'e_transfer': return 'E-Transfer';
      case 'cash': return 'Cash';
      default: return '—';
    }
  };

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
                <div className="font-semibold text-espresso">Quick Create</div>
                <div className="text-taupe text-xs mt-0.5">Name + email, invite sent immediately</div>
              </button>
              <div className="border-t border-cream" />
              <button
                className="w-full text-left px-4 py-3 hover:bg-cream transition-colors text-sm"
                onClick={() => { setDropdownOpen(false); setIntakeModal(true); }}
              >
                <div className="font-semibold text-espresso">Complete Intake Form</div>
                <div className="text-taupe text-xs mt-0.5">Build full profile, invite when ready</div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex rounded-lg border border-taupe/50 overflow-hidden text-sm">
          {['', 'active', 'pending', 'inactive'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 font-medium transition-colors ${
                filter === f ? 'bg-espresso text-cream' : 'text-espresso hover:bg-cream'
              }`}
            >
              {f === '' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {plans.length > 0 && (
          <select
            value={planFilter}
            onChange={e => setPlanFilter(e.target.value)}
            className="text-sm border border-taupe/50 rounded-lg px-3 py-1.5 bg-white text-espresso focus:ring-1 focus:ring-gold"
          >
            <option value="">All Plans</option>
            {plans.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}

        {hasFilters && (
          <button
            onClick={() => setPlanFilter('')}
            className="text-xs text-taupe hover:text-espresso underline"
          >
            Reset filters
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? <PageLoader /> : (
        <Card padding="none">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cream text-left">
                <SortHeader label="Client" sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Dogs" sortKey="dogs" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Plan" sortKey="plan" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Payment" sortKey="billing_method" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Renewal Date" sortKey="next_billing" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Intake" sortKey="intake" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Status" sortKey="status" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client: any) => {
                const profile = client.client_profile ?? {};
                return (
                  <tr
                    key={client.id}
                    className="border-b border-cream last:border-0 hover:bg-cream/50 cursor-pointer"
                    onClick={() => navigate(`/admin/clients/${client.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-espresso">{client.name}</div>
                      <div className="text-taupe text-xs">{client.email}</div>
                    </td>
                    <td className="px-6 py-4 text-espresso text-sm font-semibold">
                      {client.dogs?.length > 0
                        ? client.dogs.map((d: any) => d.name).join(', ')
                        : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-espresso whitespace-nowrap">
                      {profile.subscription_plan || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-taupe whitespace-nowrap capitalize">
                      {billingMethodLabel(profile.billing_method)}
                    </td>
                    <td className="px-6 py-4 text-sm text-taupe whitespace-nowrap">
                      {profile.next_billing_date
                        ? new Date(profile.next_billing_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-6 py-4">
                      {profile.intake_submitted_at ? (
                        <span className="text-xs text-green-600 font-semibold">Submitted</span>
                      ) : (
                        <button
                          className="text-xs text-blue hover:underline font-medium"
                          onClick={e => { e.stopPropagation(); navigate(`/admin/clients/${client.id}/intake`); }}
                        >
                          Open Form
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={statusBadge(client.status)}>{client.status}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-blue hover:underline text-sm whitespace-nowrap">View →</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {clients.length === 0 && (
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

      {/* Invite sent confirmation */}
      <Modal open={!!inviteSent} onClose={() => setInviteSent('')} title="Invite Sent!">
        <div className="space-y-4 text-center">
          <div className="text-4xl">✉️</div>
          <p className="text-sm text-espresso">
            An invitation has been sent to <strong>{inviteSent}</strong>. They'll receive an email with instructions to set up their account.
          </p>
          <Button onClick={() => setInviteSent('')}>Done</Button>
        </div>
      </Modal>
    </div>
  );
}
