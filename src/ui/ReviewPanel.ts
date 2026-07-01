/**
 * DEADLOCK — Review Panel
 * 
 * DOM-based review panel — post-attempt analysis.
 */

import { ArenaState } from '../game/simulation/ArenaState';
import { GlimmerAI } from '../ai/GlimmerAI';
import { ZoneId, ALL_ZONES, HeroAbility, GAME_CONFIG } from '../game/simulation/Types';

/**
 * Review panel — shows what happened and what AI learned.
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
    const lastEmotionalResponse = null; // Placeholder
    
    this.el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <h2 style="color:${state.hero.won ? '#00ff88' : '#ff4444'};margin:0;font-size:14px;">
          ${state.hero.won ? '★ HERO WINS' : '☠ DEFEATED'}
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
      
      ${!state.hero.won && state.lastScoreBreakdown ? `
        <div style="background:rgba(255,102,0,0.1);border:1px solid #ff6600;border-radius:6px;padding:8px 10px;margin-bottom:10px;">
          <div style="color:#ff6600;font-weight:bold;font-size:13px;margin-bottom:4px;">SCORE: ${state.lastScoreBreakdown.total}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;font-size:9px;">
            <div><span style="color:#888;">Base</span> <span style="color:#fff;">${state.lastScoreBreakdown.base}</span></div>
            <div><span style="color:#888;">×Efficiency</span> <span style="color:#00ff88;">${state.lastScoreBreakdown.efficiency.toFixed(2)}</span></div>
            <div><span style="color:#888;">×Speed</span> <span style="color:#00d4ff;">${state.lastScoreBreakdown.speed.toFixed(2)}</span></div>
            <div><span style="color:#888;">×Streak</span> <span style="color:#ffcc00;">${state.lastScoreBreakdown.streak.toFixed(2)}</span></div>
            <div><span style="color:#888;">Activations</span> <span style="color:#fff;">${state.lastScoreBreakdown.activationsUsed}</span></div>
          </div>
          ${state.killStreak > 1 ? `<div style="color:#ffcc00;font-size:10px;margin-top:4px;">🔥 ${state.killStreak} kill streak!</div>` : ''}
        </div>
      ` : ''}
      
      ${!state.hero.won && state.totalKills > 0 ? `
        <div style="background:rgba(255,102,0,0.1);border:1px solid #ff6600;border-radius:6px;padding:8px 10px;margin-bottom:10px;">
          <div style="color:#ff6600;font-weight:bold;font-size:11px;margin-bottom:4px;">☠ KILL REWARD</div>
          <div style="font-size:10px;color:#ccc;line-height:1.6;">
            Kill #${state.totalKills} — Streak: ${state.killStreak}
            ${state.newlyUnlockedAbilities.length > 0 ? `
              <div style="color:#ffcc00;margin-top:4px;">
                🔓 UNLOCKED: ${state.newlyUnlockedAbilities.join(', ')}
              </div>
            ` : ''}
          </div>
        </div>
      ` : ''}
      
      ${state.aiAdaptations.length > 0 ? `
        <div style="background:rgba(0,212,255,0.1);border:1px solid #00d4ff;border-radius:6px;padding:8px 10px;margin-bottom:10px;">
          <div style="color:#00d4ff;font-weight:bold;font-size:11px;margin-bottom:4px;">🧠 GLIMMER ADAPTED</div>
          <div style="font-size:10px;color:#aaa;line-height:1.6;">
            ${state.aiAdaptations.map(a => `<div>▸ ${a}</div>`).join('')}
          </div>
        </div>
      ` : ''}
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
        <div style="background:#111;padding:8px;border-radius:4px;border:1px solid #333;">
          <div style="color:#888;font-size:9px;margin-bottom:2px;">TIME</div>
          <div style="color:#fff;font-size:14px;font-weight:bold;">${state.elapsedTime.toFixed(1)}s</div>
        </div>
        <div style="background:#111;padding:8px;border-radius:4px;border:1px solid #333;">
          <div style="color:#888;font-size:9px;margin-bottom:2px;">HP</div>
          <div style="color:#fff;font-size:14px;font-weight:bold;">${state.hero.hp} / ${state.hero.maxHp}</div>
        </div>
        <div style="background:#111;padding:8px;border-radius:4px;border:1px solid #333;">
          <div style="color:#888;font-size:9px;margin-bottom:2px;">KILLS</div>
          <div style="color:#ff4444;font-size:14px;font-weight:bold;">${state.totalKills}</div>
        </div>
        <div style="background:#111;padding:8px;border-radius:4px;border:1px solid #333;">
          <div style="color:#888;font-size:9px;margin-bottom:2px;">TOTAL SCORE</div>
          <div style="color:#ffcc00;font-size:14px;font-weight:bold;">${state.totalScore}</div>
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
          ${state.moveHistory.slice(-20).map(m => `<span style="color:${m.hp <= 1 ? '#ff4444' : '#888'};">[${m.time.toFixed(1)}s] ${m.zone} ♥${m.hp}</span><br>`).join('')}
          ${state.moveHistory.length === 0 ? '<div>No data</div>' : ''}
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
}
