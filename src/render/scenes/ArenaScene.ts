import Phaser from 'phaser';
import { ArenaState } from '../../game/simulation/ArenaState';
import { RuleEngine } from '../../game/simulation/RuleEngine';
import type { TickEvent } from '../../game/simulation/RuleEngine';
import { GlimmerAI } from '../../ai/GlimmerAI';
import type { RuleCard } from '../../game/simulation/Types';
import { ZoneId, RuleType, HeroAction, GAME_CONFIG, PLAYABLE_ZONES, ZONE_POSITIONS } from '../../game/simulation/Types';
import { RenderBridge } from '../adapters/RenderBridge';
import { AudioManager } from '../../audio/AudioManager';
/**
 * Main gameplay scene.
 * Thin Phaser scene that delegates to the simulation.
 */
export class ArenaScene extends Phaser.Scene {
  // Systems
  private simState!: ArenaState;
  private ruleEngine!: RuleEngine;
  private glimmer!: GlimmerAI;
  private bridge!: RenderBridge;

  private audio!: AudioManager;
  // Game state
  private speedMultiplier: number = 1;
  private isPaused: boolean = false;
  private isDesignMode: boolean = false;
  private isReviewMode: boolean = false;
  private eventQueue: TickEvent[] = [];
  private attemptEndHandled: boolean = false;

  // Design mode
  private selectedRuleType: RuleType | null = null;
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
    this.ruleEngine = new RuleEngine();
    this.glimmer = new GlimmerAI();
    this.bridge = new RenderBridge();
    this.audio = new AudioManager();
    // Build render bridge
    const container = this.add.container(0, 0);
    this.bridge.init(this, container);

    // Start in design mode so the player can place rules before first attempt
    this.isDesignMode = true;
    this.isPaused = true;

    // Input: pause with Space
    this.input.keyboard!.on('keydown-SPACE', () => {
      if (this.simState.attemptOver) {
        this.beginNextAttemptInDesign();
      } else {
        this.isPaused = !this.isPaused;
      }
      this.notifyUI();
    });

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

    this.onStateChanged?.();
    this.notifyUI();
  }
  update(_time: number, delta: number): void {
    if (this.isPaused || this.isDesignMode || this.isReviewMode) return;

    const dt = (delta / 1000) * this.speedMultiplier;

    // 1. AI decides action
    if (this.simState.heroAlive && !this.simState.heroWon) {
      this.glimmer.decide(this.simState);
      this.moveHero();
    }

    // 2. Tick simulation
    const events = this.ruleEngine.tick(this.simState, dt);
    // 2a. Sound effects
    if (events.heroDied) this.audio.playDeath();
    else if (events.heroDamaged) this.audio.playDamage();
    if (events.heroReachedBoss) this.audio.playVictory();
    for (const trigger of events.ruleTriggers) {
      if (trigger.kind === 'erupt') {
        if (trigger.type === RuleType.FlameVent) this.audio.playFlame();
        else if (trigger.type === RuleType.SpikeWall) this.audio.playSpike();
        else if (trigger.type === RuleType.SentryOrb) this.audio.playOrb();
      } else if (trigger.kind === 'impact') {
        this.audio.playDamage();
      }
    }
    for (const _dep of events.rulesDeployed) {
      this.audio.playDeploy();
    }

    // 2b. Floating damage numbers
    if (events.heroDamaged) {
      const pos = ZONE_POSITIONS[this.simState.heroZone];
      const px = pos.x * this.scale.width;
      const py = pos.y * this.scale.height - 50;
      const dmgText = this.add.text(px, py, '-1 HP', {
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

    // 3. Tell AI what happened
    this.glimmer.recordOutcome(this.simState, events.heroDamaged, events.heroDodged);

    // 4. Sync visuals
    this.bridge.sync(this.simState, events);
    this.bridge.refreshZoneHighlights(this.simState);
    this.bridge.refreshPendingLabels(this.simState);
    this.bridge.updateHeroVisuals(this.simState.totalDeaths);

    // 5. Check attempt end (one-shot)
    if (this.simState.attemptOver && !this.attemptEndHandled) {
      this.attemptEndHandled = true;
      this.glimmer.recordAttemptOutcome(this.simState);
      this.eventQueue.push(events);
      this.isPaused = true;
      // Auto-show review panel after brief death pause
      this.time.delayedCall(1500, () => {
        if (this.simState.attemptOver && !this.isReviewMode) {
          this.isReviewMode = true;
          this.isDesignMode = false;
          this.bridge.resetZoneVisuals();
          this.bridge.refreshZoneHighlights(this.simState);
          this.showReviewData();
          this.onAttemptEnd?.(this.simState.heroWon);
          this.notifyUI();
        }
      });
    }

    this.notifyUI();
  }

  /** Convert hero action into zone movement */
  private moveHero(): void {
    // Gravity Well reversal
    if (this.simState.gravityWellPulled) {
      this.simState.gravityWellPulled = false;
      const action = this.simState.heroAction;
      if (action === HeroAction.MoveRight) this.simState.heroAction = HeroAction.MoveLeft;
      else if (action === HeroAction.MoveLeft) this.simState.heroAction = HeroAction.MoveRight;
      else if (action === HeroAction.Jump) this.simState.heroAction = HeroAction.Wait;
    }

    const action = this.simState.heroAction;
    const current = this.simState.heroZone;
    const neighbors = this.simState.getNeighbors(current);
    const idx = PLAYABLE_ZONES.indexOf(current);

    let target: ZoneId | null = null;

    if (action === HeroAction.MoveRight) {
      const nextIdx = idx + 1;
      if (nextIdx < PLAYABLE_ZONES.length) {
        target = PLAYABLE_ZONES[nextIdx];
      }
      if (target && !neighbors.includes(target)) {
        target = null;
      }
    } else if (action === HeroAction.MoveLeft) {
      const prevIdx = idx - 1;
      if (prevIdx >= 0) {
        target = PLAYABLE_ZONES[prevIdx];
      }
      if (target && !neighbors.includes(target)) {
        target = null;
      }
    } else if (action === HeroAction.Jump) {
      if (current === ZoneId.LeftPlatform) {
        target = ZoneId.CenterPlatform;
        const walkNeighbors = this.simState.getNeighbors(ZoneId.LeftWalkway);
        if (walkNeighbors.includes(ZoneId.CenterPlatform)) {
          target = ZoneId.CenterPlatform;
        }
      } else if (current === ZoneId.RightPlatform) {
        target = ZoneId.CenterPlatform;
      } else if (current === ZoneId.LeftWalkway) {
        target = ZoneId.RightWalkway;
      } else if (current === ZoneId.RightWalkway) {
        target = ZoneId.LeftWalkway;
      }
    }

    // Validate target is a neighbor
    if (target && neighbors.includes(target)) {
      this.simState.heroZone = target;
      this.simState.recordMove();
    }
  }

  /** Deploy a rule card from design panel */
  deployRule(card: RuleCard): void {
    this.ruleEngine.deployRule(this.simState, card);
    this.glimmer.onNewRules(this.simState);
    this.bridge.refreshZoneHighlights(this.simState);
    this.notifyUI();
  }

  /** Remove a rule */
  /** Remove a rule */
  removeRule(zone: ZoneId, type: RuleType): void {
    this.ruleEngine.removeRule(this.simState, zone, type);
    this.bridge.refreshZoneHighlights(this.simState);
    this.notifyUI();
  }

  /** Toggle design mode (pause + show rule editor) */
  toggleDesignMode(): void {
    // TAB from review after attempt over → unified exit
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

  /** Start a new attempt — live mode (used only by LAUNCH button) */
  newAttempt(): void {
    if (this.simState.attemptOver || !this.simState.heroAlive) {
      this.simState.attemptNumber++;
      this.ruleEngine.setSeed(42 + this.simState.attemptNumber);
      this.simState.resetHero();
      this.glimmer.onNewAttempt();
      this.isReviewMode = false;
      this.isDesignMode = false;
      this.isPaused = false;
      this.eventQueue = [];
      this.attemptEndHandled = false;
      this.bridge.resetZoneVisuals();
      this.bridge.refreshZoneHighlights(this.simState);
      this.notifyUI();
    }
  }

  /** Reset attempt and enter design mode — all post-attempt exits use this */
  beginNextAttemptInDesign(): void {
    if (this.simState.attemptOver || !this.simState.heroAlive) {
      this.simState.attemptNumber++;
      this.ruleEngine.setSeed(42 + this.simState.attemptNumber);
      this.simState.resetHero();
      this.glimmer.onNewAttempt();
      this.isReviewMode = false;
      this.isDesignMode = true;
      this.isPaused = true;
      this.eventQueue = [];
      this.attemptEndHandled = false;
      this.bridge.resetZoneVisuals();
      this.bridge.refreshZoneHighlights(this.simState);
      this.notifyUI();
    }
  }
  getAudio(): AudioManager { return this.audio; }
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
      this.bridge.resetZoneVisuals();
      this.bridge.refreshZoneHighlights(this.simState);
    }
    this.onStateChanged?.();
  }

  /** Get current simulation state for UI */
  getState(): ArenaState { return this.simState; }
  getAI(): GlimmerAI { return this.glimmer; }
  getSpeed(): number { return this.speedMultiplier; }
  getIsPaused(): boolean { return this.isPaused; }
  getIsDesignMode(): boolean { return this.isDesignMode; }
  getIsReviewMode(): boolean { return this.isReviewMode; }

  /** Set speed from UI */
  setSpeed(s: number): void { this.speedMultiplier = s; }

  /** Pause/unpause from UI */
  setPaused(p: boolean): void { this.isPaused = p; }

  private showReviewData(): void {
    const heatmap = this.glimmer.getMemoryHeatmap();
    this.bridge.showReviewHeatmap(heatmap);
  }

  private notifyUI(): void {
    this.onStateChanged?.();
  }
}
