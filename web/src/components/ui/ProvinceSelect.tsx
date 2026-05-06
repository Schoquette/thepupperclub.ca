import React from 'react';

const PROVINCES = [
  { value: 'AB', label: 'Alberta' },
  { value: 'BC', label: 'British Columbia' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'NB', label: 'New Brunswick' },
  { value: 'NL', label: 'Newfoundland and Labrador' },
  { value: 'NS', label: 'Nova Scotia' },
  { value: 'NT', label: 'Northwest Territories' },
  { value: 'NU', label: 'Nunavut' },
  { value: 'ON', label: 'Ontario' },
  { value: 'PE', label: 'Prince Edward Island' },
  { value: 'QC', label: 'Quebec' },
  { value: 'SK', label: 'Saskatchewan' },
  { value: 'YT', label: 'Yukon' },
];

interface Props {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

export function ProvinceSelect({ value, onChange, label = 'Province', className }: Props) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-espresso mb-1">{label}</label>
      <select
        className="input text-sm w-full"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">Select...</option>
        {PROVINCES.map(p => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>
    </div>
  );
}
