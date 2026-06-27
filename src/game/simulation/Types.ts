/** Core types for Loophole simulation */

export interface Vec2 {
  x: number;
  y: number;
}

/** Arena zones the hero can occupy */
export enum ZoneId {
  LeftPlatform = 'left',
  LeftWalkway = 'leftWalk',
  CenterPlatform = 'center',
  RightWalkway = 'rightWalk',
  RightPlatform = 'right',
  Pit = 'pit',
}

/** Zones that are actually reachable */
export const PLAYABLE_ZONES: ZoneId[] = [
  ZoneId.LeftPlatform,
  ZoneId.LeftWalkway,
  ZoneId.CenterPlatform,
  ZoneId.RightWalkway,
  ZoneId.RightPlatform,
];

/** Pre-computed zone-to-index mapping (avoids indexOf in hot paths) */
export const ZONE_INDEX: Record<string, number> = {
  [ZoneId.LeftPlatform]: 0,
  [ZoneId.LeftWalkway]: 1,
  [ZoneId.CenterPlatform]: 2,
  [ZoneId.RightWalkway]: 3,
  [ZoneId.RightPlatform]: 4,
};


/** Named platform zones (where rules can be placed) */
export const PLATFORM_ZONES: ZoneId[] = [
  ZoneId.LeftPlatform,
  ZoneId.CenterPlatform,
  ZoneId.RightPlatform,
];

/** Rule types available in prototype */
export enum RuleType {
  FlameVent = 'flameVent',
  SpikeWall = 'spikeWall',
  SentryOrb = 'sentryOrb',
  GravityWell = 'gravityWell',
  TemporalRift = 'temporalRift',
}

/** Pre-computed rule-type-to-index mapping */
export const RULE_TYPE_INDEX: Record<string, number> = {
  [RuleType.FlameVent]: 0,
  [RuleType.SpikeWall]: 1,
  [RuleType.SentryOrb]: 2,
  [RuleType.GravityWell]: 3,
  [RuleType.TemporalRift]: 4,
};

export interface RuleCard {
  id: string;
  type: RuleType;
  zone: ZoneId;
  /** Primary parameter: cooldown/interval in seconds */
  param: number;
  /** Is this rule currently active? */
  active: boolean;
}

export interface RuleState {
  /** Rule definition */
  card: RuleCard;
  /** Time elapsed since last trigger (for TimerHazard types) */
  timer: number;
  /** Whether the rule is currently in its "active" visual state */
  isErupting: boolean;
  /** Extra state for SpikeWall: the wall is up? */
  wallUp: boolean;
  /** Extra state for SentryOrb: projectile position (null = inactive) */
  projectile: { x: number; y: number; vx: number; vy: number } | null;
}

/** Hero actions */
export enum HeroAction {
  MoveLeft = 'moveLeft',
  MoveRight = 'moveRight',
  Jump = 'jump',
  Wait = 'wait',
  Dash = 'dash',
}

/** Zones have connectivity for pathfinding */
export const ZONE_CONNECTIONS: Record<ZoneId, ZoneId[]> = {
  [ZoneId.LeftPlatform]:   [ZoneId.LeftWalkway],
  [ZoneId.LeftWalkway]:    [ZoneId.LeftPlatform, ZoneId.CenterPlatform],
  [ZoneId.CenterPlatform]: [ZoneId.LeftWalkway, ZoneId.RightWalkway],
  [ZoneId.RightWalkway]:   [ZoneId.CenterPlatform, ZoneId.RightPlatform],
  [ZoneId.RightPlatform]:  [ZoneId.RightWalkway],
  [ZoneId.Pit]:            [],
};

/** Visual positions of each zone on screen (fraction of game width/height) */
export const ZONE_POSITIONS: Record<ZoneId, { x: number; y: number }> = {
  [ZoneId.LeftPlatform]:   { x: 0.35, y: 0.6 },
  [ZoneId.LeftWalkway]:    { x: 0.45, y: 0.75 },
  [ZoneId.CenterPlatform]: { x: 0.55, y: 0.45 },
  [ZoneId.RightWalkway]:   { x: 0.72, y: 0.75 },
  [ZoneId.RightPlatform]:  { x: 0.85, y: 0.6 },
  [ZoneId.Pit]:            { x: 0.55, y: 0.9 },
};

/** Simulation state snapshot (serializable) */
export interface SimulationSnapshot {
  hero: {
    zone: ZoneId;
    hp: number;
    action: HeroAction;
    alive: boolean;
    elapsedTime: number;
  };
  rules: RuleState[];
  boss: {
    alive: boolean;
    phase: number;
  };
  attemptNumber: number;
  heroWon: boolean;
}

/** A memory entry in Glimmer's strategy tree */
export interface MemoryEntry {
  zone: ZoneId;
  ruleType: RuleType | null;
  outcome: 'damage' | 'safe' | 'dodge';
  timestamp: number;
  attempt: number;
}

/** Configuration for the entire simulation */
export const GAME_CONFIG = {
  HERO_MAX_HP: 3,
  HERO_DASH_COOLDOWN: 3,
  GLIMMER_REACTION_MS: 300,
  ATTEMPT_DURATION: 20,
  RULE_DEPLOY_TIME: 3,
  FLAME_DURATION: 1.5,
  SPIKE_DURATION: 2,
  ORB_SPEED: 120,
};
