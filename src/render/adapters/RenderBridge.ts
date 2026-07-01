/**
 * DEADLOCK — Render Bridge
 * 
 * Syncs simulation state to Phaser scene graph.
 * Disposable view layer — no game logic here.
 */

import Phaser from 'phaser';
import {
  ZoneId, ALL_ZONES, ZONE_INDEX, ZONE_POSITIONS,
  TrapType, HeroAction, HeroAbility,
  TRAP_CONFIG,
} from '../../game/simulation/Types';
import type { ArenaState } from '../../game/simulation/ArenaState';
import type { TrapTickEvent } from '../../game/simulation/TrapSystem';

/**
 * Bridges simulation → Phaser rendering.
 * All visual state lives here. Simulation is truth.
 */
export class RenderBridge {
  private scene!: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  
  // Zone visuals
  private zoneGraphics: Map<ZoneId, Phaser.GameObjects.Graphics> = new Map();
  private zoneLabels: Map<ZoneId, Phaser.GameObjects.Text> = new Map();
  
  // Hero visual
  private heroSprite!: Phaser.GameObjects.Graphics;
  private heroLabel!: Phaser.GameObjects.Text;
  
  // Trap visual
  private trapGraphics: Phaser.GameObjects.Graphics | null = null;
  private trapLabel: Phaser.GameObjects.Text | null = null;
  
  // Thought bubble
  private thoughtBubble!: Phaser.GameObjects.Text;
  
  // Intent indicator
  private intentGraphics: Phaser.GameObjects.Graphics | null = null;
  
  // Review heatmap
  private heatmapGraphics: Phaser.GameObjects.Graphics | null = null;
  
  init(scene: Phaser.Scene, container: Phaser.GameObjects.Container): void {
    this.scene = scene;
    this.container = container;
    
    // Draw zones
    this.drawZones();
    
    // Create hero sprite
    this.heroSprite = scene.add.graphics();
    container.add(this.heroSprite);
    
    this.heroLabel = scene.add.text(0, 0, 'Glimmer', {
      fontSize: '12px', color: '#fff', fontFamily: 'monospace',
      fontStyle: 'bold', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5);
    container.add(this.heroLabel);
    
    // Create thought bubble
    this.thoughtBubble = scene.add.text(0, 0, '', {
      fontSize: '10px', color: '#ffcc00', fontFamily: 'monospace',
      fontStyle: 'italic', stroke: '#000', strokeThickness: 1,
      wordWrap: { width: 120 },
    }).setOrigin(0.5);
    container.add(this.thoughtBubble);
  }
  
  // ═══════════════════════════════════════════════════════
  // ZONE RENDERING
  // ═══════════════════════════════════════════════════════
  
  private drawZones(): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    
    for (const zone of ALL_ZONES) {
      const pos = ZONE_POSITIONS[zone];
      const px = pos.x * width;
      const py = pos.y * height;
      
      // Zone background
      const gfx = this.scene.add.graphics();
      gfx.fillStyle(0x1a1a2e, 0.8);
      gfx.fillRoundedRect(px - 60, py - 30, 120, 60, 8);
      gfx.lineStyle(2, 0x333355);
      gfx.strokeRoundedRect(px - 60, py - 30, 120, 60, 8);
      this.container.add(gfx);
      this.zoneGraphics.set(zone, gfx);
      
      // Zone label
      const label = this.scene.add.text(px, py, this.getZoneLabel(zone), {
        fontSize: '12px', color: '#888', fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.container.add(label);
      this.zoneLabels.set(zone, label);
    }
  }
  
  private getZoneLabel(zone: ZoneId): string {
    const labels: Record<ZoneId, string> = {
      [ZoneId.Zone1]: 'START',
      [ZoneId.Zone2]: 'ZONE 2',
      [ZoneId.Zone3]: 'BOSS',
      [ZoneId.Zone4]: 'ZONE 4',
      [ZoneId.Zone5]: 'END',
    };
    return labels[zone] ?? zone;
  }
  
  // ═══════════════════════════════════════════════════════
  // SYNC
  // ═══════════════════════════════════════════════════════
  
  /** Sync all visuals from simulation state */
  sync(state: ArenaState, trapEvents: TrapTickEvent): void {
    this.syncHero(state);
    this.syncTrap(state);
  }
  
  private syncHero(state: ArenaState): void {
    const pos = ZONE_POSITIONS[state.hero.zone];
    const px = pos.x * this.scene.scale.width;
    const py = pos.y * this.scene.scale.height;
    
    // Hero sprite
    this.heroSprite.clear();
    
    // Hero color based on HP
    const hpRatio = state.hero.hp / state.hero.maxHp;
    let color = 0x00ff88; // Green
    if (hpRatio < 0.5) color = 0xffaa00; // Orange
    if (hpRatio < 0.25) color = 0xff4444; // Red
    
    // Draw hero circle
    this.heroSprite.fillStyle(color, 1);
    this.heroSprite.fillCircle(px, py - 20, 15);
    this.heroSprite.lineStyle(2, 0xffffff);
    this.heroSprite.strokeCircle(px, py - 20, 15);
    
    // Draw eyes
    this.heroSprite.fillStyle(0xffffff, 1);
    this.heroSprite.fillCircle(px - 5, py - 22, 3);
    this.heroSprite.fillCircle(px + 5, py - 22, 3);
    this.heroSprite.fillStyle(0x000000, 1);
    this.heroSprite.fillCircle(px - 4, py - 22, 1.5);
    this.heroSprite.fillCircle(px + 6, py - 22, 1.5);
    
    // Hero label
    this.heroLabel.setPosition(px, py + 10);
    this.heroLabel.setText(`♥ ${state.hero.hp}/${state.hero.maxHp}`);
    this.heroLabel.setColor(hpRatio < 0.5 ? '#ff4444' : '#00ff88');
    
    // Thought bubble
    this.thoughtBubble.setPosition(px, py - 50);
  }
  
  private syncTrap(state: ArenaState): void {
    // Remove old trap visuals
    if (this.trapGraphics) {
      this.trapGraphics.destroy();
      this.trapGraphics = null;
    }
    if (this.trapLabel) {
      this.trapLabel.destroy();
      this.trapLabel = null;
    }
    
    if (!state.trap) return;
    
    const pos = ZONE_POSITIONS[state.trap.zone];
    const px = pos.x * this.scene.scale.width;
    const py = pos.y * this.scene.scale.height;
    
    // Trap visual
    const gfx = this.scene.add.graphics();
    const config = TRAP_CONFIG[state.trap.type];
    const color = parseInt(config.color.replace('#', ''), 16);
    
    if (state.trap.fired) {
      // Active trap — glowing
      gfx.fillStyle(color, 0.8);
      gfx.fillCircle(px, py + 30, 20);
      gfx.lineStyle(3, color);
      gfx.strokeCircle(px, py + 30, 20);
      
      // Glow effect
      gfx.fillStyle(color, 0.3);
      gfx.fillCircle(px, py + 30, 30);
    } else {
      // Inactive trap — dim
      gfx.fillStyle(color, 0.3);
      gfx.fillCircle(px, py + 30, 15);
      gfx.lineStyle(2, color, 0.5);
      gfx.strokeCircle(px, py + 30, 15);
    }
    
    this.container.add(gfx);
    this.trapGraphics = gfx;
    
    // Trap label
    const label = this.scene.add.text(px, py + 55, state.trap.type.toUpperCase(), {
      fontSize: '10px', color: config.color, fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(label);
    this.trapLabel = label;
  }
  
  // ═══════════════════════════════════════════════════════
  // ZONE HIGHLIGHTS
  // ═══════════════════════════════════════════════════════
  
  /** Refresh zone highlights based on state */
  refreshZoneHighlights(state: ArenaState): void {
    for (const zone of ALL_ZONES) {
      const gfx = this.zoneGraphics.get(zone);
      const label = this.zoneLabels.get(zone);
      if (!gfx || !label) continue;
      
      const pos = ZONE_POSITIONS[zone];
      const px = pos.x * this.scene.scale.width;
      const py = pos.y * this.scene.scale.height;
      
      // Reset visuals
      gfx.clear();
      gfx.fillStyle(0x1a1a2e, 0.8);
      gfx.fillRoundedRect(px - 60, py - 30, 120, 60, 8);
      gfx.lineStyle(2, 0x333355);
      gfx.strokeRoundedRect(px - 60, py - 30, 120, 60, 8);
      
      label.setColor('#888');
      
      // Highlight trap zone
      if (state.trap && zone === state.trap.zone) {
        const config = TRAP_CONFIG[state.trap.type];
        const color = parseInt(config.color.replace('#', ''), 16);
        gfx.lineStyle(3, color);
        gfx.strokeRoundedRect(px - 60, py - 30, 120, 60, 8);
        label.setColor(config.color);
      }
      
      // Highlight hero zone
      if (zone === state.hero.zone) {
        gfx.lineStyle(3, 0x00ff88);
        gfx.strokeRoundedRect(px - 60, py - 30, 120, 60, 8);
      }
    }
  }
  
  /** Reset zone visuals */
  resetZoneVisuals(): void {
    this.refreshZoneHighlights({} as ArenaState);
  }
  
  // ═══════════════════════════════════════════════════════
  // HERO VISUALS
  // ═══════════════════════════════════════════════════════
  
  /** Update hero visuals based on kill count (shows evolution) */
  updateHeroVisuals(killCount: number): void {
    // Hero gets more "intense" looking as it dies more
    // This is handled in syncHero based on HP
  }
  
  // ═══════════════════════════════════════════════════════
  // THOUGHT BUBBLE
  // ═══════════════════════════════════════════════════════
  
  /** Set the thought bubble text */
  setThought(text: string): void {
    this.thoughtBubble.setText(text);
  }
  
  // ═══════════════════════════════════════════════════════
  // REVIEW HEATMAP
  // ═══════════════════════════════════════════════════════
  
  /** Show review heatmap overlay */
  showReviewHeatmap(heatmap: Map<ZoneId, number>): void {
    // Remove old heatmap
    if (this.heatmapGraphics) {
      this.heatmapGraphics.destroy();
      this.heatmapGraphics = null;
    }
    
    const gfx = this.scene.add.graphics();
    
    for (const [zone, intensity] of heatmap) {
      const pos = ZONE_POSITIONS[zone];
      const px = pos.x * this.scene.scale.width;
      const py = pos.y * this.scene.scale.height;
      
      // Draw heatmap overlay
      gfx.fillStyle(0xff0000, intensity * 0.5);
      gfx.fillCircle(px, py, 40);
    }
    
    this.container.add(gfx);
    this.heatmapGraphics = gfx;
  }
  
  /** Clear heatmap */
  clearHeatmap(): void {
    if (this.heatmapGraphics) {
      this.heatmapGraphics.destroy();
      this.heatmapGraphics = null;
    }
  }
}
