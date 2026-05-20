import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface Props {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  fallback?: React.ReactNode;
}

/**
 * Fetches an image via the authenticated API client (bearer token attached
 * by the axios interceptor) and renders it as an <img>. Used for member
 * and pet photos — the photo endpoints are connection-gated server-side,
 * so the same URL returns 404 from non-permitted viewers.
 */
export default function AuthImage({ src, alt = '', className, fallback }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!src) { setBlobUrl(null); return; }
    let revoke = '';
    setFailed(false);
    setBlobUrl(null);

    // The src starts with /api/... — axios baseURL already has /api, so
    // strip the leading /api so we don't double up.
    const path = src.startsWith('/api/') ? src.slice(4) : src;

    api.get(path, { responseType: 'blob' })
      .then((res) => {
        revoke = URL.createObjectURL(res.data);
        setBlobUrl(revoke);
      })
      .catch(() => setFailed(true));

    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [src]);

  if (!src || failed) return <>{fallback ?? null}</>;
  if (!blobUrl) return <div className={`${className ?? ''} bg-cream animate-pulse`} />;
  return <img src={blobUrl} alt={alt} className={className} />;
}
