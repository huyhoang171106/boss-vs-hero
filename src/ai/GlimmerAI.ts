/**
 * DEADLOCK — Glimmer AI
 * 
 * The hero that learns, adapts, and creates mind games.
 * 
 * Core behaviors:
 * 1. Remembers damage per zone and timing
 * 2. Fakes movements to bait player activation
 * 3. Adapts strategy based on memory
 * 4. Shows visible intent (next move)
 * 5. Creates psychological battle with player
 */

import {
  ZoneId, ALL_ZONES, TRAP_ZONES, ZONE_INDEX,
  TrapType, HeroAction, HeroAbility,
  AIStrategy, GAME_CONFIG,
} from '../game/simulation/Types';
import type { MemoryEntry, AIJournalEntry } from '../game/simulation/Types';
import type { ArenaState } from '../game/simulation/ArenaState';

/**
 * Glimmer's brain.
 * 
 * Uses memory-based strategy selection with visible intent.
 * Pure logic — no rendering.
 */
export class GlimmerAI {
  // ═══════════════════════════════════════════════════════
  // MEMORY
  // ═══════════════════════════════════════════════════════
  
  /** Memory of past outcomes keyed by zone+trapType */
  private memory: Map<string, MemoryEntry[]> = new Map();
  
  /** Zone safety beliefs (indexed by ZONE_INDEX) */
  private zoneBeliefs: { safe: boolean; dangerLevel: number; lastChecked: number }[] = [];
  
  /** Timing memory: when player typically activates */
  private timingMemory: Map<number, number> = new Map(); // timestamp -> count
  
  /** Strategy success tracking */
  private strategySuccess: Map<AIStrategy, number> = new Map();
  
  /** Strategy failure tracking */
  private strategyFailure: Map<AIStrategy, number> = new Map();
  
  // ═══════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════
  
  /** Current strategy being used */
  currentStrategy: AIStrategy = AIStrategy.Wait;
  
  /** Strategy timer (switch strategy periodically) */
  private strategyTimer: number = 0;
  
  /** Reaction delay accumulator */
  private reactionAccum: number = 0;
  
  /** Last chosen action */
  lastAction: HeroAction = HeroAction.Wait;
  
  /** Next intended zone (for visible intent) */
  intentZone: ZoneId | null = null;
  
  /** Is the AI currently faking? */
  isFaking: boolean = false;
  
  /** Fake target (where AI pretends to go) */
  fakeTarget: ZoneId | null = null;
  
  /** Real target (where AI actually wants to go) */
  realTarget: ZoneId | null = null;
  
  /** AI journal for display */
  private aiJournal: AIJournalEntry[] = [];
  
  /** Current attempt number */
  private attemptNumber: number = 1;
  
  // ═══════════════════════════════════════════════════════
  // CONSTRUCTOR
  // ═══════════════════════════════════════════════════════
  
  constructor() {
    // Initialize zone beliefs
    for (let i = 0; i < ALL_ZONES.length; i++) {
      this.zoneBeliefs[i] = { safe: true, dangerLevel: 0, lastChecked: 0 };
    }
    
    // Initialize strategy tracking
    for (const strategy of Object.values(AIStrategy)) {
      this.strategySuccess.set(strategy as AIStrategy, 0);
      this.strategyFailure.set(strategy as AIStrategy, 0);
    }
  }
  
  // ═══════════════════════════════════════════════════════
  // MAIN DECISION
  // ═══════════════════════════════════════════════════════
  
  /**
   * Choose the hero's next action given the current arena state.
   * @param state - Current game state
   * @param dt - Frame delta in seconds
   * @returns Hero action to execute
   */
  decide(state: ArenaState, dt: number): HeroAction {
    // Accumulate strategy timer
    this.strategyTimer += dt;
    
    // Reaction delay: only re-evaluate every AI_REACTION_MS
    let effectiveReactionMs = state.aiReactionMs;
    this.reactionAccum += dt * 1000;
    if (this.reactionAccum < effectiveReactionMs) {
      return this.lastAction;
    }
    this.reactionAccum = 0;
    
    // Update beliefs based on current zone
    this.updateBeliefs(state);
    
    // Should we switch strategy?
    this.evaluateStrategy(state);
    
    // Execute current strategy
    const action = this.executeStrategy(state);
    
    this.lastAction = action;
    state.heroAction = action;
    
    // Compute intent for visible display
    this.computeIntent(state);
    
    return action;
  }
  
  // ═══════════════════════════════════════════════════════
  // BELIEF UPDATES
  // ═══════════════════════════════════════════════════════
  
  /** Update zone beliefs based on current state */
  private updateBeliefs(state: ArenaState): void {
    const currentZone = state.hero.zone;
    const currentIdx = ZONE_INDEX[currentZone] ?? 0;
    const belief = this.zoneBeliefs[currentIdx];
    
    if (!belief) return;
    
    // Check if there's an active trap in current zone
    if (state.trap && state.hero.zone === state.trap.zone && state.trap.fired) {
      belief.safe = false;
      belief.dangerLevel = Math.min(1, belief.dangerLevel + 0.1);
    } else {
      belief.safe = true;
      belief.dangerLevel = Math.max(0, belief.dangerLevel - 0.05);
    }
    
    belief.lastChecked = state.elapsedTime;
  }
  
  // ═══════════════════════════════════════════════════════
  // STRATEGY SELECTION
  // ═══════════════════════════════════════════════════════
  
  /** Evaluate whether to switch strategy */
  private evaluateStrategy(state: ArenaState): void {
    // Switch strategies every 3-5 seconds
    const switchTime = 3 + Math.random() * 2;
    if (this.strategyTimer < switchTime) return;
    
    this.strategyTimer = 0;
    this.pickNewStrategy(state);
  }
  
  /** Pick a new strategy based on memory and situation */
  private pickNewStrategy(state: ArenaState): void {
    const strategies = this.getAvailableStrategies(state);
    
    // Weight by past success
    const weights = strategies.map(s => {
      const success = this.strategySuccess.get(s) ?? 0;
      const failure = this.strategyFailure.get(s) ?? 0;
      const net = success - failure;
      return Math.max(1, 5 + net);
    });
    
    // Weighted random selection
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * totalWeight;
    
    for (let i = 0; i < strategies.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        this.currentStrategy = strategies[i];
        this.addJournalEntry(state, `Switching to ${strategies[i]} strategy`);
        return;
      }
    }
    
    this.currentStrategy = strategies[0];
  }
  
  /** Get available strategies based on abilities and situation */
  private getAvailableStrategies(state: ArenaState): AIStrategy[] {
    const strategies: AIStrategy[] = [AIStrategy.Wait, AIStrategy.Bait];
    
    // Rush is always available but risky
    strategies.push(AIStrategy.Rush);
    
    // Feint requires some memory
    if (this.memory.size > 3) {
      strategies.push(AIStrategy.Feint);
    }
    
    // Dash requires Dash ability
    if (state.hero.abilities.has(HeroAbility.Dash)) {
      strategies.push(AIStrategy.Dash);
    }
    
    return strategies;
  }
  
  // ═══════════════════════════════════════════════════════
  // STRATEGY EXECUTION
  // ═══════════════════════════════════════════════════════
  
  /** Execute the current strategy */
  private executeStrategy(state: ArenaState): HeroAction {
    switch (this.currentStrategy) {
      case AIStrategy.Rush:
        return this.rushStrategy(state);
      case AIStrategy.Bait:
        return this.baitStrategy(state);
      case AIStrategy.Wait:
        return this.waitStrategy(state);
      case AIStrategy.Feint:
        return this.feintStrategy(state);
      case AIStrategy.Dash:
        return this.dashStrategy(state);
      default:
        return this.waitStrategy(state);
    }
  }
  
  /** Rush: Sprint through, ignore trap */
  private rushStrategy(state: ArenaState): HeroAction {
    // Move toward Zone5 (right)
    if (state.hero.zone === ZoneId.Zone5) {
      return HeroAction.Wait; // Already at end
    }
    
    // Move right
    return HeroAction.MoveRight;
  }
  
  /** Bait: Fake approach, retreat, approach again */
  private baitStrategy(state: ArenaState): HeroAction {
    const heroZone = state.hero.zone;
    const trapZone = state.trap?.zone;
    
    // If no trap, just rush
    if (!trapZone) {
      return this.rushStrategy(state);
    }
    
    const heroIdx = ZONE_INDEX[heroZone] ?? 0;
    const trapIdx = ZONE_INDEX[trapZone] ?? 0;
    
    // If hero is before trap, bait the player
    if (heroIdx < trapIdx) {
      // Get distance to trap
      const distanceToTrap = trapIdx - heroIdx;
      
      // If close to trap, be more likely to feint
      if (distanceToTrap <= 2) {
        // 40% chance to retreat (bait activation)
        if (Math.random() < 0.4 && heroIdx > 0) {
          this.isFaking = true;
          return HeroAction.MoveLeft;
        }
        // 60% chance to advance
        this.isFaking = false;
        return HeroAction.MoveRight;
      }
      
      // If far from trap, alternate approach/retreat
      if (this.isFaking) {
        // Retreating
        if (heroIdx > 0) {
          return HeroAction.MoveLeft;
        }
      } else {
        // Approaching
        return HeroAction.MoveRight;
      }
      
      // Toggle fake state
      this.isFaking = !this.isFaking;
    }
    
    // If hero is at or past trap, rush through
    return this.rushStrategy(state);
  }
  
  /** Wait: Stand still, observe trap timing */
  private waitStrategy(state: ArenaState): HeroAction {
    // Just wait and observe
    // Every few seconds, make a small movement to test
    if (Math.random() < 0.15) {
      return Math.random() < 0.5 ? HeroAction.MoveLeft : HeroAction.MoveRight;
    }
    return HeroAction.Wait;
  }
  
  /** Feint: Quick movement one way, reverse */
  private feintStrategy(state: ArenaState): HeroAction {
    const heroZone = state.hero.zone;
    const trapZone = state.trap?.zone;
    
    // If no trap, just rush
    if (!trapZone) {
      return this.rushStrategy(state);
    }
    
    const heroIdx = ZONE_INDEX[heroZone] ?? 0;
    const trapIdx = ZONE_INDEX[trapZone] ?? 0;
    
    // If hero is before trap, feint to bait activation
    if (heroIdx < trapIdx) {
      const distanceToTrap = trapIdx - heroIdx;
      
      // If close to trap, be more aggressive with feints
      if (distanceToTrap <= 2) {
        // 60% chance to feint (move away then come back)
        if (Math.random() < 0.6) {
          // Feint: move toward trap, then retreat
          if (heroIdx > 0) {
            return HeroAction.MoveLeft;
          }
        }
        // 40% chance to rush through
        return HeroAction.MoveRight;
      }
      
      // If far from trap, random feint
      if (Math.random() < 0.5) {
        return HeroAction.MoveLeft;
      } else {
        return HeroAction.MoveRight;
      }
    }
    
    // If hero is at or past trap, rush through
    return this.rushStrategy(state);
  }
  
  /** Dash: Quick movement through trap zone */
  private dashStrategy(state: ArenaState): HeroAction {
    // If hero has dash and trap is active, dash through
    if (state.hero.abilities.has(HeroAbility.Dash) && state.hero.dashCooldown <= 0) {
      if (state.trap && state.hero.zone === state.trap.zone && state.trap.fired) {
        return HeroAction.Dash;
      }
    }
    
    // Otherwise, rush
    return this.rushStrategy(state);
  }
  
  /** Move from one zone toward another */
  private moveToward(from: ZoneId, to: ZoneId): HeroAction {
    const fromIdx = ZONE_INDEX[from] ?? 0;
    const toIdx = ZONE_INDEX[to] ?? 0;
    
    if (fromIdx < toIdx) return HeroAction.MoveRight;
    if (fromIdx > toIdx) return HeroAction.MoveLeft;
    return HeroAction.Wait;
  }
  
  // ═══════════════════════════════════════════════════════
  // INTENT COMPUTATION
  // ═══════════════════════════════════════════════════════
  
  /** Compute hero's next intended zone (for visible intent display) */
  private computeIntent(state: ArenaState): void {
    // Simulate one step ahead
    const action = this.lastAction;
    const currentZone = state.hero.zone;
    const neighbors = state.getNeighbors(currentZone);
    
    if (action === HeroAction.MoveRight) {
      const nextIdx = (ZONE_INDEX[currentZone] ?? 0) + 1;
      if (nextIdx < ALL_ZONES.length) {
        this.intentZone = ALL_ZONES[nextIdx];
      }
    } else if (action === HeroAction.MoveLeft) {
      const nextIdx = (ZONE_INDEX[currentZone] ?? 0) - 1;
      if (nextIdx >= 0) {
        this.intentZone = ALL_ZONES[nextIdx];
      }
    } else if (action === HeroAction.Jump) {
      // Jump goes to boss zone if available
      if (currentZone === ZoneId.Zone2 || currentZone === ZoneId.Zone4) {
        this.intentZone = ZoneId.Zone3;
      }
    } else {
      this.intentZone = currentZone;
    }
    
    state.heroIntent = this.intentZone;
  }
  
  // ═══════════════════════════════════════════════════════
  // OUTCOME RECORDING
  // ═══════════════════════════════════════════════════════
  
  /** Record what happened to the hero this frame */
  recordOutcome(state: ArenaState, damaged: boolean, dodged: boolean): void {
    const zone = state.hero.zone;
    const trapType = state.trap?.type ?? null;
    
    const key = this.memoryKey(zone, trapType);
    const outcome: MemoryEntry = {
      zone,
      trapType,
      outcome: damaged ? 'hit' : dodged ? 'dodged' : 'safe',
      timestamp: state.elapsedTime,
      attempt: state.attemptNumber,
      strategy: this.currentStrategy,
    };
    
    let arr = this.memory.get(key);
    if (!arr) { arr = []; this.memory.set(key, arr); }
    arr.push(outcome);
    
    // Update timing memory
    if (damaged) {
      const timeSlot = Math.floor(state.elapsedTime);
      this.timingMemory.set(timeSlot, (this.timingMemory.get(timeSlot) ?? 0) + 1);
    }
    
    // Update strategy success/failure
    if (damaged) {
      this.strategyFailure.set(this.currentStrategy, (this.strategyFailure.get(this.currentStrategy) ?? 0) + 1);
      this.addJournalEntry(state, `Ouch! Took damage in ${zone} with ${this.currentStrategy} strategy`);
    } else if (dodged) {
      this.strategySuccess.set(this.currentStrategy, (this.strategySuccess.get(this.currentStrategy) ?? 0) + 1);
      this.addJournalEntry(state, `Dodged! ${this.currentStrategy} strategy worked`);
    }
  }
  
  /** Record final outcome of an attempt */
  recordAttemptOutcome(state: ArenaState): void {
    if (state.hero.won) {
      // Hero survived — strategy worked
      this.strategySuccess.set(this.currentStrategy, (this.strategySuccess.get(this.currentStrategy) ?? 0) + 10);
      this.addJournalEntry(state, `I survived! ${this.currentStrategy} strategy was effective`);
    } else if (!state.hero.alive) {
      // Hero died — strategy failed
      this.strategyFailure.set(this.currentStrategy, (this.strategyFailure.get(this.currentStrategy) ?? 0) + 5);
      this.addJournalEntry(state, `Defeated... ${this.currentStrategy} strategy didn't work`);
    }
    
    // Consolidate memory
    this.consolidateMemory();
  }
  
  /** Consolidate memory after each attempt — prune old entries */
  private consolidateMemory(): void {
    for (const [key, entries] of this.memory) {
      // Keep only the last 20 entries per key
      if (entries.length > 20) {
        this.memory.set(key, entries.slice(-20));
      }
    }
    
    // Keep only last 50 timing entries
    if (this.timingMemory.size > 50) {
      const entries = Array.from(this.timingMemory.entries());
      this.timingMemory = new Map(entries.slice(-50));
    }
  }
  
  // ═══════════════════════════════════════════════════════
  // NEW ATTEMPT
  // ═══════════════════════════════════════════════════════
  
  /** Reset for a new attempt (keep memory!) */
  onNewAttempt(state?: ArenaState): void {
    this.strategyTimer = 0;
    this.reactionAccum = 0;
    this.isFaking = false;
    this.fakeTarget = null;
    this.realTarget = null;
    this.intentZone = null;
    this.attemptNumber++;
    
    // Pick new strategy if state provided
    if (state) {
      this.pickNewStrategy(state);
    } else {
      // Default to Wait strategy
      this.currentStrategy = AIStrategy.Wait;
    }
  }
  
  /** Increase curiosity after new trap is encountered */
  onNewTrap(state: ArenaState): void {
    // Reset beliefs for trap zone
    if (state.trap) {
      const idx = ZONE_INDEX[state.trap.zone] ?? 0;
      this.zoneBeliefs[idx] = { safe: true, dangerLevel: 0, lastChecked: 0 };
    }
    
    // Switch to Wait strategy to observe
    this.currentStrategy = AIStrategy.Wait;
    this.addJournalEntry(state, `New trap detected! Switching to observe strategy`);
  }
  
  // ═══════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════
  
  /** Get the hero's "thought process" for review panel */
  getThoughts(state?: ArenaState): string[] {
    const thoughts: string[] = [];
    
    // Current strategy
    thoughts.push(`Strategy: ${this.currentStrategy}`);
    
    // Zone beliefs
    for (let i = 0; i < ALL_ZONES.length; i++) {
      const zone = ALL_ZONES[i];
      const belief = this.zoneBeliefs[i];
      if (belief && !belief.safe) {
        thoughts.push(`${zone} is dangerous (danger: ${(belief.dangerLevel * 100).toFixed(0)}%)`);
      }
    }
    
    // Unlocked abilities
    if (state?.hero.abilities.has(HeroAbility.Dash)) thoughts.push('Ability: Dash');
    if (state?.hero.abilities.has(HeroAbility.Shield)) thoughts.push('Ability: Shield');
    if (state?.hero.abilities.has(HeroAbility.DoubleJump)) thoughts.push('Ability: Double Jump');
    
    // Memory stats
    thoughts.push(`Memory entries: ${this.memory.size}`);
    thoughts.push(`Timing patterns: ${this.timingMemory.size}`);
    
    return thoughts;
  }
  
  /** Get a concise real-time thought for the in-game thought bubble */
  getLiveThought(state: ArenaState): string {
    const zone = state.hero.zone;
    const trapZone = state.trap?.zone;
    const trapType = state.trap?.type;
    
    // Strategy-specific flavor text
    let strategyText: string;
    switch (this.currentStrategy) {
      case AIStrategy.Rush: strategyText = '⚔️ charging!'; break;
      case AIStrategy.Bait: strategyText = '🎭 baiting...'; break;
      case AIStrategy.Wait: strategyText = '👁 watching...'; break;
      case AIStrategy.Feint: strategyText = '🔄 feinting'; break;
      case AIStrategy.Dash: strategyText = '⚡ dashing!'; break;
      default: strategyText = '🧠 thinking'; break;
    }
    
    // If in trap zone, show danger
    if (trapZone && zone === trapZone && state.trap?.fired) {
      const trapName = trapType ? trapType.charAt(0).toUpperCase() + trapType.slice(1) : 'Trap';
      return `${strategyText} ⚠️ ${trapName}!`;
    }
    
    // If approaching trap, show awareness
    if (trapZone) {
      const zoneIdx = ZONE_INDEX[zone] ?? 0;
      const trapIdx = ZONE_INDEX[trapZone] ?? 0;
      if (zoneIdx < trapIdx) {
        return `${strategyText} 😰 trap ahead`;
      }
    }
    
    // Show strategy
    return strategyText;
  }
  
  /** Get memory heatmap data for review */
  getMemoryHeatmap(): Map<ZoneId, number> {
    const heat = new Map<ZoneId, number>();
    
    for (const zone of ALL_ZONES) {
      heat.set(zone, 0);
    }
    
    for (const [, entries] of this.memory) {
      for (const e of entries) {
        const current = heat.get(e.zone) ?? 0;
        heat.set(e.zone, current + (e.outcome === 'hit' ? 3 : e.outcome === 'dodged' ? 1 : 0));
      }
    }
    
    // Normalize
    const max = Math.max(...Array.from(heat.values()), 1);
    for (const [z, v] of heat) {
      heat.set(z, v / max);
    }
    
    return heat;
  }
  
  /** Get the AI journal for display */
  getJournal(): AIJournalEntry[] {
    return [...this.aiJournal];
  }
  
  // ═══════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════
  
  private memoryKey(zone: ZoneId, trapType: TrapType | null): string {
    return trapType ? `${zone}:${trapType}` : `${zone}:any`;
  }
  
  private addJournalEntry(state: ArenaState, thought: string): void {
    this.aiJournal.push({
      thought,
      timestamp: state.elapsedTime,
      attempt: state.attemptNumber,
      zone: state.hero.zone,
    });
    
    // Keep only last 20 entries
    if (this.aiJournal.length > 20) {
      this.aiJournal = this.aiJournal.slice(-20);
    }
  }
}
