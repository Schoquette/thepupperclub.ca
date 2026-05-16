import { useAuth } from '@/contexts/AuthContext';

export default function HomePage() {
  const { member, signOut } = useAuth();

  return (
    <div className="min-h-screen px-8 py-12">
      <header className="max-w-4xl mx-auto flex items-center justify-between mb-12">
        <p className="label-caps text-blue">The Pupper Club &mdash; Community</p>
        <button onClick={signOut} className="label-caps text-taupe hover:text-espresso">
          Sign Out
        </button>
      </header>

      <main className="max-w-2xl mx-auto">
        <h1 className="font-display text-3xl text-espresso mb-3">Hi, {member?.name?.split(' ')[0] ?? 'neighbour'}.</h1>
        <p className="text-espresso/80 leading-relaxed mb-10">
          You&rsquo;re signed in. Before you can browse other neighbours or
          broadcast a care request, we&rsquo;ll need to verify your identity
          and address.
        </p>

        <div className="bg-white border border-taupe/20 rounded-2xl p-8">
          <p className="label-caps text-blue mb-3">Next Step</p>
          <h2 className="font-display text-xl text-espresso mb-3">Verify your identity</h2>
          <p className="text-espresso/80 mb-6 leading-relaxed">
            You&rsquo;ll upload a government-issued ID and take a quick selfie.
            It usually takes under a minute and is reviewed within a day.
          </p>
          <button
            className="btn-blue"
            disabled
            title="Verification flow is coming in the next update."
          >
            Begin Verification &rarr;
          </button>
          <p className="text-xs text-taupe mt-4">
            Verification is opening soon. We&rsquo;ll send you an email the
            moment it&rsquo;s available.
          </p>
        </div>

        <div className="mt-10 text-center text-sm text-taupe">
          Your account status: <span className="text-espresso font-semibold uppercase tracking-wider">{member?.status?.replace(/_/g, ' ') ?? '—'}</span>
        </div>
      </main>
    </div>
  );
}
