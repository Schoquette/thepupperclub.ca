import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { format } from 'date-fns';
import { MessageCircle, Calendar, Smartphone, X } from 'lucide-react';
import { PawIcon } from '@/components/ui/PawIcon';
import { useAuth } from '@/contexts/AuthContext';

const TIME_BLOCK_LABELS: Record<string, string> = {
  early_morning: '6–9 AM', morning: '9 AM–12 PM', midday: '12–3 PM',
  afternoon: '3–6 PM', evening: '6–9 PM',
};

export default function ClientDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [phoneBannerDismissed, setPhoneBannerDismissed] = useState(
    () => localStorage.getItem('pupper-phone-banner-dismissed') === '1'
  );

  const dismissPhoneBanner = () => {
    localStorage.setItem('pupper-phone-banner-dismissed', '1');
    setPhoneBannerDismissed(true);
  };

  const { data: profile } = useQuery({
    queryKey: ['client-profile'],
    queryFn: () => api.get('/client/profile').then(r => r.data.data),
  });

  const cp = profile?.client_profile ?? user?.client_profile;
  const isFirstTime = !cp?.profile_confirmed_at;

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
        <h1 className="font-display text-2xl text-espresso">
          {isFirstTime ? 'Welcome to The Pupper Club!' : 'Welcome back!'}
        </h1>
        <p className="text-taupe mt-0.5">
          {isFirstTime ? 'Let\'s get your profile set up.' : 'Here\'s what\'s coming up for your pup.'}
        </p>
      </div>

      {/* Add to Home Screen banner */}
      {!phoneBannerDismissed && (
        <div className="relative bg-gradient-to-r from-gold/10 to-cream border border-gold/20 rounded-xl p-4">
          <button
            onClick={dismissPhoneBanner}
            className="absolute top-3 right-3 text-taupe hover:text-espresso"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-start gap-3">
            <Smartphone className="w-6 h-6 text-gold flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-espresso text-sm">Get The Pupper Club on Your Phone</div>
              <p className="text-xs text-taupe mt-1 mb-2">
                Add a shortcut to your home screen for quick access — it works just like an app!
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-espresso">
                <div className="bg-white/60 rounded-lg p-2.5">
                  <div className="font-semibold mb-1">iPhone (Safari)</div>
                  <ol className="list-decimal list-inside space-y-0.5 text-taupe">
                    <li>Tap the <strong className="text-espresso">Share</strong> button (square with arrow) at the bottom</li>
                    <li>Scroll down and tap <strong className="text-espresso">Add to Home Screen</strong></li>
                  </ol>
                </div>
                <div className="bg-white/60 rounded-lg p-2.5">
                  <div className="font-semibold mb-1">iPhone (Chrome)</div>
                  <ol className="list-decimal list-inside space-y-0.5 text-taupe">
                    <li>Tap the <strong className="text-espresso">Share</strong> icon beside the URL bar</li>
                    <li>Tap <strong className="text-espresso">Add to Home Screen</strong></li>
                  </ol>
                </div>
                <div className="bg-white/60 rounded-lg p-2.5">
                  <div className="font-semibold mb-1">Android (Chrome)</div>
                  <ol className="list-decimal list-inside space-y-0.5 text-taupe">
                    <li>Tap the <strong className="text-espresso">three-dot menu</strong> (top right)</li>
                    <li>Tap <strong className="text-espresso">Add to Home screen</strong></li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* First-time setup prompt */}
      {isFirstTime && (
        <Card>
          <div className="flex items-center justify-between p-1">
            <div>
              <div className="font-semibold text-espresso text-sm">
                {cp?.intake_submitted_at ? 'Review Your Profile' : 'Complete Your Intake Form'}
              </div>
              <div className="text-xs text-taupe mt-0.5">
                {cp?.intake_submitted_at
                  ? 'Sophie has filled out your profile. Please review it for accuracy and confirm.'
                  : 'Fill out your intake form so we can provide the best care for your pup.'}
              </div>
            </div>
            <Button size="sm" onClick={() => navigate(cp?.intake_submitted_at ? '/client/profile' : '/client/intake')}>
              {cp?.intake_submitted_at ? 'Review Profile' : 'Get Started'}
            </Button>
          </div>
        </Card>
      )}

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

      {/* Upcoming visits — only show after profile is set up */}
      {!isFirstTime && <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg text-espresso">Upcoming Visits</h2>
          <button onClick={() => navigate('/client/appointments')} className="text-sm text-blue hover:underline">
            See all
          </button>
        </div>
        {upcoming.length === 0 ? (
          <Card>
            <div className="text-center py-6 text-taupe">
              <PawIcon className="w-8 h-8 text-taupe mx-auto mb-2" />
              <p className="text-sm">No upcoming visits scheduled.</p>
              <Button size="sm" className="mt-4" onClick={() => navigate('/client/appointments')}>
                Request a Visit
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcoming.map((appt: any) => {
              const dogNames = appt.dogs?.map((d: any) => d.name).join(', ') || 'Your pup';
              const mins = appt.duration_minutes || (appt.service_type === 'walk_60' ? 60 : 30);
              const durationLabel = mins >= 120 ? `${(mins / 60).toFixed(mins % 60 === 0 ? 0 : 1)}h` : `${mins} min`;
              const timeBlock = appt.client_time_block in TIME_BLOCK_LABELS
                ? TIME_BLOCK_LABELS[appt.client_time_block as keyof typeof TIME_BLOCK_LABELS]
                : appt.client_time_block;
              const dateStr = appt.scheduled_time
                ? format(new Date(appt.scheduled_time), 'EEE, MMM d')
                : '';
              return (
                <Card key={appt.id} padding="sm">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-espresso text-sm">
                        {dogNames} | {durationLabel} Visit
                      </div>
                      <div className="text-xs text-taupe mt-0.5">
                        {dateStr} · {timeBlock}
                      </div>
                      {appt.notes && (
                        <div className="text-xs text-taupe/80 mt-0.5 truncate">
                          {appt.notes}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => navigate(`/client/appointments?edit=${appt.id}`)}
                      className="ml-3 text-xs font-medium text-blue hover:underline whitespace-nowrap"
                    >
                      Edit
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>}

      {/* Quick actions */}
      <div className={`grid gap-3 ${isFirstTime ? 'grid-cols-1' : 'grid-cols-2'}`}>
        <Card padding="sm" className="cursor-pointer hover:shadow-lg transition-shadow" >
          <button className="w-full text-left" onClick={() => navigate('/client/messages')}>
            <MessageCircle className="w-6 h-6 text-gold mb-1" />
            <div className="font-semibold text-sm text-espresso">Messages</div>
            <div className="text-xs text-taupe">Chat with Sophie</div>
          </button>
        </Card>
        {!isFirstTime && (
          <Card padding="sm" className="cursor-pointer hover:shadow-lg transition-shadow">
            <button className="w-full text-left" onClick={() => navigate('/client/appointments')}>
              <Calendar className="w-6 h-6 text-gold mb-1" />
              <div className="font-semibold text-sm text-espresso">Request a Visit</div>
              <div className="text-xs text-taupe">Request a service</div>
            </button>
          </Card>
        )}
      </div>
    </div>
  );
}
