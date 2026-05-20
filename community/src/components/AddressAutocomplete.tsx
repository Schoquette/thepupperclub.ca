import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  /** The formatted address string. Used as the controlled value. */
  value: string;
  /** Called whenever the input value changes (typed or selected). */
  onChange: (v: string) => void;
  /**
   * Called when the user picks a Google Place suggestion. The string is the
   * fully-formatted address that Google returned, which is the form the
   * Laravel geocoder works best with.
   */
  onSelect?: (formatted: string) => void;
  /** Restrict to countries (lowercase ISO codes). Defaults to ['ca']. */
  countries?: string[];
  id?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

// Module-level guards so we only inject the Google Maps script once even if
// the component is mounted in multiple places.
let googleScriptPromise: Promise<void> | null = null;

function loadGooglePlaces(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  // Already loaded.
  if ((window as any).google?.maps?.places) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      googleScriptPromise = null;
      reject(new Error('Failed to load Google Maps Places.'));
    };
    document.head.appendChild(script);
  });
  return googleScriptPromise;
}

/**
 * Single-input address picker backed by Google Places Autocomplete.
 *
 * Members type an address and Google offers matching street addresses
 * (country-restricted). Picking one fires `onSelect(formatted_address)`,
 * which we use to populate the controlled value and which the backend
 * then geocodes to a geohash. The "Selected" pill confirms the user
 * actually chose a real address rather than free-typing one.
 *
 * Falls back gracefully to a plain text input if `VITE_GOOGLE_MAPS_KEY`
 * is missing, so local development without the key still works.
 */
export default function AddressAutocomplete({
  value, onChange, onSelect,
  countries = ['ca'],
  id, placeholder, required, className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const onChangeRef = useRef(onChange);
  const onSelectRef = useRef(onSelect);
  onChangeRef.current = onChange;
  onSelectRef.current = onSelect;

  const [ready, setReady] = useState<boolean>(
    typeof window !== 'undefined' && !!(window as any).google?.maps?.places,
  );
  const [hasPicked, setHasPicked] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const apiKey: string | undefined = (import.meta as any).env?.VITE_GOOGLE_MAPS_KEY;
    if (!apiKey) { setLoadError(true); return; }
    loadGooglePlaces(apiKey)
      .then(() => setReady(true))
      .catch(() => setLoadError(true));
  }, []);

  const attachAutocomplete = useCallback(() => {
    if (!ready || !inputRef.current || autocompleteRef.current) return;
    const ac = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: countries },
      types: ['address'],
      fields: ['formatted_address', 'address_components', 'geometry'],
    });
    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      const formatted = place.formatted_address;
      if (!formatted) return;
      setHasPicked(true);
      onChangeRef.current(formatted);
      onSelectRef.current?.(formatted);
    });
    autocompleteRef.current = ac;
  }, [ready, countries]);

  useEffect(() => { attachAutocomplete(); }, [attachAutocomplete]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        autoComplete="street-address"
        required={required}
        value={value}
        onChange={(e) => { setHasPicked(false); onChange(e.target.value); }}
        placeholder={placeholder ?? 'Start typing your address...'}
        className={className ?? 'field-input'}
      />
      {hasPicked && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-[0.18em] text-blue bg-blue/10 rounded-full px-2 py-1">
          Selected
        </span>
      )}
      {loadError && (
        <p className="text-xs text-taupe mt-1">
          Autocomplete unavailable right now &mdash; please type the full
          address including city and postal code.
        </p>
      )}
    </div>
  );
}

// Minimal ambient typing so the file compiles without the Google Maps SDK
// `.d.ts` package installed. We only access these narrow surfaces.
declare global {
  namespace google.maps.places {
    class Autocomplete {
      constructor(input: HTMLInputElement, opts: any);
      addListener(eventName: string, handler: () => void): void;
      getPlace(): { formatted_address?: string; address_components?: any[]; geometry?: any };
    }
  }
}
