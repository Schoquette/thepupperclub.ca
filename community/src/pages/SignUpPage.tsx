import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function SignUpPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [searchParams] = useSearchParams();
  // Referral code from a join link. Trim + upper-case so the backend
  // lookup is deterministic regardless of how the link was pasted.
  const invitedBy = (searchParams.get('invited_by') ?? '').trim().toUpperCase() || null;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords don’t match.');
      return;
    }
    setLoading(true);
    try {
      await signUp(name.trim(), email.trim(), password, confirm, invitedBy);
      navigate('/home', { replace: true });
    } catch (err: any) {
      const data = err.response?.data;
      const firstError = data?.errors ? Object.values(data.errors).flat()[0] : null;
      const status   = err.response?.status;
      const fallback = status
        ? `Sign-up failed (server returned ${status}). Please try again.`
        : `Sign-up failed: ${err.message ?? 'network error'}. Please try again.`;
      setError((firstError as string) ?? data?.message ?? fallback);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-8 py-12">
      <div className="w-full max-w-sm">
        <Link to="/" className="label-caps text-taupe hover:text-espresso block mb-8">&larr; Back</Link>
        <h1 className="font-display text-2xl text-espresso mb-2">Create your account</h1>
        <p className="text-espresso/70 mb-4">A few details to get you started. Identity verification comes next.</p>
        {invitedBy && (
          <p className="rounded-lg bg-blue/10 border border-blue/20 px-4 py-3 text-sm text-blue mb-6">
            You&rsquo;re joining through a friend&rsquo;s invite link. Welcome.
          </p>
        )}

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="field-label" htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field-input"
            />
            <p className="text-xs text-taupe mt-2">At least 8 characters, with upper and lower case and a number.</p>
          </div>
          <div>
            <label className="field-label" htmlFor="confirm">Confirm Password</label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="field-input"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-blue w-full disabled:opacity-60">
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-taupe mt-6">
          Already have an account? <Link to="/sign-in" className="text-blue hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
