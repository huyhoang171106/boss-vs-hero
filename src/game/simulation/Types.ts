/**
 * DEADLOCK — Core Types
 * 
 * One trap. Manual activation. AI mind games.
 */

// ═══════════════════════════════════════════════════════
// ARENA ZONES
// ═══════════════════════════════════════════════════════

/** Arena zones — hero crosses from left to right */
export enum ZoneId {
  Zone1 = 'zone1',  // Hero start
  Zone2 = 'zone2',
  Zone3 = 'zone3',  // Boss zone (center)
  Zone4 = 'zone4',
  Zone5 = 'zone5',  // Hero goal (right)
}

/** All zones in order */
export const ALL_ZONES: ZoneId[] = [
  ZoneId.Zone1,
  ZoneId.Zone2,
  ZoneId.Zone3,
  ZoneId.Zone4,
  ZoneId.Zone5,
];

/** Zones where traps can be placed (not Zone1 - hero start) */
export const TRAP_ZONES: ZoneId[] = [
  ZoneId.Zone2,
  ZoneId.Zone3,
  ZoneId.Zone4,
  ZoneId.Zone5,
];

/** Pre-computed zone-to-index mapping */
export const ZONE_INDEX: Record<string, number> = {
  [ZoneId.Zone1]: 0,
  [ZoneId.Zone2]: 1,
  [ZoneId.Zone3]: 2,
  [ZoneId.Zone4]: 3,
  [ZoneId.Zone5]: 4,
};

/** Zone connections (linear) */
export const ZONE_CONNECTIONS: Record<ZoneId, ZoneId[]> = {
  [ZoneId.Zone1]: [ZoneId.Zone2],
  [ZoneId.Zone2]: [ZoneId.Zone1, ZoneId.Zone3],
  [ZoneId.Zone3]: [ZoneId.Zone2, ZoneId.Zone4],
  [ZoneId.Zone4]: [ZoneId.Zone3, ZoneId.Zone5],
  [ZoneId.Zone5]: [ZoneId.Zone4],
};

/** Visual positions of each zone (fraction of game width/height) */
export const ZONE_POSITIONS: Record<ZoneId, { x: number; y: number }> = {
  [ZoneId.Zone1]: { x: 0.15, y: 0.5 },
  [ZoneId.Zone2]: { x: 0.325, y: 0.5 },
  [ZoneId.Zone3]: { x: 0.5, y: 0.5 },
  [ZoneId.Zone4]: { x: 0.675, y: 0.5 },
  [ZoneId.Zone5]: { x: 0.85, y: 0.5 },
};

// ═══════════════════════════════════════════════════════
// TRAP TYPES
// ═══════════════════════════════════════════════════════

/** Trap types — each has unique properties */
export enum TrapType {
  Fire = 'fire',
  Ice = 'ice',
  Spike = 'spike',
  Void = 'void',
}

/** Trap type configurations */
export const TRAP_CONFIG: Record<TrapType, {
  damage: number;
  cooldown: number;
  duration: number;
  description: string;
  color: string;
  heroCounter: string;
}> = {
  [TrapType.Fire]: {
    damage: 2,
    cooldown: 2,
    duration: 2,
    description: 'High damage, instant activation',
    color: '#ff4444',
    heroCounter: 'Dash through during cooldown',
  },
  [TrapType.Ice]: {
    damage: 1,
    cooldown: 2,
    duration: 4,
    description: 'Slows hero for 2 seconds',
    color: '#44aaff',
    heroCounter: 'Jump over before activation',
  },
  [TrapType.Spike]: {
    damage: 2,
    cooldown: 2,
    duration: 1,
    description: 'Delayed activation (0.5s)',
    color: '#ffaa00',
    heroCounter: 'Move during delay window',
  },
  [TrapType.Void]: {
    damage: 0,
    cooldown: 2,
    duration: 3,
    description: 'Teleports hero to random zone',
    color: '#aa44ff',
    heroCounter: 'Avoid the zone entirely',
  },
};

// ═══════════════════════════════════════════════════════
// HERO ACTIONS
// ═══════════════════════════════════════════════════════

/** Hero actions */
export enum HeroAction {
  MoveLeft = 'moveLeft',
  MoveRight = 'moveRight',
  Jump = 'jump',
  Wait = 'wait',
  Dash = 'dash',
}

/** Hero abilities (unlocked through deaths) */
export enum HeroAbility {
  Dash = 'dash',
  Shield = 'shield',
  DoubleJump = 'doubleJump',
}

// ═══════════════════════════════════════════════════════
// AI STRATEGIES
// ═══════════════════════════════════════════════════════

/** AI strategies for approaching traps */
export enum AIStrategy {
  Rush = 'rush',       // Sprint through, ignore trap
  Bait = 'bait',       // Fake approach, retreat
  Wait = 'wait',       // Stand still, observe
  Feint = 'feint',     // Quick movement one way, reverse
  Dash = 'dash',       // Quick movement through trap zone
}

// ═══════════════════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════════════════

/** Trap state */
export interface TrapState {
  type: TrapType;
  zone: ZoneId;
  active: boolean;
  cooldownTimer: number;
  activeTimer: number;
  /** Whether trap is currently "fired" (visual effect active) */
  fired: boolean;
}

/** Hero state */
export interface HeroState {
  zone: ZoneId;
  hp: number;
  maxHp: number;
  alive: boolean;
  won: boolean;
  /** Abilities unlocked */
  abilities: Set<HeroAbility>;
  /** Cooldowns */
  dashCooldown: number;
  shieldHp: number;
  doubleJumpReady: boolean;
}

/** Memory entry for AI learning */
export interface MemoryEntry {
  zone: ZoneId;
  trapType: TrapType | null;
  outcome: 'hit' | 'miss' | 'safe' | 'dodged';
  timestamp: number;
  attempt: number;
  /** What strategy was used */
  strategy: AIStrategy;
}

/** AI journal entry for display */
export interface AIJournalEntry {
  thought: string;
  timestamp: number;
  attempt: number;
  zone: ZoneId;
}

// ═══════════════════════════════════════════════════════
// GAME CONFIGURATION
// ═══════════════════════════════════════════════════════

export const GAME_CONFIG = {
  // Hero
  HERO_MAX_HP: 3,
  HERO_DASH_COOLDOWN: 3,
  HERO_DASH_DURATION: 0.3,
  HERO_SHIELD_HP: 1,
  
  // Trap
  TRAP_ACTIVATION_DELAY: 0.5,  // Spike delay
  TRAP_COOLDOWN: 2,
  
  // AI
  AI_REACTION_MS: 300,
  AI_FAKE_CHANCE: 0.3,
  AI_LEARNING_RATE: 0.1,
  
  // Game
  ATTEMPT_DURATION: 30,
  STARTING_KILLS: 0,
  
  // Scoring
  BASE_SCORE: 100,
  EFFICIENCY_BONUS: 0.5,  // Per fewer activation
  SPEED_BONUS: 0.1,       // Per second faster
  
  // Progression
  UNLOCK_DASH_AT: 2,
  UNLOCK_SHIELD_AT: 5,
  UNLOCK_DOUBLE_JUMP_AT: 9,
  UNLOCK_SECOND_TRAP_AT: 12,
  UNLOCK_ARENA_MOD_AT: 15,
  UNLOCK_THIRD_TRAP_AT: 20,
  AI_HP_PER_5_KILLS: 1,
  AI_REACTION_REDUCTION: 25,
  AI_REACTION_REDUCTION_EVERY: 3,
};

// ═══════════════════════════════════════════════════════
// SCORE
// ═══════════════════════════════════════════════════════

/** Score breakdown */
export interface ScoreBreakdown {
  base: number;
  efficiency: number;
  speed: number;
  streak: number;
  total: number;
  activationsUsed: number;
  timeToKill: number;
}
