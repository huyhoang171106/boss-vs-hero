import { ArenaState } from '../game/simulation/ArenaState';
import { GAME_CONFIG } from '../game/simulation/Types';

/**
 * DOM-based HUD overlay.
 * Shows controls, speed, timer, HP, and game status.
 */
export class HUD {
  private el: HTMLDivElement;
  private infoEl: HTMLDivElement;
  private gameSpeed: number = 1;
  private isPaused: boolean = false;
  private isMuted: boolean = false;
  private onSpeedChange!: (speed: number) => void;
  private onPauseToggle!: () => void;
  private onToggleDesign!: () => void;
  private onNewAttempt!: () => void;
  private onToggleMute!: () => void;
  private state: ArenaState | null = null;

  constructor(container: HTMLElement) {
    // Main HUD bar at bottom
    this.el = document.createElement('div');
    this.el.id = 'game-hud';
    this.el.style.cssText = `
      position: absolute; bottom: 0; left: 0; right: 0;
      background: rgba(10,10,30,0.9); border-top: 1px solid #333;
      display: flex; align-items: center; gap: 6px;
      padding: 6px 12px; font-family: monospace; font-size: 11px;
      z-index: 100; user-select: none;
    `;
    container.appendChild(this.el);

    // Game info panel at top-left
    this.infoEl = document.createElement('div');
    this.infoEl.id = 'game-info';
    this.infoEl.style.cssText = `
      position: absolute; top: 8px; left: 8px;
      background: rgba(10,10,30,0.85); border: 1px solid #333; border-radius: 4px;
      padding: 6px 10px; font-family: monospace; font-size: 11px; color: #ccc;
      z-index: 100; pointer-events: none;
    `;
    container.appendChild(this.infoEl);
  }

  setCallbacks(
    onSpeedChange: (speed: number) => void,
    onPauseToggle: () => void,
    onToggleDesign: () => void,
    onNewAttempt: () => void,
    onToggleMute?: () => void,
  ): void {
    this.onSpeedChange = onSpeedChange;
    this.onPauseToggle = onPauseToggle;
    this.onToggleDesign = onToggleDesign;
    this.onNewAttempt = onNewAttempt;
    this.onToggleMute = onToggleMute ?? (() => {});
  }

  setState(state: ArenaState): void {
    this.state = state;
  }

  setSpeed(speed: number): void { this.gameSpeed = speed; }
  setPaused(paused: boolean): void { this.isPaused = paused; }
  setMuted(muted: boolean): void { this.isMuted = muted; }

  refresh(): void {
    this.render();
  }

  private render(): void {
    const state = this.state;
    const isOver = state?.attemptOver ?? false;
    const isAlive = state?.heroAlive ?? true;
    const heroHP = state?.heroHP ?? 0;
    const maxHP = GAME_CONFIG.HERO_MAX_HP;
    const elapsed = state?.elapsedTime ?? 0;
    const maxTime = GAME_CONFIG.ATTEMPT_DURATION;
    const remaining = Math.max(0, maxTime - elapsed);
    const attemptNum = (state?.attemptNumber ?? 0) + 1;

    let statusColor = '#888';
    let statusText = 'STANDING BY';
    if (isOver) {
      statusColor = state?.heroWon ? '#00d4ff' : '#ff4444';
      statusText = state?.heroWon ? '★ HERO VICTORY' : '☠ HERO DEFEATED';
    } else if (this.isPaused) {
      statusColor = '#ff6600';
      statusText = '⏸ PAUSED';
    } else {
      statusColor = '#00ff88';
      statusText = '▶ LIVE';
    }

    const deployCount = state?.pendingRules.length ?? 0;

    // Top info panel
    this.infoEl.innerHTML = `
      <div style="color:${statusColor};font-weight:bold;font-size:13px;">${statusText}</div>
      <div style="display:flex;gap:16px;margin-top:2px;">
        <span>Attempt <b style="color:#fff;">#${attemptNum}</b></span>
        <span>HP <b style="color:${heroHP <= 1 ? '#ff4444' : '#00ff88'};">${'█'.repeat(heroHP)}${'░'.repeat(maxHP - heroHP)}</b></span>
        <span>Time <b style="color:${remaining < 10 ? '#ff4444' : '#fff'};">${remaining.toFixed(0)}s</b></span>
        <span>Memory <b style="color:#888;">${state?.totalDeaths ?? 0} deaths</b></span>
      </div>
      <div style="font-size:9px;color:#666;margin-top:2px;">
        ${state ? state.unlockedAbilities.map(a => `<span style="color:#00d4ff;">◆${a}</span>`).join(' ') : ''}
        ${state && state.totalDeaths > 0 ? `<span style="color:#444;">| ${state.totalDeaths} deaths</span>` : ''}
      </div>
      ${deployCount > 0 ? `<div style="color:#ffcc00;font-size:10px;">⌛ Deploying ${deployCount} rule${deployCount > 1 ? 's' : ''}...</div>` : ''}
    `;

    // Bottom HUD bar
    this.el.innerHTML = `
      <span style="color:#666;">SPEED</span>
      ${[1, 2, 4, 8].map(s => `
        <button class="hud-speed" data-speed="${s}" style="
          background: ${this.gameSpeed === s ? '#533483' : '#1a1a2e'};
          border: 1px solid ${this.gameSpeed === s ? '#ff6600' : '#333'};
          color: ${this.gameSpeed === s ? '#fff' : '#888'};
          padding: 3px 8px; cursor: pointer; font-family: monospace; font-size: 11px;
          border-radius: 3px;
        ">${s}x</button>
      `).join('')}

      <div style="width:1px;height:20px;background:#333;margin:0 4px;"></div>

      <button id="hud-pause" style="
        background: ${this.isPaused ? '#ff6600' : '#1a1a2e'};
        border: 1px solid ${this.isPaused ? '#ff6600' : '#333'};
        color: ${this.isPaused ? '#fff' : '#888'};
        padding: 3px 10px; cursor: pointer; font-family: monospace; font-size: 11px;
        border-radius: 3px;
      ">${this.isPaused ? '▶ RESUME' : '⏸ PAUSE'}</button>

      <button id="hud-design" style="
        background: #1a1a2e; border: 1px solid #ff6600; color: #ff6600;
        padding: 3px 10px; cursor: pointer; font-family: monospace; font-size: 11px;
        border-radius: 3px;
      ">⚙ DESIGN</button>

      <button id="hud-mute" style="
        background: #1a1a2e; border: 1px solid #666; color: #888;
        padding: 3px 8px; cursor: pointer; font-family: monospace; font-size: 11px;
        border-radius: 3px;
      ">${this.isMuted ? '🔇' : '🔊'}</button>

      ${isOver ? `
        <button id="hud-retry" style="
          background: ${state?.heroWon ? '#ffcc00' : '#00d4ff'}; border: none; color: #000;
          padding: 3px 12px; cursor: pointer; font-family: monospace; font-size: 11px;
          border-radius: 3px; font-weight: bold;
        ">NEW RUN</button>
      ` : ''}
    `;

    // Wire events
    this.el.querySelectorAll('.hud-speed').forEach(btn => {
      btn.addEventListener('click', () => {
        const speed = parseInt(btn.getAttribute('data-speed') || '1');
        this.onSpeedChange?.(speed);
      });
    });

    this.el.querySelector('#hud-pause')?.addEventListener('click', () => this.onPauseToggle?.());
    this.el.querySelector('#hud-design')?.addEventListener('click', () => this.onToggleDesign?.());
    this.el.querySelector('#hud-mute')?.addEventListener('click', () => this.onToggleMute?.());
    this.el.querySelector('#hud-retry')?.addEventListener('click', () => this.onNewAttempt?.());
  }
}
