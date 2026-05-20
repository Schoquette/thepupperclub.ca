import { FormEvent, useState } from 'react';
import api from '@/lib/api';
import PageShell from '@/components/PageShell';

type Topic = 'technical' | 'question' | 'feature' | 'safety';

interface TopicMeta {
  key: Topic;
  label: string;
  blurb: string;
  placeholder: string;
}

const TOPICS: TopicMeta[] = [
  {
    key: 'technical',
    label: 'Report a technical issue',
    blurb: 'Something broken in the app — a page that won’t load, a button that doesn’t work, an error message.',
    placeholder: 'What were you trying to do? What did the app do instead?',
  },
  {
    key: 'question',
    label: 'Ask us a question',
    blurb: 'A question about how the Community works, your account, or anything else.',
    placeholder: 'What would you like to know?',
  },
  {
    key: 'feature',
    label: 'Put in a feature request',
    blurb: 'Something you wish the Community did. We read every one.',
    placeholder: 'Describe the feature and what it would help you do.',
  },
  {
    key: 'safety',
    label: 'Report a safety incident',
    blurb: 'A neighbour made you feel unsafe, or something happened during a visit that we should know about. Treated with care and confidentiality.',
    placeholder: 'Tell us what happened. Include names or member numbers if it helps.',
  },
];

export default function ContactPage() {
  const [topic, setTopic] = useState<Topic | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const meta = TOPICS.find((t) => t.key === topic) ?? null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!topic || !body.trim()) return;
    setSending(true);
    setError('');
    try {
      await api.post('/community/support/contact', {
        topic,
        body: body.trim(),
      });
      setSent(true);
      setBody('');
    } catch (err: any) {
      const data = err.response?.data;
      const first = data?.errors ? Object.values(data.errors).flat()[0] : null;
      setError((first as string) ?? data?.message ?? 'Couldn’t send your message. Try again in a moment.');
    } finally {
      setSending(false);
    }
  };

  return (
    <PageShell back="/home" crumbs={[{ label: 'Home', to: '/home' }, { label: 'Contact us' }]}>
      <h1 className="font-display text-3xl text-espresso mb-3">Contact us.</h1>
      <p className="text-espresso/80 leading-relaxed mb-10">
        Pick what kind of message it is &mdash; that tells us who should
        read it first.
      </p>

      {sent ? (
        <div className="bg-white border border-blue/30 rounded-2xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue/10 text-blue mb-5">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="font-display text-xl text-espresso mb-3">Thanks &mdash; we got it.</h2>
          <p className="text-espresso/80 leading-relaxed max-w-md mx-auto">
            We&rsquo;ll get back to you at your account email. Safety reports
            are reviewed within 24 hours.
          </p>
          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              onClick={() => { setSent(false); setTopic(null); }}
              className="btn-blue-outline"
              style={{ padding: '8px 18px', fontSize: 12 }}
            >
              Send another message
            </button>
          </div>
        </div>
      ) : !topic ? (
        <ul className="space-y-3">
          {TOPICS.map((t) => (
            <li key={t.key}>
              <button
                onClick={() => { setTopic(t.key); setError(''); }}
                className={`w-full text-left bg-white border rounded-2xl p-5 transition-colors ${
                  t.key === 'safety' ? 'border-red-200 hover:border-red-400' : 'border-taupe/20 hover:border-blue'
                }`}
              >
                <p className={`font-display text-lg ${t.key === 'safety' ? 'text-red-700' : 'text-espresso'}`}>{t.label}</p>
                <p className="text-sm text-espresso/80 mt-1 leading-relaxed">{t.blurb}</p>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <form onSubmit={submit} className="bg-white border border-taupe/20 rounded-2xl p-7 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className={`font-display text-lg ${meta?.key === 'safety' ? 'text-red-700' : 'text-espresso'}`}>{meta?.label}</h2>
            <button type="button" onClick={() => { setTopic(null); setBody(''); setError(''); }} className="text-xs text-taupe hover:text-espresso">
              Change topic
            </button>
          </div>
          <p className="text-sm text-espresso/80 leading-relaxed">{meta?.blurb}</p>

          <div>
            <label className="field-label" htmlFor="contact_body">Your message</label>
            <textarea
              id="contact_body"
              rows={7}
              maxLength={4000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={meta?.placeholder}
              className="field-input resize-none"
              required
            />
            <p className="text-xs text-taupe mt-1 text-right">{body.length}/4000</p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => { setTopic(null); setBody(''); }} className="label-caps text-taupe hover:text-espresso px-3">
              Cancel
            </button>
            <button type="submit" disabled={sending || !body.trim()} className="btn-blue disabled:opacity-60">
              {sending ? 'Sending...' : 'Send message'}
            </button>
          </div>
        </form>
      )}
    </PageShell>
  );
}
