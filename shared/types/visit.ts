export type DogMood = 'great' | 'good' | 'okay' | 'anxious' | 'unwell';

export const MOOD_EMOJI: Record<DogMood, string> = {
  great: '🐾',
  good: '😊',
  okay: '😐',
  anxious: '😟',
  unwell: '🤒',
};

export interface VisitReport {
  id: number;
  appointment_id: number;
  eliminated: boolean;
  ate_well: boolean;
  drank_water: boolean;
  mood: DogMood;
  energy_level: 'high' | 'normal' | 'low';
  distance_km: number | null;
  notes: string | null;
  photo_urls: string[];
  created_at: string;
  updated_at: string;
}
