export type Graha = 'Sun' | 'Moon' | 'Mars' | 'Mercury' | 'Jupiter' | 'Venus' | 'Saturn' | 'Rahu' | 'Ketu';

export type Ayanamsa = 'lahiri' | 'raman' | 'kp' | 'yukteshwar' | 'fagan-bradley' | 'true-chitra';

export type GrahaPosition = {
  graha: Graha;
  longitude: number;
  rasi: number;
  isRetrograde: boolean;
  isCombust: boolean;
  isFast: boolean;
};

export type D1Chart = {
  ascendantRasi: number;
  ascendantLongitude?: number;
  grahas: GrahaPosition[];
};
