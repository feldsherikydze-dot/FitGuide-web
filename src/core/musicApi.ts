// FitGuide Web — источники музыки: радио и онлайн-треки.
//
// Радио: RadioBrowser (открытый каталог, без ключей). Онлайн: Audius
// (полные треки, без ключа), запасной каталог — Internet Archive; если
// ничего не нашлось, последний резерв — 30-секундные превью iTunes
// (в Android для них есть бейдж «30с»).
//
// Все запросы идут с таймаутом: мёртвый хост не должен держать вкладку.

import type { PlayerTrack } from './player';

const APP = 'FitGuide';

const AUDIUS_HOSTS = [
  'https://api.audius.co',
  'https://discoveryprovider.audius.co',
  'https://discoveryprovider2.audius.co',
  'https://discoveryprovider3.audius.co',
];

const RB_HOSTS = [
  'https://de1.api.radio-browser.info',
  'https://de2.api.radio-browser.info',
  'https://nl1.api.radio-browser.info',
];

async function fetchJson<T>(url: string, timeoutMs = 12000): Promise<T> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    window.clearTimeout(timer);
  }
}

function uniqByUrl(list: PlayerTrack[]): PlayerTrack[] {
  const seen = new Set<string>();
  const out: PlayerTrack[] = [];
  for (const t of list) {
    const k = (t.url || '') + '|' + t.id;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

// ------------------------------------------------------------------ радио

interface RbStation {
  stationuuid?: string;
  name?: string;
  url?: string;
  url_resolved?: string;
  homepage?: string;
  favicon?: string;
  tags?: string;
  country?: string;
  countrycode?: string;
  state?: string;
  codec?: string;
  bitrate?: number;
  lastcheckok?: number;
}

function rbTrack(s: RbStation): PlayerTrack | null {
  const url = (s.url_resolved || s.url || '').trim();
  const name = (s.name || '').trim();
  if (!url || !name) return null;
  // На GitHub Pages страница открыта по https — http-поток браузер
  // заблокирует как mixed content. Такие станции не показываем.
  if (!url.startsWith('https://')) return null;
  if (s.lastcheckok === 0) return null;
  const genre = (s.tags || '').split(',').filter(Boolean).slice(0, 3).join(' · ');
  const place = [s.state, s.country].filter(Boolean).join(', ');
  return {
    id: `radio_${s.stationuuid || Math.abs(hashCode(url))}`,
    title: name,
    artist: genre || place || 'Радио',
    url,
    artwork: s.favicon || undefined,
    source: 'radio',
    genre,
    country: s.country,
    live: true,
  };
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

async function rbGet(path: string): Promise<PlayerTrack[]> {
  let lastError: unknown = null;
  for (const host of RB_HOSTS) {
    try {
      const arr = await fetchJson<RbStation[]>(host + path, 10000);
      if (!Array.isArray(arr)) return [];
      return arr.map(rbTrack).filter((t): t is PlayerTrack => !!t);
    } catch (e) {
      lastError = e;
    }
  }
  if (lastError) throw lastError;
  return [];
}

function latinCity(ru: string): string {
  const c = ru.trim().toLowerCase();
  if (c === 'красноярск') return 'Krasnoyarsk';
  if (c === 'москва') return 'Moscow';
  if (c === 'санкт-петербург' || c === 'питер') return 'Petersburg';
  if (c === 'новосибирск') return 'Novosibirsk';
  if (c === 'екатеринбург') return 'Ekaterinburg';
  return ru.trim();
}

export function radioZaycev(): PlayerTrack[] {
  const rows: Array<[string, string, string]> = [
    ['Зайцев FM Поп', 'поп / хиты', 'https://abs.zaycev.fm/pop128k'],
    ['Зайцев FM Relax', 'чиллаут / лаунж', 'https://abs.zaycev.fm/relax128k'],
    ['Зайцев FM NewRock', 'рок / альтернатива', 'https://abs.zaycev.fm/rock128k'],
  ];
  return rows.map(([title, genre, url]) => ({
    id: `radio_zaycev_${Math.abs(hashCode(url))}`,
    title,
    artist: genre,
    url,
    source: 'radio' as const,
    genre,
    country: 'Россия',
    live: true,
  }));
}

/** Проверенные https-потоки на случай, если каталог RadioBrowser недоступен. */
export function radioCurated(): PlayerTrack[] {
  const rows: Array<[string, string, string]> = [
    ['Европа Плюс', 'поп / хиты', 'https://ep256.hostingradio.ru:8052/europaplus256.mp3'],
    ['Ретро FM', 'хиты 80-х и 90-х', 'https://retroserver.streamr.ru:8043/retro256.mp3'],
    ['РАДИО ВАНЯ', 'поп', 'https://icecast-radiovanya.cdnvideo.ru/radiovanya'],
    ['Relax FM Chillout', 'чиллаут', 'https://pub0201.101.ru/stream/trust/mp3/128/24'],
    ['Anon.FM', 'электроника / экспериментальная', 'https://icecast.anon.fm/radio'],
  ];
  return rows.map(([title, genre, url]) => ({
    id: `radio_curated_${Math.abs(hashCode(url))}`,
    title,
    artist: genre,
    url,
    source: 'radio' as const,
    genre,
    country: 'Россия',
    live: true,
  }));
}

/** Автотюн: волны города + российские сети, как PlayerRadioApi.autotune. */
export async function radioAutotune(cityRu: string): Promise<PlayerTrack[]> {
  const city = cityRu.trim() || 'Красноярск';
  const latin = latinCity(city);
  const tasks: Array<Promise<PlayerTrack[]>> = [
    rbGet(`/json/stations/search?name=${encodeURIComponent(city)}&limit=80&hidebroken=true&order=votes&reverse=true&is_https=true`),
    rbGet(`/json/stations/search?country=Russia&state=${encodeURIComponent(city)}&limit=80&hidebroken=true&order=votes&reverse=true&is_https=true`),
    rbGet('/json/stations/bycountry/Russia?limit=80&hidebroken=true&order=votes&reverse=true&is_https=true'),
  ];
  if (latin.toLowerCase() !== city.toLowerCase()) {
    tasks.push(rbGet(`/json/stations/search?name=${encodeURIComponent(latin)}&limit=80&hidebroken=true&order=votes&reverse=true&is_https=true`));
  }
  if (city.toLowerCase() === 'красноярск') {
    tasks.push(rbGet('/json/stations/search?name=Krasnoyarsk%20Krai&limit=50&hidebroken=true&order=votes&reverse=true&is_https=true'));
    tasks.push(rbGet('/json/stations/search?name=Siberia&limit=30&hidebroken=true&order=votes&reverse=true&is_https=true'));
  }

  const settled = await Promise.allSettled(tasks);
  const found: PlayerTrack[] = [];
  for (const s of settled) {
    if (s.status === 'fulfilled') found.push(...s.value);
  }

  // «Зайцев FM» и проверенные сети — всегда сверху, как в Android.
  return uniqByUrl([...radioZaycev(), ...radioCurated(), ...found]);
}

export async function radioSearch(q: string, limit = 60): Promise<PlayerTrack[]> {
  const query = q.trim();
  if (!query) return radioTop(limit);
  return rbGet(`/json/stations/search?name=${encodeURIComponent(query)}&limit=${limit}&hidebroken=true&order=votes&reverse=true&is_https=true`);
}

export async function radioTop(limit = 60): Promise<PlayerTrack[]> {
  return rbGet(`/json/stations/topvote/${limit}?hidebroken=true&is_https=true`);
}

// ------------------------------------------------------------------ онлайн

interface AudiusTrack {
  id?: string;
  title?: string;
  duration?: number;
  genre?: string;
  user?: { name?: string };
  artwork?: Record<string, string>;
}

function audiusTrack(o: AudiusTrack, host: string): PlayerTrack | null {
  const id = (o.id || '').trim();
  const title = (o.title || '').trim();
  if (!id || !title || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  const art = o.artwork || {};
  const artwork = art['480x480'] || art['150x150'] || undefined;
  return {
    id: `online_${id}`,
    title,
    artist: o.user?.name || o.genre || '',
    url: `${host}/v1/tracks/${id}/stream?app_name=${APP}`,
    artwork,
    durationMs: o.duration && o.duration > 0 && o.duration < 36000 ? o.duration * 1000 : undefined,
    source: 'online',
    genre: o.genre,
    live: false,
  };
}

async function audiusGet(path: string): Promise<PlayerTrack[]> {
  for (const host of AUDIUS_HOSTS) {
    try {
      const root = await fetchJson<{ data?: AudiusTrack[] }>(host + path, 9000);
      const arr = root?.data;
      if (!Array.isArray(arr)) continue;
      const list = arr.map(o => audiusTrack(o, host)).filter((t): t is PlayerTrack => !!t);
      if (list.length) return list;
    } catch {
      // хост заблокирован/недоступен — пробуем следующий
    }
  }
  return [];
}

interface ArchiveDoc {
  identifier?: string;
  title?: string;
  creator?: string | string[];
}

interface ArchiveMetaFile {
  name?: string;
  length?: string;
  private?: string;
  title?: string;
  artist?: string;
}

interface ArchiveMeta {
  files?: ArchiveMetaFile[];
  metadata?: { title?: string; creator?: string | string[] };
}

async function archiveDocs(q: string, rows: number): Promise<ArchiveDoc[]> {
  const url = 'https://archive.org/advancedsearch.php?q=' + encodeURIComponent(q)
    + '&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=creator'
    + `&rows=${rows}&sort%5B%5D=downloads+desc&output=json`;
  const root = await fetchJson<{ response?: { docs?: ArchiveDoc[] } }>(url, 12000);
  return root?.response?.docs || [];
}

async function archiveTrack(doc: ArchiveDoc): Promise<PlayerTrack | null> {
  const id = doc.identifier || '';
  if (!id) return null;
  try {
    const meta = await fetchJson<ArchiveMeta>(`https://archive.org/metadata/${encodeURIComponent(id)}`, 15000);
    const files = meta.files || [];
    let file: ArchiveMetaFile | null = null;
    for (const f of files) {
      const name = (f.name || '').toLowerCase();
      if (name.endsWith('.mp3') && !name.endsWith('_meta.mp3') && !f.private) {
        file = f;
        break;
      }
    }
    if (!file?.name) return null;
    const seconds = Number(file.length);
    // Обрывки и служебные дорожки в онлайн-подборку не пускаем.
    if (Number.isFinite(seconds) && seconds > 0 && seconds < 45) return null;
    const rawTitle = doc.title || meta.metadata?.title || file.title || id;
    const creator = doc.creator || meta.metadata?.creator || file.artist || '';
    const artist = Array.isArray(creator) ? creator[0] : String(creator || '');
    return {
      id: `ia_${id}`,
      title: String(rawTitle).trim(),
      artist: artist.trim(),
      url: `https://archive.org/download/${encodeURIComponent(id)}/${encodeURIComponent(file.name)}`,
      artwork: `https://archive.org/services/img/${encodeURIComponent(id)}`,
      durationMs: Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : undefined,
      source: 'online',
      genre: 'archive',
      live: false,
    };
  } catch {
    return null;
  }
}

async function archiveTracks(q: string, rows: number): Promise<PlayerTrack[]> {
  const docs = await archiveDocs(q, rows);
  const out: PlayerTrack[] = [];
  // Метаданные тянем пачками по 6, чтобы не завалить archive.org.
  for (let i = 0; i < docs.length; i += 6) {
    const chunk = docs.slice(i, i + 6);
    const tracks = await Promise.all(chunk.map(archiveTrack));
    for (const t of tracks) if (t) out.push(t);
    if (out.length >= rows) break;
  }
  return out;
}

export async function onlineTrending(): Promise<PlayerTrack[]> {
  const audius = await audiusGet(`/v1/tracks/trending?app_name=${APP}&limit=50`);
  if (audius.length >= 10) return audius;
  const archive = await archiveTracks('collection:audio_music AND format:MP3', 10).catch(() => []);
  return uniqByUrl([...audius, ...archive]);
}

const GENRE_MAP: Record<string, string> = {
  'Поп': 'Pop',
  'Хип-хоп': 'Hip-Hop/Rap',
  'Рок': 'Rock',
  'Электроника': 'Electronic',
  'Танцевальная': 'Electronic',
  'R&B': 'R&B/Soul',
  'Инди': 'Alternative',
  'Джаз': 'Jazz',
  'Классика': 'Classical',
  'Метал': 'Metal',
};

export async function onlineByGenres(genres: string[]): Promise<PlayerTrack[]> {
  const terms = genres.map(g => GENRE_MAP[g] || g).slice(0, 4);
  if (!terms.length) return onlineTrending();

  const lists = await Promise.all(terms.map(term =>
    audiusGet(`/v1/tracks/trending?app_name=${APP}&genre=${encodeURIComponent(term)}&limit=40`).catch(() => [])
  ));
  let out = uniqByUrl(lists.flat());

  if (out.length < 8) {
    const archive = await Promise.all(
      genres.slice(0, 2).map(g => archiveTracks(
        `(title:(${g}) OR creator:(${g}) OR subject:(${g})) AND collection:audio_music AND format:MP3`,
        8,
      ).catch(() => []))
    );
    out = uniqByUrl([...out, ...archive.flat()]);
  }
  return out;
}

interface ItunesResult {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
  trackTimeMillis?: number;
  primaryGenreName?: string;
}

async function itunesSearch(q: string): Promise<PlayerTrack[]> {
  const root = await fetchJson<{ results?: ItunesResult[] }>(
    `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=25`,
    10000,
  );
  return (root.results || [])
    .filter(r => r.previewUrl && r.trackName)
    .map(r => ({
      id: `itunes_${r.trackId || Math.abs(hashCode((r.trackName || '') + (r.artistName || '')))}`,
      title: r.trackName || '',
      artist: r.artistName || '',
      url: r.previewUrl,
      artwork: r.artworkUrl100,
      durationMs: r.trackTimeMillis,
      source: 'online' as const,
      genre: r.primaryGenreName,
      live: false,
    }));
}

function matchesGenre(track: PlayerTrack, genres: string[]): boolean {
  if (!genres.length) return true;
  const g = (track.genre || '').toLowerCase();
  return genres.some(name => {
    const mapped = (GENRE_MAP[name] || name).toLowerCase();
    const ru = name.toLowerCase();
    return g.includes(mapped) || g.includes(ru);
  });
}

export async function onlineSearch(q: string, genres: string[] = []): Promise<PlayerTrack[]> {
  const query = q.trim();
  if (!query) return genres.length ? onlineByGenres(genres) : onlineTrending();

  const audius = await audiusGet(`/v1/tracks/search?query=${encodeURIComponent(query)}&app_name=${APP}&limit=50`);
  let out = genres.length ? audius.filter(t => matchesGenre(t, genres)) : audius;

  if (out.length < 5) {
    const archive = await archiveTracks(
      `(title:(${query}) OR creator:(${query})) AND collection:audio_music AND format:MP3`,
      8,
    ).catch(() => []);
    out = uniqByUrl([...out, ...archive]);
  }

  // Последний резерв — 30-секундные превью iTunes (бейдж «30с»).
  if (out.length === 0) {
    out = await itunesSearch(query).catch(() => []);
  }
  return out;
}

export function isShortPreview(track: PlayerTrack): boolean {
  return track.id.startsWith('itunes_');
}
