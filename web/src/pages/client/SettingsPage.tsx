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

  const updateNotifs = useMutation({
    mutationFn: (data: Record<string, boolean>) => api.patch('/client/profile', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-profile'] });
      setNotifEditing(false);
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

      {/* Notification Preferences */}
      <Card>
        <CardHeader
          title="Notification Preferences"
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
                  secondary_notify_app: p.secondary_notify_app ?? false,
                  secondary_notify_email: p.secondary_notify_email ?? false,
                  secondary_notify_sms: p.secondary_notify_sms ?? false,
                });
                setNotifEditing(true);
              }}>
                Edit
              </Button>
            )
          }
        />
        {notifEditing && notifForm ? (
          <div className="space-y-4">
            <p className="text-xs text-taupe">Choose how each contact receives updates about appointments, messages, and more.</p>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-espresso mb-2 uppercase tracking-wide">Primary Contact</p>
                <div className="space-y-2">
                  {[
                    { key: 'notify_app', label: 'App notifications' },
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
              </div>
              <div>
                <p className="text-xs font-semibold text-espresso mb-2 uppercase tracking-wide">Secondary Contact</p>
                <div className="space-y-2">
                  {[
                    { key: 'secondary_notify_app', label: 'App notifications' },
                    { key: 'secondary_notify_email', label: 'Email' },
                    { key: 'secondary_notify_sms', label: 'Text message (SMS)' },
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
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-semibold text-espresso mb-2 uppercase tracking-wide">Primary Contact</p>
              <div className="flex flex-wrap gap-2">
                {(p.notify_app ?? true) && <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-gold/10 text-gold border border-gold/20">App</span>}
                {!!p.notify_email && <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-gold/10 text-gold border border-gold/20">Email</span>}
                {!!p.notify_sms && <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-gold/10 text-gold border border-gold/20">SMS</span>}
                {!(p.notify_app ?? true) && !p.notify_email && !p.notify_sms && <span className="text-xs text-taupe">None selected</span>}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-espresso mb-2 uppercase tracking-wide">Secondary Contact</p>
              <div className="flex flex-wrap gap-2">
                {!!p.secondary_notify_app && <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-gold/10 text-gold border border-gold/20">App</span>}
                {!!p.secondary_notify_email && <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-gold/10 text-gold border border-gold/20">Email</span>}
                {!!p.secondary_notify_sms && <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-gold/10 text-gold border border-gold/20">SMS</span>}
                {!p.secondary_notify_app && !p.secondary_notify_email && !p.secondary_notify_sms && <span className="text-xs text-taupe">None selected</span>}
              </div>
            </div>
          </div>
        )}
      </Card>

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
