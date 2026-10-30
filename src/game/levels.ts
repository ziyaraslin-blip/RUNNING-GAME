import { LandmarkType, RunnerZoneDefinition } from './types';

/**
 * Six real-life Wayanad route corridors along NH-766 & SH-29:
 * Ascending from Thamarassery Churam's 9 Hairpin Bends through Lakkidi,
 * Meppadi's tea estates, Ambukuthi/Edakkal granite pass, Soochipara gorge,
 * Kuruvadweep bamboo causeway, and Banasura Sagar's earthen dam crest.
 */
/** Gentle speed increment applied every 100m reached during a run */
export const SPEED_STEP_PER_100M = 0.38;
export const MAX_BASE_RUN_SPEED = 20.8;

export const WAYANAD_ZONES: RunnerZoneDefinition[] = [
  {
    index: 0,
    name: 'Thamarassery Churam',
    malayalamRegion: 'NH-766 · Hairpin 9/9 to Lakkidi',
    landmark: LandmarkType.LakkidiViewpoint,
    startDistance: 0,
    skyHex: 0x3b5954,
    fogDensity: 0.0135,
    baseSpeed: 11.2,
  },
  {
    index: 1,
    name: 'Meppadi Tea Highway',
    malayalamRegion: 'Vythiri – Chembra Estates',
    landmark: LandmarkType.ChembraHeartLake,
    startDistance: 260,
    skyHex: 0x3e6659,
    fogDensity: 0.012,
    baseSpeed: 11.6,
  },
  {
    index: 2,
    name: 'Ambukuthi – Edakkal Pass',
    malayalamRegion: 'Sulthan Bathery Granite Ghat',
    landmark: LandmarkType.EdakkalCaves,
    startDistance: 520,
    skyHex: 0x4b524f,
    fogDensity: 0.014,
    baseSpeed: 12.0,
  },
  {
    index: 3,
    name: 'Soochipara Gorge Road',
    malayalamRegion: 'Vellarimala Waterfall Bridge',
    landmark: LandmarkType.SoochiparaFalls,
    startDistance: 780,
    skyHex: 0x2c4a54,
    fogDensity: 0.0165,
    baseSpeed: 12.4,
  },
  {
    index: 4,
    name: 'Kuruvadweep Causeway',
    malayalamRegion: 'Kabini River Bamboo Corridor',
    landmark: LandmarkType.KuruvadweepIslands,
    startDistance: 1040,
    skyHex: 0x335c49,
    fogDensity: 0.0135,
    baseSpeed: 12.8,
  },
  {
    index: 5,
    name: 'Banasura Sagar Crest',
    malayalamRegion: 'Padinjarathara Dam Highway',
    landmark: LandmarkType.BanasuraDam,
    startDistance: 1300,
    skyHex: 0x354a5c,
    fogDensity: 0.013,
    baseSpeed: 13.2,
  },
];

export function getZoneForDistance(
  distanceMeters: number,
  startZoneOffset = 0
): RunnerZoneDefinition {
  const virtualDist =
    distanceMeters + WAYANAD_ZONES[startZoneOffset].startDistance;
  const wrapped = virtualDist % 1560;
  for (let i = WAYANAD_ZONES.length - 1; i >= 0; i--) {
    if (wrapped >= WAYANAD_ZONES[i].startDistance) {
      return WAYANAD_ZONES[i];
    }
  }
  return WAYANAD_ZONES[0];
}
