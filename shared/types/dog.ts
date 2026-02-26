export type DogSize = 'small' | 'medium' | 'large' | 'extra_large';
export type DogSex = 'male' | 'female';

export interface Dog {
  id: number;
  user_id: number;
  name: string;
  breed: string | null;
  date_of_birth: string | null;
  size: DogSize | null;
  sex: DogSex | null;
  weight_kg: number | null;
  colour: string | null;
  microchip_number: string | null;
  spayed_neutered: boolean;
  bite_history: boolean;
  bite_history_notes: string | null;
  aggression_notes: string | null;
  vet_name: string | null;
  vet_phone: string | null;
  vet_address: string | null;
  medications: Medication[];
  special_instructions: string | null;
  photo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Computed
  has_expired_vaccinations?: boolean;
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  notes: string | null;
}

export interface VaccinationRecord {
  id: number;
  dog_id: number;
  vaccine_name: string;
  administered_date: string;
  expiry_date: string | null;
  document_url: string | null;
  is_expired: boolean;
  created_at: string;
  updated_at: string;
}

export interface HomeAccess {
  id: number;
  user_id: number;
  entry_instructions: string | null;
  lockbox_code: string | null; // Only returned to admin (decrypted)
  door_code: string | null;    // Only returned to admin (decrypted)
  alarm_code: string | null;   // Only returned to admin (decrypted)
  key_location: string | null;
  parking_instructions: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
