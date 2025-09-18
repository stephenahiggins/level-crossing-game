export type GameMode = "easy" | "medium" | "hard";

export interface LevelCrossing {
  id: number;
  imagePath: string;
  countryCode: string;
  latitude: number | null;
  longitude: number | null;
}

export interface LevelCrossingRecord {
  id: number;
  image_path?: string;
  imagePath?: string;
  url?: string;
  country_code?: string;
  countryCode?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
}

export interface RoundOption {
  code: string;
  name: string;
}

export interface RoundData {
  crossing: LevelCrossing;
  options: RoundOption[];
  correctCode: string;
}

export interface RoundOutcome {
  crossingId: number;
  countryCode: string;
  attempts: number;
  success: boolean;
  duration: number;
}
