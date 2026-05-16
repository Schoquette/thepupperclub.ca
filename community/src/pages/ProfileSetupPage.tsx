import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const AVAILABILITY_OPTIONS: { value: string; label: string }[] = [
  { value: 'mornings', label: 'Mornings' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'evenings', label: 'Evenings' },
  { value: 'weekends', label: 'Weekends' },
  { value: 'ad_hoc',   label: 'Ad hoc' },
];

export default function ProfileSetupPage() {
  const navigate = useNavigate();
  const { member, refreshMember } = useAuth();
  const [introduction, setIntroduction] = useState(member?.introduction ?? '');
  const [availability, setAvailability] = useState<string[]>([]);
  const [radius, setRadius] = useState(member?.radius_meters ?? 1000);
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggle = (value: string) => {
    setAvailability((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (introduction.trim().length < 20) {
      setError('A short introduction helps neighbours feel comfortable connecting — at least a sentence or two.');
      return;
    }
    if (!address.trim()) {
      setError('We need your address to find neighbours nearby. It’s never shown to other members.');
      return;
    }
    setSaving(true);
    try {
      await api.patch('/community/profile', {
        introduction: introduction.trim(),
        availability,
        radius_meters: radius,
        address: address.trim(),
      });
      await refreshMember();
      navigate('/discover', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'We couldn’t save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const radiusLabel =
    radius <= 500  ? 'In your building or block'  :
    radius <= 1000 ? 'Less than 1 km' :
    radius <= 2000 ? 'About 2 km' :
    'Up to 5 km';

  return (
    <div className="min-h-screen px-8 py-12">
      <header className="max-w-2xl mx-auto mb-10">
        <p className="label-caps text-blue">The Pupper Club &mdash; Community</p>
      </header>

      <main className="max-w-2xl mx-auto">
        <h1 className="font-display text-3xl text-espresso mb-3">Tell us a little about you.</h1>
        <p className="text-espresso/80 leading-relaxed mb-10">
          A short profile helps neighbours feel comfortable connecting. None of
          your contact details &mdash; phone, email, address &mdash; are ever
          shown to other members.
        </p>

        <form onSubmit={onSubmit} className="space-y-8">
          <div>
            <label htmlFor="intro" className="field-label">Introduction</label>
            <textarea
              id="intro"
              rows={4}
              maxLength={600}
              value={introduction}
              onChange={(e) => setIntroduction(e.target.value)}
              placeholder="A sentence or two about you. Mention your pets, if any, and what you enjoy about your neighbourhood."
              className="field-input resize-none"
            />
            <p className="text-xs text-taupe mt-2 text-right">{introduction.length}/600</p>
          </div>

          <div>
            <div className="field-label">When are you typically available?</div>
            <div className="flex flex-wrap gap-2 mt-1">
              {AVAILABILITY_OPTIONS.map((opt) => {
                const selected = availability.includes(opt.value);
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => toggle(opt.value)}
                    className={`px-4 py-2 rounded-full border-2 text-sm transition ${
                      selected
                        ? 'bg-blue text-white border-blue'
                        : 'bg-transparent text-espresso border-taupe/40 hover:border-blue'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-taupe mt-2">Choose any that fit. You can change this later.</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="radius" className="field-label mb-0">Neighbour radius</label>
              <span className="text-sm text-espresso">{radiusLabel}</span>
            </div>
            <input
              id="radius"
              type="range"
              min={250}
              max={5000}
              step={250}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full accent-blue"
            />
            <div className="flex justify-between text-xs text-taupe mt-1">
              <span>250 m</span>
              <span>5 km</span>
            </div>
          </div>

          <div>
            <label htmlFor="address" className="field-label">Your home address</label>
            <input
              id="address"
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Example St, Port Moody, BC"
              autoComplete="street-address"
              className="field-input"
            />
            <p className="text-xs text-taupe mt-2 leading-relaxed">
              Your address is geocoded once, stored only as a coarse area
              (about a ±600m cell), and is <strong>never visible</strong> to
              other members. They&rsquo;ll only see approximate distance
              (e.g. &ldquo;Less than 500m away&rdquo;).
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => navigate('/home')}
              className="label-caps text-taupe hover:text-espresso"
            >
              &larr; Back
            </button>
            <button type="submit" disabled={saving} className="btn-blue disabled:opacity-60">
              {saving ? 'Saving...' : 'Save & Continue'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
