import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Lock, Bell, Settings } from 'lucide-react';

export default function AdminSettingsPage() {
  // Password
  const [pwForm, setPwForm] = useState({ current_password: '', password: '', password_confirmation: '' });
  const [pwMsg, setPwMsg] = useState('');

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-5 h-5 text-taupe" />
        <h1 className="page-title">Settings</h1>
      </div>

      {/* Browser/Desktop Notifications */}
      {typeof Notification !== 'undefined' && (
        <Card>
          <CardHeader title="Desktop Notifications" />
          <div className="space-y-3">
            <p className="text-sm text-taupe">
              Get browser notifications when clients send messages, submit requests, or when appointments need attention.
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
    </div>
  );
}
