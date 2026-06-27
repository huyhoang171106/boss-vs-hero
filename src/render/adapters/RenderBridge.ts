import Phaser from 'phaser';
import { ArenaState } from '../../game/simulation/ArenaState';
import type { TickEvent } from '../../game/simulation/RuleEngine';
import {
  ZoneId, PLAYABLE_ZONES, PLATFORM_ZONES,
  ZONE_POSITIONS, RuleType, GAME_CONFIG,
} from '../../game/simulation/Types';

/**
 * Bridges simulation state into Phaser scene objects.
 * Scene graph = disposable view state. Simulation owns truth.
 */
export class RenderBridge {
  private scene!: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;

  private platforms: Map<ZoneId, Phaser.GameObjects.Rectangle> = new Map();
  private spikeEffects: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private zoneLabels: Map<ZoneId, Phaser.GameObjects.Text> = new Map();

  private zoneGlowTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  private gameWidth: number;
  private gameHeight: number;
  private zoneWidth: number;
  private zoneHeight: number;

  private particlePool: Phaser.GameObjects.Rectangle[] = [];

  constructor() {
    this.gameWidth = 800;
    this.gameHeight = 500;
    this.zoneWidth = 120;
    this.zoneHeight = 80;
  }

  init(scene: Phaser.Scene, container: Phaser.GameObjects.Container): void {
    this.scene = scene;
    this.container = container;
    this.gameWidth = scene.scale.width;
    this.gameHeight = scene.scale.height;
    this.zoneWidth = Math.max(120, this.gameWidth / 6);
    this.zoneHeight = Math.max(80, this.gameHeight / 6);

    this.buildArena();
    this.buildHero();
    this.buildBoss();
  }

  private buildArena(): void {
    const bg = this.scene.add.rectangle(
      this.gameWidth / 2, this.gameHeight / 2,
      this.gameWidth, this.gameHeight, 0x1a1a2e
    );
    bg.setDepth(-10);
    this.container.add(bg);

    for (const z of PLAYABLE_ZONES) {
      const pos = ZONE_POSITIONS[z];
      const px = pos.x * this.gameWidth;
      const py = pos.y * this.gameHeight;
      const isPlatform = PLATFORM_ZONES.includes(z);

      const rect = this.scene.add.rectangle(
        px, py,
        isPlatform ? this.zoneWidth : this.zoneWidth * 0.6,
        isPlatform ? this.zoneHeight * 0.5 : this.zoneHeight * 0.3,
        isPlatform ? 0x16213e : 0x0f3460
      );
      rect.setStrokeStyle(1, 0x533483);
      rect.setDepth(isPlatform ? 0 : -1);
      this.container.add(rect);
      this.platforms.set(z, rect);
      const label = this.scene.add.text(px, py + (isPlatform ? 40 : 20), z, {
        fontSize: '14px', color: '#8888aa', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5);
      label.setDepth(1);
      this.container.add(label);
      this.zoneLabels.set(z, label);
    }

    const pitPos = ZONE_POSITIONS[ZoneId.Pit];
    const pitText = this.scene.add.text(
      pitPos.x * this.gameWidth, pitPos.y * this.gameHeight,
      '☠ PIT ☠', { fontSize: '18px', color: '#ff4444', fontFamily: 'monospace', fontStyle: 'bold' }
    ).setOrigin(0.5);
    pitText.setDepth(-2);
    this.container.add(pitText);
  }

  private heroContainer!: Phaser.GameObjects.Container;
  private heroBody!: Phaser.GameObjects.Rectangle;
  private heroEyes!: Phaser.GameObjects.Arc;
  private heroName!: Phaser.GameObjects.Text;
  private heroHpBg!: Phaser.GameObjects.Rectangle;
  private heroHpFill!: Phaser.GameObjects.Rectangle;
  private heroThought!: Phaser.GameObjects.Text;
  private lastHp: number = -1;
  private lastThought: string = '';
  private thoughtThrottle: number = 0;
  /** Glimmer's visual evolution stage (1-3) */
  private heroEvolutionStage: number = 1;

  private buildHero(): void {
    const startPos = ZONE_POSITIONS[ZoneId.LeftPlatform];
    const sx = startPos.x * this.gameWidth;
    const sy = startPos.y * this.gameHeight;

    this.heroContainer = this.scene.add.container(sx, sy - 50);
    this.heroContainer.setDepth(5);

    // Glow halo behind hero
    const glow = this.scene.add.circle(0, 0, 30, 0x00d4ff, 0.15);
    this.heroContainer.add(glow);

    this.heroBody = this.scene.add.rectangle(0, 0, 40, 54, 0x00d4ff);
    this.heroBody.setStrokeStyle(2, 0x00fff0);
    this.heroContainer.add(this.heroBody);

    this.heroEyes = this.scene.add.circle(0, -10, 6, 0xffffff);
    this.heroContainer.add(this.heroEyes);

    this.heroName = this.scene.add.text(0, -48, '✦ Glimmer', {
      fontSize: '14px', color: '#00d4ff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.heroContainer.add(this.heroName);
    // HP bar — persistent, updated on damage only
    this.heroHpBg = this.scene.add.rectangle(0, 38, 44, 5, 0x333333);
    this.heroHpBg.setStrokeStyle(1, 0x555555);
    this.heroContainer.add(this.heroHpBg);
    this.heroHpFill = this.scene.add.rectangle(-20, 38, 40, 4, 0x00ff88);
    this.heroHpFill.setOrigin(0, 0.5);
    this.heroContainer.add(this.heroHpFill);

    // Thought bubble — persistent, throttled to ~0.5s updates
    this.heroThought = this.scene.add.text(0, -68, '', {
      fontSize: '11px', color: '#aaaacc', fontFamily: 'monospace',
      backgroundColor: 'rgba(10,10,30,0.8)', padding: { x: 6, y: 3 },
    }).setOrigin(0.5, 1);
    this.heroThought.setAlpha(0);
    this.heroContainer.add(this.heroThought);

    this.container.add(this.heroContainer);
  }

  /** Update Glimmer's appearance based on deaths/progression */
  updateHeroVisuals(totalDeaths: number): void {
    let stage = 1;
    if (totalDeaths >= 5) stage = 2;
    if (totalDeaths >= 15) stage = 3;

    if (stage !== this.heroEvolutionStage) {
      this.heroEvolutionStage = stage;
      const sizes = [
        { body: 40, stroke: 0x00fff0, color: 0x00d4ff },
        { body: 48, stroke: 0xffaa00, color: 0xffcc00 },
        { body: 56, stroke: 0xff4444, color: 0xff6600 },
      ];
      const s = sizes[stage - 1];
      this.heroBody.setSize(s.body, s.body * 1.35);
      this.heroBody.setStrokeStyle(3, s.stroke);
      this.heroName.setText(`✦ Glimmer v${stage}`);
      this.heroName.setColor(s.color === 0xff6600 ? '#ff6600' : s.color === 0xffcc00 ? '#ffcc00' : '#00d4ff');
    }
  }


  private bossContainer!: Phaser.GameObjects.Container;

  private buildBoss(): void {
    const pos = ZONE_POSITIONS[ZoneId.CenterPlatform];
    const bx = pos.x * this.gameWidth;
    const by = pos.y * this.gameHeight;

    this.bossContainer = this.scene.add.container(bx, by - 55);
    this.bossContainer.setDepth(4);

    const body = this.scene.add.rectangle(0, 0, 56, 64, 0xdc143c);
    body.setStrokeStyle(3, 0xff4444);
    this.bossContainer.add(body);

    const lEye = this.scene.add.circle(-12, -12, 6, 0xffff00);
    this.bossContainer.add(lEye);
    const rEye = this.scene.add.circle(12, -12, 6, 0xffff00);
    this.bossContainer.add(rEye);

    const label = this.scene.add.text(0, -48, 'BOSS', {
      fontSize: '16px', color: '#ff4444', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.bossContainer.add(label);

    this.container.add(this.bossContainer);
  }

  /** Sync visual state with simulation */
  sync(state: ArenaState, events: TickEvent): void {
    this.updateHeroPosition(state);
    this.updateHeroAppearance(state);
    this.updateHeroHUD(state);
    this.handleEvents(state, events);
  }

  private lastHeroX: number = 0;
  private lastHeroY: number = 0;
  private updateHeroPosition(state: ArenaState): void {
    const pos = ZONE_POSITIONS[state.heroZone];
    const targetX = pos.x * this.gameWidth;
    const targetY = pos.y * this.gameHeight - 50;
    // Trail particles when moving
    const dx = targetX - this.heroContainer.x;
    const dy = targetY - this.heroContainer.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 5 && Math.random() < 0.3) {
      const trail = this.scene.add.circle(
        this.heroContainer.x + (Math.random() - 0.5) * 8,
        this.heroContainer.y + (Math.random() - 0.5) * 8,
        2 + Math.random() * 2, 0x00d4ff, 0.6
      );
      trail.setDepth(4);
      this.scene.tweens.add({
        targets: trail, alpha: 0, scale: 0.3,
        duration: 300 + Math.random() * 200,
        onComplete: () => trail.destroy(),
      });
    }
    this.heroContainer.x += dx * 0.12;
    this.heroContainer.y += dy * 0.12;
  }

  private heroHealthPulseTween: Phaser.Tweens.Tween | null = null;

  private updateHeroAppearance(state: ArenaState): void {
    const hpScale = state.heroHP / GAME_CONFIG.HERO_MAX_HP;
    this.heroContainer.setScale(0.8 + hpScale * 0.2);

    if (!state.heroAlive) {
      // Dead - keep it visible but faded for a moment
      this.heroContainer.setAlpha(0.3);
      this.heroContainer.setAngle(90);
      return;
    }

    this.heroContainer.setAngle(0);

    if (hpScale <= 0.34) {
      // Low HP - pulse red
      if (!this.heroHealthPulseTween) {
        this.heroBody.setFillStyle(0xff4444);
        this.heroHealthPulseTween = this.scene.tweens.add({
          targets: this.heroContainer,
          alpha: { from: 1, to: 0.5 },
          duration: 400,
          yoyo: true,
          repeat: -1,
        });
      }
      this.heroContainer.setAlpha(1);
    } else {
      // Normal appearance
      if (this.heroHealthPulseTween) {
        this.heroHealthPulseTween.stop();
        this.heroHealthPulseTween = null;
      }
      this.heroContainer.setAlpha(1);
      this.heroBody.setFillStyle(0x00d4ff);
    }
  }
  /** Update HP bar and thought bubble — only does work on change */
  private updateHeroHUD(state: ArenaState): void {
    // HP bar — update only when HP changes
    const hp = state.heroHP;
    if (hp !== this.lastHp) {
      this.lastHp = hp;
      const maxHp = GAME_CONFIG.HERO_MAX_HP;
      const ratio = Math.max(0, hp / maxHp);
      this.heroHpFill.setScale(ratio, 1);
      // Color: green > yellow > red
      const color = ratio > 0.6 ? 0x00ff88 : ratio > 0.3 ? 0xffaa00 : 0xff4444;
      this.heroHpFill.setFillStyle(color);
      this.heroHpBg.setVisible(state.heroAlive);
      this.heroHpFill.setVisible(state.heroAlive);
    }
    // Thought bubble — throttle to ~0.5s, only on change
    const now = this.scene.time.now;
    if (now - this.thoughtThrottle > 500) {
      const thought = state.heroAlive
        ? this.getZoneThought(state)
        : (state.heroWon ? '★ VICTORY!' : '☠ ...');
      if (thought !== this.lastThought) {
        this.lastThought = thought;
        this.heroThought.setText(thought);
        this.heroThought.setAlpha(state.heroAlive ? 0.9 : 0.6);
      }
      this.thoughtThrottle = now;
    }
  }

  private getZoneThought(state: ArenaState): string {
    const z = state.heroZone;
    const rules = state.getRulesInZone(z);
    if (rules.length === 0) return '...safe here';
    const types = rules.map(r => r.card.type);
    if (types.includes(RuleType.FlameVent)) return '🔥 heat!';
    if (types.includes(RuleType.SpikeWall)) return '⚡ danger!';
    if (types.includes(RuleType.SentryOrb)) return '🟣 spotted!';
    if (types.includes(RuleType.GravityWell)) return '🌀 pulled!';
    if (types.includes(RuleType.TemporalRift)) return '⏱ losing time!';
    return '...hmm';
  }

  /** Track ongoing particle emitters per zone for continuous hazards */
  private activeFireEmitters: Map<string, Phaser.GameObjects.Rectangle[]> = new Map();

  private handleEvents(state: ArenaState, events: TickEvent): void {
    for (const trigger of events.ruleTriggers) {
      switch (trigger.kind) {
        case 'erupt': this.showEruption(trigger.zone, trigger.type); break;
        case 'dismiss': this.hideEffect(trigger.zone, trigger.type); break;
        case 'impact': this.showImpact(trigger.zone); break;
        case 'spawn': this.showOrbSpawn(trigger.zone); break;
      }
    }
    if (events.heroDamaged) {
      this.scene.cameras.main.shake(150, 0.015);
      this.scene.cameras.main.flash(80, 255, 0, 0);
      this.flashHeroDamage();
    }
    if (events.heroDied) {
      this.scene.cameras.main.shake(500, 0.03);
      this.playHeroDeathEffect();
    }
    if (events.heroReachedBoss) {
      this.scene.cameras.main.flash(500, 0, 255, 0);
    }
  }

  private flashHeroDamage(): void {
    this.heroBody.setFillStyle(0xffffff);
    this.scene.time.delayedCall(100, () => {
      if (this.heroBody && this.heroBody.active) {
        this.heroBody.setFillStyle(0x00d4ff);
      }
    });
  }

  private playHeroDeathEffect(): void {
    // Create burst of particles at hero position
    const hx = this.heroContainer.x;
    const hy = this.heroContainer.y;
    for (let i = 0; i < 12; i++) {
      const p = this.scene.add.rectangle(
        hx, hy, 4 + Math.random() * 4, 4 + Math.random() * 4,
        [0x00d4ff, 0x00fff0, 0x00aaff][Math.floor(Math.random() * 3)]
      );
      p.setDepth(6);
      const angle = (Math.PI * 2 / 12) * i;
      const dist = 40 + Math.random() * 60;
      this.scene.tweens.add({
        targets: p,
        x: hx + Math.cos(angle) * dist,
        y: hy + Math.sin(angle) * dist,
        alpha: 0,
        scale: 0,
        duration: 600 + Math.random() * 400,
        delay: Math.random() * 100,
        onComplete: () => p.destroy(),
      });
    }
  }

  /** Spawn fire particles for FlameVent eruptions */
  private spawnFireParticles(px: number, py: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const size = 4 + Math.random() * 8;
      const p = this.scene.add.rectangle(
        px + (Math.random() - 0.5) * 20,
        py,
        size, size,
        [0xff4400, 0xff6600, 0xffaa00, 0xff0000][Math.floor(Math.random() * 4)]
      );
      p.setDepth(3);
      this.scene.tweens.add({
        targets: p,
        y: py - 20 - Math.random() * 40,
        x: px + (Math.random() - 0.5) * 30,
        alpha: 0,
        scale: 0.3 + Math.random() * 0.7,
        duration: 400 + Math.random() * 300,
        onComplete: () => p.destroy(),
      });
    }
  }

  /** Spawn debris particles for SpikeWall */
  private spawnDebrisParticles(px: number, py: number): void {
    for (let i = 0; i < 6; i++) {
      const size = 3 + Math.random() * 4;
      const p = this.scene.add.rectangle(
        px + (Math.random() - 0.5) * 40,
        py - 10,
        size, size, 0xaaaaaa
      );
      p.setDepth(3);
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
      const dist = 20 + Math.random() * 30;
      this.scene.tweens.add({
        targets: p,
        x: px + Math.cos(angle) * dist,
        y: py + Math.sin(angle) * dist,
        alpha: 0,
        duration: 300 + Math.random() * 200,
        onComplete: () => p.destroy(),
      });
    }
  }

  /** Spawn spark particles for SentryOrb */
  private spawnSparkParticles(px: number, py: number): void {
    for (let i = 0; i < 5; i++) {
      const p = this.scene.add.circle(
        px + (Math.random() - 0.5) * 10,
        py + (Math.random() - 0.5) * 10,
        2 + Math.random() * 3, 0xff88ff
      );
      p.setDepth(3);
      const angle = Math.random() * Math.PI * 2;
      const dist = 15 + Math.random() * 25;
      this.scene.tweens.add({
        targets: p,
        x: px + Math.cos(angle) * dist,
        y: py + Math.sin(angle) * dist,
        alpha: 0,
        duration: 200 + Math.random() * 200,
        onComplete: () => p.destroy(),
      });
    }
  }

  /** Spawn deploy glow particles */
  spawnDeployEffect(zone: ZoneId): void {
    const pos = ZONE_POSITIONS[zone];
    const px = pos.x * this.gameWidth;
    const py = pos.y * this.gameHeight;

    const ring = this.scene.add.circle(px, py, 10, 0xffff00, 0.6);
    ring.setDepth(4);
    ring.setStrokeStyle(2, 0xffff00);
    this.scene.tweens.add({
      targets: ring,
      scale: 3,
      alpha: 0,
      duration: 600,
      onComplete: () => ring.destroy(),
    });
  }

  private showEruption(zone: ZoneId, type: RuleType): void {
    const pos = ZONE_POSITIONS[zone];
    const px = pos.x * this.gameWidth;
    const py = pos.y * this.gameHeight;

    switch (type) {
      case RuleType.FlameVent: {
        // Main flame rectangle
        const flame = this.scene.add.rectangle(px, py - 20, 60, 8, 0xff6600, 0.9);
        flame.setDepth(2);
        this.scene.tweens.add({
          targets: flame, y: py - 70, alpha: 0,
          duration: GAME_CONFIG.FLAME_DURATION * 1000,
          onComplete: () => flame.destroy(),
        });
        // Fire particles
        this.spawnFireParticles(px, py - 20, 8);
        break;
      }
      case RuleType.SpikeWall: {
        // Spikes
        for (let i = -2; i <= 2; i++) {
          const spike = this.scene.add.triangle(
            px + i * 18, py - this.zoneHeight * 0.25,
            0, 0, 8, -40, 16, 0, 0x888888
          );
          spike.setDepth(3);
          this.scene.tweens.add({
            targets: spike,
            y: spike.y - 40,
            duration: 150 + Math.abs(i) * 30,
            ease: 'back.out',
            onComplete: () => {
              // Keep visible during spike duration
              this.scene.time.delayedCall(GAME_CONFIG.SPIKE_DURATION * 1000 - 300, () => {
                this.scene.tweens.add({
                  targets: spike,
                  y: spike.y + 40,
                  alpha: 0,
                  duration: 200,
                  onComplete: () => spike.destroy(),
                });
              });
            },
          });
        }
        // Debris
        this.spawnDebrisParticles(px, py);
        break;
      }
      case RuleType.SentryOrb: {
        // Orb flash + projectile
        const flash = this.scene.add.circle(px, py - 20, 15, 0xff00ff, 0.8);
        flash.setDepth(3);
        this.scene.tweens.add({
          targets: flash, alpha: 0, scale: 2, duration: 300,
          onComplete: () => flash.destroy(),
        });
        this.spawnSparkParticles(px, py - 20);
        break;
      }
      case RuleType.GravityWell: {
        // Purple vortex ring
        const ring1 = this.scene.add.circle(px, py - 20, 8, 0xaa44ff, 0.7);
        ring1.setStrokeStyle(2, 0xff88ff);
        ring1.setDepth(3);
        const ring2 = this.scene.add.circle(px, py - 20, 4, 0xcc66ff, 0.5);
        ring2.setDepth(3);
        this.scene.tweens.add({
          targets: ring1,
          scale: 2.5, alpha: 0,
          duration: 400,
          onComplete: () => ring1.destroy(),
        });
        this.scene.tweens.add({
          targets: ring2,
          scale: 3, alpha: 0,
          duration: 500,
          onComplete: () => ring2.destroy(),
        });
        break;
      }
      case RuleType.TemporalRift: {
        // Blue time rift effect
        const rift = this.scene.add.circle(px, py - 20, 12, 0x4488ff, 0.6);
        rift.setStrokeStyle(2, 0x88ccff);
        rift.setDepth(3);
        this.scene.tweens.add({
          targets: rift,
          scaleX: 0.3,
          scaleY: 2.0,
          alpha: 0,
          duration: 600,
          onComplete: () => rift.destroy(),
        });
        // Time shards
        for (let i = 0; i < 4; i++) {
          const shard = this.scene.add.rectangle(
            px + (Math.random() - 0.5) * 16,
            py - 20 + (Math.random() - 0.5) * 16,
            3, 6, 0x88ccff
          );
          shard.setDepth(3);
          this.scene.tweens.add({
            targets: shard,
            y: shard.y - 30,
            alpha: 0,
            angle: 180,
            duration: 500 + Math.random() * 300,
            onComplete: () => shard.destroy(),
          });
        }
        break;
      }
    }
  }

  private hideEffect(zone: ZoneId, type: RuleType): void {
    const key = `${zone}:${type}`;
    const spike = this.spikeEffects.get(key);
    if (spike) {
      this.scene.tweens.add({
        targets: spike, height: 4, duration: 200,
        onComplete: () => { spike.destroy(); this.spikeEffects.delete(key); },
      });
    }
  }

  private showImpact(zone: ZoneId): void {
    const pos = ZONE_POSITIONS[zone];
    const px = pos.x * this.gameWidth;
    const py = pos.y * this.gameHeight;
    const burst = this.scene.add.circle(px, py - 20, 5, 0xff00ff);
    this.scene.tweens.add({ targets: burst, scale: 3, alpha: 0, duration: 300, onComplete: () => burst.destroy() });
    this.spawnSparkParticles(px, py - 20);
  }

  private showOrbSpawn(zone: ZoneId): void {
    const pos = ZONE_POSITIONS[zone];
    const px = pos.x * this.gameWidth;
    const py = pos.y * this.gameHeight;
    const orb = this.scene.add.circle(px, py - 30, 6, 0xff00ff);
    orb.setDepth(3);
    this.scene.tweens.add({ targets: orb, x: px + 200, alpha: 0, duration: 1200, onComplete: () => orb.destroy() });
  }

  /** Zone glow animation data */
  private zoneGlowTweens: Map<ZoneId, Phaser.Tweens.Tween> = new Map();
  /** Per-zone cached visual state — avoids destroying/recreating every frame */
  private zoneVisualState: Map<ZoneId, {
    erupting: boolean;
    ruleCount: number;
    ruleKey: string;
    pendingCount: number;
  }> = new Map();

  refreshZoneHighlights(state: ArenaState): void {
    const RULE_COLORS: Record<string, number> = {
      [RuleType.FlameVent]: 0xff6600, [RuleType.SpikeWall]: 0xaaaaaa,
      [RuleType.SentryOrb]: 0xff00ff, [RuleType.GravityWell]: 0xaa44ff,
      [RuleType.TemporalRift]: 0x4488ff,
    };
    const RULE_TINTS: Record<string, number> = {
      [RuleType.FlameVent]: 0x331100, [RuleType.SpikeWall]: 0x222222,
      [RuleType.SentryOrb]: 0x220022, [RuleType.GravityWell]: 0x1a0033,
      [RuleType.TemporalRift]: 0x001133,
    };
    const RULE_ICONS: Record<string, string> = {
      [RuleType.FlameVent]: '🔥', [RuleType.SpikeWall]: '⚡',
      [RuleType.SentryOrb]: '🟣', [RuleType.GravityWell]: '🌀',
      [RuleType.TemporalRift]: '⏱',
    };

    for (const z of PLAYABLE_ZONES) {
      const rect = this.platforms.get(z);
      if (!rect) continue;
      const pos = ZONE_POSITIONS[z];
      const px = pos.x * this.gameWidth;
      const py = pos.y * this.gameHeight;
      const isPlatform = PLATFORM_ZONES.includes(z);
      const rules = state.getRulesInZone(z);
      const hasRule = rules.length > 0;
      const isPending = state.pendingRules.some(p => p.card.zone === z);
      const isErupting = state.ruleStates.some(rs => rs.card.zone === z && rs.isErupting);
      const ruleKey = rules.map(r => r.card.type).join(',');
      const pendingCount = state.pendingRules.filter(p => p.card.zone === z).length;

      // Get or init cached state — always defined after this block
      let vs = this.zoneVisualState.get(z);
      const isCacheMiss = !vs;
      if (isCacheMiss) {
        vs = { erupting: false, ruleCount: 0, ruleKey: '', pendingCount: 0 };
        this.zoneVisualState.set(z, vs);
      }
      const cached = vs!;

      const eruptingChanged = isCacheMiss || isErupting !== cached.erupting;
      const rulesChanged = isCacheMiss || ruleKey !== cached.ruleKey;
      const pendingChanged = isCacheMiss || pendingCount !== cached.pendingCount;

      // Only touch tweens when erupting state transitions
      if (eruptingChanged) {
        const oldTween = this.zoneGlowTweens.get(z);
        if (oldTween) { oldTween.stop(); this.zoneGlowTweens.delete(z); }

        if (isErupting) {
          const tween = this.scene.tweens.add({
            targets: rect, alpha: { from: 1, to: 0.4 },
            duration: 150, yoyo: true, repeat: -1,
          });
          this.zoneGlowTweens.set(z, tween);
          rect.setStrokeStyle(3, 0xff0000);
          rect.setFillStyle(0x440000);
        } else if (hasRule) {
          const dominant = rules[0].card.type;
          rect.setStrokeStyle(2, RULE_COLORS[dominant] ?? 0xff6600);
          rect.setFillStyle(RULE_TINTS[dominant] ?? 0x16213e);
          rect.setAlpha(1);
        } else {
          rect.setStrokeStyle(1, isPlatform ? 0x533483 : 0x0f3460);
          rect.setFillStyle(isPlatform ? 0x16213e : 0x0f3460);
          rect.setAlpha(1);
        }
      }

      // When rules change: update icons AND zone tint
      if (rulesChanged) {
        // Update zone tint/stroke (only if not currently erupting — erupting overrides color)
        if (!isErupting) {
          if (hasRule) {
            const dominant = rules[0].card.type;
            rect.setStrokeStyle(2, RULE_COLORS[dominant] ?? 0xff6600);
            rect.setFillStyle(RULE_TINTS[dominant] ?? 0x16213e);
          } else {
            rect.setStrokeStyle(1, isPlatform ? 0x533483 : 0x0f3460);
            rect.setFillStyle(isPlatform ? 0x16213e : 0x0f3460);
          }
          rect.setAlpha(1);
        }

        // Recreate icon text
        const oldIcon = this.zoneGlowTexts.get(`icon-${z}`);
        if (oldIcon) { oldIcon.destroy(); this.zoneGlowTexts.delete(`icon-${z}`); }
        if (hasRule) {
          const iconStr = rules.map(r => RULE_ICONS[r.card.type] ?? '?').join(' ');
          const iconLabel = this.scene.add.text(px, py - (isPlatform ? 40 : 24), iconStr, {
            fontSize: '18px',
          }).setOrigin(0.5);
          iconLabel.setDepth(2);
          this.container.add(iconLabel);
          this.zoneGlowTexts.set(`icon-${z}`, iconLabel);
        }
      }

      // Only recreate countdown texts when pending count changes; just update text content each frame
      if (pendingChanged) {
        const oldCd = this.zoneGlowTexts.get(`pending-${z}`);
        if (oldCd) { oldCd.destroy(); this.zoneGlowTexts.delete(`pending-${z}`); }
      }
      if (isPending) {
        const pending = state.pendingRules.find(p => p.card.zone === z);
        if (pending) {
          const rem = Math.max(0, GAME_CONFIG.RULE_DEPLOY_TIME - pending.timer).toFixed(1);
          let cd = this.zoneGlowTexts.get(`pending-${z}`) as Phaser.GameObjects.Text | undefined;
          if (!cd) {
            cd = this.scene.add.text(px, py - (isPlatform ? 54 : 36), '', {
              fontSize: '13px', color: '#ffff00', fontFamily: 'monospace', fontStyle: 'bold',
            }).setOrigin(0.5);
            cd.setDepth(5);
            this.container.add(cd);
            this.zoneGlowTexts.set(`pending-${z}`, cd);
          }
          cd.setText(`⏳ ${rem}s`); // cheap — just updates text, no alloc
        }
      } else {
        // No pending — destroy countdown if it exists
        const oldCd = this.zoneGlowTexts.get(`pending-${z}`);
        if (oldCd) { oldCd.destroy(); this.zoneGlowTexts.delete(`pending-${z}`); }
      }

      // Update cached state
      cached.erupting = isErupting;
      cached.ruleCount = rules.length;
      cached.ruleKey = ruleKey;
      cached.pendingCount = pendingCount;
    }
  }

  refreshPendingLabels(_state: ArenaState): void {
    // Merged into refreshZoneHighlights
  }

  showReviewHeatmap(heatmap: Map<ZoneId, number>): void {
    for (const [zone, intensity] of heatmap) {
      const rect = this.platforms.get(zone);
      if (!rect) continue;
      rect.setFillStyle(0xff0000, Math.min(0.5, intensity * 0.5));
    }
  }

  /** Stop all zone tweens + clear cache — call when entering review/design/newAttempt */
  resetZoneVisuals(): void {
    for (const [, tween] of this.zoneGlowTweens) { tween.stop(); }
    this.zoneGlowTweens.clear();
    this.zoneVisualState.clear();
    // Destroy cached texts
    for (const [, label] of this.zoneGlowTexts) { label.destroy(); }
    this.zoneGlowTexts.clear();
  }

  destroy(): void {
    this.container.removeAll(true);
  }
}
