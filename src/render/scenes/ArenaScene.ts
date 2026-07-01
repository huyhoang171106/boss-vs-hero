/**
 * DEADLOCK — Arena Scene
 * 
 * Main gameplay scene. Thin Phaser scene that delegates to simulation.
 */

import Phaser from 'phaser';
import { ArenaState } from '../../game/simulation/ArenaState';
import { TrapSystem } from '../../game/simulation/TrapSystem';
import { GlimmerAI } from '../../ai/GlimmerAI';
import {
  ZoneId, ALL_ZONES, TRAP_ZONES, ZONE_INDEX, ZONE_POSITIONS,
  TrapType, HeroAction, HeroAbility,
  GAME_CONFIG, TRAP_CONFIG,
} from '../../game/simulation/Types';
import { RenderBridge } from '../adapters/RenderBridge';
import { AudioManager } from '../../audio/AudioManager';

/**
 * Main gameplay scene.
 * Thin Phaser scene that delegates to the simulation.
 */
export class ArenaScene extends Phaser.Scene {
  // Systems
  private simState!: ArenaState;
  private trapSystem!: TrapSystem;
  private glimmer!: GlimmerAI;
  private bridge!: RenderBridge;
  private audio!: AudioManager;
  
  // Game state
  private speedMultiplier: number = 1;
  private isPaused: boolean = true;
  private isDesignMode: boolean = true;
  private isReviewMode: boolean = false;
  
  // Attempt state
  private attemptEndHandled: boolean = false;
  
  // UI update throttle
  private _uiFrameCounter: number = 0;
  
  // DOM elements
  private _intentIndicator: HTMLDivElement | null = null;
  private _comboDisplay: HTMLDivElement | null = null;
  private _lastComboCount: number = 0;
  
  // Design mode
  private selectedTrapType: TrapType = TrapType.Fire;
  private selectedZone: ZoneId | null = null;
  
  // DOM callbacks (set by main.ts)
  onStateChanged!: () => void;
  onAttemptEnd!: (heroWon: boolean) => void;
  
  constructor() {
    super({ key: 'ArenaScene' });
  }
  
  create(): void {
    // Initialize systems
    this.simState = new ArenaState();
    this.trapSystem = new TrapSystem();
    this.glimmer = new GlimmerAI();
    this.bridge = new RenderBridge();
    this.audio = new AudioManager();
    
    // Build render bridge
    const container = this.add.container(0, 0);
    this.bridge.init(this, container);
    
    // Start in design mode
    this.isDesignMode = true;
    this.isPaused = true;
    
    // Input: pause with Space
    this.input.keyboard!.on('keydown-SPACE', () => {
      if (this.isDesignMode) {
        this.toggleDesignMode();
      } else if (this.simState.attemptOver) {
        this.beginNextAttemptInDesign();
      } else {
        // Manual trap activation
        this.activateTrap();
      }
    });
    
    // Speed controls
    this.input.keyboard!.on('keydown-ONE', () => { this.speedMultiplier = 1; this.notifyUI(); });
    this.input.keyboard!.on('keydown-TWO', () => { this.speedMultiplier = 2; this.notifyUI(); });
    this.input.keyboard!.on('keydown-THREE', () => { this.speedMultiplier = 4; this.notifyUI(); });
    this.input.keyboard!.on('keydown-FOUR', () => { this.speedMultiplier = 8; this.notifyUI(); });
    
    // Design mode toggle
    this.input.keyboard!.on('keydown-TAB', () => {
      this.toggleDesignMode();
    });
    
    // Review mode toggle
    this.input.keyboard!.on('keydown-R', () => {
      if (this.simState.attemptOver || this.isReviewMode) {
        this.toggleReviewMode();
      }
    });
    
    // Trap type selection (1-4)
    this.input.keyboard!.on('keydown-ONE', () => { this.selectedTrapType = TrapType.Fire; this.notifyUI(); });
    this.input.keyboard!.on('keydown-TWO', () => { this.selectedTrapType = TrapType.Ice; this.notifyUI(); });
    this.input.keyboard!.on('keydown-THREE', () => { this.selectedTrapType = TrapType.Spike; this.notifyUI(); });
    this.input.keyboard!.on('keydown-FOUR', () => { this.selectedTrapType = TrapType.Void; this.notifyUI(); });
    
    this.onStateChanged?.();
    this.notifyUI();
  }
  
  update(_time: number, delta: number): void {
    if (this.isPaused || this.isDesignMode || this.isReviewMode) return;
    
    const dt = (delta / 1000) * this.speedMultiplier;
    
    // 1. AI decides action
    if (this.simState.hero.alive && !this.simState.hero.won) {
      this.glimmer.decide(this.simState, dt);
      this.moveHero();
    }
    
    // 2. Tick trap system
    const trapEvents = this.trapSystem.tick(this.simState, dt);
    
    // 2a. Sound effects
    if (trapEvents.heroDied) this.audio.playDeath();
    else if (trapEvents.heroDamaged) this.audio.playDamage();
    if (trapEvents.heroWon) this.audio.playVictory();
    if (trapEvents.trapActivated) this.audio.playDeploy();
    
    // 2b. Floating damage numbers
    if (trapEvents.heroDamaged) {
      const pos = ZONE_POSITIONS[this.simState.hero.zone];
      const px = pos.x * this.scale.width;
      const py = pos.y * this.scale.height - 50;
      const dmgText = this.add.text(px, py, `-${trapEvents.damageAmount} HP`, {
        fontSize: '16px', color: '#ff4444', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(10);
      this.tweens.add({
        targets: dmgText,
        y: py - 30,
        alpha: 0,
        duration: 600,
        onComplete: () => dmgText.destroy(),
      });
    }
    
    // 2c. Shield blocked effect
    if (trapEvents.shieldBlocked) {
      const pos = ZONE_POSITIONS[this.simState.hero.zone];
      const px = pos.x * this.scale.width;
      const py = pos.y * this.scale.height - 50;
      const shieldText = this.add.text(px, py, '🛡️ BLOCKED', {
        fontSize: '14px', color: '#44aaff', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(10);
      this.tweens.add({
        targets: shieldText,
        y: py - 30,
        alpha: 0,
        duration: 600,
        onComplete: () => shieldText.destroy(),
      });
    }
    
    // 2d. Teleport effect
    if (trapEvents.heroTeleported && trapEvents.teleportDestination) {
      this.simState.hero.zone = trapEvents.teleportDestination;
      this.simState.recordMove();
      this.showAbilityEffect('🌀 TELEPORTED!', '#aa44ff');
    }
    
    // 3. Tell AI what happened
    this.glimmer.recordOutcome(this.simState, trapEvents.heroDamaged, false);
    
    // 4. Sync visuals
    this.bridge.sync(this.simState, trapEvents);
    this.bridge.refreshZoneHighlights(this.simState);
    this.bridge.updateHeroVisuals(this.simState.totalKills);
    
    // 4b. Sync AI thought bubble
    if (this.simState.hero.alive) {
      this.bridge.setThought(this.glimmer.getLiveThought(this.simState));
    }
    
    // 5. Show intent indicator
    this.updateIntentIndicator();
    
    // 6. Check attempt end (one-shot)
    if (this.simState.attemptOver && !this.attemptEndHandled) {
      this.attemptEndHandled = true;
      this.glimmer.recordAttemptOutcome(this.simState);
      
      // Award kill rewards
      if (!this.simState.hero.won) {
        this.simState.addKill();
      }
      
      this.isPaused = true;
      
      // Show kill cinematic
      if (!this.simState.hero.won) {
        this.showKillCinematic();
        
        // Show unlock notifications
        for (const ability of this.simState.newlyUnlockedAbilities) {
          const abilityNames: Record<HeroAbility, string> = {
            [HeroAbility.Dash]: 'Dash',
            [HeroAbility.Shield]: 'Shield',
            [HeroAbility.DoubleJump]: 'Double Jump',
          };
          const name = abilityNames[ability] ?? ability;
          this.time.delayedCall(1500, () => {
            this.showUnlockNotification(name);
          });
        }
      }
      
      // Auto-show review panel after cinematic
      this.time.delayedCall(2500, () => {
        if (this.simState.attemptOver && !this.isReviewMode) {
          this.isReviewMode = true;
          this.isDesignMode = false;
          this.bridge.resetZoneVisuals();
          this.bridge.refreshZoneHighlights(this.simState);
          this.showReviewData();
          this.onAttemptEnd?.(this.simState.hero.won);
          this.notifyUI();
        }
      });
    }
    
    // 7. Throttle UI updates
    if (++this._uiFrameCounter % 6 === 0) this.notifyUI();
  }
  
  // ═══════════════════════════════════════════════════════
  // HERO MOVEMENT
  // ═══════════════════════════════════════════════════════
  
  /** Convert hero action into zone movement */
  private moveHero(): void {
    const action = this.simState.heroAction;
    const current = this.simState.hero.zone;
    const neighbors = this.simState.getNeighbors(current);
    const idx = ZONE_INDEX[current] ?? 0;
    
    let target: ZoneId | null = null;
    
    if (action === HeroAction.MoveRight) {
      const nextIdx = idx + 1;
      if (nextIdx < ALL_ZONES.length) {
        target = ALL_ZONES[nextIdx];
      }
    } else if (action === HeroAction.MoveLeft) {
      const prevIdx = idx - 1;
      if (prevIdx >= 0) {
        target = ALL_ZONES[prevIdx];
      }
    } else if (action === HeroAction.Jump) {
      // Jump to boss zone if adjacent
      if (current === ZoneId.Zone2 || current === ZoneId.Zone4) {
        target = ZoneId.Zone3;
      }
    } else if (action === HeroAction.Dash) {
      // Dash through current zone (if trap is there)
      if (this.simState.trap && current === this.simState.trap.zone) {
        // Dash succeeds — no damage
        target = current; // Stay in zone but avoid damage
      }
    }
    
    // Validate target is a neighbor
    if (target && neighbors.includes(target)) {
      this.simState.hero.zone = target;
      this.simState.recordMove();
    }
  }
  
  // ═══════════════════════════════════════════════════════
  // TRAP ACTIONS
  // ═══════════════════════════════════════════════════════
  
  /** Place a trap on a zone */
  placeTrap(zone: ZoneId, type: TrapType): void {
    this.trapSystem.placeTrap(this.simState, zone, type);
    this.glimmer.onNewTrap(this.simState);
    this.bridge.refreshZoneHighlights(this.simState);
    this.notifyUI();
  }
  
  /** Remove the current trap */
  removeTrap(): void {
    this.trapSystem.removeTrap(this.simState);
    this.bridge.refreshZoneHighlights(this.simState);
    this.notifyUI();
  }
  
  /** Activate the trap manually */
  activateTrap(): boolean {
    const success = this.trapSystem.activateTrap(this.simState);
    if (success) {
      this.audio.playDeploy();
      this.showAbilityEffect('🔥 ACTIVATED!', TRAP_CONFIG[this.simState.trap!.type].color);
      this.notifyUI();
    }
    return success;
  }
  
  // ═══════════════════════════════════════════════════════
  // GAME PHASES
  // ═══════════════════════════════════════════════════════
  
  /** Toggle design mode */
  toggleDesignMode(): void {
    if (this.isReviewMode && this.simState.attemptOver) {
      this.beginNextAttemptInDesign();
      return;
    }
    
    this.isDesignMode = !this.isDesignMode;
    if (this.isDesignMode) {
      this.isReviewMode = false;
      this.isPaused = true;
      this.bridge.resetZoneVisuals();
      this.bridge.refreshZoneHighlights(this.simState);
    } else {
      if (this.simState.attemptOver) {
        this.beginNextAttemptInDesign();
        return;
      }
      this.isPaused = false;
    }
    this.onStateChanged?.();
  }
  
  /** Toggle review mode */
  toggleReviewMode(): void {
    this.isReviewMode = !this.isReviewMode;
    if (this.isReviewMode) {
      this.isDesignMode = false;
      this.isPaused = true;
      this.bridge.resetZoneVisuals();
      this.bridge.refreshZoneHighlights(this.simState);
      this.showReviewData();
    } else {
      if (this.simState.attemptOver) {
        this.beginNextAttemptInDesign();
        return;
      }
      this.isPaused = false;
    }
    this.onStateChanged?.();
  }
  
  /** Start next attempt in design mode */
  beginNextAttemptInDesign(): void {
    this.simState.resetForNewAttempt();
    this.glimmer.onNewAttempt();
    this.isReviewMode = false;
    this.isDesignMode = true;
    this.isPaused = true;
    this.attemptEndHandled = false;
    this.bridge.resetZoneVisuals();
    this.bridge.refreshZoneHighlights(this.simState);
    this.notifyUI();
  }
  
  // ═══════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════
  
  getState(): ArenaState { return this.simState; }
  getAI(): GlimmerAI { return this.glimmer; }
  getSpeed(): number { return this.speedMultiplier; }
  getIsPaused(): boolean { return this.isPaused; }
  getIsDesignMode(): boolean { return this.isDesignMode; }
  getIsReviewMode(): boolean { return this.isReviewMode; }
  getAudio(): AudioManager { return this.audio; }
  getSelectedTrapType(): TrapType { return this.selectedTrapType; }
  getSelectedZone(): ZoneId | null { return this.selectedZone; }
  setSelectedZone(zone: ZoneId | null): void { this.selectedZone = zone; }
  
  /** Set speed from UI */
  setSpeed(s: number): void { this.speedMultiplier = s; }
  
  /** Pause/unpause from UI */
  setPaused(p: boolean): void { this.isPaused = p; }
  
  // ═══════════════════════════════════════════════════════
  // UI HELPERS
  // ═══════════════════════════════════════════════════════
  
  private showReviewData(): void {
    const heatmap = this.glimmer.getMemoryHeatmap();
    this.bridge.showReviewHeatmap(heatmap);
  }
  
  private notifyUI(): void {
    this.onStateChanged?.();
  }
  
  /** Update intent indicator */
  private updateIntentIndicator(): void {
    const parent = this.game.canvas.parentElement;
    if (!parent) return;
    
    const isLive = !this.isDesignMode && !this.isReviewMode && !this.simState.attemptOver && this.simState.hero.alive;
    
    if (!isLive) {
      if (this._intentIndicator) {
        this._intentIndicator.style.display = 'none';
      }
      return;
    }
    
    const strategy = this.glimmer.currentStrategy;
    const intentZone = this.simState.heroIntent;
    const strategyNames: Record<string, string> = {
      rush: 'RUSHING',
      bait: 'BAITING',
      wait: 'WAITING',
      feint: 'FEINTING',
      dash: 'DASHING',
    };
    const strategyColors: Record<string, string> = {
      rush: '#ff4444',
      bait: '#ffcc00',
      wait: '#00d4ff',
      feint: '#aa44ff',
      dash: '#00ff88',
    };
    const desc = strategyNames[strategy] || '???';
    const color = strategyColors[strategy] || '#aaa';
    const zoneName = intentZone ? this.getZoneDisplayName(intentZone) : '—';
    
    if (!this._intentIndicator) {
      this._intentIndicator = document.createElement('div');
      this._intentIndicator.style.cssText = `
        position: absolute; top: 8px; left: 12px;
        font-family: monospace; font-size: 11px; font-weight: bold;
        color: #aaa; z-index: 120; pointer-events: none;
        background: rgba(20,20,40,0.8); border: 1px solid #333;
        border-radius: 4px; padding: 3px 8px;
      `;
      parent.appendChild(this._intentIndicator);
    }
    
    this._intentIndicator.style.display = 'block';
    this._intentIndicator.style.borderColor = color;
    this._intentIndicator.textContent = `${desc} → ${zoneName}`;
  }
  
  /** Show ability visual effect */
  private showAbilityEffect(text: string, color: string): void {
    const parent = this.game.canvas.parentElement;
    if (!parent) return;
    
    const el = document.createElement('div');
    el.style.cssText = `
      position: absolute; bottom: 60px; left: 50%; transform: translateX(-50%);
      font-family: monospace; font-size: 16px; font-weight: bold;
      color: ${color}; z-index: 150; pointer-events: none;
      text-shadow: 0 0 10px ${color}80;
      animation: comboFlash 1.2s ease-out forwards;
    `;
    el.textContent = text;
    parent.appendChild(el);
    this.time.delayedCall(1200, () => el.remove());
  }
  
  /** Show animated score breakdown when hero is killed */
  private showKillCinematic(): void {
    const parent = this.game.canvas.parentElement;
    if (!parent) return;
    
    const bd = this.simState.lastScoreBreakdown;
    if (!bd) return;
    
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.7); z-index: 200;
      animation: fadeIn 0.15s ease-out;
    `;
    overlay.innerHTML = `
      <div style="text-align: center; font-family: monospace; color: #fff;">
        <div style="font-size: 36px; font-weight: bold; color: #ff4444;
          text-shadow: 0 0 20px rgba(255,68,68,0.5); margin-bottom: 8px;
          animation: killPop 0.3s cubic-bezier(0.175,0.885,0.32,1.275);">ELIMINATED</div>
        <div style="font-size: 14px; color: #aaa; margin-bottom: 16px; animation: fadeSlideIn 0.4s 0.1s both;">
          Attempt #${this.simState.attemptNumber}
        </div>
        <div style="font-size: 13px; line-height: 1.8; animation: fadeSlideIn 0.4s 0.2s both;">
          <div>BASE <span style="color:#ffaa00">${bd.base}</span></div>
          <div>× EFFICIENCY <span style="color:#00d4ff">${bd.efficiency.toFixed(2)}x</span>
            <span style="color:#666;font-size:11px">${bd.activationsUsed} activations</span></div>
          <div>× SPEED <span style="color:#00ff88">${bd.speed.toFixed(2)}x</span>
            <span style="color:#666;font-size:11px">${bd.timeToKill.toFixed(1)}s</span></div>
          <div>× STREAK <span style="color:#ffcc00">${bd.streak.toFixed(2)}x</span></div>
        </div>
        <div style="font-size: 28px; font-weight: bold; color: #ffcc00; margin-top: 12px;
          text-shadow: 0 0 15px rgba(255,204,0,0.4);
          animation: killPop 0.3s 0.5s cubic-bezier(0.175,0.885,0.32,1.275) both;">
          ${bd.total} PTS
        </div>
      </div>
    `;
    parent.appendChild(overlay);
    
    this.time.delayedCall(2200, () => {
      overlay.style.animation = 'fadeOut 0.3s ease-in forwards';
      this.time.delayedCall(300, () => overlay.remove());
    });
  }
  
  /** Show trap unlock notification */
  private showUnlockNotification(abilityName: string): void {
    const parent = this.game.canvas.parentElement;
    if (!parent) return;
    
    const el = document.createElement('div');
    el.style.cssText = `
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      font-family: monospace; font-size: 18px; font-weight: bold;
      color: #ffcc00; z-index: 200; pointer-events: none;
      text-shadow: 0 0 20px #ffcc0080, 0 0 40px #ff660040;
      animation: comboFlash 2s ease-out forwards;
      text-align: center;
    `;
    el.innerHTML = `🔓 NEW ABILITY UNLOCKED!<br><span style="font-size:24px;color:#ff6600;">${abilityName}</span>`;
    parent.appendChild(el);
    this.time.delayedCall(2000, () => el.remove());
  }
  
  /** Get display name for a zone */
  private getZoneDisplayName(zone: ZoneId): string {
    const names: Record<string, string> = {
      zone1: 'Start',
      zone2: 'Zone 2',
      zone3: 'Boss',
      zone4: 'Zone 4',
      zone5: 'End',
    };
    return names[zone] || zone;
  }
}
