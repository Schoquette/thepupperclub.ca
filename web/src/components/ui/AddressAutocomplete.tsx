import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Input } from './Input';
import { ProvinceSelect } from './ProvinceSelect';

export interface AddressFields {
  street: string;
  city: string;
  province: string;
  postal_code: string;
}

interface Props {
  value: AddressFields;
  onChange: (fields: AddressFields) => void;
  label?: string;
}

let googleLoaded = false;
let googleLoading = false;
let googleLoadCallbacks: (() => void)[] = [];

function loadGooglePlaces(apiKey: string): Promise<void> {
  if (googleLoaded) return Promise.resolve();
  if (googleLoading) {
    return new Promise(resolve => {
      googleLoadCallbacks.push(resolve);
    });
  }

  googleLoading = true;
  return new Promise((resolve, reject) => {
    googleLoadCallbacks.push(resolve);
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.onload = () => {
      googleLoaded = true;
      googleLoading = false;
      googleLoadCallbacks.forEach(cb => cb());
      googleLoadCallbacks = [];
    };
    script.onerror = () => {
      googleLoading = false;
      reject(new Error('Failed to load Google Maps'));
    };
    document.head.appendChild(script);
  });
}

export default function AddressAutocomplete({ value, onChange, label }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [ready, setReady] = useState(googleLoaded);
  const [searchValue, setSearchValue] = useState(value.street);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_KEY;
    if (!apiKey) return;

    loadGooglePlaces(apiKey).then(() => setReady(true)).catch(() => {});
  }, []);

  const initAutocomplete = useCallback(() => {
    if (!inputRef.current || !ready || autocompleteRef.current) return;

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'ca' },
      types: ['address'],
      fields: ['address_components', 'formatted_address'],
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place.address_components) return;

      const fields: AddressFields = { street: '', city: '', province: '', postal_code: '' };
      let streetNumber = '';
      let route = '';

      for (const component of place.address_components) {
        const type = component.types[0];
        switch (type) {
          case 'street_number':
            streetNumber = component.long_name;
            break;
          case 'route':
            route = component.long_name;
            break;
          case 'locality':
            fields.city = component.long_name;
            break;
          case 'administrative_area_level_1':
            fields.province = component.short_name;
            break;
          case 'postal_code':
            fields.postal_code = component.long_name;
            break;
        }
      }

      fields.street = [streetNumber, route].filter(Boolean).join(' ');
      setSearchValue(fields.street);
      onChangeRef.current(fields);
    });

    autocompleteRef.current = autocomplete;
  }, [ready]);

  useEffect(() => {
    initAutocomplete();
  }, [initAutocomplete]);

  // Sync external value changes
  useEffect(() => {
    setSearchValue(value.street);
  }, [value.street]);

  return (
    <div className="space-y-3">
      {label && (
        <div className="text-xs font-semibold text-taupe uppercase tracking-wide">{label}</div>
      )}
      <div>
        <label className="block text-sm font-medium text-espresso mb-1">Street Address</label>
        <input
          ref={inputRef}
          type="text"
          className="input text-sm w-full"
          placeholder="Start typing an address..."
          value={searchValue}
          onChange={e => {
            setSearchValue(e.target.value);
            onChange({ ...value, street: e.target.value });
          }}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Input
          label="City"
          value={value.city}
          onChange={e => onChange({ ...value, city: e.target.value })}
        />
        <ProvinceSelect
          value={value.province}
          onChange={v => onChange({ ...value, province: v })}
        />
        <Input
          label="Postal Code"
          value={value.postal_code}
          onChange={e => onChange({ ...value, postal_code: e.target.value })}
          placeholder="V5K 1A1"
        />
      </div>
    </div>
  );
}
