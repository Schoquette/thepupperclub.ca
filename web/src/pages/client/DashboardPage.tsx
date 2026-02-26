import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { format } from 'date-fns';

const TIME_BLOCK_LABELS = {
  early_morning: '7–10 AM', morning: '9–12 PM', midday: '11 AM–2 PM',
  afternoon: '2–5 PM', evening: '5–8 PM',
};

export default function ClientDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: appointments } = useQuery({
    queryKey: ['client-appointments-upcoming'],
    queryFn: () => api.get('/client/appointments', { params: { upcoming: 1 } }).then(r => r.data.data),
  });

  const { data: invoices } = useQuery({
    queryKey: ['client-invoices'],
    queryFn: () => api.get('/client/invoices').then(r => r.data.data),
  });

  const upcoming = appointments?.slice(0, 3) ?? [];
  const unpaidInvoices = invoices?.filter((i: any) => ['sent', 'overdue'].includes(i.status)) ?? [];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="font-display text-2xl text-espresso">Welcome back!</h1>
        <p className="text-taupe mt-0.5">Here's what's coming up for your pup.</p>
      </div>

      {/* Unpaid invoices banner */}
      {unpaidInvoices.length > 0 && (
        <div
          className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between cursor-pointer"
          onClick={() => navigate('/client/invoices')}
        >
          <div>
            <div className="font-semibold text-red-700 text-sm">Outstanding Invoice{unpaidInvoices.length > 1 ? 's' : ''}</div>
            <div className="text-xs text-red-500 mt-0.5">
              {unpaidInvoices.length} invoice{unpaidInvoices.length > 1 ? 's' : ''} · ${unpaidInvoices.reduce((s: number, i: any) => s + Number(i.total), 0).toFixed(2)} total
            </div>
          </div>
          <span className="text-red-600 text-sm font-medium">Pay Now →</span>
        </div>
      )}

      {/* Upcoming walks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg text-espresso">Upcoming Walks</h2>
          <button onClick={() => navigate('/client/appointments')} className="text-sm text-blue hover:underline">
            See all
          </button>
        </div>
        {upcoming.length === 0 ? (
          <Card>
            <div className="text-center py-6 text-taupe">
              <div className="text-3xl mb-2">🐕</div>
              <p className="text-sm">No upcoming walks scheduled.</p>
              <Button size="sm" className="mt-4" onClick={() => navigate('/client/appointments')}>
                Book a Walk
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcoming.map((appt: any) => (
              <Card key={appt.id} padding="sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-espresso text-sm">
                      {appt.service_type?.replace(/_/g, ' ')}
                    </div>
                    <div className="text-xs text-taupe mt-0.5">
                      {appt.client_time_block in TIME_BLOCK_LABELS
                        ? TIME_BLOCK_LABELS[appt.client_time_block as keyof typeof TIME_BLOCK_LABELS]
                        : appt.client_time_block}
                    </div>
                  </div>
                  <Badge variant={statusBadge(appt.status)}>{appt.status}</Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Card padding="sm" className="cursor-pointer hover:shadow-lg transition-shadow" >
          <button className="w-full text-left" onClick={() => navigate('/client/messages')}>
            <div className="text-2xl mb-1">💬</div>
            <div className="font-semibold text-sm text-espresso">Messages</div>
            <div className="text-xs text-taupe">Chat with Sophie</div>
          </button>
        </Card>
        <Card padding="sm" className="cursor-pointer hover:shadow-lg transition-shadow">
          <button className="w-full text-left" onClick={() => navigate('/client/appointments')}>
            <div className="text-2xl mb-1">📅</div>
            <div className="font-semibold text-sm text-espresso">Book a Walk</div>
            <div className="text-xs text-taupe">Request a service</div>
          </button>
        </Card>
      </div>
    </div>
  );
}
