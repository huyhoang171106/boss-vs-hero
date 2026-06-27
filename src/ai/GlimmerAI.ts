import {
  ZoneId, PLAYABLE_ZONES, ZONE_CONNECTIONS,
  GAME_CONFIG, ZONE_INDEX, RuleType, HeroAction,
} from '../game/simulation/Types';
import type { MemoryEntry } from '../game/simulation/Types';
import { ArenaState } from '../game/simulation/ArenaState';
/**
 * Glimmer's brain.
 *
 * Uses a Strategy Tree: remembers outcomes of past actions,
 * explores new approaches when old ones fail, exploits what works.
 *
 * Pure logic — no rendering.
 */
export class GlimmerAI {
  /** Memory of past outcomes keyed by zone+rule combo */
  private memory: Map<string, MemoryEntry[]> = new Map();

  /** Current exploration level (0 = exploit, 1 = explore) */
  private explorationRate: number = 1.0;

  /** How many times each strategy has been tried */
  private strategyTries: Map<string, number> = new Map();

  /** Current strategy the hero is executing */
  private currentStrategy: string = 'explore';

  /** Timer for strategy switching */
  private strategyTimer: number = 0;

  /** Last chosen action */
  lastAction: HeroAction = HeroAction.Wait;

  /** Personality: how often the hero tries completely random things */
  private curiosity: number = 0.3;

  /** Track if hero is "confused" (keeps failing same way) */
  private failureStreak: number = 0;

  /** Zone safety memory — what the hero believes about each zone (array indexed by ZONE_INDEX) */
  private zoneBeliefs: { safe: boolean; lastChecked: number; hazardTiming: number }[] = [];

  constructor() {
    for (let i = 0; i < PLAYABLE_ZONES.length; i++) {
      const z = PLAYABLE_ZONES[i];
      const idx = ZONE_INDEX[z as string]!;
      this.zoneBeliefs[idx] = { safe: true, lastChecked: 0, hazardTiming: 0 };
    }
  }

  /**
   * Choose the hero's next action given the current arena state.
   */
  decide(state: ArenaState): HeroAction {
    const currentBelief = this.zoneBeliefs[ZONE_INDEX[state.heroZone as string]!];
    // 1. Update beliefs based on current zone (inlined — hot path)
    if (currentBelief) {
      const rules = state.getRulesInZone(state.heroZone);
      let hasActiveHazard = false;
      for (let i = 0; i < rules.length; i++) {
        const r = rules[i];
        if (r.isErupting || r.wallUp || r.projectile) {
          hasActiveHazard = true;
          break;
        }
      }
      if (!hasActiveHazard) {
        currentBelief.safe = true;
        currentBelief.lastChecked = state.elapsedTime;
      }
    }

    // 2. Should we switch strategy?
    this.evaluateStrategy(state);

    // 3. Choose action based on current strategy
    const action = this.executeStrategy(state);

    this.lastAction = action;
    state.heroAction = action;
    return action;
  }

  /** Record what happened to the hero this frame */
  recordOutcome(state: ArenaState, damaged: boolean, dodged: boolean): void {
    const key = this.memoryKey(state.heroZone, null);
    const outcome: MemoryEntry = {
      zone: state.heroZone,
      ruleType: null,
      outcome: damaged ? 'damage' : dodged ? 'dodge' : 'safe',
      timestamp: state.elapsedTime,
      attempt: state.attemptNumber,
    };
    let arr = this.memory.get(key);
    if (!arr) { arr = []; this.memory.set(key, arr); }
    arr.push(outcome);

    // Note: per-rule-type memory is NOT stored here — it's only consumed by the review
    // panel, and the AI strategies only read zone-level memory (memoryKey with null ruleType).
    // Removing per-rule writes saves 3 allocations + 3 Map ops per tick.

    if (damaged) {
      this.failureStreak++;
      const belief = this.zoneBeliefs[ZONE_INDEX[state.heroZone as string]!];
      if (belief) {
        belief.safe = false;
        belief.lastChecked = state.elapsedTime;
      }
    } else {
      this.failureStreak = Math.max(0, this.failureStreak - 1);
    }
  }

  /** Record final outcome of an attempt */
  recordAttemptOutcome(state: ArenaState): void {
    if (state.heroWon) {
      // This strategy worked — boost its score
      const tries = this.strategyTries.get(this.currentStrategy) || 0;
      this.strategyTries.set(this.currentStrategy, tries + 10);
    } else if (!state.heroAlive) {
      // This strategy failed — reduce exploration (hero is more cautious now)
      this.explorationRate = Math.max(0.2, this.explorationRate - 0.1);
    }

    // Learning: after each death, hero remembers more clearly
    this.consolidateMemory();
  }

  /** Increase curiosity after new rule cards are encountered */
  onNewRules(state: ArenaState): void {
    const occupied = state.getOccupiedZones();
    for (const z of occupied) {
      const belief = this.zoneBeliefs[ZONE_INDEX[z as string]!];
      if (belief) {
        belief.safe = true; // Reset belief — new rules change everything
        belief.lastChecked = 0;
      }
    }
    // Boost curiosity — new rules might mean new opportunities
    this.curiosity = Math.min(0.5, this.curiosity + 0.15);
  }

  /** Reset for a new attempt (keep memory!) */
  onNewAttempt(): void {
    this.strategyTimer = 0;
    this.failureStreak = 0;
    // Slightly increase exploration at start of new attempt
    if (this.explorationRate < 0.8) {
      this.explorationRate += 0.05;
    }
  }

  /** Get the hero's "thought process" for review panel */
  getThoughts(state?: ArenaState): string[] {
    const thoughts: string[] = [];

    // Unlocked abilities awareness
    if (state?.heroCanDash) thoughts.push('Ability: Dash');
    if (state?.heroCanShield) thoughts.push('Ability: Shield (absorbs 1 hit)');
    if (state?.heroCanDoubleJump) thoughts.push('Ability: Double Jump');

    // What zones does Glimmer think are safe/dangerous?
    for (let i = 0; i < PLAYABLE_ZONES.length; i++) {
      const zone = PLAYABLE_ZONES[i];
      const belief = this.zoneBeliefs[ZONE_INDEX[zone as string]!];
      if (belief && !belief.safe) {
        thoughts.push(`${zone} is dangerous (last checked ${belief.lastChecked.toFixed(1)}s)`);
      }
    }

    // Current strategy
    thoughts.push(`Strategy: ${this.currentStrategy}`);
    thoughts.push(`Curiosity: ${(this.curiosity * 100).toFixed(0)}%`);

    // Most recent memory
    const ent = Array.from(this.memory.entries());
    const recent = ent
      .filter((e) => e[1].length > 0)
      .sort((a, b) => {
        const aArr = a[1];
        const bArr = b[1];
        return bArr[bArr.length - 1].timestamp - aArr[aArr.length - 1].timestamp;
      })
      .slice(0, 3);

    for (const [key, entries] of recent) {
      const last = entries[entries.length - 1];
      thoughts.push(`Remember: ${key} → ${last.outcome}`);
    }

    return thoughts;
  }

  /** Memory heatmap data for review */
  getMemoryHeatmap(): Map<ZoneId, number> {
    const heat = new Map<ZoneId, number>();
    for (const z of PLAYABLE_ZONES) {
      heat.set(z, 0);
    }
    for (const [, entries] of this.memory) {
      for (const e of entries) {
        const current = heat.get(e.zone) || 0;
        heat.set(e.zone, current + (e.outcome === 'damage' ? 3 : e.outcome === 'dodge' ? 1 : 0));
      }
    }
    // Normalize
    const max = Math.max(...Array.from(heat.values()), 1);
    for (const [z, v] of heat) {
      heat.set(z, v / max);
    }
    return heat;
  }

  // ---- Private ----

  private memoryKey(zone: ZoneId, ruleType: RuleType | null): string {
    if (ruleType === null) return `${zone}:any`;
    return `${zone}:${ruleType}`;
  }


  private evaluateStrategy(state: ArenaState): void {
    // Switch strategies periodically or when stuck
    const switchTime = 3 + this.failureStreak * 2;
    if (this.strategyTimer > switchTime) {
      this.pickNewStrategy(state);
      this.strategyTimer = 0;
    }
  }

  private pickNewStrategy(state: ArenaState): void {
    const strategies = this.getAvailableStrategies(state);

    // Weight by past success and randomness
    const weights = strategies.map(s => {
      const tries = this.strategyTries.get(s.name) || 0;
      const baseWeight = s.priority;
      // Boost strategies not tried much (exploration)
      const noveltyBonus = Math.max(0, 10 - tries) * 0.5;
      // If failureStreak is high, prefer safer strategies
      const safetyBias = this.failureStreak > 5 ? (s.riskLevel === 'low' ? 5 : 0) : 0;
      return baseWeight + noveltyBonus + safetyBias;
    });

    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * totalWeight;
    for (let i = 0; i < strategies.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        this.currentStrategy = strategies[i].name;
        return;
      }
    }
    this.currentStrategy = strategies[0].name;
  }

  private getAvailableStrategies(state: ArenaState): { name: string; priority: number; riskLevel: 'low' | 'mid' | 'high' }[] {
    return [
      { name: 'rush',      priority: 5 + (this.curiosity > 0.4 ? 0 : 3), riskLevel: 'high' },
      { name: 'explore',   priority: 8, riskLevel: 'mid' },
      { name: 'sneak',     priority: 4 + this.failureStreak * 2, riskLevel: 'low' },
      { name: 'observe',   priority: 3 + (this.curiosity > 0.3 ? 5 : 0), riskLevel: 'low' },
      { name: 'pattern',   priority: this.memory.size > 5 ? 7 : 2, riskLevel: 'mid' },
    ];
  }

  private executeStrategy(state: ArenaState): HeroAction {
    // Glimmer's reaction delay — never frame-perfect
    const reactTicks = Math.floor(GAME_CONFIG.GLIMMER_REACTION_MS / 100);

    switch (this.currentStrategy) {
      case 'rush':
        return this.rushStrategy(state);
      case 'explore':
        return this.exploreStrategy(state);
      case 'sneak':
        return this.sneakStrategy(state);
      case 'observe':
        return this.observeStrategy(state);
      case 'pattern':
        return this.patternStrategy(state);
      default:
        return this.exploreStrategy(state);
    }
  }

  /** Rush toward the boss, ignoring danger */
  private rushStrategy(state: ArenaState): HeroAction {
    const currentIdx = ZONE_INDEX[state.heroZone as string];
    const bossIdx = ZONE_INDEX[ZoneId.CenterPlatform as string];

    // If hero has dash and next zone has flame vent, dash through it
    if (state.heroCanDash && state.heroDashCooldown <= 0) {
      const nextIdx = currentIdx + (currentIdx < bossIdx ? 1 : -1);
      if (nextIdx >= 0 && nextIdx < PLAYABLE_ZONES.length) {
        const nextZone = PLAYABLE_ZONES[nextIdx];
        if (!state.isZoneSafe(nextZone)) {
          return HeroAction.Dash;
        }
      }
    }
    // If hero has double-jump and is at boss zone, celebrate
    if (state.heroCanDoubleJump && state.heroDoubleJumpReady && currentIdx === bossIdx) {
      return HeroAction.Jump;
    }

    if (currentIdx < bossIdx) return HeroAction.MoveRight;
    if (currentIdx > bossIdx) return HeroAction.MoveLeft;
    return HeroAction.Jump;
  }

  /** Explore the arena, visiting new zones and testing rules */
  private exploreStrategy(state: ArenaState): HeroAction {
    // Find the most unchecked zone (avoids filter allocations)
    let bestTarget: ZoneId | null = null;
    let bestTime = -Infinity;
    for (let i = 0; i < PLAYABLE_ZONES.length; i++) {
      const z = PLAYABLE_ZONES[i];
      if (z === state.heroZone) continue;
      const belief = this.zoneBeliefs[ZONE_INDEX[z as string]!];
      const lastChecked = belief ? belief.lastChecked : 0;
      if (!belief || lastChecked < state.elapsedTime - 5) {
        if (lastChecked > bestTime) {
          bestTarget = z;
          bestTime = lastChecked;
        }
      }
    }
    if (bestTarget) return this.moveToward(state.heroZone, bestTarget);
    return this.rushStrategy(state);
  }

  /** Move carefully, preferring safe zones and timing hazards */
  private sneakStrategy(state: ArenaState): HeroAction {
    // If current zone is dangerous, leave immediately (or use shield)
    if (!state.isZoneSafe(state.heroZone)) {
      if (state.heroCanShield && state.heroShieldHP > 0) {
        // Shield will absorb damage, keep moving toward boss
      } else {
        const neighbors = state.getNeighbors(state.heroZone);
        const safeNeighbor = neighbors.find(n => state.isZoneSafe(n) && this.zoneBeliefs[ZONE_INDEX[n as string]!]?.safe !== false);
        if (safeNeighbor) return this.moveToward(state.heroZone, safeNeighbor);
      }
    }

    // Otherwise, carefully advance toward boss
    const currentIdx = ZONE_INDEX[state.heroZone as string];
    const bossIdx = ZONE_INDEX[ZoneId.CenterPlatform as string];
    const direction = currentIdx < bossIdx ? HeroAction.MoveRight : HeroAction.MoveLeft;

    // But wait sometimes to observe timing
    if (Math.random() < 0.3) return HeroAction.Wait;

    // If next zone is dangerous, wait
    const nextIdx = currentIdx + (currentIdx < bossIdx ? 1 : -1);
    if (nextIdx >= 0 && nextIdx < PLAYABLE_ZONES.length) {
      const nextZone = PLAYABLE_ZONES[nextIdx];
      if (!state.isZoneSafe(nextZone)) {
        if (!state.heroCanShield || state.heroShieldHP <= 0) {
          return HeroAction.Wait;
        }
      }
    }

    return direction;
  }

  /** Stand still and observe — learn timing patterns */
  private observeStrategy(_state: ArenaState): HeroAction {
    // Just wait and watch — builds memory through observation
    // Every few ticks, move slightly to test a different spot
    if (Math.random() < 0.15) {
      return Math.random() < 0.5 ? HeroAction.MoveLeft : HeroAction.MoveRight;
    }
    return HeroAction.Wait;
  }

  /** Use memory of past patterns to anticipate hazards */
  private patternStrategy(state: ArenaState): HeroAction {
    // Check if we have memory for current zone
    const key = this.memoryKey(state.heroZone, null);
    const entries = this.memory.get(key);

    if (entries && entries.length > 0) {
      // If we've been damaged here before, try to leave or dodge
      const lastDamage = entries.filter(e => e.outcome === 'damage').length;
      if (lastDamage > 1) {
        // This zone is dangerous — leave
        const neighbors = state.getNeighbors(state.heroZone);
        if (neighbors.length > 0) {
          const target = neighbors[Math.floor(Math.random() * neighbors.length)];
          return this.moveToward(state.heroZone, target);
        }
      }
    }

    // Check if any zone has no damage memory — go there
    const safeZone = PLAYABLE_ZONES.find(z => {
      const k = this.memoryKey(z, null);
      const mem = this.memory.get(k);
      return !mem || mem.every(e => e.outcome !== 'damage');
    });

    if (safeZone && safeZone !== state.heroZone) {
      return this.moveToward(state.heroZone, safeZone);
    }

    // Everything has hurt us — rush boss as last resort
    return this.rushStrategy(state);
  }

  /** Move from one zone toward another zone */
  private moveToward(from: ZoneId, to: ZoneId): HeroAction {
    const fromIdx = ZONE_INDEX[from as string];
    const toIdx = ZONE_INDEX[to as string];
    if (fromIdx < toIdx) return HeroAction.MoveRight;
    if (fromIdx > toIdx) return HeroAction.MoveLeft;

    // Same zone — need to go through walkways
    const neighbors = ZONE_CONNECTIONS[from];
    if (neighbors.length > 0) {
      const target = neighbors.reduce((best, n) => {
        const bestIdx = best ? Math.abs(ZONE_INDEX[best as string] - toIdx) : Infinity;
        const nIdx = Math.abs(ZONE_INDEX[n as string] - toIdx);
        return nIdx < bestIdx ? n : best;
      });
      if (target) {
        return this.moveToward(from, target);
      }
    }

    // Can't determine path — jump (trying to find a way)
    return HeroAction.Jump;
  }

  /** Consolidate memory after each attempt — prune noise */
  private consolidateMemory(): void {
    // Keep only the most relevant memories
    for (const [key, entries] of this.memory) {
      // Keep the last 20 entries per key
      if (entries.length > 20) {
        this.memory.set(key, entries.slice(-20));
      }
    }
  }
}
