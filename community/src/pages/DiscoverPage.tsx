import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function DiscoverPage() {
  const { member, signOut } = useAuth();
  const radiusKm = member?.radius_meters ? (member.radius_meters / 1000).toFixed(1) : '1';

  return (
    <div className="min-h-screen px-8 py-12">
      <header className="max-w-4xl mx-auto flex items-center justify-between mb-12">
        <p className="label-caps text-blue">The Pupper Club &mdash; Community</p>
        <div className="flex items-center gap-6">
          <Link to="/home" className="label-caps text-taupe hover:text-espresso">Home</Link>
          <button onClick={signOut} className="label-caps text-taupe hover:text-espresso">Sign Out</button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto">
        <h1 className="font-display text-3xl text-espresso mb-3">Your neighbours.</h1>
        <p className="text-espresso/80 leading-relaxed mb-12">
          Verified members within about {radiusKm} km of you will appear here.
          You&rsquo;ll see a first name, a short intro, and approximate
          distance &mdash; never an address.
        </p>

        <div className="bg-white border border-taupe/20 rounded-2xl p-12 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue/10 text-blue mb-5">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="10" r="3" />
              <path d="M12 2a8 8 0 0 0-8 8c0 7 8 12 8 12s8-5 8-12a8 8 0 0 0-8-8z" />
            </svg>
          </div>
          <h2 className="font-display text-xl text-espresso mb-3">Quiet here for now.</h2>
          <p className="text-espresso/80 leading-relaxed max-w-md mx-auto">
            We&rsquo;re still gathering the first neighbours in your area.
            We&rsquo;ll send you an email as soon as people start joining
            within your radius.
          </p>
          <p className="text-xs text-taupe mt-6">
            Want to invite someone? Send them to <span className="text-espresso">thepupperclub.ca/community</span>.
          </p>
        </div>
      </main>
    </div>
  );
}
