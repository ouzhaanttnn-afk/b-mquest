/**
 * BIM QUEST — Procedural Web Audio & Haptic Engine
 * Zero external audio assets required. Generates crisp architectural UI/game sounds
 * using the browser's native AudioContext and triggers subtle mobile haptics.
 */

export type SoundEffectType =
  | 'click'
  | 'select'
  | 'snap'
  | 'build'
  | 'success'
  | 'error';

const MUTE_STORAGE_KEY = 'bimquest.soundMuted.v1';

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    try {
      sharedAudioCtx = new AudioCtx();
    } catch {
      return null;
    }
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {
      // Ignore autoplay restrictions
    });
  }
  return sharedAudioCtx;
}

export function isSoundMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setSoundMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? 'true' : 'false');
  } catch {
    // Ignore storage errors
  }
}

export function triggerHaptic(pattern: number | number[] = 10): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignore on unsupported devices
  }
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  type: OscillatorType = 'sine',
  peakGain = 0.08,
  endFreq?: number
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  if (endFreq && endFreq !== freq) {
    osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);
  }

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.01);
}

export function playSound(effect: SoundEffectType): void {
  if (isSoundMuted()) return;

  if (effect === 'select') {
    triggerHaptic(8);
  } else if (effect === 'snap' || effect === 'build') {
    triggerHaptic(15);
  } else if (effect === 'success') {
    triggerHaptic([18, 40, 30]);
  } else if (effect === 'error') {
    triggerHaptic([30, 50, 30]);
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  switch (effect) {
    case 'click': {
      playTone(ctx, 520, now, 0.045, 'triangle', 0.05, 640);
      break;
    }
    case 'select': {
      playTone(ctx, 440, now, 0.06, 'sine', 0.06, 587.33);
      break;
    }
    case 'snap': {
      // Crisp magnetic snap double-chime
      playTone(ctx, 587.33, now, 0.07, 'triangle', 0.075, 880);
      playTone(ctx, 880, now + 0.05, 0.11, 'sine', 0.08, 1174.66);
      break;
    }
    case 'build': {
      // Architectural block placement chord
      playTone(ctx, 261.63, now, 0.09, 'triangle', 0.08, 329.63);
      playTone(ctx, 523.25, now + 0.04, 0.14, 'sine', 0.08, 659.25);
      break;
    }
    case 'success': {
      // Uplifting major 7th architectural fanfare (C5 - E5 - G5 - B5 - C6)
      const notes = [523.25, 659.25, 783.99, 987.77, 1046.5];
      notes.forEach((n, idx) => {
        playTone(
          ctx,
          n,
          now + idx * 0.065,
          0.22,
          idx === notes.length - 1 ? 'triangle' : 'sine',
          0.085
        );
      });
      break;
    }
    case 'error': {
      // Gentle low warning interval
      playTone(ctx, 240, now, 0.12, 'sawtooth', 0.045, 200);
      playTone(ctx, 190, now + 0.1, 0.16, 'triangle', 0.05, 165);
      break;
    }
  }
}
