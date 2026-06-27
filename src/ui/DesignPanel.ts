import { RuleType, ZoneId, PLATFORM_ZONES } from '../game/simulation/Types';
import { ArenaState } from '../game/simulation/ArenaState';

export interface PendingRuleDef {
  type: RuleType;
  zone: ZoneId;
  param: number;
}

/**
 * DOM-based design panel — left sidebar overlay.
 */
export class DesignPanel {
  private el: HTMLDivElement;
  private onDeploy!: (def: PendingRuleDef) => void;
  private onRemove!: (zone: ZoneId, type: RuleType) => void;
  private onClose!: () => void;
  private selectedType: RuleType | null = null;
  private state: ArenaState | null = null;

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.id = 'design-panel';
    this.el.style.cssText = `
      position: fixed; top: 0; left: 0; bottom: 0; width: 360px;
      background: rgba(10,10,30,0.94); border-right: 1px solid #333;
      display: none; flex-direction: column; padding: 16px;
      font-family: monospace; color: #ccc; z-index: 100;
      overflow-y: auto; backdrop-filter: blur(4px);
    `;
    container.appendChild(this.el);
  }

  setCallbacks(
    onDeploy: (def: PendingRuleDef) => void,
    onRemove: (zone: ZoneId, type: RuleType) => void,
    onClose: () => void,
  ): void {
    this.onDeploy = onDeploy;
    this.onRemove = onRemove;
    this.onClose = onClose;
  }

  show(state: ArenaState): void {
    this.state = state;
    this.el.style.display = 'flex';
    this.render();
  }

  hide(): void {
    this.el.style.display = 'none';
  }

  setState(state: ArenaState): void {
    this.state = state;
  }

  private render(): void {
    const state = this.state;
    const isFirstTime = state && state.attemptNumber === 0 && state.totalDeaths === 0;

    this.el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <h2 style="color:#ff6600;margin:0;font-size:16px;">⚙ DESIGN</h2>
        <button id="dp-close" style="
          background:#333;border:1px solid #666;color:#fff;padding:4px 12px;
          cursor:pointer;font-family:monospace;border-radius:4px;font-size:11px;
        ">✕ CLOSE</button>
      </div>

      ${isFirstTime ? `
        <div style="background:rgba(0,212,255,0.1);border:1px solid #00d4ff;border-radius:6px;padding:8px 12px;margin-bottom:10px;">
          <div style="color:#00d4ff;font-weight:bold;font-size:12px;margin-bottom:3px;">Welcome to LOOPHOLE</div>
          <div style="color:#aaa;font-size:10px;line-height:1.5;">
            <b>YOU are the BOSS.</b> Place Rule Cards to create hazards.<br>
            Glimmer (AI hero) will try to survive.<br><br>
            1. Click a <b style="color:#ff6600;">Rule Card</b><br>
            2. Click a <b style="color:#ff6600;">Zone</b> to place<br>
            3. Click <b style="color:#00d4ff;">▶ LAUNCH</b> to start<br><br>
            <b style="color:#ff6600;">Tip:</b> Combine rules for synergies!
          </div>
        </div>
      ` : state && state.totalDeaths > 0 ? `
        <div style="background:rgba(255,68,68,0.08);border:1px solid #ff4444;border-radius:6px;padding:6px 10px;margin-bottom:8px;font-size:10px;line-height:1.4;">
          Deaths: <b>${state.totalDeaths}</b> |
          ${state.heroCanDash ? '<span style="color:#00d4ff;">Dash</span>' : '<span style="color:#555;">Dash(2)</span>'}
          ${state.heroCanShield ? ' <span style="color:#00ff88;">Shield</span>' : ' <span style="color:#555;">Shield(5)</span>'}
          ${state.heroCanDoubleJump ? ' <span style="color:#ffcc00;">Jump</span>' : ' <span style="color:#555;">Jump(10)</span>'}
        </div>
      ` : ''}

      <h3 style="color:#aaa;margin:0 0 6px;font-size:11px;">RULES</h3>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
        ${this.renderRuleCard(RuleType.FlameVent, 'Flame Vent', 'Periodic fire', '#ff6600')}
        ${this.renderRuleCard(RuleType.SpikeWall, 'Spike Wall', 'Rises on pass', '#888')}
        ${this.renderRuleCard(RuleType.SentryOrb, 'Sentry Orb', 'Fires at hero', '#ff00ff')}
        ${this.renderRuleCard(RuleType.GravityWell, 'Gravity Well', 'Pulls hero', '#aa44ff')}
        ${this.renderRuleCard(RuleType.TemporalRift, 'Temporal Rift', 'Steals time', '#4488ff')}
      </div>

      <h3 style="color:#aaa;margin:0 0 6px;font-size:11px;">ZONES</h3>
      <div id="dp-zones" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
        ${PLATFORM_ZONES.map(z => this.renderZone(z)).join('')}
      </div>

      <div style="padding:6px;background:#111;border:1px solid #333;border-radius:4px;margin-bottom:10px;">
        <p style="margin:0;color:#888;font-size:10px;">
          ${this.selectedType
            ? `Selected: <b style="color:#ff6600">${this.ruleTypeName(this.selectedType)}</b> → click zone`
            : 'Click rule → click zone to place'}
        </p>
      </div>

      <button id="dp-start" style="
        background:#00d4ff;border:none;color:#000;padding:10px 0;
        cursor:pointer;font-family:monospace;font-weight:bold;font-size:13px;
        border-radius:4px;width:100%;
      ">▶ LAUNCH ATTEMPT</button>
    `;

    this.el.querySelector('#dp-start')?.addEventListener('click', () => this.onClose?.());
    this.el.querySelector('#dp-close')?.addEventListener('click', () => this.onClose?.());

    this.el.querySelectorAll('.rule-card').forEach(card => {
      card.addEventListener('click', () => {
        this.selectedType = card.getAttribute('data-type') as RuleType;
        this.render();
      });
    });

    this.el.querySelectorAll('.zone-slot').forEach(slot => {
      slot.addEventListener('click', () => {
        const zone = slot.getAttribute('data-zone') as ZoneId;
        if (this.selectedType && state) {
          const existing = state.getRulesInZone(zone).find(r => r.card.type === this.selectedType);
          if (existing) {
            this.onRemove(zone, this.selectedType);
          } else {
            this.onDeploy({ type: this.selectedType, zone, param: 5 });
          }
          this.selectedType = null;
          this.render();
        }
      });
    });
  }

  private renderRuleCard(type: RuleType, name: string, desc: string, color: string): string {
    const isSelected = this.selectedType === type;
    return `
      <div class="rule-card" data-type="${type}" style="
        background: ${isSelected ? color + '33' : '#1a1a2e'};
        border: 1px solid ${isSelected ? color : '#333'};
        border-radius: 4px; padding: 6px 8px; cursor: pointer;
        min-width: 90px; text-align: center;
      ">
        <div style="color:${color};font-weight:bold;font-size:11px;">${name}</div>
        <div style="color:#666;font-size:9px;">${desc}</div>
      </div>
    `;
  }

  private renderZone(zone: ZoneId): string {
    const hasRule = this.state?.getRulesInZone(zone).length ?? 0;
    return `
      <div class="zone-slot" data-zone="${zone}" style="
        background: ${hasRule ? 'rgba(255,102,0,0.1)' : '#1a1a2e'};
        border: 1px solid ${hasRule ? '#ff6600' : '#333'};
        border-radius: 4px; padding: 6px 10px; cursor: pointer;
        font-size: 10px; color: ${hasRule ? '#ff6600' : '#888'};
      ">
        ${zone}${hasRule ? ' ✓' : ''}
      </div>
    `;
  }

  private ruleTypeName(type: RuleType): string {
    const names: Record<string, string> = {
      [RuleType.FlameVent]: 'Flame Vent',
      [RuleType.SpikeWall]: 'Spike Wall',
      [RuleType.SentryOrb]: 'Sentry Orb',
      [RuleType.GravityWell]: 'Gravity Well',
      [RuleType.TemporalRift]: 'Temporal Rift',
    };
    return names[type] || type;
  }
}
