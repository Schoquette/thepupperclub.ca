interface Props {
  verified?: boolean;
  /** When true (the default), nothing renders for non-verified members.
   *  Useful in inline contexts where we only want a marker when present. */
  inlineOnly?: boolean;
}

/**
 * Small "ID verified" badge. Verification is optional in the Community;
 * this is a soft trust signal, not a status gate.
 */
export default function VerifiedBadge({ verified, inlineOnly = true }: Props) {
  if (!verified) {
    if (inlineOnly) return null;
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-taupe label-caps">
        Not Verified
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue bg-blue/10 rounded-full px-2 py-0.5"
      title="ID verified through Stripe Identity"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      Verified
    </span>
  );
}
