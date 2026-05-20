import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import PageShell from '@/components/PageShell';

interface AccountSettings {
  paused: boolean;
  paused_at: string | null;
  notification_prefs: Record<string, boolean>;
}

const NOTIFICATION_FIELDS: { key: string; label: string; description: string }[] = [
  { key: 'connection_requests', label: 'Connection requests', description: 'When a neighbour wants to connect.' },
  { key: 'messages',            label: 'Messages',            description: 'When a connection sends you a message.' },
  { key: 'broadcasts',          label: 'Neighbourhood broadcasts', description: 'When someone in your radius posts a broadcast.' },
  { key: 'product_updates',     label: 'Product updates',     description: 'Occasional emails about new features. Off by default.' },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { member, refreshMember, setToken, signOut } = useAuth();

  const [settings, setSettings] = useState<AccountSettings | null>(null);
  const [loadError, setLoadError] = useState('');
  const [savingPrefs, setSavingPrefs] = useState<string | null>(null);
  const [pauseBusy, setPauseBusy] = useState(false);

  // Password change
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPwConfirm, setNewPwConfirm] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMessage, setPwMessage] = useState('');
  const [pwError, setPwError] = useState('');

  // Delete account
  const [showDelete, setShowDelete] = useState(false);
  const [deletePw, setDeletePw] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get<AccountSettings>('/community/account/settings');
      setSettings(res.data);
    } catch {
      setLoadError('Couldn’t load your settings.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const togglePref = async (key: string) => {
    if (!settings) return;
    const next = { ...settings.notification_prefs, [key]: !settings.notification_prefs[key] };
    setSettings({ ...settings, notification_prefs: next });
    setSavingPrefs(key);
    try {
      await api.patch('/community/account/notifications', { prefs: { [key]: next[key] } });
    } catch {
      // Roll back optimistic update on failure.
      setSettings((s) => s && ({ ...s, notification_prefs: { ...s.notification_prefs, [key]: !next[key] } }));
    } finally {
      setSavingPrefs(null);
    }
  };

  const togglePause = async () => {
    if (!settings) return;
    setPauseBusy(true);
    try {
      if (settings.paused) {
        await api.post('/community/account/resume');
        setSettings({ ...settings, paused: false, paused_at: null });
      } else {
        const ok = confirm('Pause your profile? Neighbours won’t see you in Discover and you won’t appear in any new searches until you resume.');
        if (!ok) { setPauseBusy(false); return; }
        const res = await api.post<{ paused: boolean; paused_at: string }>('/community/account/pause');
        setSettings({ ...settings, paused: true, paused_at: res.data.paused_at });
      }
      await refreshMember();
    } catch {
      setLoadError('Couldn’t update pause state.');
    } finally {
      setPauseBusy(false);
    }
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwMessage('');
    setPwError('');
    if (newPw !== newPwConfirm) { setPwError('The new passwords don’t match.'); return; }
    if (newPw.length < 8) { setPwError('Your new password should be at least 8 characters.'); return; }
    setPwBusy(true);
    try {
      const res = await api.patch<{ token?: string; message?: string }>('/community/account/password', {
        current_password:      currentPw,
        password:              newPw,
        password_confirmation: newPwConfirm,
      });
      if (res.data?.token) setToken(res.data.token);
      setPwMessage('Password updated.');
      setCurrentPw(''); setNewPw(''); setNewPwConfirm('');
    } catch (err: any) {
      const data = err.response?.data;
      const first = data?.errors ? Object.values(data.errors).flat()[0] : null;
      setPwError((first as string) ?? data?.message ?? 'Couldn’t update your password.');
    } finally {
      setPwBusy(false);
    }
  };

  const deleteAccount = async () => {
    setDeleteError('');
    if (!deletePw) { setDeleteError('Enter your password to confirm.'); return; }
    setDeleteBusy(true);
    try {
      await api.delete('/community/account', { data: { current_password: deletePw } });
      await signOut();
      navigate('/', { replace: true });
    } catch (err: any) {
      setDeleteError(err.response?.data?.message ?? 'Couldn’t close your account.');
      setDeleteBusy(false);
    }
  };

  return (
    <PageShell back="/home" crumbs={[{ label: 'Home', to: '/home' }, { label: 'Settings' }]}>
        <h1 className="font-display text-3xl text-espresso mb-3">Settings.</h1>
        <p className="text-espresso/80 leading-relaxed mb-10">
          Manage your profile, notifications, and account.
        </p>

        {loadError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-6">
            {loadError}
          </div>
        )}

        {/* ────────── Profile & pets ────────── */}
        <section className="bg-white border border-taupe/20 rounded-2xl p-7 mb-6">
          <h2 className="font-display text-xl text-espresso mb-2">Profile & pets</h2>
          <p className="text-sm text-espresso/80 mb-5 leading-relaxed">
            Update your photo, intro, availability, care preferences, and the
            pets in your home.
          </p>
          <Link to="/profile-setup" className="btn-blue-outline">Edit profile &rarr;</Link>
        </section>

        {/* ────────── Notifications ────────── */}
        <section className="bg-white border border-taupe/20 rounded-2xl p-7 mb-6">
          <h2 className="font-display text-xl text-espresso mb-2">Notifications</h2>
          <p className="text-sm text-espresso/80 mb-5 leading-relaxed">
            Choose the emails we send you. You can change these at any time.
          </p>
          {!settings ? (
            <p className="text-sm text-taupe">Loading...</p>
          ) : (
            <ul className="divide-y divide-taupe/20">
              {NOTIFICATION_FIELDS.map((f) => {
                const on = !!settings.notification_prefs[f.key];
                return (
                  <li key={f.key} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="font-medium text-espresso">{f.label}</p>
                      <p className="text-xs text-taupe leading-relaxed mt-0.5">{f.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => togglePref(f.key)}
                      disabled={savingPrefs === f.key}
                      role="switch"
                      aria-checked={on}
                      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-blue' : 'bg-taupe/30'} ${savingPrefs === f.key ? 'opacity-60' : ''}`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ────────── Pause profile ────────── */}
        <section className="bg-white border border-taupe/20 rounded-2xl p-7 mb-6">
          <h2 className="font-display text-xl text-espresso mb-2">Pause your profile</h2>
          <p className="text-sm text-espresso/80 mb-5 leading-relaxed">
            Hide your profile from Discover and stop new connection requests.
            Existing connections stay in place &mdash; you can resume any time.
          </p>
          {settings?.paused && (
            <div className="rounded-lg bg-gold/15 border border-gold/30 px-4 py-3 text-sm text-espresso mb-4">
              Your profile is paused. Neighbours can&rsquo;t see you in
              Discover right now.
            </div>
          )}
          <button
            onClick={togglePause}
            disabled={pauseBusy || !settings}
            className={settings?.paused ? 'btn-blue disabled:opacity-60' : 'btn-blue-outline disabled:opacity-60'}
          >
            {pauseBusy ? 'Working...' : settings?.paused ? 'Resume profile' : 'Pause profile'}
          </button>
        </section>

        {/* ────────── Privacy ────────── */}
        <section className="bg-white border border-taupe/20 rounded-2xl p-7 mb-6">
          <h2 className="font-display text-xl text-espresso mb-2">Privacy</h2>
          <p className="text-sm text-espresso/80 mb-5 leading-relaxed">
            See and manage the neighbours you&rsquo;ve blocked.
          </p>
          <Link to="/settings/blocks" className="btn-blue-outline">Blocked neighbours &rarr;</Link>
        </section>

        {/* ────────── Verification ────────── */}
        <section className="bg-white border border-taupe/20 rounded-2xl p-7 mb-6">
          <h2 className="font-display text-xl text-espresso mb-2">Identity verification</h2>
          {member?.status === 'verified' ? (
            <p className="text-sm text-espresso/80 leading-relaxed">
              You&rsquo;re verified. Neighbours see a small verified badge on
              your profile.
            </p>
          ) : (
            <>
              <p className="text-sm text-espresso/80 mb-5 leading-relaxed">
                Verify your identity to send connection requests and unlock
                full profiles. A one-time $5 fee covers the ID check.
              </p>
              <Link to="/verify" className="btn-blue-outline">Verify my identity &rarr;</Link>
            </>
          )}
        </section>

        {/* ────────── Change password ────────── */}
        <section className="bg-white border border-taupe/20 rounded-2xl p-7 mb-6">
          <h2 className="font-display text-xl text-espresso mb-2">Change password</h2>
          <form onSubmit={changePassword} className="space-y-4 mt-4">
            <div>
              <label className="field-label" htmlFor="current_password">Current password</label>
              <input id="current_password" type="password" autoComplete="current-password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className="field-input" required />
            </div>
            <div>
              <label className="field-label" htmlFor="new_password">New password</label>
              <input id="new_password" type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="field-input" required />
              <p className="text-xs text-taupe mt-1">At least 8 characters with upper, lower, and a number.</p>
            </div>
            <div>
              <label className="field-label" htmlFor="new_password_confirm">Confirm new password</label>
              <input id="new_password_confirm" type="password" autoComplete="new-password" value={newPwConfirm} onChange={(e) => setNewPwConfirm(e.target.value)} className="field-input" required />
            </div>
            {pwError && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{pwError}</div>}
            {pwMessage && <div className="rounded-lg bg-blue/10 border border-blue/20 px-4 py-3 text-sm text-blue">{pwMessage}</div>}
            <div>
              <button type="submit" disabled={pwBusy} className="btn-blue disabled:opacity-60">
                {pwBusy ? 'Updating...' : 'Update password'}
              </button>
            </div>
          </form>
        </section>

        {/* ────────── Delete account ────────── */}
        <section className="bg-white border border-red-200 rounded-2xl p-7 mb-12">
          <h2 className="font-display text-xl text-red-700 mb-2">Delete account</h2>
          <p className="text-sm text-espresso/80 mb-5 leading-relaxed">
            This closes your account, signs you out, and removes your profile
            from Discover. Your messages and recommendations are preserved
            for the neighbours you&rsquo;ve interacted with, but everything
            with your name attached disappears from their view.
          </p>
          {!showDelete ? (
            <button onClick={() => setShowDelete(true)} className="text-sm text-red-700 hover:underline">
              Close my account &rarr;
            </button>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="field-label" htmlFor="delete_password">Confirm with your password</label>
                <input id="delete_password" type="password" autoComplete="current-password" value={deletePw} onChange={(e) => setDeletePw(e.target.value)} className="field-input" />
              </div>
              {deleteError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{deleteError}</div>
              )}
              <div className="flex items-center gap-3">
                <button onClick={() => { setShowDelete(false); setDeletePw(''); setDeleteError(''); }} className="label-caps text-taupe hover:text-espresso px-3">
                  Cancel
                </button>
                <button
                  onClick={deleteAccount}
                  disabled={deleteBusy}
                  className="px-5 py-2 rounded-full bg-red-600 text-white text-sm hover:bg-red-700 transition-colors disabled:opacity-60"
                >
                  {deleteBusy ? 'Closing...' : 'Permanently close'}
                </button>
              </div>
            </div>
          )}
        </section>
    </PageShell>
  );
}
