// FitGuide Web — сигналы тренировки (порт WorkSignal.java).
//
// Пять профилей — те же WAV-файлы, что в Android (res/raw/sig_*.wav).
// Профиль и громкость хранятся под теми же именами, что в Android:
// work_signal_profile / work_signal_volume. Старые ключи веба читаются
// как fallback, чтобы уже сохранённый выбор не потерялся.

import { getString, setString } from './storage';

export type SignalProfileKey = 'default' | 'alarm' | 'gong' | 'soft' | 'mechanical';
export type SignalKind = 'setStart' | 'setTimeUp' | 'restOver';

export interface SignalProfile {
  key: SignalProfileKey;
  label: string;
  file: string;
  /** Сколько раз звучит сигнал «время вышло» — как timeUpRepeats в Android. */
  timeUpRepeats: number;
  /** Пауза между повторами, мс. */
  gapMs: number;
}

export const SIGNAL_PROFILES: SignalProfile[] = [
  { key: 'default', label: 'Гонг на ринге', file: 'sounds/sig_default.wav', timeUpRepeats: 2, gapMs: 700 },
  { key: 'alarm', label: 'Как будильник', file: 'sounds/sig_alarm.wav', timeUpRepeats: 1, gapMs: 0 },
  { key: 'gong', label: 'Паровозный гудок', file: 'sounds/sig_gong.wav', timeUpRepeats: 2, gapMs: 900 },
  { key: 'soft', label: 'Мягкий', file: 'sounds/sig_soft.wav', timeUpRepeats: 2, gapMs: 520 },
  { key: 'mechanical', label: 'Механический таймер', file: 'sounds/sig_mech.wav', timeUpRepeats: 2, gapMs: 380 },
];

const PROFILE_KEY = 'work_signal_profile';
const VOLUME_KEY = 'work_signal_volume';
const LEGACY_PROFILE_KEY = 'signal_profile';
const LEGACY_VOLUME_KEY = 'signal_volume';
const DEFAULT_VOLUME = 100;

export function getSignalProfile(): SignalProfile {
  const raw = getString(PROFILE_KEY, '') || getString(LEGACY_PROFILE_KEY, '');
  return SIGNAL_PROFILES.find(p => p.key === raw) ?? SIGNAL_PROFILES[0];
}

export function getSignalProfileKey(): SignalProfileKey {
  return getSignalProfile().key;
}

export function setSignalProfile(key: string): void {
  const profile = SIGNAL_PROFILES.find(p => p.key === key) ?? SIGNAL_PROFILES[0];
  setString(PROFILE_KEY, profile.key);
  try { localStorage.removeItem('fitguide_web_' + LEGACY_PROFILE_KEY); } catch { /* ignore */ }
}

export function getSignalVolume(): number {
  const raw = getString(VOLUME_KEY, '') || getString(LEGACY_VOLUME_KEY, '');
  const value = parseInt(raw, 10);
  if (!Number.isFinite(value)) return DEFAULT_VOLUME;
  return Math.max(0, Math.min(100, value));
}

export function setSignalVolume(value: number): void {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  setString(VOLUME_KEY, String(percent));
  try { localStorage.removeItem('fitguide_web_' + LEGACY_VOLUME_KEY); } catch { /* ignore */ }
}

// ------------------------------------------------------------------ звук

type AudioContextCtor = typeof AudioContext;

let ctx: AudioContext | null = null;
const buffers = new Map<SignalProfileKey, AudioBuffer>();
const loading = new Set<SignalProfileKey>();
let unlockInstalled = false;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function ensureContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = getAudioContextCtor();
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

function audioUrl(file: string): string {
  return `${import.meta.env.BASE_URL}${file}`;
}

async function loadBuffer(profile: SignalProfile): Promise<AudioBuffer | null> {
  const context = ensureContext();
  if (!context) return null;
  const cached = buffers.get(profile.key);
  if (cached) return cached;
  if (loading.has(profile.key)) return null;

  loading.add(profile.key);
  try {
    const response = await fetch(audioUrl(profile.file), { cache: 'force-cache' });
    if (!response.ok) throw new Error(String(response.status));
    const data = await response.arrayBuffer();
    const buffer = await context.decodeAudioData(data);
    buffers.set(profile.key, buffer);
    return buffer;
  } catch {
    return null;
  } finally {
    loading.delete(profile.key);
  }
}

/** Загрузить все сигналы заранее — как WorkSignal.warmUp в Android. */
export function warmUpSignals(): void {
  const context = ensureContext();
  if (!context) return;
  for (const profile of SIGNAL_PROFILES) void loadBuffer(profile);
}

function scheduleBuffer(
  context: AudioContext,
  buffer: AudioBuffer,
  volume: number,
  repeats: number,
  gapMs: number,
): void {
  const start = context.currentTime + 0.02;
  const step = buffer.duration + gapMs / 1000;
  for (let i = 0; i < repeats; i++) {
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(context.destination);
    source.start(start + i * step);
  }
}

/** Запасной путь для браузеров без Web Audio. */
function playFallback(profile: SignalProfile, volume: number): void {
  try {
    const audio = new Audio(audioUrl(profile.file));
    audio.volume = volume;
    void audio.play().catch(() => { /* автоплей заблокирован */ });
  } catch {
    /* звук не критичен */
  }
}

function playBuffer(profile: SignalProfile, volume: number, repeats: number, gapMs: number): void {
  const context = ensureContext();
  if (!context) {
    playFallback(profile, volume);
    return;
  }

  const start = (buffer: AudioBuffer | null) => {
    if (!buffer) {
      playFallback(profile, volume);
      return;
    }
    const run = () => scheduleBuffer(context, buffer, volume, repeats, gapMs);
    if (context.state === 'suspended') {
      void context.resume().then(run).catch(() => { /* останется тишина */ });
    } else {
      run();
    }
  };

  const cached = buffers.get(profile.key);
  if (cached) {
    start(cached);
  } else {
    void loadBuffer(profile).then(start);
  }
}

function vibrate(kind: SignalKind): void {
  const patterns: Record<SignalKind, number[]> = {
    setStart: [0, 120],
    setTimeUp: [0, 350, 140, 350, 140, 500],
    restOver: [0, 200, 120, 200],
  };
  try {
    navigator.vibrate?.(patterns[kind]);
  } catch {
    /* вибрация не критична */
  }
}

function play(profile: SignalProfile, volumePercent: number, kind: SignalKind, withVibration: boolean): void {
  if (withVibration) vibrate(kind);
  const volume = Math.max(0, Math.min(1, volumePercent / 100));
  if (volume <= 0) return; // ноль — только вибрация, как в Android
  const repeats = kind === 'setTimeUp' ? profile.timeUpRepeats : 1;
  const gapMs = kind === 'setTimeUp' ? profile.gapMs : 0;
  playBuffer(profile, volume, repeats, gapMs);
}

/** Сигнал тренировки: старт подхода, время вышло, отдых закончился. */
export function playSignal(kind: SignalKind): void {
  play(getSignalProfile(), getSignalVolume(), kind, true);
}

/** Предпрослушивание из настроек — без вибрации. */
export function previewSignal(): void {
  play(getSignalProfile(), getSignalVolume(), 'setStart', false);
}

/** Разбудить AudioContext после первого касания — иначе мобильный браузер молчит. */
export function unlockSignalAudio(): void {
  const context = ensureContext();
  if (!context) return;
  if (context.state === 'suspended') void context.resume().catch(() => { /* ignore */ });
  warmUpSignals();
}

/** Таймер: три коротких гудка, как ToneGenerator.TONE_PROP_BEEP в Android. */
export function playTimerBeep(): void {
  const context = ensureContext();
  if (!context) return;

  const run = () => {
    for (let i = 0; i < 3; i++) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'square';
      oscillator.frequency.value = 880;
      const at = context.currentTime + 0.02 + i * 0.55;
      gain.gain.setValueAtTime(0.25, at);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.4);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.45);
    }
  };

  if (context.state === 'suspended') {
    void context.resume().then(run).catch(() => { /* ignore */ });
  } else {
    run();
  }
}

function installSignalUnlock(): void {
  if (unlockInstalled || typeof document === 'undefined') return;
  unlockInstalled = true;
  const options: AddEventListenerOptions = { once: true, capture: true };
  document.addEventListener('pointerdown', unlockSignalAudio, options);
  document.addEventListener('touchstart', unlockSignalAudio, options);
  document.addEventListener('keydown', unlockSignalAudio, options);
}

installSignalUnlock();
