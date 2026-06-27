import { ArenaState } from '../game/simulation/ArenaState';
import { GlimmerAI } from '../ai/GlimmerAI';
import { ZoneId, PLAYABLE_ZONES } from '../game/simulation/Types';

/**
 * DOM-based review panel — right sidebar overlay.
 */
export class ReviewPanel {
  private el: HTMLDivElement;
  private onClose!: () => void;
  private onNewAttempt!: () => void;
  private state: ArenaState | null = null;

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.id = 'review-panel';
    this.el.style.cssText = `
      position: fixed; top: 0; right: 0; bottom: 0; width: 380px;
      background: rgba(10,10,30,0.94); border-left: 1px solid #333;
      display: none; flex-direction: column; padding: 16px;
      font-family: monospace; color: #ccc; z-index: 100;
      overflow-y: auto; backdrop-filter: blur(4px);
    `;
    container.appendChild(this.el);
  }

  setCallbacks(onClose: () => void, onNewAttempt: () => void): void {
    this.onClose = onClose;
    this.onNewAttempt = onNewAttempt;
  }

  show(state: ArenaState, ai: GlimmerAI): void {
    this.state = state;
    this.el.style.display = 'flex';
    this.render(ai);
  }

  hide(): void {
    this.el.style.display = 'none';
  }

  private render(ai: GlimmerAI): void {
    const state = this.state!;
    const thoughts = ai.getThoughts(state);
    const heatmap = ai.getMemoryHeatmap();

    this.el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <h2 style="color:${state.heroWon ? '#00ff88' : '#ff4444'};margin:0;font-size:14px;">
          ${state.heroWon ? '★ HERO WINS' : '☠ DEFEATED'}
        </h2>
        <div style="display:flex;gap:6px;">
          <button id="rv-retry" style="
            background:#00d4ff;border:none;color:#000;padding:5px 12px;
            cursor:pointer;font-family:monospace;font-weight:bold;font-size:11px;
            border-radius:3px;
          ">NEW ATTEMPT</button>
          <button id="rv-close" style="
            background:#333;border:1px solid #666;color:#fff;padding:5px 10px;
            cursor:pointer;font-family:monospace;font-size:11px;border-radius:3px;
          ">✕</button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
        <div style="background:#111;padding:8px;border-radius:4px;border:1px solid #333;">
          <div style="color:#888;font-size:9px;margin-bottom:2px;">TIME</div>
          <div style="color:#fff;font-size:14px;font-weight:bold;">${state.elapsedTime.toFixed(1)}s</div>
        </div>
        <div style="background:#111;padding:8px;border-radius:4px;border:1px solid #333;">
          <div style="color:#888;font-size:9px;margin-bottom:2px;">HP</div>
          <div style="color:#fff;font-size:14px;font-weight:bold;">${state.heroHP} / 3</div>
        </div>
        <div style="background:#111;padding:8px;border-radius:4px;border:1px solid #333;">
          <div style="color:#888;font-size:9px;margin-bottom:2px;">DEATHS</div>
          <div style="color:#ff4444;font-size:14px;font-weight:bold;">${state.totalDeaths}</div>
        </div>
        <div style="background:#111;padding:8px;border-radius:4px;border:1px solid #333;">
          <div style="color:#888;font-size:9px;margin-bottom:2px;">ZONES VISITED</div>
          <div style="color:#00d4ff;font-size:14px;font-weight:bold;">${new Set(state.moveHistory.map(m => m.zone)).size}</div>
        </div>
      </div>

      <div style="background:#111;padding:8px;border-radius:4px;border:1px solid #333;margin-bottom:8px;">
        <h3 style="color:#00d4ff;margin:0 0 4px;font-size:11px;">Glimmer's Thoughts</h3>
        <div style="font-size:10px;line-height:1.7;color:#aaa;">
          ${thoughts.map(t => `<div>▸ ${t}</div>`).join('')}
        </div>
      </div>

      <div style="background:#111;padding:8px;border-radius:4px;border:1px solid #333;margin-bottom:8px;">
        <h3 style="color:#ff4444;margin:0 0 4px;font-size:11px;">Zone Memory</h3>
        <div style="display:flex;gap:4px;flex-wrap:wrap;">
          ${Array.from(heatmap.entries()).map(([zone, intensity]) => `
            <div style="background:rgba(255,0,0,${intensity});border:1px solid ${intensity > 0 ? '#ff4444' : '#333'};padding:4px 6px;border-radius:3px;text-align:center;flex:1;min-width:60px;">
              <div style="font-size:9px;font-weight:bold;color:#ccc;">${zone}</div>
              <div style="font-size:8px;color:${intensity > 0.5 ? '#ff4444' : '#666'};">${intensity > 0 ? `${(intensity * 100).toFixed(0)}%` : '—'}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div style="background:#111;padding:8px;border-radius:4px;border:1px solid #333;margin-bottom:8px;">
        <h3 style="color:#888;margin:0 0 4px;font-size:11px;">Path (last 20)</h3>
        <div style="font-size:9px;line-height:1.5;color:#666;max-height:100px;overflow-y:auto;">
          ${state.moveHistory.slice(-20).map(m => `<span style="color:${m.hp <= 1 ? '#ff4444' : '#888'};">[${m.time.toFixed(1)}s] ${m.zone} ${m.action} ♥${m.hp}</span><br>`).join('')}
          ${state.moveHistory.length === 0 ? '<div>No data</div>' : ''}
        </div>
      </div>

      <div style="background:#111;padding:8px;border-radius:4px;border:1px solid #333;">
        <h3 style="color:#888;margin:0 0 4px;font-size:11px;">Arena Map</h3>
        <div style="font-size:10px;line-height:1.5;color:#666;">
          ${this.renderPathVisualization(state)}
        </div>
      </div>

      <div style="margin-top:8px;padding:6px;background:rgba(0,212,255,0.1);border-radius:3px;">
        <p style="margin:0;font-size:9px;color:#00d4ff;">
          Glimmer remembers every attempt. Past strategies inform future ones.
        </p>
      </div>
    `;

    this.el.querySelector('#rv-retry')?.addEventListener('click', () => this.onNewAttempt?.());
    this.el.querySelector('#rv-close')?.addEventListener('click', () => this.onClose?.());
  }

  private renderPathVisualization(state: ArenaState): string {
    const layout = [
      ['','','Boss','',''],
      ['','','Center','',''],
      ['LeftW','','','','RightW'],
      ['LeftP','Pit','','Pit','RightP'],
    ];
    const visited = new Set(state.moveHistory.map(m => m.zone));
    const lastZone = state.moveHistory.length > 0 ? state.moveHistory[state.moveHistory.length - 1].zone : null;

    return layout.map(row => {
      return row.map(cell => {
        if (!cell) return '<span style="color:#222;">——</span>';
        const isLast = cell === lastZone;
        if (isLast) return `<span style="color:#00d4ff;font-weight:bold;">◆${cell}</span>`;
        if (visited.has(cell as ZoneId)) return `<span style="color:#666;">◇${cell}</span>`;
        return `<span style="color:#333;">◇${cell}</span>`;
      }).join(' ') + '<br>';
    }).join('');
  }
}
