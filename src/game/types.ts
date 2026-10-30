export enum LandmarkType {
  LakkidiViewpoint = 'lakkidi_viewpoint',
  ChembraHeartLake = 'chembra_heart_lake',
  EdakkalCaves = 'edakkal_caves',
  SoochiparaFalls = 'soochipara_falls',
  KuruvadweepIslands = 'kuruvadweep_islands',
  BanasuraDam = 'banasura_dam',
}

export enum ObstacleKind {
  /** Low fallen rosewood trunk / tea cart — Jump over (W / Up / Space) */
  JumpHurdle = 'jump_hurdle',
  /** Overhead banyan chain-tree arch / rock lintel — Slide under (S / Down) */
  SlideArch = 'slide_arch',
  /** Full-height Edakkal petroglyph monolith — Switch lanes (A / D) */
  SolidMonolith = 'solid_monolith',
  /** Lane-patrolling Wild Tusker with raised-trunk telegraph — Switch lanes */
  WildTusker = 'wild_tusker',
  /** Rushing Kabini gorge gap — Jump across */
  GorgeGap = 'gorge_gap',
}

export enum PowerupKind {
  None = 'none',
  CoinMagnet = 'coin_magnet',
  SpiceBoost = 'spice_boost',
}

export type GamePhase = 'title' | 'playing' | 'paused' | 'game_over';

/** Default 'elevated' gives the requested realistic slightly-above chase angle */
export type CameraPreset = 'elevated' | 'aerial' | 'close';

export interface RunnerZoneDefinition {
  index: number;
  name: string;
  malayalamRegion: string;
  landmark: LandmarkType;
  startDistance: number;
  skyHex: number;
  fogDensity: number;
  baseSpeed: number;
}

export interface HudSnapshot {
  phase: GamePhase;
  zoneIndex: number;
  zoneName: string;
  malayalamRegion: string;
  soundscapeLabel: string;
  distanceMeters: number;
  runSpeedKmh: number;
  milestoneBannerMeters: number;
  coins: number;
  totalCoinsBank: number;
  score: number;
  highScore: number;
  bestDistance: number;
  multiplier: number;
  /** 0 = monster far behind, 1 = monster right on player's heels! */
  monsterProximity: number;
  monsterAlert: boolean;
  magnetSeconds: number;
  boostSeconds: number;
  /** 4D Chrono-Shift gauge (0..100) and active state */
  chronoCharge: number;
  chronoActive: boolean;
  chronoSeconds: number;
  /** 4D Dynamic Atmosphere & Time-of-Day state */
  timeOfDayLabel: string;
  weatherLabel: string;
  fx4dEnabled: boolean;
  /** Live 4D lens feedback intensities (0..1) for subtle perimeter rain/warp */
  lensWetness: number;
  windCrossForce: number;
  lightningFlash: number;
  deathReason: string;
  cameraPreset: CameraPreset;
  muted: boolean;
  ambienceVolume: number;
  dockCollapsed: boolean;
  webglFallback: boolean;
}
