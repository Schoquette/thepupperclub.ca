import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { Lock, Trash2, Settings, Bell } from 'lucide-react';

export default function ClientSettingsPage() {
  const qc = useQueryClient();

  // Password
  const [pwForm, setPwForm] = useState({ current_password: '', password: '', password_confirmation: '' });
  const [pwMsg, setPwMsg] = useState('');

  // Delete
  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteMsg, setDeleteMsg] = useState('');

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

  // Notification prefs
  const { data: profile, isLoading } = useQuery({
    queryKey: ['client-profile'],
    queryFn: () => api.get('/client/profile').then(r => r.data.data),
  });

  const [notifForm, setNotifForm] = useState<Record<string, boolean> | null>(null);
  const [notifEditing, setNotifEditing] = useState(false);

  const p = profile?.client_profile ?? {};

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

  const [notifSuccessMsg, setNotifSuccessMsg] = useState('');
  const [notifError, setNotifError] = useState('');

  const updateNotifs = useMutation({
    mutationFn: (data: Record<string, boolean>) => api.patch('/client/profile', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-profile'] });
      setNotifEditing(false);
      setNotifError('');
      setNotifSuccessMsg('Saved!');
      setTimeout(() => setNotifSuccessMsg(''), 2500);
    },
    onError: (err: any) => {
      setNotifError(err.response?.data?.message || 'Failed to save notification preferences.');
    },
  });

  const deleteAccount = useMutation({
    mutationFn: () => api.post('/auth/delete-account', { password: deletePassword }),
    onSuccess: () => {
      localStorage.removeItem('token');
      window.location.href = '/';
    },
    onError: (err: any) => {
      setDeleteMsg(err.response?.data?.message || 'Failed to delete account.');
    },
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-5 h-5 text-taupe" />
        <h1 className="font-display text-xl text-espresso">Settings</h1>
      </div>

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

      {/* Notification Channels */}
      <Card>
        <CardHeader
          title="Notification Channels"
          action={
            notifEditing ? (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setNotifEditing(false)}>Cancel</Button>
                <Button size="sm" loading={updateNotifs.isPending} onClick={() => notifForm && updateNotifs.mutate(notifForm)}>Save</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => {
                setNotifForm({
                  notify_app: p.notify_app ?? true,
                  notify_email: p.notify_email ?? false,
                  notify_sms: p.notify_sms ?? false,
                });
                setNotifEditing(true);
              }}>
                Edit
              </Button>
            )
          }
        />
        {notifSuccessMsg && <span className="text-sm text-green-600 font-medium">{notifSuccessMsg}</span>}
        {notifError && <p className="text-sm text-red-600">{notifError}</p>}
        <p className="text-xs text-taupe mb-3">Choose how you receive notifications.</p>
        {notifEditing && notifForm ? (
          <div className="space-y-2">
            {[
              { key: 'notify_app', label: 'App / Push notifications' },
              { key: 'notify_email', label: 'Email' },
              { key: 'notify_sms', label: 'Text message (SMS)' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-cream/50">
                <input
                  type="checkbox"
                  checked={!!notifForm[key]}
                  onChange={e => setNotifForm(f => ({ ...f!, [key]: e.target.checked }))}
                  className="h-4 w-4 rounded border-taupe text-gold focus:ring-gold"
                />
                <span className="text-sm text-espresso">{label}</span>
              </label>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(p.notify_app ?? true) && <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-gold/10 text-gold border border-gold/20">App</span>}
            {!!p.notify_email && <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-gold/10 text-gold border border-gold/20">Email</span>}
            {!!p.notify_sms && <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-gold/10 text-gold border border-gold/20">SMS</span>}
            {!(p.notify_app ?? true) && !p.notify_email && !p.notify_sms && <span className="text-xs text-taupe">None selected</span>}
          </div>
        )}
      </Card>

      {/* Notification Types */}
      <NotificationTypesCard profile={p} />

      {/* Browser/Desktop Notifications */}
      {typeof Notification !== 'undefined' && (
        <Card>
          <CardHeader title="Desktop Notifications" />
          <div className="space-y-3">
            <p className="text-sm text-taupe">
              Get notified in your browser when you receive new messages, appointment updates, or invoices — even when you're on another tab.
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

      {/* Delete Account */}
      <Card>
        <CardHeader title="Delete Account" />
        <div className="space-y-4">
          <p className="text-sm text-taupe">
            Permanently delete your account and all associated data including dog profiles, appointments, messages, and documents. This action cannot be undone.
          </p>
          {!showDelete ? (
            <Button size="sm" variant="outline" onClick={() => setShowDelete(true)}>
              <Trash2 className="w-4 h-4 mr-1.5" />
              Delete My Account
            </Button>
          ) : (
            <div className="space-y-3 p-4 border border-red-200 rounded-xl bg-red-50/50">
              <p className="text-sm font-semibold text-red-700">Are you sure? Enter your password to confirm.</p>
              <Input
                label="Password"
                type="password"
                value={deletePassword}
                onChange={e => { setDeletePassword(e.target.value); setDeleteMsg(''); }}
              />
              {deleteMsg && <p className="text-sm text-red-500">{deleteMsg}</p>}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setShowDelete(false); setDeletePassword(''); setDeleteMsg(''); }}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  loading={deleteAccount.isPending}
                  disabled={!deletePassword}
                  onClick={() => deleteAccount.mutate()}
                  className="!bg-red-600 hover:!bg-red-700 !text-white !border-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Permanently Delete
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

const NOTIF_TYPES = [
  { key: 'messages', label: 'Messages', desc: 'New messages from your walker' },
  { key: 'visit_checkin', label: 'Visit check-in', desc: 'When your walker arrives' },
  { key: 'visit_reports', label: 'Visit reports', desc: 'Report card after each visit' },
  { key: 'appointment_updates', label: 'Appointment changes', desc: 'Rescheduled or cancelled visits' },
  { key: 'appointment_reminders', label: 'Appointment reminders', desc: 'Day-before visit reminders' },
  { key: 'invoices', label: 'Invoices & billing', desc: 'New invoices and payment confirmations' },
  { key: 'service_requests', label: 'Service request updates', desc: 'Approved, declined, or counter-offered' },
  { key: 'documents', label: 'Documents', desc: 'Signature requests and document updates' },
];

function NotificationTypesCard({ profile }: { profile: any }) {
  const qc = useQueryClient();
  const stored: Record<string, boolean> = profile?.notification_preferences ?? {};
  const [editing, setEditing] = useState(false);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [successMsg, setSuccessMsg] = useState('');

  const startEdit = () => {
    const initial: Record<string, boolean> = {};
    NOTIF_TYPES.forEach(t => { initial[t.key] = stored[t.key] !== false; });
    setPrefs(initial);
    setEditing(true);
  };

  const save = useMutation({
    mutationFn: () => api.patch('/client/profile', { notification_preferences: prefs }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-profile'] });
      setEditing(false);
      setSuccessMsg('Saved!');
      setTimeout(() => setSuccessMsg(''), 2500);
    },
    onError: () => {},
  });

  return (
    <Card>
      <CardHeader
        title="Notification Types"
        action={
          <div className="flex items-center gap-2">
            {successMsg && <span className="text-sm text-green-600 font-medium">{successMsg}</span>}
            {editing ? (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                <Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>Save</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={startEdit}>Edit</Button>
            )}
          </div>
        }
      />
      <p className="text-xs text-taupe mb-3">Choose which types of notifications you want to receive. All are enabled by default.</p>
      {editing ? (
        <div className="space-y-1">
          {NOTIF_TYPES.map(t => (
            <label key={t.key} className="flex items-start gap-3 cursor-pointer p-2 rounded-lg hover:bg-cream/50">
              <input
                type="checkbox"
                checked={prefs[t.key] !== false}
                onChange={e => setPrefs(p => ({ ...p, [t.key]: e.target.checked }))}
                className="h-4 w-4 mt-0.5 rounded border-taupe text-gold focus:ring-gold"
              />
              <div>
                <div className="text-sm text-espresso font-medium">{t.label}</div>
                <div className="text-xs text-taupe">{t.desc}</div>
              </div>
            </label>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {NOTIF_TYPES.map(t => {
            const enabled = stored[t.key] !== false;
            return (
              <div key={t.key} className="flex items-center justify-between py-1.5">
                <div>
                  <span className="text-sm text-espresso">{t.label}</span>
                  <span className="text-xs text-taupe ml-2">{t.desc}</span>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${enabled ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                  {enabled ? 'On' : 'Off'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
