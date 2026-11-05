import type { Ayanamsa } from '../services/ephemeris.model';

export type BirthDetails = {
  name: string;
  dob: string;
  tob: string;
  cityLabel: string;
  lat: number;
  lng: number;
  timezone: string;
  ayanamsa: Ayanamsa;
};
