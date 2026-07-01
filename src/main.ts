/**
 * DEADLOCK — Main Entry Point
 * 
 * Fullscreen layout. One trap. Manual activation. AI mind games.
 */

import Phaser from 'phaser';
import { ArenaScene } from './render/scenes/ArenaScene';
import { DesignPanel } from './ui/DesignPanel';
import { ReviewPanel } from './ui/ReviewPanel';
import { HUD } from './ui/HUD';
import { TrapType, ZoneId } from './game/simulation/Types';

/**
 * DEADLOCK — Main entry point.
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
      (zone: ZoneId, type: TrapType) => {
        scene.placeTrap(zone, type);
        queueUpdate();
      },
      () => {
        scene.removeTrap();
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
      () => { queueUpdate(); },
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
      () => {
        scene.beginNextAttemptInDesign();
        queueUpdate();
      },
      () => {
        const muted = !scene.getAudio().getMuted();
        scene.getAudio().setMuted(muted);
        hud.setMuted(muted);
        hud.refresh();
      },
    );
    
    scene.onStateChanged = () => queueUpdate();
    
    queueUpdate();
    console.log('DEADLOCK — One trap. Manual activation. AI mind games.');
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
  
  .trap-type-btn {
    animation: cardSlideIn 0.25s ease-out both;
  }
  .trap-type-btn:nth-child(1) { animation-delay: 0.02s; }
  .trap-type-btn:nth-child(2) { animation-delay: 0.06s; }
  .trap-type-btn:nth-child(3) { animation-delay: 0.10s; }
  .trap-type-btn:nth-child(4) { animation-delay: 0.14s; }
  @keyframes cardSlideIn {
    from { opacity: 0; transform: translateY(-12px) scale(0.9); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  
  .zone-btn {
    animation: zonePopIn 0.3s ease-out both;
    transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s !important;
  }
  .zone-btn:nth-child(1) { animation-delay: 0.08s; }
  .zone-btn:nth-child(2) { animation-delay: 0.12s; }
  .zone-btn:nth-child(3) { animation-delay: 0.16s; }
  .zone-btn:nth-child(4) { animation-delay: 0.20s; }
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
  
  #hud {
    animation: infoSlideDown 0.3s ease-out;
  }
  @keyframes infoSlideDown {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .trap-type-btn:hover { transform: scale(1.05); }
  .zone-btn:hover {
    border-color: #ff6600 !important;
    box-shadow: 0 0 8px rgba(255,102,0,0.3);
  }
  button { transition: opacity 0.15s, transform 0.1s; }
  button:hover { opacity: 0.85; }
  button:active { transform: scale(0.95); }
  
  @keyframes killPop {
    0% { transform: scale(0.3); opacity: 0; }
    60% { transform: scale(1.1); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }
  @keyframes comboFlash {
    0% { opacity: 0; transform: translateX(-50%) scale(0.5); }
    15% { opacity: 1; transform: translateX(-50%) scale(1.2); }
    30% { transform: translateX(-50%) scale(1); }
    80% { opacity: 1; }
    100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
  }
`;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
