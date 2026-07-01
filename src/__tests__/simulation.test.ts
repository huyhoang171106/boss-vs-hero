import { describe, it, expect } from 'vitest';
import {
  ZoneId, ALL_ZONES, TRAP_ZONES, ZONE_INDEX,
  TrapType, HeroAction, HeroAbility,
  GAME_CONFIG, TRAP_CONFIG,
} from '../game/simulation/Types';
import { ArenaState } from '../game/simulation/ArenaState';
import { TrapSystem } from '../game/simulation/TrapSystem';
import { GlimmerAI } from '../ai/GlimmerAI';

// ── Helpers ──────────────────────────────────────────────────────────

function makeState(): ArenaState {
  return new ArenaState();
}

function makeTrapSystem(): TrapSystem {
  return new TrapSystem();
}

function makeAI(): GlimmerAI {
  return new GlimmerAI();
}

// ── Tests ────────────────────────────────────────────────────────────

describe('ArenaState', () => {
  it('initializes with correct defaults', () => {
    const state = makeState();
    expect(state.attemptNumber).toBe(1);
    expect(state.hero.hp).toBe(GAME_CONFIG.HERO_MAX_HP);
    expect(state.hero.alive).toBe(true);
    expect(state.hero.won).toBe(false);
    expect(state.trap).toBeNull();
    expect(state.totalKills).toBe(0);
    expect(state.totalScore).toBe(0);
  });

  it('resetHero resets per-attempt state', () => {
    const state = makeState();
    state.hero.zone = ZoneId.Zone5;
    state.hero.hp = 0;
    state.hero.alive = false;
    state.attemptOver = true;
    state.elapsedTime = 25;
    state.totalKills = 5;

    state.resetHero();

    expect(state.hero.zone).toBe(ZoneId.Zone1);
    expect(state.hero.hp).toBe(GAME_CONFIG.HERO_MAX_HP);
    expect(state.hero.alive).toBe(true);
    expect(state.attemptOver).toBe(false);
    expect(state.elapsedTime).toBe(0);
    expect(state.totalKills).toBe(5); // Preserved
  });

  it('getNeighbors returns correct connections', () => {
    const state = makeState();
    expect(state.getNeighbors(ZoneId.Zone1)).toContain(ZoneId.Zone2);
    expect(state.getNeighbors(ZoneId.Zone2)).toContain(ZoneId.Zone1);
    expect(state.getNeighbors(ZoneId.Zone2)).toContain(ZoneId.Zone3);
    expect(state.getNeighbors(ZoneId.Zone3)).toContain(ZoneId.Zone2);
    expect(state.getNeighbors(ZoneId.Zone3)).toContain(ZoneId.Zone4);
    expect(state.getNeighbors(ZoneId.Zone5)).toContain(ZoneId.Zone4);
  });
});

describe('TrapSystem', () => {
  it('placeTrap succeeds on valid zone', () => {
    const state = makeState();
    const system = makeTrapSystem();
    const result = system.placeTrap(state, ZoneId.Zone2, TrapType.Fire);
    expect(result).toBe(true);
    expect(state.trap).not.toBeNull();
    expect(state.trap!.type).toBe(TrapType.Fire);
    expect(state.trap!.zone).toBe(ZoneId.Zone2);
  });

  it('placeTrap fails on Zone1 (hero start)', () => {
    const state = makeState();
    const system = makeTrapSystem();
    const result = system.placeTrap(state, ZoneId.Zone1, TrapType.Fire);
    expect(result).toBe(false);
    expect(state.trap).toBeNull();
  });

  it('removeTrap clears the trap', () => {
    const state = makeState();
    const system = makeTrapSystem();
    system.placeTrap(state, ZoneId.Zone2, TrapType.Fire);
    system.removeTrap(state);
    expect(state.trap).toBeNull();
  });

  it('canActivateTrap returns true when trap is ready', () => {
    const state = makeState();
    const system = makeTrapSystem();
    system.placeTrap(state, ZoneId.Zone2, TrapType.Fire);
    expect(state.canActivateTrap()).toBe(true);
  });

  it('activateTrap sets trap as fired', () => {
    const state = makeState();
    const system = makeTrapSystem();
    system.placeTrap(state, ZoneId.Zone2, TrapType.Fire);
    const result = system.activateTrap(state);
    expect(result).toBe(true);
    expect(state.trap!.fired).toBe(true);
    expect(state.activationsUsed).toBe(1);
  });

  it('activateTrap fails when on cooldown', () => {
    const state = makeState();
    const system = makeTrapSystem();
    system.placeTrap(state, ZoneId.Zone2, TrapType.Fire);
    system.activateTrap(state); // First activation
    const result = system.activateTrap(state); // Should fail (cooldown)
    expect(result).toBe(false);
  });

  it('trap cooldown decreases over time', () => {
    const state = makeState();
    const system = makeTrapSystem();
    system.placeTrap(state, ZoneId.Zone2, TrapType.Fire);
    system.activateTrap(state);
    
    expect(state.trap!.cooldownTimer).toBeGreaterThan(0);
    
    system.tick(state, 1.0);
    expect(state.trap!.cooldownTimer).toBeLessThan(GAME_CONFIG.TRAP_COOLDOWN);
  });

  it('trap effect triggers when hero is in zone', () => {
    const state = makeState();
    const system = makeTrapSystem();
    system.placeTrap(state, ZoneId.Zone2, TrapType.Fire);
    state.hero.zone = ZoneId.Zone2;
    system.activateTrap(state);
    
    const events = system.tick(state, 0.1);
    expect(events.trapEffectTriggered).toBe(true);
  });
});

describe('Trap Types', () => {
  it('Fire deals damage', () => {
    const state = makeState();
    const system = makeTrapSystem();
    system.placeTrap(state, ZoneId.Zone2, TrapType.Fire);
    state.hero.zone = ZoneId.Zone2;
    system.activateTrap(state);
    
    const hpBefore = state.hero.hp;
    system.tick(state, 0.1);
    expect(state.hero.hp).toBeLessThan(hpBefore);
  });

  it('Ice deals damage and slows', () => {
    const state = makeState();
    const system = makeTrapSystem();
    system.placeTrap(state, ZoneId.Zone2, TrapType.Ice);
    state.hero.zone = ZoneId.Zone2;
    system.activateTrap(state);
    
    const hpBefore = state.hero.hp;
    const events = system.tick(state, 0.1);
    expect(state.hero.hp).toBeLessThan(hpBefore);
    expect(events.heroSlowed).toBe(true);
  });

  it('Spike deals damage', () => {
    const state = makeState();
    const system = makeTrapSystem();
    system.placeTrap(state, ZoneId.Zone2, TrapType.Spike);
    state.hero.zone = ZoneId.Zone2;
    system.activateTrap(state);
    
    const hpBefore = state.hero.hp;
    system.tick(state, 0.1);
    expect(state.hero.hp).toBeLessThan(hpBefore);
  });

  it('Void teleports hero', () => {
    const state = makeState();
    const system = makeTrapSystem();
    system.placeTrap(state, ZoneId.Zone2, TrapType.Void);
    state.hero.zone = ZoneId.Zone2;
    system.activateTrap(state);
    
    const events = system.tick(state, 0.1);
    expect(events.heroTeleported).toBe(true);
    expect(events.teleportDestination).not.toBeNull();
  });
});

describe('Hero Abilities', () => {
  it('Dash unlocks at 2 kills', () => {
    const state = makeState();
    state.totalKills = 2;
    state.addKill(); // This increments to 3, but we set it before
    expect(state.hero.abilities.has(HeroAbility.Dash)).toBe(true);
  });

  it('Shield unlocks at 5 kills', () => {
    const state = makeState();
    state.totalKills = 4;
    state.addKill(); // 5 kills
    expect(state.hero.abilities.has(HeroAbility.Shield)).toBe(true);
    expect(state.hero.shieldHp).toBe(GAME_CONFIG.HERO_SHIELD_HP);
  });

  it('DoubleJump unlocks at 9 kills', () => {
    const state = makeState();
    state.totalKills = 8;
    state.addKill(); // 9 kills
    expect(state.hero.abilities.has(HeroAbility.DoubleJump)).toBe(true);
  });

  it('AI reaction time decreases with kills', () => {
    const state = makeState();
    const initialReaction = state.aiReactionMs;
    state.totalKills = 2;
    state.addKill(); // 3 kills → reaction decreases
    expect(state.aiReactionMs).toBeLessThan(initialReaction);
  });
});

describe('Scoring', () => {
  it('calculateScore returns correct breakdown', () => {
    const state = makeState();
    state.totalKills = 0;
    state.killStreak = 0;
    state.activationsUsed = 1;
    state.elapsedTime = 10;
    
    const breakdown = state.calculateScore();
    expect(breakdown.base).toBe(GAME_CONFIG.BASE_SCORE);
    expect(breakdown.activationsUsed).toBe(1);
    expect(breakdown.timeToKill).toBe(10);
    expect(breakdown.total).toBeGreaterThan(0);
  });

  it('fewer activations gives better efficiency', () => {
    const state1 = makeState();
    state1.activationsUsed = 1;
    state1.totalKills = 0;
    state1.killStreak = 0;
    const bd1 = state1.calculateScore();
    
    const state2 = makeState();
    state2.activationsUsed = 5;
    state2.totalKills = 0;
    state2.killStreak = 0;
    const bd2 = state2.calculateScore();
    
    expect(bd1.efficiency).toBeGreaterThan(bd2.efficiency);
  });

  it('streak bonus increases with consecutive kills', () => {
    const state1 = makeState();
    state1.killStreak = 1;
    state1.activationsUsed = 1;
    state1.totalKills = 0;
    const bd1 = state1.calculateScore();
    
    const state2 = makeState();
    state2.killStreak = 5;
    state2.activationsUsed = 1;
    state2.totalKills = 0;
    const bd2 = state2.calculateScore();
    
    expect(bd2.streak).toBeGreaterThan(bd1.streak);
  });
});

describe('GlimmerAI', () => {
  it('initializes with correct defaults', () => {
    const ai = makeAI();
    expect(ai.currentStrategy).toBeDefined();
    expect(ai.intentZone).toBeNull();
  });

  it('decide returns a valid action', () => {
    const ai = makeAI();
    const state = makeState();
    const action = ai.decide(state, 0.1);
    expect(Object.values(HeroAction)).toContain(action);
  });

  it('getThoughts returns non-empty array', () => {
    const ai = makeAI();
    const state = makeState();
    const thoughts = ai.getThoughts(state);
    expect(thoughts.length).toBeGreaterThan(0);
  });

  it('getLiveThought returns a string', () => {
    const ai = makeAI();
    const state = makeState();
    const thought = ai.getLiveThought(state);
    expect(typeof thought).toBe('string');
    expect(thought.length).toBeGreaterThan(0);
  });

  it('getMemoryHeatmap returns zone data', () => {
    const ai = makeAI();
    const heatmap = ai.getMemoryHeatmap();
    expect(heatmap.size).toBe(ALL_ZONES.length);
  });

  it('onNewAttempt resets state', () => {
    const ai = makeAI();
    ai.onNewAttempt();
    expect(ai.currentStrategy).toBeDefined();
  });
});

describe('Zone Configuration', () => {
  it('has 5 zones', () => {
    expect(ALL_ZONES.length).toBe(5);
  });

  it('has 4 trap zones (not Zone1)', () => {
    expect(TRAP_ZONES.length).toBe(4);
    expect(TRAP_ZONES).not.toContain(ZoneId.Zone1);
  });

  it('zone indices are sequential', () => {
    for (let i = 0; i < ALL_ZONES.length; i++) {
      expect(ZONE_INDEX[ALL_ZONES[i]]).toBe(i);
    }
  });
});

describe('Trap Configuration', () => {
  it('all trap types have valid config', () => {
    for (const type of Object.values(TrapType)) {
      const config = TRAP_CONFIG[type];
      expect(config.damage).toBeGreaterThanOrEqual(0);
      expect(config.cooldown).toBeGreaterThan(0);
      expect(config.duration).toBeGreaterThan(0);
      expect(config.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('Fire has highest damage', () => {
    const fireDmg = TRAP_CONFIG[TrapType.Fire].damage;
    const iceDmg = TRAP_CONFIG[TrapType.Ice].damage;
    const spikeDmg = TRAP_CONFIG[TrapType.Spike].damage;
    expect(fireDmg).toBeGreaterThanOrEqual(iceDmg);
    expect(fireDmg).toBeGreaterThanOrEqual(spikeDmg);
  });
});

describe('Game Configuration', () => {
  it('has valid hero config', () => {
    expect(GAME_CONFIG.HERO_MAX_HP).toBeGreaterThan(0);
    expect(GAME_CONFIG.HERO_DASH_COOLDOWN).toBeGreaterThan(0);
  });

  it('has valid trap config', () => {
    expect(GAME_CONFIG.TRAP_COOLDOWN).toBeGreaterThan(0);
    expect(GAME_CONFIG.TRAP_ACTIVATION_DELAY).toBeGreaterThanOrEqual(0);
  });

  it('has valid AI config', () => {
    expect(GAME_CONFIG.AI_REACTION_MS).toBeGreaterThan(0);
    expect(GAME_CONFIG.AI_FAKE_CHANCE).toBeGreaterThanOrEqual(0);
    expect(GAME_CONFIG.AI_FAKE_CHANCE).toBeLessThanOrEqual(1);
  });

  it('has valid scoring config', () => {
    expect(GAME_CONFIG.BASE_SCORE).toBeGreaterThan(0);
    expect(GAME_CONFIG.EFFICIENCY_BONUS).toBeGreaterThan(0);
    expect(GAME_CONFIG.SPEED_BONUS).toBeGreaterThan(0);
  });

  it('has valid progression thresholds', () => {
    expect(GAME_CONFIG.UNLOCK_DASH_AT).toBeGreaterThan(0);
    expect(GAME_CONFIG.UNLOCK_SHIELD_AT).toBeGreaterThan(GAME_CONFIG.UNLOCK_DASH_AT);
    expect(GAME_CONFIG.UNLOCK_DOUBLE_JUMP_AT).toBeGreaterThan(GAME_CONFIG.UNLOCK_SHIELD_AT);
  });
});
