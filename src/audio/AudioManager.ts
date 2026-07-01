/**
 * DEADLOCK — Audio Manager
 * 
 * Procedural audio via Web Audio API.
 * No asset files needed.
 */

/**
 * Procedural audio manager.
 * Creates sounds from oscillators — no files needed.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  
  constructor() {
    // Lazy init — create context on first user interaction
    this.initContext();
  }
  
  private initContext(): void {
    if (this.ctx) return;
    
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      console.warn('Web Audio API not available');
    }
  }
  
  /** Ensure context is running (Chrome autoplay policy) */
  private ensureContext(): void {
    if (!this.ctx) this.initContext();
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
  }
  
  /** Toggle mute */
  getMuted(): boolean { return this.muted; }
  setMuted(muted: boolean): void { this.muted = muted; }
  
  // ═══════════════════════════════════════════════════════
  // SOUND EFFECTS
  // ═══════════════════════════════════════════════════════
  
  /** Play trap deployment sound */
  playDeploy(): void {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.ctx!.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, this.ctx!.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.3, this.ctx!.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(this.ctx!.destination);
    
    osc.start();
    osc.stop(this.ctx!.currentTime + 0.1);
  }
  
  /** Play damage sound */
  playDamage(): void {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, this.ctx!.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx!.currentTime + 0.2);
    
    gain.gain.setValueAtTime(0.3, this.ctx!.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + 0.2);
    
    osc.connect(gain);
    gain.connect(this.ctx!.destination);
    
    osc.start();
    osc.stop(this.ctx!.currentTime + 0.2);
  }
  
  /** Play death sound */
  playDeath(): void {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, this.ctx!.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.ctx!.currentTime + 0.5);
    
    gain.gain.setValueAtTime(0.4, this.ctx!.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + 0.5);
    
    osc.connect(gain);
    gain.connect(this.ctx!.destination);
    
    osc.start();
    osc.stop(this.ctx!.currentTime + 0.5);
  }
  
  /** Play victory sound */
  playVictory(): void {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    
    // Play ascending notes
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const duration = 0.15;
    
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx!.currentTime + i * duration);
      
      gain.gain.setValueAtTime(0.3, this.ctx!.currentTime + i * duration);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + (i + 1) * duration);
      
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      
      osc.start(this.ctx!.currentTime + i * duration);
      osc.stop(this.ctx!.currentTime + (i + 1) * duration);
    });
  }
  
  /** Play flame sound */
  playFlame(): void {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, this.ctx!.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, this.ctx!.currentTime + 0.3);
    
    gain.gain.setValueAtTime(0.2, this.ctx!.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + 0.3);
    
    osc.connect(gain);
    gain.connect(this.ctx!.destination);
    
    osc.start();
    osc.stop(this.ctx!.currentTime + 0.3);
  }
  
  /** Play spike sound */
  playSpike(): void {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(1000, this.ctx!.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, this.ctx!.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.3, this.ctx!.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(this.ctx!.destination);
    
    osc.start();
    osc.stop(this.ctx!.currentTime + 0.1);
  }
  
  /** Play orb sound */
  playOrb(): void {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, this.ctx!.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx!.currentTime + 0.2);
    
    gain.gain.setValueAtTime(0.2, this.ctx!.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + 0.2);
    
    osc.connect(gain);
    gain.connect(this.ctx!.destination);
    
    osc.start();
    osc.stop(this.ctx!.currentTime + 0.2);
  }
}
