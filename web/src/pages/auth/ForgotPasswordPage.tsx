import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong.');
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
          <p className="text-taupe mt-1 text-sm">Reset your password</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {sent ? (
            <div className="text-center space-y-3">
              <div className="text-4xl">📧</div>
              <p className="font-semibold text-espresso">Check your inbox</p>
              <p className="text-sm text-taupe">We've sent a reset link to <strong>{email}</strong>. It expires in 1 hour.</p>
              <Link to="/login" className="text-sm text-blue hover:underline block mt-4">Back to sign in</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-sm text-taupe">
                Enter your email address and we'll send you a link to reset your password.
              </p>
              <Input
                label="Email address"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
              )}
              <Button type="submit" loading={loading} className="w-full" size="lg">
                Send Reset Link
              </Button>
              <div className="text-center">
                <Link to="/login" className="text-sm text-blue hover:underline">Back to sign in</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
