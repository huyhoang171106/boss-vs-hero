/**
 * DEADLOCK — HUD
 * 
 * DOM-based HUD — controls, score, timer.
 */

import { GAME_CONFIG } from '../game/simulation/Types';
import type { ArenaState } from '../game/simulation/ArenaState';

/**
 * HUD — top bar with controls and status.
 */
export class HUD {
  private el: HTMLDivElement;
  private speedCallback!: (speed: number) => void;
  private pauseCallback!: () => void;
  private designCallback!: () => void;
  private retryCallback!: () => void;
  private muteCallback!: () => void;
  
  private state: ArenaState | null = null;
  private isPaused: boolean = false;
  private speed: number = 1;
  private isMuted: boolean = false;
  
  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.id = 'hud';
    this.el.style.cssText = `
      position: fixed; top: 0; left: 280px; right: 380px; height: 40px;
      background: rgba(10,10,30,0.9); border-bottom: 1px solid #333;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 16px; font-family: monospace; z-index: 100;
    `;
    container.appendChild(this.el);
  }
  
  setCallbacks(
    speed: (speed: number) => void,
    pause: () => void,
    design: () => void,
    retry: () => void,
    mute: () => void,
  ): void {
    this.speedCallback = speed;
    this.pauseCallback = pause;
    this.designCallback = design;
    this.retryCallback = retry;
    this.muteCallback = mute;
  }
  
  setState(state: ArenaState): void {
    this.state = state;
  }
  
  setPaused(paused: boolean): void {
    this.isPaused = paused;
  }
  
  setSpeed(speed: number): void {
    this.speed = speed;
  }
  
  setMuted(muted: boolean): void {
    this.isMuted = muted;
  }
  
  refresh(): void {
    if (!this.state) return;
    
    const state = this.state;
    
    this.el.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="color:#ff6600;font-weight:bold;font-size:12px;">DEADLOCK</div>
        <div style="color:#888;font-size:10px;">Attempt #${state.attemptNumber}</div>
        <div style="color:#ffcc00;font-size:10px;">Score: ${state.totalScore}</div>
        <div style="color:#ff4444;font-size:10px;">Kills: ${state.totalKills}</div>
      </div>
      
      <div style="display:flex;align-items:center;gap:8px;">
        <button id="hud-pause" style="
          background:${this.isPaused ? '#00ff88' : '#333'};
          border:none;color:${this.isPaused ? '#000' : '#fff'};
          padding:4px 8px;cursor:pointer;font-family:monospace;font-size:10px;
          border-radius:3px;
        ">${this.isPaused ? '▶ PLAY' : '⏸ PAUSE'}</button>
        
        <div style="display:flex;gap:4px;">
          ${[1, 2, 4, 8].map(s => `
            <button class="speed-btn" data-speed="${s}" style="
              background:${this.speed === s ? '#00d4ff' : '#333'};
              border:none;color:${this.speed === s ? '#000' : '#fff'};
              padding:4px 6px;cursor:pointer;font-family:monospace;font-size:9px;
              border-radius:3px;
            ">${s}x</button>
          `).join('')}
        </div>
        
        <button id="hud-design" style="
          background:#ff6600;border:none;color:#000;
          padding:4px 8px;cursor:pointer;font-family:monospace;font-size:10px;
          border-radius:3px;
        ">DESIGN</button>
        
        <button id="hud-retry" style="
          background:#333;border:1px solid #666;color:#fff;
          padding:4px 8px;cursor:pointer;font-family:monospace;font-size:10px;
          border-radius:3px;
        ">RETRY</button>
        
        <button id="hud-mute" style="
          background:#333;border:1px solid #666;color:${this.isMuted ? '#ff4444' : '#fff'};
          padding:4px 8px;cursor:pointer;font-family:monospace;font-size:10px;
          border-radius:3px;
        ">${this.isMuted ? '🔇' : '🔊'}</button>
      </div>
    `;
    
    // Event listeners
    this.el.querySelector('#hud-pause')?.addEventListener('click', () => this.pauseCallback());
    this.el.querySelector('#hud-design')?.addEventListener('click', () => this.designCallback());
    this.el.querySelector('#hud-retry')?.addEventListener('click', () => this.retryCallback());
    this.el.querySelector('#hud-mute')?.addEventListener('click', () => this.muteCallback());
    
    // Speed buttons
    this.el.querySelectorAll('.speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const speed = parseInt(btn.getAttribute('data-speed') ?? '1');
        this.speedCallback(speed);
      });
    });
  }
}
