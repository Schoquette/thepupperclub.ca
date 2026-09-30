import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Lock, Bell, Settings, Mail, MessageSquare, Smartphone, Download, Database } from 'lucide-react';
import { todayPacific } from '@/lib/date';

const PAYG_TYPES = [
  { value: 'walk_30', label: '30-Minute Visit' },
  { value: 'walk_60', label: '60-Minute Visit' },
  { value: 'pack_hike', label: 'Group Hike' },
];

export default function AdminSettingsPage() {
  const qc = useQueryClient();

  // Fetch current user
  const { data: userData } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => api.get('/auth/me').then(r => r.data.data),
  });

  // Backup
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');

  const downloadBackup = async () => {
    setBackupLoading(true);
    setBackupMsg('');
    try {
      const res = await api.get('/admin/backup/download', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `thepupperclub-backup-${todayPacific()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupMsg('Backup downloaded successfully.');
    } catch (err: any) {
      setBackupMsg('Failed to download backup. Please try again.');
    } finally {
      setBackupLoading(false);
    }
  };

  // Password
  const [pwForm, setPwForm] = useState({ current_password: '', password: '', password_confirmation: '' });
  const [pwMsg, setPwMsg] = useState('');

  // Pay As You Go pricing
  const { data: paygRates } = useQuery({
    queryKey: ['payg-pricing'],
    queryFn: () => api.get('/admin/payg-pricing').then(r => r.data.data),
  });
  const { data: stripeRes } = useQuery({
    queryKey: ['stripe-products'],
    queryFn: () => api.get('/admin/stripe/products').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const oneTimePrices: { priceId: string; label: string }[] = [];
  stripeRes?.data?.forEach((product: any) => {
    product.prices?.forEach((price: any) => {
      if (price.interval) return; // skip recurring prices
      oneTimePrices.push({
        priceId: price.id,
        label: `${product.name}${price.nickname ? ` — ${price.nickname}` : ''} ($${price.amount})`,
      });
    });
  });
  const [paygMsg, setPaygMsg] = useState('');
  const [paygMsgError, setPaygMsgError] = useState(false);
  const savePaygPrice = useMutation({
    mutationFn: ({ service_type, stripe_price_id }: { service_type: string; stripe_price_id: string }) =>
      api.post('/admin/payg-pricing', { service_type, stripe_price_id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payg-pricing'] }); setPaygMsgError(false); setPaygMsg('Saved!'); setTimeout(() => setPaygMsg(''), 2500); },
    onError: (err: any) => { setPaygMsgError(true); setPaygMsg(err.response?.data?.message ?? 'Failed to save.'); },
  });

  // Notification preferences
  const [notifForm, setNotifForm] = useState<Record<string, boolean> | null>(null);
  const [notifEditing, setNotifEditing] = useState(false);

  // Browser notifications
  const [browserNotifStatus, setBrowserNotifStatus] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const requestBrowserNotifs = async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setBrowserNotifStatus(result);
    if (result === 'granted') {
      new Notification('The Pupper Club', { body: 'Desktop notifications are now enabled!', icon: '/logo.png' });
    }
  };

  const changePassword = useMutation({
    mutationFn: () => api.patch('/auth/change-password', pwForm),
    onSuccess: () => {
      setPwMsg('Password changed successfully.');
      setPwForm({ current_password: '', password: '', password_confirmation: '' });
    },
    onError: (err: any) => {
      setPwMsg(err.response?.data?.message || 'Failed to change password.');
    },
  });

  const [notifMsg, setNotifMsg] = useState('');
  const updateNotifs = useMutation({
    mutationFn: (prefs: Record<string, boolean>) => api.patch('/auth/notification-preferences', prefs),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth-me'] });
      setNotifEditing(false);
      setNotifMsg('Preferences saved!'); setTimeout(() => setNotifMsg(''), 2500);
    },
    onError: (err: any) => {
      setNotifMsg(err.response?.data?.message || 'Failed to save preferences.');
    },
  });

  const notifChannels = [
    { key: 'notify_app', label: 'In-app notifications', icon: Smartphone, desc: 'Push notifications on mobile app' },
    { key: 'notify_email', label: 'Email', icon: Mail, desc: 'Get notified via email' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-5 h-5 text-taupe" />
        <h1 className="page-title">Settings</h1>
      </div>

      {/* Notification Preferences */}
      <Card>
        <CardHeader
          title="Alert Preferences"
          action={
            notifEditing ? (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setNotifEditing(false)}>Cancel</Button>
                <Button size="sm" loading={updateNotifs.isPending} onClick={() => notifForm && updateNotifs.mutate(notifForm)}>Save</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => {
                setNotifForm({
                  notify_app: userData?.notify_app ?? true,
                  notify_email: userData?.notify_email ?? true,
                });
                setNotifEditing(true);
              }}>
                Edit
              </Button>
            )
          }
        />
        <p className="text-sm text-taupe mb-4">
          Choose how you receive alerts when clients send messages, submit requests, or when appointments need attention.
        </p>
        {notifMsg && (
          <p className={`text-sm mb-3 font-medium ${notifMsg.includes('saved') || notifMsg.includes('Saved') ? 'text-green-600' : 'text-red-600'}`}>{notifMsg}</p>
        )}

        {notifEditing && notifForm ? (
          <div className="space-y-2">
            {notifChannels.map(({ key, label, icon: Icon, desc }) => (
              <label key={key} className="flex items-center gap-4 cursor-pointer p-3 rounded-xl hover:bg-cream/50 border border-transparent hover:border-cream transition-colors">
                <input
                  type="checkbox"
                  checked={!!notifForm[key]}
                  onChange={e => setNotifForm(f => ({ ...f!, [key]: e.target.checked }))}
                  className="h-4 w-4 rounded border-taupe text-gold focus:ring-gold flex-shrink-0"
                />
                <Icon className="w-5 h-5 text-taupe flex-shrink-0" />
                <div>
                  <span className="text-sm font-medium text-espresso">{label}</span>
                  <p className="text-xs text-taupe">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(userData?.notify_app ?? true) && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gold/10 text-gold border border-gold/20">
                <Smartphone className="w-3 h-3" /> In-app
              </span>
            )}
            {(userData?.notify_email ?? true) && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gold/10 text-gold border border-gold/20">
                <Mail className="w-3 h-3" /> Email
              </span>
            )}
            {!(userData?.notify_app ?? true) && !(userData?.notify_email ?? true) && (
              <span className="text-xs text-taupe">None selected</span>
            )}
          </div>
        )}
      </Card>

      {/* Browser/Desktop Notifications */}
      {typeof Notification !== 'undefined' && (
        <Card>
          <CardHeader title="Desktop Notifications" />
          <div className="space-y-3">
            <p className="text-sm text-taupe">
              Get browser notifications when clients send messages, submit requests, or when appointments need attention — even when you're on another tab.
            </p>
            {browserNotifStatus === 'granted' ? (
              <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                <Bell className="w-4 h-4" />
                Desktop notifications are enabled
              </div>
            ) : browserNotifStatus === 'denied' ? (
              <div className="space-y-2">
                <p className="text-sm text-red-500 font-medium">
                  Notifications are blocked. To re-enable:
                </p>
                <ol className="list-decimal list-inside text-xs text-taupe space-y-1">
                  <li>Click the lock/site-info icon in your browser's address bar</li>
                  <li>Find "Notifications" and change it to "Allow"</li>
                  <li>Refresh this page</li>
                </ol>
              </div>
            ) : (
              <Button size="sm" onClick={requestBrowserNotifs}>
                <Bell className="w-4 h-4 mr-1.5" />
                Enable Desktop Notifications
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Change Password */}
      <Card>
        <CardHeader title="Change Password" />
        <div className="space-y-4">
          <Input
            label="Current Password"
            type="password"
            value={pwForm.current_password}
            onChange={e => { setPwForm(f => ({ ...f, current_password: e.target.value })); setPwMsg(''); }}
          />
          <Input
            label="New Password"
            type="password"
            value={pwForm.password}
            onChange={e => { setPwForm(f => ({ ...f, password: e.target.value })); setPwMsg(''); }}
          />
          <Input
            label="Confirm New Password"
            type="password"
            value={pwForm.password_confirmation}
            onChange={e => { setPwForm(f => ({ ...f, password_confirmation: e.target.value })); setPwMsg(''); }}
          />
          <p className="text-xs text-taupe">Must be at least 8 characters with uppercase, lowercase, and a number.</p>
          {pwMsg && (
            <p className={`text-sm ${pwMsg.includes('successfully') ? 'text-green-600' : 'text-red-500'}`}>{pwMsg}</p>
          )}
          <div className="flex justify-end">
            <Button
              size="sm"
              loading={changePassword.isPending}
              disabled={!pwForm.current_password || !pwForm.password || !pwForm.password_confirmation}
              onClick={() => changePassword.mutate()}
            >
              <Lock className="w-4 h-4 mr-1.5" />
              Update Password
            </Button>
          </div>
        </div>
      </Card>

      {/* Pay As You Go Pricing */}
      <Card>
        <CardHeader title="Pay As You Go Pricing" />
        <div className="space-y-3">
          <p className="text-sm text-taupe">
            Each visit type's 10-pack price, sourced from a one-time Stripe Price. The per-visit rate (pack price ÷ 10) is the default charged to Pay-As-You-Go clients, unless a client has a custom override.
          </p>
          {oneTimePrices.length === 0 && (
            <p className="text-xs text-red-500">No one-time Stripe prices found. Create a Product with a one-time Price for each 10-pack in Stripe first.</p>
          )}
          {PAYG_TYPES.map(t => {
            const row = paygRates?.find((r: any) => r.service_type === t.value);
            return (
              <div key={t.value} className="flex items-center gap-3">
                <span className="text-sm text-espresso font-medium w-32 shrink-0">{t.label}</span>
                <select
                  className="input flex-1"
                  defaultValue={row?.stripe_price_id ?? ''}
                  onChange={e => e.target.value && savePaygPrice.mutate({ service_type: t.value, stripe_price_id: e.target.value })}
                >
                  <option value="">— Select 10-pack price —</option>
                  {oneTimePrices.map(p => <option key={p.priceId} value={p.priceId}>{p.label}</option>)}
                </select>
                <span className="text-xs text-taupe w-28 text-right shrink-0">
                  {row?.per_visit_rate ? `$${row.per_visit_rate}/visit` : '—'}
                </span>
              </div>
            );
          })}
          {paygMsg && <p className={`text-sm font-medium ${paygMsgError ? 'text-red-600' : 'text-green-600'}`}>{paygMsg}</p>}
        </div>
      </Card>

      {/* Backup & Export */}
      <Card>
        <CardHeader title="Backup & Export" />
        <div className="space-y-3">
          <p className="text-sm text-taupe">
            Download a full database backup as a ZIP file containing CSV exports of all important tables (users, dogs, appointments, invoices, messages, and more).
          </p>
          {backupMsg && (
            <p className={`text-sm font-medium ${backupMsg.includes('successfully') ? 'text-green-600' : 'text-red-500'}`}>{backupMsg}</p>
          )}
          <Button
            size="sm"
            loading={backupLoading}
            onClick={downloadBackup}
          >
            <Database className="w-4 h-4 mr-1.5" />
            {backupLoading ? 'Preparing Backup...' : 'Download Database Backup'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
