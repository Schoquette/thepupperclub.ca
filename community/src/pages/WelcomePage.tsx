import { Link } from 'react-router-dom';

export default function WelcomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-8">
      <div className="max-w-lg w-full text-center">
        <p className="label-caps text-blue mb-6">The Pupper Club — Community</p>
        <h1 className="font-display text-3xl text-espresso leading-snug mb-5">
          A trusted neighbourhood<br />network for shared pet care.
        </h1>
        <p className="text-espresso/80 leading-relaxed mb-10">
          A small, trusted circle of verified neighbours who show up for each
          other &mdash; and for the pets they love. No marketplace, no money,
          no ratings. Just neighbours, nearby.
        </p>

        <div className="flex flex-col gap-3">
          <Link to="/sign-up" className="btn-blue">Create an Account</Link>
          <Link to="/sign-in" className="btn-blue-outline">I Have an Account</Link>
        </div>

        <p className="text-xs text-taupe mt-12 leading-relaxed">
          Membership is free. Verification is required before you can browse,
          message, or broadcast a care request.
        </p>
      </div>
    </div>
  );
}
