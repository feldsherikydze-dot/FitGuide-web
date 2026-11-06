// FitGuide Web — любимые треки плеера (порт PlayerLikes.java)
//
// Один список на все источники: своя музыка, радио, онлайн. Ключ трека —
// source|id, поэтому лайк переживает перезагрузку и не зависит от позиции
// в списке. Формат хранения совместим по смыслу с player_likes_v1.

import { getJSON, setJSON } from './storage';
import type { PlayerTrack } from './player';

const KEY = 'player_likes_v1';

interface StoredLike {
  k: string;
  id: string;
  src: string;
  t: string;
  a: string;
  u?: string;
  g?: string;
  c?: string;
  art?: string;
  d?: number;
  live?: boolean;
  localKey?: string;
  ts: number;
}

let likes: StoredLike[] = load();
const listeners = new Set<() => void>();

function load(): StoredLike[] {
  try {
    const raw = getJSON<StoredLike[]>(KEY, []);
    return Array.isArray(raw) ? raw.filter(x => x && x.k && x.t) : [];
  } catch {
    return [];
  }
}

function save(next: StoredLike[]) {
  likes = next;
  setJSON(KEY, next);
  listeners.forEach(fn => fn());
}

export function subscribeLikes(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function likeKey(track: PlayerTrack): string {
  return `${track.source}|${track.id}`;
}

export function isLiked(track: PlayerTrack): boolean {
  const k = likeKey(track);
  return likes.some(x => x.k === k);
}

export function toggleLike(track: PlayerTrack): boolean {
  const k = likeKey(track);
  const exists = likes.some(x => x.k === k);
  if (exists) {
    save(likes.filter(x => x.k !== k));
    return false;
  }
  const item: StoredLike = {
    k,
    id: track.id,
    src: track.source,
    t: track.title,
    a: track.artist || '',
    u: track.url,
    g: track.genre,
    c: track.country,
    art: track.artwork,
    d: track.durationMs,
    live: track.live,
    localKey: track.localKey,
    ts: Date.now(),
  };
  save([item, ...likes]);
  return true;
}

export function likedTracks(): PlayerTrack[] {
  return likes.map(x => ({
    id: x.id,
    title: x.t,
    artist: x.a || '',
    url: x.u,
    artwork: x.art,
    durationMs: x.d,
    source: (x.src as PlayerTrack['source']) || 'online',
    genre: x.g,
    country: x.c,
    live: !!x.live,
    localKey: x.localKey,
  }));
}

export function getLikesCount(): number {
  return likes.length;
}
