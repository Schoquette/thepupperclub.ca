import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import PageShell from '@/components/PageShell';

export default function HomePage() {
  const { member } = useAuth();

  const isVerified  = member?.status === 'verified';
  const isSuspended = member?.status === 'suspended';
  const hasProfile  = !!(member?.introduction && member.introduction.trim().length > 0);

  return (
    <PageShell>
        <h1 className="font-display text-3xl text-espresso mb-3">Hi, {member?.name?.split(' ')[0] ?? 'neighbour'}.</h1>

        {isSuspended ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8">
            <p className="label-caps text-red-700 mb-3">Account Suspended</p>
            <p className="text-espresso/80 leading-relaxed">
              This account has been temporarily suspended. Please reach out
              to support if you believe this is in error.
            </p>
          </div>
        ) : !hasProfile ? (
          <>
            <p className="text-espresso/80 leading-relaxed mb-10">
              Welcome. A short profile gets you ready to browse neighbours
              nearby.
            </p>
            <div className="bg-white border border-taupe/20 rounded-2xl p-8">
              <p className="label-caps text-blue mb-3">First Step</p>
              <h2 className="font-display text-xl text-espresso mb-3">Set up your profile</h2>
              <p className="text-espresso/80 mb-6 leading-relaxed">
                Add a short intro, your pets, and tell us when you&rsquo;re
                typically available. We&rsquo;ll also ask for your address
                so we can find neighbours nearby &mdash; it&rsquo;s stored
                as a coarse area and never shown to other members.
              </p>
              <Link to="/profile-setup" className="btn-blue">Set Up Profile &rarr;</Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-espresso/80 leading-relaxed mb-10">
              You&rsquo;re all set. Head into Discover to see neighbours
              within your radius.
            </p>
            <div className="bg-white border border-taupe/20 rounded-2xl p-8 text-center">
              <p className="label-caps text-blue mb-3">{isVerified ? 'Verified' : 'Welcome'}</p>
              <h2 className="font-display text-xl text-espresso mb-3">Welcome to the Community.</h2>
              <Link to="/discover" className="btn-blue">Browse Neighbours &rarr;</Link>
              {member && (
                <p className="text-xs text-taupe mt-5 space-x-4">
                  <Link to={`/member/${member.id}`} className="hover:text-espresso underline">View my profile</Link>
                  <Link to="/profile-setup" className="hover:text-espresso underline">Edit profile</Link>
                  <Link to="/settings/blocks" className="hover:text-espresso underline">Blocked neighbours</Link>
                </p>
              )}
            </div>
          </>
        )}

        {/* Verification card — required to connect with neighbours or
            see names and photos. Browsing anonymously is fine without it. */}
        {!isSuspended && !isVerified && (
          <div className="bg-cream/60 border border-blue/20 rounded-2xl p-7 mt-8">
            <p className="label-caps text-blue mb-3">Required to connect</p>
            <h3 className="font-display text-lg text-espresso mb-2">Verify your identity ($5)</h3>
            <p className="text-sm text-espresso/80 mb-5 leading-relaxed">
              You can browse anonymously today. To send connection requests
              or unlock names and photos, verify your identity with a
              government ID + selfie. A one-time $5 fee covers Stripe&rsquo;s
              per-check cost &mdash; The Pupper Club doesn&rsquo;t earn from it.
            </p>
            <Link to="/verify" className="btn-blue-outline">Verify My Identity &rarr;</Link>
          </div>
        )}
    </PageShell>
  );
}
