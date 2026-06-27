import Phaser from 'phaser';
import { ArenaScene } from './render/scenes/ArenaScene';
import { DesignPanel, type PendingRuleDef } from './ui/DesignPanel';
import { ReviewPanel } from './ui/ReviewPanel';
import { HUD } from './ui/HUD';
import type { RuleCard } from './game/simulation/Types';
import { RuleType } from './game/simulation/Types';

/**
 * LOOPHOLE — Main entry point. Fullscreen layout.
 */
function boot(): void {
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = '';

  // Game container fills entire viewport
  const gameContainer = document.createElement('div');
  gameContainer.id = 'game-container';
  gameContainer.style.cssText = `
    position: fixed; inset: 0; width: 100vw; height: 100vh;
    overflow: hidden;
  `;
  app.appendChild(gameContainer);

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: vw,
    height: vh,
    parent: gameContainer,
    backgroundColor: '#1a1a2e',
    scene: [ArenaScene],
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  };

  const game = new Phaser.Game(config);

  game.events.once('ready', () => {
    const scene = game.scene.getScene('ArenaScene') as ArenaScene;

    const designPanel = new DesignPanel(gameContainer);
    const reviewPanel = new ReviewPanel(gameContainer);
    const hud = new HUD(gameContainer);

    let updateQueued = false;
    function updateUI(): void {
      updateQueued = false;
      const state = scene.getState();
      hud.setState(state);
      hud.setPaused(scene.getIsPaused());
      hud.setSpeed(scene.getSpeed());
      hud.refresh();

      if (scene.getIsDesignMode()) {
        designPanel.show(state);
        reviewPanel.hide();
      } else if (scene.getIsReviewMode()) {
        designPanel.hide();
        reviewPanel.show(state, scene.getAI());
      } else {
        designPanel.hide();
        reviewPanel.hide();
      }
    }

    function queueUpdate(): void {
      if (!updateQueued) {
        updateQueued = true;
        requestAnimationFrame(updateUI);
      }
    }

    designPanel.setCallbacks(
      (def: PendingRuleDef) => {
        const card: RuleCard = {
          id: `${def.type}-${def.zone}-${Date.now()}`,
          type: def.type,
          zone: def.zone,
          param: def.param,
          active: true,
        };
        scene.deployRule(card);
        queueUpdate();
      },
      (zone, type) => {
        scene.removeRule(zone, type);
        queueUpdate();
      },
      () => {
        if (scene.getState().attemptOver) {
          scene.beginNextAttemptInDesign();
        } else {
          scene.toggleDesignMode();
        }
        queueUpdate();
      },
    );

    reviewPanel.setCallbacks(
      () => {
        if (scene.getState().attemptOver) {
          scene.beginNextAttemptInDesign();
        } else {
          scene.toggleReviewMode();
        }
        queueUpdate();
      },
      () => {
        scene.beginNextAttemptInDesign();
        queueUpdate();
      },
    );

    hud.setCallbacks(
      (speed) => { scene.setSpeed(speed); hud.setSpeed(speed); hud.refresh(); },
      () => { scene.setPaused(!scene.getIsPaused()); hud.setPaused(scene.getIsPaused()); hud.refresh(); },
      () => {
        if (scene.getState().attemptOver) {
          scene.beginNextAttemptInDesign();
        } else {
          scene.toggleDesignMode();
        }
        queueUpdate();
      },
      () => { scene.beginNextAttemptInDesign(); queueUpdate(); },
      () => {
        const muted = !scene.getAudio().getMuted();
        scene.getAudio().setMuted(muted);
        hud.setMuted(muted);
        hud.refresh();
      },
    );

    scene.onStateChanged = () => queueUpdate();

    queueUpdate();
    console.log('LOOPHOLE — Write the rules. Watch them break.');
  });
}

const style = document.createElement('style');
style.textContent = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 100%; height: 100%; overflow: hidden;
    background: #0a0a1a;
  }
  #app { width: 100%; height: 100%; }

  .rule-card {
    animation: cardSlideIn 0.25s ease-out both;
  }
  .rule-card:nth-child(1) { animation-delay: 0.02s; }
  .rule-card:nth-child(2) { animation-delay: 0.06s; }
  .rule-card:nth-child(3) { animation-delay: 0.10s; }
  .rule-card:nth-child(4) { animation-delay: 0.14s; }
  .rule-card:nth-child(5) { animation-delay: 0.18s; }
  @keyframes cardSlideIn {
    from { opacity: 0; transform: translateY(-12px) scale(0.9); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .zone-slot {
    animation: zonePopIn 0.3s ease-out both;
    transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s !important;
  }
  .zone-slot:nth-child(1) { animation-delay: 0.08s; }
  .zone-slot:nth-child(2) { animation-delay: 0.12s; }
  .zone-slot:nth-child(3) { animation-delay: 0.16s; }
  @keyframes zonePopIn {
    from { opacity: 0; transform: scale(0.85); }
    to { opacity: 1; transform: scale(1); }
  }

  #design-panel, #review-panel {
    animation: panelFadeIn 0.2s ease-out;
  }
  @keyframes panelFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  #game-info {
    animation: infoSlideDown 0.3s ease-out;
  }
  @keyframes infoSlideDown {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .rule-card:hover { transform: scale(1.05); }
  .zone-slot:hover {
    border-color: #ff6600 !important;
    box-shadow: 0 0 8px rgba(255,102,0,0.3);
  }
  button { transition: opacity 0.15s, transform: 0.1s; }
  button:hover { opacity: 0.85; }
  button:active { transform: scale(0.95); }
`;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
