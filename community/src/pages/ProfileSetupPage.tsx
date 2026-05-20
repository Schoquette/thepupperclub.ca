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

const CARE_OPTIONS: { value: string; label: string }[] = [
  { value: 'dog_walk',      label: 'Dog walks' },
  { value: 'drop_in',       label: 'Drop-in feeds & visits' },
  { value: 'overnight',     label: 'Overnight stays' },
  { value: 'multi_day',     label: 'Multi-day care' },
  { value: 'companionship', label: 'Just companionship' },
];

const RADIUS_MAX = 15000;

function radiusLabelFor(meters: number): string {
  if (meters >= RADIUS_MAX) return '15 km+ (no limit)';
  if (meters <= 500)  return 'In your building or block';
  if (meters <= 1000) return 'Less than 1 km';
  if (meters <= 2000) return 'About 2 km';
  if (meters <= 5000) return 'About 5 km';
  if (meters <= 10000) return 'About 10 km';
  return 'Up to 15 km';
}

export default function ProfileSetupPage() {
  const navigate = useNavigate();
  const { member, refreshMember } = useAuth();
  const [introduction, setIntroduction] = useState(member?.introduction ?? '');
  const [availability, setAvailability] = useState<string[]>(member?.availability ?? []);
  const [careOffered, setCareOffered]   = useState<string[]>(member?.care_offered ?? []);
  const [careNeeded, setCareNeeded]     = useState<string[]>(member?.care_needed ?? []);
  const [radius, setRadius] = useState(member?.radius_meters ?? 1000);
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleIn = (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    setter((prev) =>
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
        care_offered: careOffered,
        care_needed:  careNeeded,
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

  const radiusLabel = radiusLabelFor(radius);

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
                    onClick={() => toggleIn(setAvailability, opt.value)}
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
            <div className="field-label">Care you can offer to neighbours</div>
            <p className="text-xs text-taupe mb-2">What you'd be willing to help with. Leave empty if you only need care, not offering it.</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {CARE_OPTIONS.map((opt) => {
                const selected = careOffered.includes(opt.value);
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => toggleIn(setCareOffered, opt.value)}
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
          </div>

          <div>
            <div className="field-label">Care you sometimes need for your own pets</div>
            <p className="text-xs text-taupe mb-2">What you might ask a neighbour for. Leave empty if you only offer care, not asking for it.</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {CARE_OPTIONS.map((opt) => {
                const selected = careNeeded.includes(opt.value);
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => toggleIn(setCareNeeded, opt.value)}
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
              max={RADIUS_MAX}
              step={250}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full accent-blue"
            />
            <div className="flex justify-between text-xs text-taupe mt-1">
              <span>250 m</span>
              <span>15 km+</span>
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
