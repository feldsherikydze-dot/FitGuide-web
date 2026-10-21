// FitGuide Web — плеер (общий для мини-бара и экрана музыки)

import { useEffect, useRef, useState, useCallback } from 'react';
import { getJSON, setJSON, KEYS } from './storage';

export interface PlayerTrack {
  id: string;
  title: string;
  artist: string;
  url?: string;
  artwork?: string;
  duration?: number;
}

export interface PlayerState {
  visible: boolean;
  playing: boolean;
  title: string;
  subtitle: string;
  track: PlayerTrack | null;
  queue: PlayerTrack[];
  index: number;
}

const IDLE: PlayerState = {
  visible: false,
  playing: false,
  title: 'Выберите трек или радио',
  subtitle: 'Сейчас играет',
  track: null,
  queue: [],
  index: -1,
};

let state: PlayerState = { ...IDLE };
const listeners = new Set<() => void>();

function commit(next: Partial<PlayerState>) {
  state = { ...state, ...next };
  listeners.forEach(fn => fn());
}

export function getPlayer(): PlayerState {
  return state;
}

export function subscribePlayer(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function playTrack(track: PlayerTrack, queue?: PlayerTrack[]) {
  const list = queue && queue.length ? queue : [track];
  const index = Math.max(0, list.findIndex(t => t.id === track.id));
  commit({
    visible: true,
    playing: true,
    track,
    queue: list,
    index,
    title: track.title,
    subtitle: track.artist,
  });
}

export function setQueue(queue: PlayerTrack[], startIndex = 0) {
  if (!queue.length) return;
  playTrack(queue[startIndex], queue);
}

export function togglePlay() {
  commit({ playing: !state.playing });
}

export function closePlayer() {
  commit({ visible: false, playing: false });
}

export function nextTrack() {
  if (!state.queue.length) return;
  const i = (state.index + 1) % state.queue.length;
  const t = state.queue[i];
  commit({ index: i, track: t, title: t.title, subtitle: t.artist, playing: true });
}

export function prevTrack() {
  if (!state.queue.length) return;
  const i = (state.index - 1 + state.queue.length) % state.queue.length;
  const t = state.queue[i];
  commit({ index: i, track: t, title: t.title, subtitle: t.artist, playing: true });
}

/** Хук для React-компонентов. */
export function usePlayer() {
  const [, force] = useState(0);
  useEffect(() => subscribePlayer(() => force(x => x + 1)), []);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Синхронизируем <audio> с состоянием плеера
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = 0.7;
    }
    const audio = audioRef.current;
    if (state.track?.url && audio.src !== state.track.url) {
      audio.src = state.track.url;
      audio.load();
    }
    if (state.playing) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [state.playing, state.track?.url]);

  return {
    visible: state.visible,
    playing: state.playing,
    title: state.title,
    subtitle: state.subtitle,
    track: state.track,
    queue: state.queue,
    index: state.index,
    toggle: togglePlay,
    next: nextTrack,
    prev: prevTrack,
    close: closePlayer,
  };
}
