/**
 * public/js/audio.js
 * Simple Web Audio API synthesizer for UNO game sound effects.
 * Generates sounds programmatically to avoid external asset dependencies.
 */
class AudioManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.enabled = true;
        this.volume = 0.3;
    }

    init() {
        // Resume context on user interaction if suspended
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    /**
     * Play a synthesized sound effect
     * @param {string} type - 'hover', 'click', 'play', 'draw', 'turn', 'uno', 'win'
     */
    play(type) {
        if (!this.enabled) return;
        this.init();

        const handlers = {
            hover: () => this._beep(800, 0.05, 'sine', 0.05),
            click: () => this._beep(600, 0.1, 'triangle', 0.1),
            play: () => this._swoosh(600, 1200, 0.3),
            draw: () => this._swoosh(800, 400, 0.2),
            turn: () => this._chime(500, 0.5),
            uno: () => this._alert(400, 10),
            win: () => this._fanfare(),
            error: () => this._buzz()
        };

        if (handlers[type]) handlers[type]();
    }

    // ── Synthesizers ──────────────────────────────────────

    _beep(freq, duration, type = 'sine', vol = 1) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(this.volume * vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    _swoosh(startFreq, endFreq, duration) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        // White noise buffer would be better, but osc is cheaper/easier
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(50, this.ctx.currentTime);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + duration);

        gain.gain.setValueAtTime(this.volume * 0.5, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    _chime(baseFreq, duration) {
        const now = this.ctx.currentTime;
        [1, 1.5, 2].forEach((mult, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.frequency.value = baseFreq * mult;
            osc.type = 'sine';

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(this.volume * 0.3, now + 0.05 + (i * 0.05));
            gain.gain.exponentialRampToValueAtTime(0.01, now + duration + (i * 0.1));

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(now + duration + 1);
        });
    }

    _alert(freq, count) {
        const now = this.ctx.currentTime;
        for (let i = 0; i < count; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, now + i * 0.15);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + i * 0.15 + 0.1);

            gain.gain.setValueAtTime(this.volume * 0.5, now + i * 0.15);
            gain.gain.linearRampToValueAtTime(0, now + i * 0.15 + 0.1);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(now + i * 0.15 + 0.1);
        }
    }

    _buzz() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(50, this.ctx.currentTime + 0.3);

        gain.gain.setValueAtTime(this.volume * 0.5, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }

    _fanfare() {
        const now = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C Major
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;

            const start = now + i * 0.1;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(this.volume * 0.4, start + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, start + 2);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(start + 2);
        });
    }
}

const audioManager = new AudioManager();
window.audioManager = audioManager;
