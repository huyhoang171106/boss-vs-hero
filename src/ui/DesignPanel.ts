/**
 * DEADLOCK — Design Panel
 * 
 * DOM-based design panel for trap placement.
 */

import {
  ZoneId, TRAP_ZONES, TrapType, TRAP_CONFIG, GAME_CONFIG,
} from '../game/simulation/Types';
import type { ArenaState } from '../game/simulation/ArenaState';

/**
 * Design panel — trap placement interface.
 */
export class DesignPanel {
  private el: HTMLDivElement;
  private onPlaceTrap!: (zone: ZoneId, type: TrapType) => void;
  private onRemoveTrap!: () => void;
  private onStartAttempt!: () => void;
  private onRerollHand!: () => void;
  private state: ArenaState | null = null;
  
  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.id = 'design-panel';
    this.el.style.cssText = `
      position: fixed; top: 0; left: 0; bottom: 0; width: 280px;
      background: rgba(10,10,30,0.94); border-right: 1px solid #333;
      display: none; flex-direction: column; padding: 16px;
      font-family: monospace; color: #ccc; z-index: 100;
      overflow-y: auto; backdrop-filter: blur(4px);
    `;
    container.appendChild(this.el);
  }
  
  setCallbacks(
    onPlaceTrap: (zone: ZoneId, type: TrapType) => void,
    onRemoveTrap: () => void,
    onStartAttempt: () => void,
    onRerollHand: () => void,
  ): void {
    this.onPlaceTrap = onPlaceTrap;
    this.onRemoveTrap = onRemoveTrap;
    this.onStartAttempt = onStartAttempt;
    this.onRerollHand = onRerollHand;
  }
  
  show(state: ArenaState): void {
    this.state = state;
    this.el.style.display = 'flex';
    this.render();
  }
  
  hide(): void {
    this.el.style.display = 'none';
  }
  
  private render(): void {
    const state = this.state!;
    const hasTrap = state.trap !== null;
    const canStart = hasTrap && state.hero.alive && !state.hero.won;
    
    this.el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h2 style="color:#ff6600;margin:0;font-size:14px;">DESIGN PHASE</h2>
        <button id="dp-close" style="
          background:#333;border:1px solid #666;color:#fff;padding:4px 8px;
          cursor:pointer;font-family:monospace;font-size:11px;border-radius:3px;
        ">✕</button>
      </div>
      
      <div style="margin-bottom:12px;">
        <div style="color:#888;font-size:10px;margin-bottom:4px;">TRAP TYPE (1-4)</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
          ${Object.values(TrapType).map(type => `
            <button class="trap-type-btn" data-type="${type}" style="
              background:${state.selectedTrapType === type ? TRAP_CONFIG[type].color + '33' : '#111'};
              border:2px solid ${state.selectedTrapType === type ? TRAP_CONFIG[type].color : '#333'};
              color:${TRAP_CONFIG[type].color};
              padding:8px 6px;cursor:pointer;font-family:monospace;font-size:10px;
              border-radius:4px;text-align:center;
            ">
              <div style="font-size:14px;margin-bottom:2px;">
                ${type === 'fire' ? '🔥' : type === 'ice' ? '❄️' : type === 'spike' ? '⚡' : '🌀'}
              </div>
              <div>${type.toUpperCase()}</div>
              <div style="font-size:8px;color:#888;margin-top:2px;">${TRAP_CONFIG[type].damage} DMG</div>
            </button>
          `).join('')}
        </div>
      </div>
      
      <div style="margin-bottom:12px;">
        <div style="color:#888;font-size:10px;margin-bottom:4px;">PLACE TRAP ON ZONE</div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${TRAP_ZONES.map(zone => `
            <button class="zone-btn" data-zone="${zone}" style="
              background:${hasTrap && state.trap!.zone === zone ? '#ff660033' : '#111'};
              border:2px solid ${hasTrap && state.trap!.zone === zone ? '#ff6600' : '#333'};
              color:${hasTrap && state.trap!.zone === zone ? '#ff6600' : '#888'};
              padding:8px;cursor:pointer;font-family:monospace;font-size:11px;
              border-radius:4px;text-align:left;
            ">
              ${zone === 'zone2' ? 'Zone 2 (Left)' : 
                zone === 'zone3' ? 'Zone 3 (Boss)' : 
                zone === 'zone4' ? 'Zone 4 (Right)' : 
                'Zone 5 (End)'}
              ${hasTrap && state.trap!.zone === zone ? ' ✓ ACTIVE' : ''}
            </button>
          `).join('')}
        </div>
      </div>
      
      ${hasTrap ? `
        <div style="background:#111;padding:8px;border-radius:4px;border:1px solid #333;margin-bottom:12px;">
          <div style="color:${TRAP_CONFIG[state.trap!.type].color};font-weight:bold;font-size:11px;margin-bottom:4px;">
            ${state.trap!.type.toUpperCase()} TRAP
          </div>
          <div style="font-size:10px;color:#aaa;line-height:1.6;">
            <div>Damage: ${TRAP_CONFIG[state.trap!.type].damage} HP</div>
            <div>Cooldown: ${GAME_CONFIG.TRAP_COOLDOWN}s</div>
            <div>Counter: ${TRAP_CONFIG[state.trap!.type].heroCounter}</div>
          </div>
          <button id="dp-remove" style="
            margin-top:8px;background:#ff444433;border:1px solid #ff4444;color:#ff4444;
            padding:4px 8px;cursor:pointer;font-family:monospace;font-size:10px;
            border-radius:3px;width:100%;
          ">Remove Trap</button>
        </div>
      ` : ''}
      
      <div style="margin-top:auto;">
        <button id="dp-start" style="
          width:100%;background:${canStart ? '#00ff88' : '#333'};
          border:none;color:${canStart ? '#000' : '#666'};
          padding:12px;cursor:${canStart ? 'pointer' : 'default'};
          font-family:monospace;font-weight:bold;font-size:13px;
          border-radius:4px;
        ">${canStart ? '▶ START ATTEMPT' : 'Place a trap to start'}</button>
        
        <div style="text-align:center;margin-top:8px;font-size:9px;color:#666;">
          Press TAB to toggle • SPACE to activate trap
        </div>
      </div>
    `;
    
    // Event listeners
    this.el.querySelector('#dp-close')?.addEventListener('click', () => this.onRemoveTrap());
    this.el.querySelector('#dp-remove')?.addEventListener('click', () => this.onRemoveTrap());
    this.el.querySelector('#dp-start')?.addEventListener('click', () => {
      if (canStart) this.onStartAttempt();
    });
    
    // Trap type buttons
    this.el.querySelectorAll('.trap-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type') as TrapType;
        if (type) {
          state.selectedTrapType = type;
          this.render();
        }
      });
    });
    
    // Zone buttons
    this.el.querySelectorAll('.zone-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const zone = btn.getAttribute('data-zone') as ZoneId;
        if (zone) {
          this.onPlaceTrap(zone, state.selectedTrapType);
        }
      });
    });
  }
}
