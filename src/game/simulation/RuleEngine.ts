import {
  ZoneId, PLATFORM_ZONES, PLAYABLE_ZONES, ZONE_INDEX,
  GAME_CONFIG,
} from './Types';
import { RuleType } from './Types';
import { HeroAction } from './Types';
import type { RuleCard, RuleState } from './Types';
import { ArenaState } from './ArenaState';

/**
 * Tick result: what happened this frame so the renderer can show it.
 */
export type SynergyKind = 'molten_spikes' | 'flame_orb';

export interface TickEvent {
  ruleTriggers: { zone: ZoneId; type: RuleType; kind: 'erupt' | 'impact' | 'spawn' | 'dismiss' }[];
  rulesDeployed: { zone: ZoneId; type: RuleType }[];
  heroDamaged: boolean;
  heroDodged: boolean;
  heroDied: boolean;
  heroReachedBoss: boolean;
  /** Active synergies this tick */
  synergies: { zone: ZoneId; kind: SynergyKind }[];
  /** Shield blocked damage this tick */
  shieldBlocked: boolean;
}

/**
 * Pure simulation — runs rules, updates hero status.
 * No rendering, no randomness (seeded PRNG).
 */
export class RuleEngine {
  private seed: number;

  constructor() {
    this.seed = 42;
  }
  /** Advance the simulation by dt seconds. Returns events for the frame. */
  tick(state: ArenaState, dt: number): TickEvent {
    const events: TickEvent = {
      ruleTriggers: [],
      rulesDeployed: [],
      heroDamaged: false,
      heroDodged: false,
      heroDied: false,
      heroReachedBoss: false,
      synergies: [],
      shieldBlocked: false,
    };

    if (state.attemptOver) return events;

    state.elapsedTime += dt;

    // 1. Deploy pending rules
    for (let i = state.pendingRules.length - 1; i >= 0; i--) {
      state.pendingRules[i].timer -= dt;
      if (state.pendingRules[i].timer <= 0) {
        const p = state.pendingRules[i];
        state.ruleStates.push(this.cardToState(p.card));
        state.invalidateRulesCache();
        events.rulesDeployed.push({ zone: p.card.zone, type: p.card.type });
        state.pendingRules.splice(i, 1);
      }
    }

    // 2. Update each rule
    const ruleStates = state.ruleStates;
    for (let i = 0; i < ruleStates.length; i++) {
      const rs = ruleStates[i];
      if (!rs.card.active) continue;
      this.updateRule(rs, state, dt, events);
    }

    // 2a. Detect synergies — iterate PLAYABLE_ZONES directly (avoids Set + redundant getRulesInZone)
    for (let i = 0; i < PLAYABLE_ZONES.length; i++) {
      const z = PLAYABLE_ZONES[i];
      const zr = state.getRulesInZone(z);
      if (zr.length === 0) continue;
      let hf = false, hs = false;
      for (let j = 0; j < zr.length; j++) {
        const t = zr[j].card.type;
        if (t === RuleType.FlameVent) hf = true;
        else if (t === RuleType.SpikeWall) hs = true;
      }
      if (hf && hs) events.synergies.push({ zone: z, kind: 'molten_spikes' });
    }
    // 3. Check hero in current zone — apply damage
    if (state.heroAlive && !state.heroWon) {
      this.checkDamage(state, events);
    }

    // 4. Check win condition: hero survives full duration
    if (state.heroAlive && state.elapsedTime >= GAME_CONFIG.ATTEMPT_DURATION) {
      state.heroWon = true;
      state.attemptOver = true;
      events.heroReachedBoss = true;
    }

    // 5. Cooldowns
    if (state.heroDashCooldown > 0) state.heroDashCooldown -= dt;
    if (state.heroDodgeCooldown > 0) state.heroDodgeCooldown -= dt;

    return events;
  }

  private cardToState(card: RuleCard): RuleState {
    return {
      card,
      timer: 0,
      isErupting: false,
      wallUp: false,
      projectile: null,
    };
  }

  private updateRule(rs: RuleState, state: ArenaState, dt: number, events: TickEvent): void {
    switch (rs.card.type) {
      case RuleType.FlameVent:
        this.updateFlameVent(rs, dt, events);
        break;
      case RuleType.SpikeWall:
        this.updateSpikeWall(rs, state, dt, events);
        break;
      case RuleType.SentryOrb:
        this.updateSentryOrb(rs, state, dt, events);
        break;
      case RuleType.GravityWell:
        this.updateGravityWell(rs, state, dt, events);
        break;
      case RuleType.TemporalRift:
        this.updateTemporalRift(rs, state, dt, events);
        break;
    }
  }

  private updateFlameVent(rs: RuleState, dt: number, events: TickEvent): void {
    rs.timer += dt;
    const cooldown = rs.card.param;

    if (rs.isErupting) {
      if (rs.timer >= GAME_CONFIG.FLAME_DURATION) {
        rs.isErupting = false;
        rs.timer = 0;
        events.ruleTriggers.push({ zone: rs.card.zone, type: RuleType.FlameVent, kind: 'dismiss' });
      }
    } else {
      if (rs.timer >= cooldown) {
        rs.isErupting = true;
        rs.timer = 0;
        events.ruleTriggers.push({ zone: rs.card.zone, type: RuleType.FlameVent, kind: 'erupt' });
      }
    }
  }

  private updateSpikeWall(rs: RuleState, state: ArenaState, dt: number, events: TickEvent): void {
    rs.timer += dt;
    const cooldown = rs.card.param;

    if (rs.wallUp) {
      if (rs.timer >= GAME_CONFIG.SPIKE_DURATION) {
        rs.wallUp = false;
        rs.timer = 0;
        events.ruleTriggers.push({ zone: rs.card.zone, type: RuleType.SpikeWall, kind: 'dismiss' });
      }
    } else {
      if (state.heroZone === rs.card.zone) {
        rs.wallUp = true;
        rs.timer = 0;
        events.ruleTriggers.push({ zone: rs.card.zone, type: RuleType.SpikeWall, kind: 'erupt' });
      } else if (rs.timer >= cooldown) {
        rs.wallUp = true;
        rs.timer = 0;
        events.ruleTriggers.push({ zone: rs.card.zone, type: RuleType.SpikeWall, kind: 'erupt' });
      }
    }
  }

  private updateSentryOrb(rs: RuleState, state: ArenaState, dt: number, events: TickEvent): void {
    rs.timer += dt;
    const cooldown = rs.card.param;

    if (rs.projectile) {
      const p = rs.projectile;
      const targetIdx = ZONE_INDEX[state.heroZone as string];
      const currentIdx = ZONE_INDEX[rs.card.zone as string];
      const diff = targetIdx - currentIdx;
      const dir = Math.sign(diff);

      p.x += dir * GAME_CONFIG.ORB_SPEED * dt;

      const heroIdx = ZONE_INDEX[state.heroZone as string];
      const orbAtHero = Math.abs(currentIdx + dir * 3 - heroIdx) < 1;

      if (orbAtHero && state.heroZone !== rs.card.zone) {
        rs.projectile = null;
        events.ruleTriggers.push({ zone: rs.card.zone, type: RuleType.SentryOrb, kind: 'impact' });
      } else if (Math.abs(p.x) > 5) {
        rs.projectile = null;
      }
    } else if (rs.timer >= cooldown) {
      const targetIdx = ZONE_INDEX[state.heroZone as string];
      const sourceIdx = ZONE_INDEX[rs.card.zone as string];
      const dir = Math.sign(targetIdx - sourceIdx);
      rs.projectile = {
        x: ZONE_INDEX[rs.card.zone as string],
        y: 0,
        vx: dir,
        vy: 0,
      };
      rs.timer = 0;
      events.ruleTriggers.push({ zone: rs.card.zone, type: RuleType.SentryOrb, kind: 'spawn' });
    }
  }

  private updateGravityWell(rs: RuleState, state: ArenaState, dt: number, events: TickEvent): void {
    rs.timer += dt;
    const cooldown = rs.card.param;

    if (rs.timer >= cooldown) {
      if (state.heroZone === rs.card.zone && state.heroAlive) {
        state.gravityWellPulled = true;
        events.ruleTriggers.push({ zone: rs.card.zone, type: RuleType.GravityWell, kind: 'erupt' });
      }
      rs.timer = 0;
    }
  }

  private updateTemporalRift(rs: RuleState, state: ArenaState, dt: number, events: TickEvent): void {
    rs.timer += dt;
    const cooldown = rs.card.param;

    if (rs.timer >= cooldown) {
      if (state.heroZone === rs.card.zone && state.heroAlive) {
        state.elapsedTime = Math.max(0, state.elapsedTime - 3);
        events.ruleTriggers.push({ zone: rs.card.zone, type: RuleType.TemporalRift, kind: 'erupt' });
      }
      rs.timer = 0;
    }
  }
  private checkDamage(state: ArenaState, events: TickEvent): void {
    const rules = state.getRulesInZone(state.heroZone);
    let tookDamage = false;

    // Precompute synergy flags once per zone (not per-rule)
    let hasFlame = false, hasSpike = false;
    for (let i = 0; i < rules.length; i++) {
      const t = rules[i].card.type;
      if (t === RuleType.FlameVent) hasFlame = true;
      else if (t === RuleType.SpikeWall) hasSpike = true;
    }
    const moltenSpikes = hasFlame && hasSpike;

    for (let i = 0; i < rules.length; i++) {
      const rs = rules[i];

      if (rs.isErupting && rs.card.type === RuleType.FlameVent) {
        if (state.heroAction === HeroAction.Dash && state.heroDodgeCooldown <= 0) {
          state.heroDodgeCooldown = GAME_CONFIG.HERO_DASH_COOLDOWN;
          events.heroDodged = true;
        } else {
          state.heroHP -= moltenSpikes ? 2 : 1;
          tookDamage = true;
        }
      }

      if (rs.wallUp && rs.card.type === RuleType.SpikeWall) {
        if (state.heroAction === HeroAction.Jump) {
          events.heroDodged = true;
        } else {
          state.heroHP -= moltenSpikes ? 2 : 1;
          tookDamage = true;
        }
      }

      if (rs.projectile && rs.card.type === RuleType.SentryOrb && state.heroZone !== rs.card.zone) {
        if (state.heroAction === HeroAction.Dash || state.heroAction === HeroAction.Jump) {
          events.heroDodged = true;
        } else {
          state.heroHP -= 1;
          tookDamage = true;
        }
        rs.projectile = null;
      }
    }

    if (tookDamage) {
      if (state.heroShieldHP > 0) {
        state.heroShieldHP--;
        state.heroHP++;
        tookDamage = false;
        events.shieldBlocked = true;
      }

      if (state.heroHP <= 0) {
        state.heroAlive = false;
        state.attemptOver = true;
        events.heroDied = true;
        state.totalDeaths++;
        if (state.totalDeaths >= 2) state.heroCanDash = true;
        if (state.totalDeaths >= 5) state.heroCanShield = true;
        if (state.totalDeaths >= 10) state.heroCanDoubleJump = true;
      }

      if (!events.heroDied) {
        events.heroDamaged = true;
      }
    }
  }

  /** Add a new rule card to the pending queue */
  deployRule(state: ArenaState, card: RuleCard): void {
    state.ruleStates = state.ruleStates.filter(
      r => !(r.card.zone === card.zone && r.card.type === card.type)
    );
    state.pendingRules.push({ card, timer: GAME_CONFIG.RULE_DEPLOY_TIME });
    state.invalidateRulesCache();
  }

  /** Remove a rule from a zone */
  removeRule(state: ArenaState, zone: ZoneId, type: RuleType): void {
    state.ruleStates = state.ruleStates.filter(
      r => !(r.card.zone === zone && r.card.type === type)
    );
    state.invalidateRulesCache();
  }

  /** Set the PRNG seed for deterministic replay */
  setSeed(seed: number): void {
    this.seed = seed;
  }
}
