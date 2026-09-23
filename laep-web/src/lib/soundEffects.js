/**
 * soundEffects.js — Procedural Zero-Dependency Aerospace Web Audio Synthesizer.
 * Synthesizes crisp telemetry blips, radar sweeps, and route lock confirmation chimes
 * in pure code via the native Web Audio API (0 KB network download overhead).
 *
 * Includes automatic first-gesture AudioContext unlock to eliminate audio lag and dropped clicks.
 */

class AerospaceAudioEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = typeof window !== 'undefined' ? localStorage.getItem('laep_audio_muted') === 'true' : false;
    this.isUnlocked = false;
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
  }

  unlock() {
    this.init();
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().then(() => {
          this.isUnlocked = true;
        }).catch(() => {});
      } else {
        this.isUnlocked = true;
      }
    }
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('laep_audio_muted', String(muted));
    }
  }

  toggleMuted() {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  ensureRunning(cb) {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => {
        if (!this.isMuted && this.ctx && this.ctx.state === 'running') {
          cb();
        }
      }).catch(() => {});
    } else if (this.ctx.state === 'running') {
      cb();
    }
  }

  // ── 1. Telemetry Click (Crisp 1.8kHz blip) ─────────────────────────
  playTelemetryClick() {
    this.ensureRunning(() => {
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(2000, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.018);

        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.022);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.022);
      } catch {
        // Ignore
      }
    });
  }

  // ── 2. Radar Sweep Ping (880Hz spatial resonant chirp) ─────────────
  playRadarSweep() {
    this.ensureRunning(() => {
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(920, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.16);

        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.2);
      } catch {
        // Ignore
      }
    });
  }

  // ── 3. Route Lock Confirmation (Dual-tone 520Hz + 1040Hz chime) ─────
  playRouteLock() {
    this.ensureRunning(() => {
      try {
        const now = this.ctx.currentTime;

        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(523.25, now); // C5
        osc1.frequency.setValueAtTime(659.25, now + 0.08); // E5

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1046.5, now); // C6
        osc2.frequency.setValueAtTime(1318.5, now + 0.08); // E6

        gain.gain.setValueAtTime(0.065, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.38);
        osc2.stop(now + 0.38);
      } catch {
        // Ignore
      }
    });
  }

  // ── 4. Target Acquisition Chord (Pentatonic Triad) ─────────────────
  playTargetAcquired() {
    this.ensureRunning(() => {
      try {
        const now = this.ctx.currentTime;
        const freqs = [440, 554.37, 659.25]; // A4, C#5, E5

        freqs.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.035);

          gain.gain.setValueAtTime(0.045, now + idx * 0.035);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.035 + 0.3);

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(now + idx * 0.035);
          osc.stop(now + idx * 0.035 + 0.3);
        });
      } catch {
        // Ignore
      }
    });
  }

  // ── 5. Warning / Slope Limit Beep ─────────────────────────────────
  playWarningBeep() {
    this.ensureRunning(() => {
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(360, now);
        osc.frequency.setValueAtTime(280, now + 0.08);

        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.18);
      } catch {
        // Ignore
      }
    });
  }
}

export const soundEngine = new AerospaceAudioEngine();

// Global first-gesture listener to immediately warm up and unlock Web Audio context
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    soundEngine.unlock();
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };
  window.addEventListener('pointerdown', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
}
