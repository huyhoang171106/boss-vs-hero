/**
 * DEADLOCK — Arena State
 * 
 * Mutable game state. Pure data, no rendering.
 */

import {
  ZoneId, ALL_ZONES, TRAP_ZONES, ZONE_INDEX,
  TrapType, HeroAction, HeroAbility,
  AIStrategy, GAME_CONFIG,
} from './Types';
import type { TrapState, HeroState, MemoryEntry, AIJournalEntry, ScoreBreakdown } from './Types';

/**
 * Core game state. Updated by simulation, read by renderer.
 */
export class ArenaState {
  // ═══════════════════════════════════════════════════════
  // ATTEMPT STATE
  // ═══════════════════════════════════════════════════════
  
  /** Current attempt number (1-indexed) */
  attemptNumber: number = 1;
  
  /** Time elapsed in current attempt (seconds) */
  elapsedTime: number = 0;
  
  /** Is the current attempt over? */
  attemptOver: boolean = false;
  
  /** Is the game paused? */
  isPaused: boolean = false;
  
  // ═══════════════════════════════════════════════════════
  // TRAP STATE
  // ═══════════════════════════════════════════════════════
  
  /** Current trap (one trap per attempt) */
  trap: TrapState | null = null;
  
  /** Selected trap type for placement */
  selectedTrapType: TrapType = TrapType.Fire;
  
  /** Selected zone for placement */
  selectedZone: ZoneId | null = null;
  
  /** Number of activations used this attempt */
  activationsUsed: number = 0;
  
  /** Total activations across all attempts */
  totalActivations: number = 0;
  
  // ═══════════════════════════════════════════════════════
  // HERO STATE
  // ═══════════════════════════════════════════════════════
  
  /** Hero state */
  hero: HeroState = {
    zone: ZoneId.Zone1,
    hp: GAME_CONFIG.HERO_MAX_HP,
    maxHp: GAME_CONFIG.HERO_MAX_HP,
    alive: true,
    won: false,
    abilities: new Set<HeroAbility>(),
    dashCooldown: 0,
    shieldHp: 0,
    doubleJumpReady: true,
  };
  
  /** Hero's current action */
  heroAction: HeroAction = HeroAction.Wait;
  
  /** Hero's intended next zone (for visible intent) */
  heroIntent: ZoneId | null = null;
  
  // ═══════════════════════════════════════════════════════
  // AI STATE
  // ═══════════════════════════════════════════════════════
  
  /** AI's current strategy */
  aiStrategy: AIStrategy = AIStrategy.Wait;
  
  /** AI's reaction delay (ms) — decreases with kills */
  aiReactionMs: number = GAME_CONFIG.AI_REACTION_MS;
  
  // ═══════════════════════════════════════════════════════
  // PROGRESSION
  // ═══════════════════════════════════════════════════════
  
  /** Total kills across all attempts */
  totalKills: number = 0;
  
  /** Current kill streak */
  killStreak: number = 0;
  
  /** Best kill streak */
  bestStreak: number = 0;
  
  /** Total score across all attempts */
  totalScore: number = 0;
  
  /** Score from last attempt */
  lastScore: number = 0;
  
  /** Score breakdown from last attempt */
  lastScoreBreakdown: ScoreBreakdown | null = null;
  
  /** Newly unlocked abilities this attempt */
  newlyUnlockedAbilities: HeroAbility[] = [];
  
  // ═══════════════════════════════════════════════════════
  // MEMORY
  // ═══════════════════════════════════════════════════════
  
  /** Hero's move history this attempt */
  moveHistory: { zone: ZoneId; action: HeroAction; time: number; hp: number }[] = [];
  
  /** AI journal entries */
  aiJournal: AIJournalEntry[] = [];
  
  /** AI adaptations shown to player */
  aiAdaptations: string[] = [];
  
  // ═══════════════════════════════════════════════════════
  // CONSTRUCTOR
  // ═══════════════════════════════════════════════════════
  
  constructor() {
    this.resetHero();
  }
  
  // ═══════════════════════════════════════════════════════
  // HERO METHODS
  // ═══════════════════════════════════════════════════════
  
  /** Reset hero for new attempt */
  resetHero(): void {
    this.hero = {
      zone: ZoneId.Zone1,
      hp: GAME_CONFIG.HERO_MAX_HP,
      maxHp: GAME_CONFIG.HERO_MAX_HP,
      alive: true,
      won: false,
      abilities: new Set<HeroAbility>(),
      dashCooldown: 0,
      shieldHp: 0,
      doubleJumpReady: true,
    };
    this.heroAction = HeroAction.Wait;
    this.heroIntent = null;
    this.moveHistory = [];
    this.elapsedTime = 0;
    this.attemptOver = false;
    this.activationsUsed = 0;
    this.trap = null;
    this.selectedTrapType = TrapType.Fire;
    this.selectedZone = null;
  }
  
  /** Get hero's current zone index */
  getHeroZoneIndex(): number {
    return ZONE_INDEX[this.hero.zone] ?? 0;
  }
  
  /** Get boss zone index (Zone3 = center) */
  getBossZoneIndex(): number {
    return ZONE_INDEX[ZoneId.Zone3] ?? 2;
  }
  
  /** Check if hero is at boss zone */
  isHeroAtBoss(): boolean {
    return this.hero.zone === ZoneId.Zone3;
  }
  
  /** Check if hero has reached the end */
  isHeroAtEnd(): boolean {
    return this.hero.zone === ZoneId.Zone5;
  }
  
  /** Get neighbors of a zone */
  getNeighbors(zone: ZoneId): ZoneId[] {
    const connections: Record<ZoneId, ZoneId[]> = {
      [ZoneId.Zone1]: [ZoneId.Zone2],
      [ZoneId.Zone2]: [ZoneId.Zone1, ZoneId.Zone3],
      [ZoneId.Zone3]: [ZoneId.Zone2, ZoneId.Zone4],
      [ZoneId.Zone4]: [ZoneId.Zone3, ZoneId.Zone5],
      [ZoneId.Zone5]: [ZoneId.Zone4],
    };
    return connections[zone] ?? [];
  }
  
  /** Record a hero move */
  recordMove(): void {
    this.moveHistory.push({
      zone: this.hero.zone,
      action: this.heroAction,
      time: this.elapsedTime,
      hp: this.hero.hp,
    });
  }
  
  // ═══════════════════════════════════════════════════════
  // TRAP METHODS
  // ═══════════════════════════════════════════════════════
  
  /** Place a trap on a zone */
  placeTrap(zone: ZoneId, type: TrapType): boolean {
    if (!TRAP_ZONES.includes(zone)) return false;
    
    this.trap = {
      type,
      zone,
      active: true,
      cooldownTimer: 0,
      activeTimer: 0,
      fired: false,
    };
    
    return true;
  }
  
  /** Remove the current trap */
  removeTrap(): void {
    this.trap = null;
  }
  
  /** Check if trap can be activated */
  canActivateTrap(): boolean {
    return this.trap !== null && 
           this.trap.active && 
           this.trap.cooldownTimer <= 0 &&
           this.hero.alive &&
           !this.hero.won;
  }
  
  /** Activate the trap (manual activation by player) */
  activateTrap(): boolean {
    if (!this.canActivateTrap()) return false;
    
    this.trap!.fired = true;
    this.trap!.activeTimer = this.getTrapDuration();
    this.trap!.cooldownTimer = GAME_CONFIG.TRAP_COOLDOWN;
    this.activationsUsed++;
    
    return true;
  }
  
  /** Get trap duration based on type */
  getTrapDuration(): number {
    if (!this.trap) return 0;
    
    const durations: Record<TrapType, number> = {
      [TrapType.Fire]: 2,
      [TrapType.Ice]: 4,
      [TrapType.Spike]: 1,
      [TrapType.Void]: 3,
    };
    
    return durations[this.trap.type] ?? 2;
  }
  
  /** Check if hero is in trap zone and trap is active */
  isHeroInTrapZone(): boolean {
    return this.trap !== null && 
           this.hero.zone === this.trap.zone && 
           this.trap.fired;
  }
  
  // ═══════════════════════════════════════════════════════
  // PROGRESSION METHODS
  // ═══════════════════════════════════════════════════════
  
  /** Add a kill and check for unlocks */
  addKill(): void {
    this.totalKills++;
    this.killStreak++;
    this.bestStreak = Math.max(this.bestStreak, this.killStreak);
    
    // Check for hero ability unlocks
    this.checkHeroUnlocks();
    
    // Update AI reaction time
    if (this.totalKills % GAME_CONFIG.AI_REACTION_REDUCTION_EVERY === 0) {
      this.aiReactionMs = Math.max(100, this.aiReactionMs - GAME_CONFIG.AI_REACTION_REDUCTION);
    }
  }
  
  /** Check for hero ability unlocks */
  private checkHeroUnlocks(): void {
    this.newlyUnlockedAbilities = [];
    
    if (this.totalKills >= GAME_CONFIG.UNLOCK_DASH_AT && !this.hero.abilities.has(HeroAbility.Dash)) {
      this.hero.abilities.add(HeroAbility.Dash);
      this.newlyUnlockedAbilities.push(HeroAbility.Dash);
    }
    
    if (this.totalKills >= GAME_CONFIG.UNLOCK_SHIELD_AT && !this.hero.abilities.has(HeroAbility.Shield)) {
      this.hero.abilities.add(HeroAbility.Shield);
      this.hero.shieldHp = GAME_CONFIG.HERO_SHIELD_HP;
      this.newlyUnlockedAbilities.push(HeroAbility.Shield);
    }
    
    if (this.totalKills >= GAME_CONFIG.UNLOCK_DOUBLE_JUMP_AT && !this.hero.abilities.has(HeroAbility.DoubleJump)) {
      this.hero.abilities.add(HeroAbility.DoubleJump);
      this.hero.doubleJumpReady = true;
      this.newlyUnlockedAbilities.push(HeroAbility.DoubleJump);
    }
  }
  
  /** Calculate score for this attempt */
  calculateScore(): ScoreBreakdown {
    const base = this.hero.won ? 0 : GAME_CONFIG.BASE_SCORE;
    
    // Efficiency: fewer activations = better
    const efficiency = this.activationsUsed > 0 
      ? Math.max(0.2, 1 + (5 - this.activationsUsed) * GAME_CONFIG.EFFICIENCY_BONUS)
      : 1;
    
    // Speed: faster kill = better
    const speed = this.hero.won 
      ? 0.5 
      : Math.max(0.5, 1 + (30 - this.elapsedTime) * GAME_CONFIG.SPEED_BONUS / 30);
    
    // Streak: consecutive kills
    const streak = 1 + (this.killStreak - 1) * 0.1;
    
    const total = Math.round(base * efficiency * speed * streak);
    
    const breakdown: ScoreBreakdown = {
      base,
      efficiency,
      speed,
      streak,
      total,
      activationsUsed: this.activationsUsed,
      timeToKill: this.elapsedTime,
    };
    
    this.lastScore = total;
    this.lastScoreBreakdown = breakdown;
    this.totalScore += total;
    
    return breakdown;
  }
  
  /** Reset for new attempt (keep progression) */
  resetForNewAttempt(): void {
    this.attemptNumber++;
    this.resetHero();
    this.aiAdaptations = [];
    this.aiJournal = [];
  }
}
