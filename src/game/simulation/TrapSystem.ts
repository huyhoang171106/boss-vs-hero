/**
 * DEADLOCK — Trap System
 * 
 * Handles trap placement, activation, effects, and damage.
 * One trap per attempt. Manual activation by player.
 */

import {
  ZoneId, TrapType, HeroAction, HeroAbility,
  GAME_CONFIG, TRAP_CONFIG,
} from './Types';
import type { TrapState } from './Types';
import type { ArenaState } from './ArenaState';

/**
 * Tick result: what happened to traps this frame.
 */
export interface TrapTickEvent {
  /** Trap was activated by player */
  trapActivated: boolean;
  
  /** Trap effect triggered (damage, slow, etc.) */
  trapEffectTriggered: boolean;
  
  /** Hero took damage */
  heroDamaged: boolean;
  
  /** Damage amount */
  damageAmount: number;
  
  /** Hero was slowed by ice */
  heroSlowed: boolean;
  
  /** Hero was teleported by void */
  heroTeleported: boolean;
  
  /** Teleport destination */
  teleportDestination: ZoneId | null;
  
  /** Shield blocked damage */
  shieldBlocked: boolean;
  
  /** Hero died */
  heroDied: boolean;
  
  /** Hero won (reached end) */
  heroWon: boolean;
}

/**
 * Trap system — processes trap mechanics each frame.
 */
export class TrapSystem {
  /** Pooled tick event to avoid allocation */
  private readonly _event: TrapTickEvent = {
    trapActivated: false,
    trapEffectTriggered: false,
    heroDamaged: false,
    damageAmount: 0,
    heroSlowed: false,
    heroTeleported: false,
    teleportDestination: null,
    shieldBlocked: false,
    heroDied: false,
    heroWon: false,
  };
  
  /**
   * Process trap mechanics for this frame.
   * @param state - Current game state
   * @param dt - Delta time in seconds
   * @returns Events for this frame
   */
  tick(state: ArenaState, dt: number): TrapTickEvent {
    const event = this._event;
    
    // Reset event
    event.trapActivated = false;
    event.trapEffectTriggered = false;
    event.heroDamaged = false;
    event.damageAmount = 0;
    event.heroSlowed = false;
    event.heroTeleported = false;
    event.teleportDestination = null;
    event.shieldBlocked = false;
    event.heroDied = false;
    event.heroWon = false;
    
    if (!state.trap || !state.hero.alive || state.hero.won) {
      return event;
    }
    
    // Update trap cooldown
    if (state.trap.cooldownTimer > 0) {
      state.trap.cooldownTimer -= dt;
    }
    
    // Update trap active timer
    if (state.trap.fired && state.trap.activeTimer > 0) {
      state.trap.activeTimer -= dt;
      
      // Check if trap effect should trigger
      if (state.trap.activeTimer <= 0) {
        state.trap.fired = false;
        state.trap.activeTimer = 0;
      }
    }
    
    // Check if hero is in trap zone and trap is active
    if (state.isHeroInTrapZone()) {
      event.trapEffectTriggered = true;
      
      // Apply trap effect based on type
      switch (state.trap.type) {
        case TrapType.Fire:
          this.applyFireDamage(state, event);
          break;
        case TrapType.Ice:
          this.applyIceEffect(state, event);
          break;
        case TrapType.Spike:
          this.applySpikeDamage(state, event);
          break;
        case TrapType.Void:
          this.applyVoidEffect(state, event);
          break;
      }
    }
    
    // Check win condition: hero reached Zone5
    if (state.hero.zone === ZoneId.Zone5) {
      state.hero.won = true;
      state.attemptOver = true;
      event.heroWon = true;
    }
    
    // Check if hero is at boss zone (Zone3) — just informational, doesn't end attempt
    
    return event;
  }
  
  /**
   * Activate trap manually (player input).
   * @param state - Current game state
   * @returns true if activation succeeded
   */
  activateTrap(state: ArenaState): boolean {
    if (!state.canActivateTrap()) return false;
    
    return state.activateTrap();
  }
  
  /**
   * Place a trap on a zone.
   * @param state - Current game state
   * @param zone - Zone to place trap
   * @param type - Trap type
   * @returns true if placement succeeded
   */
  placeTrap(state: ArenaState, zone: ZoneId, type: TrapType): boolean {
    return state.placeTrap(zone, type);
  }
  
  /**
   * Remove the current trap.
   * @param state - Current game state
   */
  removeTrap(state: ArenaState): void {
    state.removeTrap();
  }
  
  // ═══════════════════════════════════════════════════════
  // TRAP EFFECTS
  // ═══════════════════════════════════════════════════════
  
  /** Apply fire damage */
  private applyFireDamage(state: ArenaState, event: TrapTickEvent): void {
    const damage = TRAP_CONFIG[TrapType.Fire].damage;
    
    // Check if hero can dash through
    if (state.heroAction === HeroAction.Dash && state.hero.abilities.has(HeroAbility.Dash)) {
      // Hero dashed through — no damage
      return;
    }
    
    // Apply damage
    this.applyDamage(state, damage, event);
  }
  
  /** Apply ice effect (slow) */
  private applyIceEffect(state: ArenaState, event: TrapTickEvent): void {
    const damage = TRAP_CONFIG[TrapType.Ice].damage;
    
    // Check if hero can jump over
    if (state.heroAction === HeroAction.Jump && state.hero.abilities.has(HeroAbility.DoubleJump)) {
      // Hero jumped over — no damage
      return;
    }
    
    // Apply slow effect
    event.heroSlowed = true;
    
    // Apply damage
    this.applyDamage(state, damage, event);
  }
  
  /** Apply spike damage */
  private applySpikeDamage(state: ArenaState, event: TrapTickEvent): void {
    const damage = TRAP_CONFIG[TrapType.Spike].damage;
    
    // Spike has 0.5s delay — hero can move during this time
    // (This is handled in the main game loop by checking if trap just activated)
    
    // Apply damage
    this.applyDamage(state, damage, event);
  }
  
  /** Apply void effect (teleport) */
  private applyVoidEffect(state: ArenaState, event: TrapTickEvent): void {
    const damage = TRAP_CONFIG[TrapType.Void].damage;
    
    // Void teleports hero to random zone
    event.heroTeleported = true;
    
    // Choose random zone (not current zone, not Zone1)
    const possibleZones = [
      ZoneId.Zone2,
      ZoneId.Zone3,
      ZoneId.Zone4,
      ZoneId.Zone5,
    ].filter(z => z !== state.hero.zone);
    
    event.teleportDestination = possibleZones[Math.floor(Math.random() * possibleZones.length)];
    
    // Apply damage if any
    if (damage > 0) {
      this.applyDamage(state, damage, event);
    }
  }
  
  /** Apply damage to hero */
  private applyDamage(state: ArenaState, damage: number, event: TrapTickEvent): void {
    // Check if shield blocks damage
    if (state.hero.shieldHp > 0) {
      state.hero.shieldHp--;
      event.shieldBlocked = true;
      return;
    }
    
    // Apply damage
    state.hero.hp -= damage;
    event.heroDamaged = true;
    event.damageAmount = damage;
    
    // Check if hero died
    if (state.hero.hp <= 0) {
      state.hero.hp = 0;
      state.hero.alive = false;
      state.attemptOver = true;
      event.heroDied = true;
    }
  }
}
