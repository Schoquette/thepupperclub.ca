import React, { useEffect, useRef } from 'react';

let googleLoaded = false;
let googleLoading = false;
let googleLoadCallbacks: (() => void)[] = [];

function loadGooglePlaces(apiKey: string): Promise<void> {
  if (googleLoaded) return Promise.resolve();
  if (googleLoading) return new Promise(resolve => { googleLoadCallbacks.push(resolve); });
  googleLoading = true;
  return new Promise((resolve, reject) => {
    googleLoadCallbacks.push(resolve);
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.onload = () => { googleLoaded = true; googleLoading = false; googleLoadCallbacks.forEach(cb => cb()); googleLoadCallbacks = []; };
    script.onerror = () => { googleLoading = false; reject(); };
    document.head.appendChild(script);
  });
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export default function SimpleAddressInput({ value, onChange, className, placeholder }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_KEY;
    if (!apiKey) return;
    loadGooglePlaces(apiKey).then(() => {
      if (!inputRef.current || autocompleteRef.current) return;
      const ac = new google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'ca' },
        types: ['address'],
        fields: ['formatted_address'],
      });
      ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        if (place.formatted_address) onChangeRef.current(place.formatted_address);
      });
      autocompleteRef.current = ac;
    }).catch(() => {});
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      className={className}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}
