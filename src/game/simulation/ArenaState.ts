import {
  ZoneId, PLATFORM_ZONES, PLAYABLE_ZONES, ZONE_CONNECTIONS,
  GAME_CONFIG,
} from './Types';
import type { RuleCard, RuleState, RuleType } from './Types';
import { HeroAction } from './Types';

/**
 * Owns all mutable simulation state for the arena.
 * Pure data — no rendering, no Phaser.
 */
export class ArenaState {
  // Hero
  heroZone: ZoneId = ZoneId.LeftPlatform;
  heroHP: number = GAME_CONFIG.HERO_MAX_HP;
  heroAction: HeroAction = HeroAction.Wait;
  heroAlive: boolean = true;
  heroDashCooldown: number = 0;
  heroDodgeCooldown: number = 0;
  heroCanDash: boolean = false;
  /** Shield absorbs one hit per attempt */
  heroCanShield: boolean = false;
  heroShieldHP: number = 0;
  /** Double jump allows skipping one zone mid-move */
  heroCanDoubleJump: boolean = false;
  heroDoubleJumpReady: boolean = false;
  /** Set by GravityWell to reverse hero's next movement */
  gravityWellPulled: boolean = false;
  /** Unlocked abilities display flags for UI */
  get unlockedAbilities(): string[] {
    const abilities: string[] = [];
    if (this.heroCanDash) abilities.push('Dash');
    if (this.heroCanShield) abilities.push('Shield');
    if (this.heroCanDoubleJump) abilities.push('Double Jump');
    return abilities;
  }
  // Timer
  elapsedTime: number = 0;
  attemptNumber: number = 0;
  totalDeaths: number = 0;
  heroWon: boolean = false;
  attemptOver: boolean = false;
  // Rules placed by player
  ruleStates: RuleState[] = [];

  // Zone-rules cache — avoids per-call filter allocation in hot path
  private _rulesCache: Map<ZoneId, RuleState[]> | null = null;
  private _cacheDirty = true;

  /** Get rule states for a given zone (uses cache to avoid per-call allocation) */
  getRulesInZone(zone: ZoneId): RuleState[] {
    if (this._cacheDirty || !this._rulesCache) {
      this._rebuildRulesCache();
    }
    return this._rulesCache!.get(zone) ?? [];
  }

  /** Invalidate the rules cache (call when ruleStates changes) */
  invalidateRulesCache(): void {
    this._cacheDirty = true;
  }

  private _rebuildRulesCache(): void {
    this._rulesCache = new Map();
    for (let i = 0; i < PLAYABLE_ZONES.length; i++) {
      const z = PLAYABLE_ZONES[i];
      const rules: RuleState[] = [];
      for (let j = 0; j < this.ruleStates.length; j++) {
        const r = this.ruleStates[j];
        if (r.card.zone === z && r.card.active) {
          rules.push(r);
        }
      }
      this._rulesCache.set(z, rules);
    }
    this._cacheDirty = false;
  }

  // Pending rules being deployed
  pendingRules: { card: RuleCard; timer: number }[] = [];

  // Move history for review
  moveHistory: { time: number; zone: ZoneId; hp: number; action: HeroAction }[] = [];

  constructor() {
    this.moveHistory.push({
      time: 0,
      zone: this.heroZone,
      hp: this.heroHP,
      action: HeroAction.Wait,
    });
  }

  /** Get all platform zones that have rules */
  getOccupiedZones(): ZoneId[] {
    return PLATFORM_ZONES.filter(z =>
      this.ruleStates.some(r => r.card.zone === z && r.card.active)
    );
  }

  /** Check if a zone is safe right now (no active hazards) */
  isZoneSafe(zone: ZoneId): boolean {
    const rules = this.getRulesInZone(zone);
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      if (r.isErupting || r.wallUp || r.projectile) return false;
    }
    return true;
  }
  getNeighbors(zone: ZoneId): ZoneId[] {
    return ZONE_CONNECTIONS[zone] || [];
  }

  /** Record movement for review */
  recordMove(): void {
    this.moveHistory.push({
      time: this.elapsedTime,
      zone: this.heroZone,
      hp: this.heroHP,
      action: this.heroAction,
    });
  }

  /** Reset hero for a new attempt */
  resetHero(): void {
    this.heroZone = ZoneId.LeftPlatform;
    this.heroHP = GAME_CONFIG.HERO_MAX_HP;
    this.heroAlive = true;
    this.heroWon = false;
    this.attemptOver = false;
    this.elapsedTime = 0;
    this.heroDashCooldown = 0;
    this.heroDodgeCooldown = 0;
    this.gravityWellPulled = false;
    this.heroShieldHP = this.heroCanShield ? 1 : 0;
    this.heroDoubleJumpReady = this.heroCanDoubleJump;
    this.moveHistory = [{ time: 0, zone: this.heroZone, hp: this.heroHP, action: HeroAction.Wait }];
    this.resetRules();
  }

  /** Rebuild rule states from cards (fresh timers/runtime state) and reset pending deploys */
  resetRules(): void {
    // Rebuild active rule states from their cards — fresh timer, no eruption, no projectile
    this.ruleStates = this.ruleStates.map(rs => ({
      card: rs.card,
      timer: 0,
      isErupting: false,
      wallUp: false,
      projectile: null,
    }));
    // Reset pending deploy timers to full duration
    for (const p of this.pendingRules) {
      p.timer = GAME_CONFIG.RULE_DEPLOY_TIME;
    }
    this.invalidateRulesCache();
  }
}
