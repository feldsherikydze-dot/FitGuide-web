// FitGuide Web — единый плеер приложения (порт MediaService/PlayerService).
//
// Один <audio> на всё приложение: экран «Плеер» и мини-плеер на главном
// показывают одно и то же состояние. Очередь, повтор и перемешивание
// работают как в Android:
//   repeat 0 — выключен, 1 — повтор одного трека, 2 — повтор очереди;
//   shuffle — следующий/предыдущий выбирается случайно.
//
// Своя музыка лежит в IndexedDB; для неё url появляется только в момент
// воспроизведения (blob:), поэтому в localStorage сохраняется localKey.

import { useSyncExternalStore } from 'react';
import { getJSON, setJSON, getString, setString } from './storage';
import { getLocalBlob } from './musicLibrary';

export type PlayerSource = 'local' | 'radio' | 'online';

export interface PlayerTrack {
  id: string;
  title: string;
  artist: string;
  url?: string;
  artwork?: string;
  durationMs?: number;
  source: PlayerSource;
  genre?: string;
  country?: string;
  live?: boolean;
  /** Ключ файла в IndexedDB (для своей музыки). */
  localKey?: string;
}

export interface PlayerState {
  track: PlayerTrack | null;
  queue: PlayerTrack[];
  index: number;
  playing: boolean;
  loading: boolean;
  error: string | null;
  /** Секунды. */
  position: number;
  duration: number;
  shuffle: boolean;
  repeat: 0 | 1 | 2;
  volume: number;
}

const LAST_KEY = 'media_last_v1';
const VOLUME_KEY = 'player_volume';

const IDLE_TITLE = 'Выберите трек или радио';
const IDLE_SUB = 'Сейчас играет';

function restored(): PlayerState {
  const saved = getJSON<{
    track?: PlayerTrack | null;
    queue?: PlayerTrack[];
    index?: number;
    volume?: number;
  }>(LAST_KEY, {});
  const savedVolume = Number(getString(VOLUME_KEY, '0.8'));
  const volume = Number.isFinite(savedVolume) ? Math.min(1, Math.max(0, savedVolume)) : 0.8;
  const track = saved.track || null;
  return {
    track,
    queue: Array.isArray(saved.queue) ? saved.queue : [],
    index: typeof saved.index === 'number' ? saved.index : (track ? 0 : -1),
    playing: false,
    loading: false,
    error: null,
    position: 0,
    duration: track?.durationMs ? track.durationMs / 1000 : 0,
    shuffle: false,
    repeat: 0,
    volume,
  };
}

let state: PlayerState = restored();
const listeners = new Set<() => void>();

function commit(patch: Partial<PlayerState>) {
  state = { ...state, ...patch };
  listeners.forEach(fn => fn());
}

export function getPlayer(): PlayerState {
  return state;
}

export function subscribePlayer(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ------------------------------------------------------------------ audio

let audio: HTMLAudioElement | null = null;
let switching = false;
let loadToken = 0;
let currentResolvedUrl = '';
let liveRetries = 0;
const localUrls = new Map<string, string>();

// ---------------------------------------------------------------- эквалайзер (PlayerEqActivity)
//
// 5 полос 60/230/910/3.6k/14k Гц + бас и «громкость» (loudness). Web Audio
// подключается ТОЛЬКО к своей музыке: у потоков часто нет CORS-заголовков, и
// MediaElementSource сделал бы их тихими. При переходе на поток элемент
// пересоздаётся без графа — радио и онлайн играют напрямую, как раньше.

export interface EqState {
  on: boolean;
  bass: boolean;
  virt: boolean;
  loud: boolean;
  /** дБ по полосам, −15..+15. */
  bands: number[];
}

const EQ_KEY = 'player_eq_v1';
const EQ_FREQS = [60, 230, 910, 3600, 14000];

let eqState: EqState = (() => {
  const raw = getJSON<EqState | null>(EQ_KEY, null);
  if (raw && Array.isArray(raw.bands) && raw.bands.length === 5) {
    return {
      on: !!raw.on,
      bass: !!raw.bass,
      virt: !!raw.virt,
      // В Android выравнивание громкости включено по умолчанию.
      loud: raw.loud == null ? true : !!raw.loud,
      bands: raw.bands.map(v => Math.max(-15, Math.min(15, Number(v) || 0))),
    };
  }
  return { on: false, bass: false, virt: false, loud: true, bands: [0, 0, 0, 0, 0] };
})();

let eqCtx: AudioContext | null = null;
let eqFilters: BiquadFilterNode[] = [];
let eqBass: BiquadFilterNode | null = null;
let eqLoudDry: GainNode | null = null;
let eqLoudMakeup: GainNode | null = null;
let eqVirtGains: GainNode[] = [];
let eqAttached = false;

export function getEq(): EqState {
  return eqState;
}

/** Любой включённый эффект требует графа; все выключены — играем напрямую. */
function eqNeeded(): boolean {
  return eqState.on || eqState.bass || eqState.virt || eqState.loud;
}

function eqApply() {
  if (!eqCtx) return;
  const now = eqCtx.currentTime;
  eqFilters.forEach((f, i) => {
    f.gain.setTargetAtTime(eqState.on ? eqState.bands[i] : 0, now, 0.02);
  });
  eqBass?.gain.setTargetAtTime(eqState.bass ? 6 : 0, now, 0.02);
  // LoudnessEnhancer: сжатие + компенсирующий подъём; выключен — сухой путь.
  eqLoudDry?.gain.setTargetAtTime(eqState.loud ? 0 : 1, now, 0.02);
  eqLoudMakeup?.gain.setTargetAtTime(eqState.loud ? 1.4 : 0, now, 0.02);

  // Виртуализатор — расширение стереобазы (mid/side). Выключен — прямой путь.
  const [vLL, vRR, vLM, vRM, vLS, vRS, vWide, vInv] = eqVirtGains;
  if (vLL && vRR && vLM && vRM && vLS && vRS && vWide && vInv) {
    vLL.gain.setTargetAtTime(eqState.virt ? 0 : 1, now, 0.02);
    vRR.gain.setTargetAtTime(eqState.virt ? 0 : 1, now, 0.02);
    vLM.gain.setTargetAtTime(eqState.virt ? 0.5 : 0, now, 0.02);
    vRM.gain.setTargetAtTime(eqState.virt ? 0.5 : 0, now, 0.02);
    vLS.gain.setTargetAtTime(eqState.virt ? 0.5 : 0, now, 0.02);
    vRS.gain.setTargetAtTime(eqState.virt ? -0.5 : 0, now, 0.02);
    vWide.gain.setTargetAtTime(eqState.virt ? 0.35 : 0, now, 0.02);
    vInv.gain.value = -1;
  }
}

function attachEq(a: HTMLAudioElement) {
  if (eqAttached) {
    eqApply();
    void eqCtx?.resume().catch(() => {});
    return;
  }
  const Ctor = window.AudioContext
    || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  try {
    eqCtx = new Ctor();
    const ctx = eqCtx;
    const src = ctx.createMediaElementSource(a);

    eqFilters = EQ_FREQS.map(freq => {
      const f = ctx.createBiquadFilter();
      f.type = 'peaking';
      f.frequency.value = freq;
      f.Q.value = 1.1;
      f.gain.value = 0;
      return f;
    });

    eqBass = ctx.createBiquadFilter();
    eqBass.type = 'lowshelf';
    eqBass.frequency.value = 120;
    eqBass.gain.value = 0;

    // Громкость: сухой путь + сжатый с компенсацией.
    const loudIn = ctx.createGain();
    const loudOut = ctx.createGain();
    eqLoudDry = ctx.createGain();
    eqLoudMakeup = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -30;
    comp.knee.value = 20;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.25;

    // Стереобаза: mid/side с расширением.
    const split = ctx.createChannelSplitter(2);
    const merge = ctx.createChannelMerger(2);
    const vLL = ctx.createGain(); const vRR = ctx.createGain();
    const vLM = ctx.createGain(); const vRM = ctx.createGain();
    const vLS = ctx.createGain(); const vRS = ctx.createGain();
    const mid = ctx.createGain(); const side = ctx.createGain();
    const vWide = ctx.createGain(); const vInv = ctx.createGain();
    eqVirtGains = [vLL, vRR, vLM, vRM, vLS, vRS, vWide, vInv];

    // Цепочка: источник → полосы → бас → громкость → стерео → выход.
    let node: AudioNode = src;
    for (const f of eqFilters) { node.connect(f); node = f; }
    node.connect(eqBass);
    eqBass.connect(loudIn);

    loudIn.connect(eqLoudDry);
    eqLoudDry.connect(loudOut);
    loudIn.connect(comp);
    comp.connect(eqLoudMakeup);
    eqLoudMakeup.connect(loudOut);

    loudOut.connect(split);
    split.connect(vLL, 0); vLL.connect(merge, 0, 0);
    split.connect(vRR, 1); vRR.connect(merge, 0, 1);

    split.connect(vLM, 0); vLM.connect(mid);
    split.connect(vRM, 1); vRM.connect(mid);
    split.connect(vLS, 0); vLS.connect(side);
    split.connect(vRS, 1); vRS.connect(side);

    mid.connect(merge, 0, 0);
    mid.connect(merge, 0, 1);
    side.connect(vWide);
    vWide.connect(merge, 0, 0);
    vWide.connect(vInv);
    vInv.connect(merge, 0, 1);

    merge.connect(ctx.destination);

    eqAttached = true;
    eqApply();
    void ctx.resume().catch(() => {});
  } catch {
    eqCtx = null;
    eqAttached = false;
    eqFilters = [];
    eqBass = null;
    eqLoudDry = null;
    eqLoudMakeup = null;
    eqVirtGains = [];
  }
}

/** Убрать Web Audio: элемент пересоздаётся чистым (потоки без CORS играют напрямую). */
function detachEq() {
  if (!eqAttached) return;
  const old = audio;
  if (old) {
    try {
      old.pause();
      old.removeAttribute('src');
      old.load();
    } catch { /* ignore */ }
  }
  audio = null;
  try { void eqCtx?.close(); } catch { /* ignore */ }
  eqCtx = null;
  eqFilters = [];
  eqBass = null;
  eqLoudDry = null;
  eqLoudMakeup = null;
  eqVirtGains = [];
  eqAttached = false;
}

/** Изменить настройки эквалайзера и сразу применить. */
export function setEq(patch: Partial<EqState>) {
  eqState = { ...eqState, ...patch };
  setJSON(EQ_KEY, eqState);
  eqApply();
  const want = !!state.track?.localKey && eqNeeded();
  if (state.track?.localKey && want !== eqAttached && state.playing) {
    const pos = audio?.currentTime ?? 0;
    void loadCurrent(true).then(() => { if (pos > 0) seek(pos); });
  }
}

function persistLast() {
  const strip = (t: PlayerTrack): PlayerTrack => ({
    ...t,
    url: t.localKey ? undefined : t.url,
  });
  setJSON(LAST_KEY, {
    track: state.track ? strip(state.track) : null,
    queue: state.queue.map(strip),
    index: state.index,
    volume: state.volume,
  });
}

function syncMediaSession() {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    if (!state.track) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
      return;
    }
    const artwork = state.track.artwork
      ? [{ src: state.track.artwork, sizes: '512x512', type: 'image/jpeg' }]
      : [];
    navigator.mediaSession.metadata = new MediaMetadata({
      title: state.track.title,
      artist: state.track.artist || '',
      album: state.track.genre || 'FitGuide',
      artwork,
    });
    navigator.mediaSession.playbackState = state.playing ? 'playing' : 'paused';
  } catch {
    // Media Session не обязателен — молча пропускаем
  }
}

function ensureAudio(): HTMLAudioElement {
  if (audio) return audio;
  const a = new Audio();
  a.preload = 'metadata';
  a.volume = state.volume;
  audio = a;

  a.addEventListener('timeupdate', () => {
    if (!Number.isFinite(a.currentTime)) return;
    commit({ position: a.currentTime });
  });
  a.addEventListener('durationchange', () => {
    if (state.track?.live) return;
    if (Number.isFinite(a.duration) && a.duration > 0) commit({ duration: a.duration });
  });
  a.addEventListener('loadedmetadata', () => {
    if (state.track?.live) return;
    if (Number.isFinite(a.duration) && a.duration > 0) commit({ duration: a.duration });
    commit({ loading: false });
  });
  a.addEventListener('waiting', () => commit({ loading: true }));
  a.addEventListener('canplay', () => commit({ loading: false }));
  a.addEventListener('playing', () => {
    liveRetries = 0;
    commit({ playing: true, loading: false, error: null });
    syncMediaSession();
  });
  a.addEventListener('pause', () => {
    if (switching) return;
    commit({ playing: false });
    syncMediaSession();
  });
  a.addEventListener('ended', onEnded);
  a.addEventListener('error', onError);

  if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
    const setHandler = navigator.mediaSession.setActionHandler.bind(navigator.mediaSession) as
      (action: string, handler: (details?: { seekTime?: number }) => void) => void;
    const bind = (action: string, fn: (details?: { seekTime?: number }) => void) => {
      try { setHandler(action, fn); } catch { /* не поддерживается */ }
    };
    bind('play', () => togglePlay());
    bind('pause', () => togglePlay());
    bind('previoustrack', () => prevTrack());
    bind('nexttrack', () => nextTrack());
    bind('seekto', details => {
      if (typeof details?.seekTime === 'number') seek(details.seekTime);
    });
  }

  return a;
}

async function resolveUrl(track: PlayerTrack): Promise<string> {
  if (track.url) return track.url;
  if (!track.localKey) return '';
  const cached = localUrls.get(track.localKey);
  if (cached) return cached;
  const blob = await getLocalBlob(track.localKey);
  if (!blob) return '';
  const url = URL.createObjectURL(blob);
  localUrls.set(track.localKey, url);
  return url;
}

async function loadCurrent(autoplay: boolean) {
  const track = state.track;
  const token = ++loadToken;
  if (!track) return;

  commit({
    loading: true,
    error: null,
    position: 0,
    duration: track.durationMs ? track.durationMs / 1000 : 0,
    playing: autoplay,
  });

  let url = '';
  try {
    url = await resolveUrl(track);
  } catch {
    url = '';
  }
  if (token !== loadToken) return;
  if (!url) {
    commit({
      loading: false,
      playing: false,
      error: track.source === 'local'
        ? 'Файл не найден в хранилище браузера'
        : 'Не удалось воспроизвести',
    });
    return;
  }

  // Эквалайзер — только своя музыка (blob). У потоков нет CORS-заголовков:
  // MediaElementSource сделал бы их беззвучными, поэтому элемент пересоздаётся чистым.
  const wantEq = !!track.localKey && eqNeeded();
  if (!wantEq && eqAttached) detachEq();
  const a = ensureAudio();
  if (wantEq) attachEq(a);

  switching = true;
  try {
    a.pause();
    a.src = url;
    currentResolvedUrl = url;
    a.load();
    if (autoplay) {
      await a.play();
    }
  } catch (e) {
    if (token === loadToken) {
      const name = (e as DOMException)?.name;
      commit({
        playing: false,
        loading: false,
        // NotAllowedError — браузер не дал автозапуск без жеста; это не ошибка трека.
        error: name === 'NotAllowedError' ? null : 'Не удалось воспроизвести. Проверьте интернет.',
      });
    }
  } finally {
    if (token === loadToken) switching = false;
  }
}

function onEnded() {
  const track = state.track;
  if (!track) return;

  if (state.repeat === 1) {
    seek(0);
    void play();
    return;
  }
  if (track.live) {
    void loadCurrent(true);
    return;
  }
  if (state.queue.length > 1) {
    if (state.repeat === 0 && !state.shuffle && state.index >= state.queue.length - 1) {
      stopAll();
      return;
    }
    advance(true);
    return;
  }
  if (state.repeat === 0) {
    stopAll();
    return;
  }
  seek(0);
  void play();
}

function onError() {
  if (!audio || !audio.src) return;
  if (state.track?.live && liveRetries < 2) {
    liveRetries++;
    window.setTimeout(() => { void loadCurrent(true); }, 1200);
    return;
  }
  commit({
    playing: false,
    loading: false,
    error: 'Не удалось воспроизвести. Проверьте интернет.',
  });
}

async function play() {
  const a = ensureAudio();
  try {
    await a.play();
    commit({ playing: true });
  } catch (e) {
    const name = (e as DOMException)?.name;
    if (name !== 'NotAllowedError') {
      commit({ playing: false, error: 'Не удалось воспроизвести' });
    }
  }
}

// ------------------------------------------------------------------ API

export function playQueue(queue: PlayerTrack[], startIndex = 0) {
  if (!queue.length) return;
  const i = Math.min(Math.max(0, startIndex), queue.length - 1);
  const track = queue[i];
  liveRetries = 0;
  commit({
    track,
    queue: [...queue],
    index: i,
    playing: true,
    error: null,
    position: 0,
    duration: track.durationMs ? track.durationMs / 1000 : 0,
  });
  persistLast();
  syncMediaSession();
  void loadCurrent(true);
}

export function playTrack(track: PlayerTrack, queue?: PlayerTrack[]) {
  const list = queue && queue.length ? queue : [track];
  const i = Math.max(0, list.findIndex(t => t.id === track.id));
  playQueue(list, i < 0 ? 0 : i);
}

/** Совместимость со старым API. */
export function setQueue(queue: PlayerTrack[], startIndex = 0) {
  playQueue(queue, startIndex);
}

export function togglePlay() {
  if (!state.track) return;
  if (state.playing) {
    ensureAudio().pause();
    commit({ playing: false });
    syncMediaSession();
    return;
  }
  if (audio && currentResolvedUrl && audio.src) {
    void play();
  } else {
    void loadCurrent(true);
  }
  syncMediaSession();
}

function advance(auto: boolean) {
  if (!state.queue.length) return;
  if (state.queue.length === 1) {
    seek(0);
    void play();
    return;
  }
  let next = state.index;
  if (state.shuffle) {
    for (let k = 0; k < 8 && next === state.index; k++) {
      next = Math.floor(Math.random() * state.queue.length);
    }
  } else {
    next = (state.index + 1) % state.queue.length;
  }
  if (auto && state.repeat === 0 && !state.shuffle && next === 0 && state.index === state.queue.length - 1) {
    stopAll();
    return;
  }
  const track = state.queue[next];
  liveRetries = 0;
  commit({
    track,
    index: next,
    playing: true,
    position: 0,
    duration: track.durationMs ? track.durationMs / 1000 : 0,
    error: null,
  });
  persistLast();
  syncMediaSession();
  void loadCurrent(true);
}

export function nextTrack() {
  advance(false);
}

export function prevTrack() {
  if (!state.queue.length) return;
  if (state.queue.length === 1) {
    seek(0);
    void play();
    return;
  }
  let prev = state.index;
  if (state.shuffle) {
    for (let k = 0; k < 8 && prev === state.index; k++) {
      prev = Math.floor(Math.random() * state.queue.length);
    }
  } else {
    prev = (state.index - 1 + state.queue.length) % state.queue.length;
  }
  const track = state.queue[prev];
  liveRetries = 0;
  commit({
    track,
    index: prev,
    playing: true,
    position: 0,
    duration: track.durationMs ? track.durationMs / 1000 : 0,
    error: null,
  });
  persistLast();
  syncMediaSession();
  void loadCurrent(true);
}

export function seek(seconds: number) {
  if (!audio || state.track?.live) return;
  if (!Number.isFinite(seconds)) return;
  const max = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : seconds;
  const pos = Math.min(Math.max(0, seconds), max);
  try { audio.currentTime = pos; } catch { /* ещё не готов */ }
  commit({ position: pos });
}

export function setVolume(v: number) {
  const volume = Math.min(1, Math.max(0, v));
  setString(VOLUME_KEY, String(volume));
  if (audio) audio.volume = volume;
  commit({ volume });
  persistLast();
}

export function toggleShuffle() {
  commit({ shuffle: !state.shuffle });
}

export function cycleRepeat() {
  commit({ repeat: ((state.repeat + 1) % 3) as 0 | 1 | 2 });
}

/** Полная остановка: мини-плеер снова показывает «Выберите трек или радио». */
export function stopAll() {
  loadToken++;
  switching = false;
  const a = audio;
  if (a) {
    try {
      a.pause();
      a.removeAttribute('src');
      a.load();
    } catch { /* ignore */ }
  }
  currentResolvedUrl = '';
  liveRetries = 0;
  commit({
    track: null,
    queue: [],
    index: -1,
    playing: false,
    loading: false,
    error: null,
    position: 0,
    duration: 0,
  });
  setJSON(LAST_KEY, { track: null, queue: [], index: -1, volume: state.volume });
  syncMediaSession();
}

export const closePlayer = stopAll;

/** Забыть blob-URL удалённого локального трека. */
export function forgetLocalTrack(localKey: string) {
  const url = localUrls.get(localKey);
  if (url) {
    URL.revokeObjectURL(url);
    localUrls.delete(localKey);
  }
  if (state.track?.localKey === localKey) stopAll();
}

export function usePlayer() {
  const s = useSyncExternalStore(subscribePlayer, getPlayer, getPlayer);
  return {
    ...s,
    title: s.track?.title || IDLE_TITLE,
    subtitle: s.track?.artist || IDLE_SUB,
    toggle: togglePlay,
    next: nextTrack,
    prev: prevTrack,
    close: stopAll,
  };
}
