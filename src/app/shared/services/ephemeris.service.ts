import { Injectable } from '@angular/core';
import type SwissEphemeris from 'swisseph-wasm';
import { Ayanamsa, D1Chart, Graha, GrahaPosition } from './ephemeris.model';

const SWISSEPH_CDN_URL = 'https://cdn.jsdelivr.net/npm/swisseph-wasm@0.1.0/src/swisseph.js';

const GRAHA_PLANET_IDS: Record<Exclude<Graha, 'Ketu'>, number> = {
  Sun: 0,
  Moon: 1,
  Mercury: 2,
  Venus: 3,
  Mars: 4,
  Jupiter: 5,
  Saturn: 6,
  Rahu: 11,
};

const EPHEMERIS_FLAG_SWISS = 2;
const EPHEMERIS_FLAG_SIDEREAL = 65536;
const EPHEMERIS_FLAG_SPEED = 256;

// Classical combustion (Asta) orbs in degrees from the Sun - Sun/Rahu/Ketu
// are not subject to combustion, so they're intentionally absent here.
const COMBUSTION_ORB_DEG: Partial<Record<Graha, number>> = {
  Moon: 12,
  Mars: 17,
  Mercury: 14,
  Jupiter: 11,
  Venus: 10,
  Saturn: 15,
};

// Classical mean daily motion (degrees/day) - used only as a per-graha
// reference scale for isFast ("atichari"/unusually fast transit, per
// Sarvatobhadra Chakra's vedha rule), not as the position calculation
// itself. Relative, not a fixed absolute degrees/day cutoff, since grahas'
// normal speeds span two orders of magnitude (Saturn ~0.03/day vs Moon
// ~13/day).
const MEAN_DAILY_MOTION: Record<Graha, number> = {
  Sun: 0.9856,
  Moon: 13.176,
  Mars: 0.524,
  Mercury: 1.383,
  Jupiter: 0.0831,
  Venus: 1.602,
  Saturn: 0.0334,
  Rahu: 0.0529,
  Ketu: 0.0529,
};

const SIDEREAL_MODE_BY_AYANAMSA: Record<Ayanamsa, number> = {
  lahiri: 1,
  raman: 3,
  kp: 5,
  yukteshwar: 7,
  'fagan-bradley': 0,
  'true-chitra': 27,
};

type GrahaLongitudeSpeed = { longitude: number; longitudeSpeed: number };

type RawPositions = {
  grahaData: Record<Graha, GrahaLongitudeSpeed>;
  ascendantLongitude: number;
};

@Injectable({ providedIn: 'root' })
export class EphemerisService {
  #swissEphemeris: SwissEphemeris | null = null;
  #initPromise: Promise<SwissEphemeris> | null = null;

  async calculateD1Chart(datetime: Date, latitude: number, longitude: number, ayanamsa: Ayanamsa): Promise<D1Chart> {
    const { grahaData, ascendantLongitude } = await this.#calculateRawPositions(
      datetime,
      latitude,
      longitude,
      ayanamsa,
    );

    const grahas = this.#toGrahaPositions(grahaData, this.#toRasi);
    return { ascendantRasi: this.#toRasi(ascendantLongitude), ascendantLongitude, grahas };
  }

  #toGrahaPositions(
    grahaData: Record<Graha, GrahaLongitudeSpeed>,
    toRasi: (longitude: number) => number,
  ): GrahaPosition[] {
    const sunLongitude = grahaData.Sun.longitude;

    return Object.entries(grahaData).map(([graha, { longitude, longitudeSpeed }]) => {
      const combustionOrb = COMBUSTION_ORB_DEG[graha as Graha];
      const meanDailyMotion = MEAN_DAILY_MOTION[graha as Graha];
      return {
        graha: graha as Graha,
        longitude,
        rasi: toRasi(longitude),
        isRetrograde: longitudeSpeed < 0,
        isCombust: combustionOrb !== undefined && this.#angularDistance(longitude, sunLongitude) <= combustionOrb,
        isFast: Math.abs(longitudeSpeed) > meanDailyMotion,
      };
    });
  }

  #angularDistance(a: number, b: number): number {
    const diff = Math.abs(a - b) % 360;
    return diff > 180 ? 360 - diff : diff;
  }

  async #calculateRawPositions(
    datetime: Date,
    latitude: number,
    longitude: number,
    ayanamsa: Ayanamsa,
  ): Promise<RawPositions> {
    const ephemeris = await this.#getEphemeris();
    ephemeris.set_sid_mode(SIDEREAL_MODE_BY_AYANAMSA[ayanamsa], 0, 0);
    const julianDay = this.#toJulianDay(ephemeris, datetime);

    const grahaData = this.#calculateGrahaData(ephemeris, julianDay);
    const houses = ephemeris.houses_ex(julianDay, EPHEMERIS_FLAG_SIDEREAL, latitude, longitude, 'W');

    return { grahaData, ascendantLongitude: houses.ascmc[0] };
  }

  #calculateGrahaData(ephemeris: SwissEphemeris, julianDay: number): Record<Graha, GrahaLongitudeSpeed> {
    const grahaData = {} as Record<Graha, GrahaLongitudeSpeed>;
    for (const [graha, planetId] of Object.entries(GRAHA_PLANET_IDS)) {
      const [longitude, , , longitudeSpeed] = ephemeris.calc_ut(
        julianDay,
        planetId,
        EPHEMERIS_FLAG_SWISS | EPHEMERIS_FLAG_SIDEREAL | EPHEMERIS_FLAG_SPEED,
      );
      grahaData[graha as Graha] = { longitude, longitudeSpeed };
    }
    grahaData.Ketu = {
      longitude: ephemeris.degnorm(grahaData.Rahu.longitude + 180),
      longitudeSpeed: grahaData.Rahu.longitudeSpeed,
    };
    return grahaData;
  }

  #toJulianDay(ephemeris: SwissEphemeris, datetime: Date): number {
    return ephemeris.julday(
      datetime.getUTCFullYear(),
      datetime.getUTCMonth() + 1,
      datetime.getUTCDate(),
      datetime.getUTCHours() + datetime.getUTCMinutes() / 60 + datetime.getUTCSeconds() / 3600,
    );
  }

  #toRasi(longitude: number): number {
    return Math.floor(longitude / 30);
  }

  async #getEphemeris(): Promise<SwissEphemeris> {
    if (this.#swissEphemeris) {
      return this.#swissEphemeris;
    }
    this.#initPromise ??= this.#init();
    return this.#initPromise;
  }

  async #init(): Promise<SwissEphemeris> {
    const { default: SwissEphCtor } = await import(/* @vite-ignore */ SWISSEPH_CDN_URL);
    const ephemeris: SwissEphemeris = new SwissEphCtor();
    await ephemeris.initSwissEph();
    this.#swissEphemeris = ephemeris;
    return ephemeris;
  }
}
