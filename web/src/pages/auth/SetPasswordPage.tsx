import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function SetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const email = params.get('email');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setError('');
    setLoading(true);
    try {
      // Use reset-password endpoint (works for first-time setup too)
      await api.post('/auth/reset-password', {
        token,
        email,
        password,
        password_confirmation: confirm,
      });
      setDone(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not set password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-4xl mb-3">🐾</div>
          <h1 className="font-display text-3xl text-espresso tracking-wide">THE PUPPER CLUB</h1>
          <p className="text-taupe mt-1 text-sm">Set your password</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {done ? (
            <div className="text-center">
              <div className="text-4xl mb-3">✅</div>
              <p className="font-semibold text-espresso">Password set! Redirecting to login...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-sm text-taupe">
                Welcome! Please choose a strong password for your account.
              </p>
              <Input
                label="New password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                hint="Use uppercase, lowercase, and numbers"
                required
              />
              <Input
                label="Confirm password"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat your password"
                error={confirm && password !== confirm ? 'Passwords do not match' : undefined}
                required
              />
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
              )}
              <Button type="submit" loading={loading} className="w-full" size="lg">
                Set Password &amp; Sign In
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
