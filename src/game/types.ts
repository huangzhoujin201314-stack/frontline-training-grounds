export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type HitMarkerType = 'none' | 'normal' | 'headshot' | 'kill';

export type EndReason = 'time' | 'eliminated' | 'victory';

export interface KillFeedItem {
  id: number;
  botName: string;
  headshot: boolean;
  points: number;
  timestamp: number;
}

export interface HudSnapshot {
  phase: GamePhase;
  score: number;
  kills: number;
  headshots: number;
  shotsFired: number;
  shotsHit: number;
  streak: number;
  maxStreak: number;
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  ammo: number;
  magSize: number;
  reserveAmmo: number;
  isReloading: boolean;
  reloadProgress: number;
  isAds: boolean;
  isSprinting: boolean;
  timeLeft: number;
  totalTime: number;
  wave: number;
  waveKills: number;
  waveTarget: number;
  objectiveTitle: string;
  objectiveDesc: string;
  hitMarkerType: HitMarkerType;
  hitSeq: number;
  damageFlash: number;
  damageAngle: number;
  crosshairSpread: number;
  killFeed: KillFeedItem[];
  pointerLocked: boolean;
  endReason: EndReason;
  muted: boolean;
  sensitivity: number;
  touchMode: boolean;
  webglError: string | null;
}

export interface ColliderBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  tag?: string;
}

export interface RampVolume {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  yLow: number;
  yHigh: number;
  /** Direction along which height ascends from yLow to yHigh */
  ascendDir: '+z' | '-z' | '+x' | '-x';
}

export interface TouchInputState {
  moveX: number; // -1..1
  moveY: number; // -1..1 (forward positive)
  firing: boolean;
  ads: boolean;
  sprinting: boolean;
}
