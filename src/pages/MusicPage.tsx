// FitGuide Web — экран «Плеер» (порт PlayerActivity + activity_player.xml)
//
// Четыре вкладки, как в Android: Моя музыка / Радио / Онлайн / Любимое.
// Своя музыка хранится в IndexedDB, радио — RadioBrowser, онлайн — Audius
// с запасным каталогом Internet Archive. Один <audio> на всё приложение,
// поэтому воспроизведение продолжается при переходе на другие экраны.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { PageHeader, MaskIcon, asset, usePaletteVars } from '../components/ui';
import { Dialog } from './progress/common';
import { getString, setString } from '../core/storage';
import {
  addLocalFiles, deleteLocalRecord, formatDuration, listLocalRecords, pickAudioFiles,
  pickFolderAudioFiles, type LocalRecord,
} from '../core/musicLibrary';
import { onlineByGenres, onlineSearch, onlineTrending, radioAutotune, radioSearch, isShortPreview } from '../core/musicApi';
import { likedTracks, subscribeLikes, toggleLike, isLiked } from '../core/musicLikes';
import {
  cycleRepeat, nextTrack, playQueue, prevTrack, seek, stopAll, togglePlay, toggleShuffle,
  usePlayer, type PlayerTrack,
} from '../core/player';

type Tab = 'local' | 'radio' | 'online' | 'fav';
type RadioFilter = 'ru' | 'all' | 'fav';

const GENRES = ['Поп', 'Хип-хоп', 'Рок', 'Электроника', 'Танцевальная', 'R&B', 'Инди', 'Джаз', 'Классика', 'Метал'];

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00';
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function isRuStation(t: PlayerTrack): boolean {
  const c = (t.country || '').toLowerCase();
  return c.includes('росси') || c.includes('russia');
}

function trackSub(t: PlayerTrack): string {
  let s = t.artist || '';
  if (t.live) return s ? `${s} · LIVE` : 'LIVE';
  if (t.durationMs) return s ? `${s} · ${formatDuration(t.durationMs)}` : formatDuration(t.durationMs);
  return s;
}

function trackBadge(t: PlayerTrack): string {
  if (t.live) return 'LIVE';
  if (t.source === 'online') return isShortPreview(t) ? '30с' : 'FULL';
  return '';
}

// ---------------------------------------------------------------- элементы

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fg-pchip active:opacity-80"
      style={{
        background: on ? 'var(--p-circle)' : 'var(--p-labels)',
        borderColor: 'var(--p-outline)',
        color: on ? 'var(--p-on-circle)' : 'var(--p-on-labels)',
      }}
    >
      {children}
    </button>
  );
}

function PlayerButton({ children, onClick, className }: {
  children: React.ReactNode; onClick: () => void; className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx('h-10 px-4 rounded-[22px] text-[14px] font-medium active:opacity-80', className)}
      style={{
        background: 'var(--p-labels)',
        border: '1px solid var(--p-outline)',
        color: 'var(--p-labels-text)',
      }}
    >
      {children}
    </button>
  );
}

function Status({ children }: { children: React.ReactNode }) {
  // tvP*Status в activity_player.xml без своего цвета — наследует textMain.
  return (
    <div className="py-3 text-center text-[13px]" style={{ color: 'var(--color-text-main)' }}>
      {children}
    </div>
  );
}

function TrackRow({ track, onPlay, onLike, onDelete }: {
  track: PlayerTrack;
  onPlay: () => void;
  onLike: () => void;
  onDelete?: () => void;
}) {
  const liked = isLiked(track);
  const badge = trackBadge(track);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPlay}
      onKeyDown={e => { if (e.key === 'Enter') onPlay(); }}
      className="mx-1.5 my-1.5 rounded-[16px] flex items-center pl-3.5 pr-2 py-2.5 active:opacity-90"
      style={{ background: 'var(--p-labels)', border: '1px solid var(--p-outline)' }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-[15px] font-bold truncate" style={{ color: 'var(--color-text-main)' }}>
            {track.title}
          </div>
          {badge && (
            // tvPBadge в item_player_track.xml — ?attr/colorPrimary,
            // BaseActivity перекрашивает акцент в надписи (D).
            <span className="text-[11px] font-bold flex-shrink-0" style={{ color: 'var(--p-labels-text)' }}>
              {badge}
            </span>
          )}
        </div>
        <div className="text-[12px] mt-0.5 truncate" style={{ color: 'var(--color-text-secondary)' }}>
          {trackSub(track)}
        </div>
      </div>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onLike(); }}
        aria-label={liked ? 'Убрать из любимых' : 'Нравится этот трек'}
        className="w-[42px] h-[42px] flex items-center justify-center rounded-full active:bg-black/10 flex-shrink-0"
      >
        <MaskIcon
          src={asset(liked ? 'icons/ic_heart.svg' : 'icons/ic_heart_outline.svg')}
          color="var(--p-on-labels)"
          size={22}
          className={liked ? '' : 'opacity-70'}
        />
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onDelete(); }}
          aria-label="Удалить трек"
          className="w-[42px] h-[42px] flex items-center justify-center rounded-full active:bg-black/10 flex-shrink-0 opacity-85"
        >
          <MaskIcon src={asset('icons/ic_delete.svg')} color="var(--p-on-labels)" size={22} />
        </button>
      )}
    </div>
  );
}

function useLikesVersion() {
  const [, force] = useState(0);
  useEffect(() => subscribeLikes(() => force(x => x + 1)), []);
}

// ---------------------------------------------------------------- страница

export function MusicPage() {
  usePaletteVars();
  const navigate = useNavigate();
  const player = usePlayer();
  useLikesVersion();

  const [tab, setTab] = useState<Tab>('local');
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
  }, []);

  // ---- своя музыка ----
  const [localRecords, setLocalRecords] = useState<LocalRecord[]>([]);
  const [localLoading, setLocalLoading] = useState(true);
  const [localBusy, setLocalBusy] = useState<string | null>(null);
  const [localQuery, setLocalQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<PlayerTrack | null>(null);

  const reloadLocal = useCallback(async () => {
    const rows = await listLocalRecords();
    setLocalRecords(rows);
  }, []);

  useEffect(() => {
    let alive = true;
    reloadLocal()
      .catch(() => { if (alive) setLocalRecords([]); })
      .finally(() => { if (alive) setLocalLoading(false); });
    return () => { alive = false; };
  }, [reloadLocal]);

  const localTracks = useMemo<PlayerTrack[]>(() => localRecords.map(r => ({
    id: `local_${r.key}`,
    title: r.title,
    artist: r.artist,
    durationMs: r.durationMs,
    source: 'local',
    localKey: r.key,
  })), [localRecords]);

  const localVisible = useMemo(() => {
    const q = localQuery.trim().toLowerCase();
    if (!q) return localTracks;
    return localTracks.filter(t => `${t.title} ${t.artist}`.toLowerCase().includes(q));
  }, [localTracks, localQuery]);

  const addFiles = useCallback(async (files: File[], folder: boolean) => {
    if (!files.length) return;
    setLocalBusy(folder ? 'Ищу музыку в папке…' : 'Добавляю треки…');
    try {
      const res = await addLocalFiles(files, (done, total) => {
        setLocalBusy(`Добавляю треки… ${done} из ${total}`);
      });
      await reloadLocal();
      const total = (await listLocalRecords()).length;
      if (res.added > 0) showToast(`Найдено новых: ${res.added}. Всего в фонотеке: ${total}`);
      else showToast('Новых файлов не нашлось — медиатека уже полная');
    } catch {
      showToast('Не удалось сохранить файлы в браузере');
    } finally {
      setLocalBusy(null);
    }
  }, [reloadLocal, showToast]);

  const onAddTracks = async () => {
    const files = await pickAudioFiles();
    await addFiles(files, false);
  };

  const onFindAll = async () => {
    const files = await pickFolderAudioFiles();
    await addFiles(files, true);
  };

  const doDelete = async () => {
    const t = deleteTarget;
    if (!t?.localKey) return;
    setDeleteTarget(null);
    try {
      await deleteLocalRecord(t.localKey);
      await reloadLocal();
      showToast('Трек удалён');
    } catch {
      showToast('Не удалось удалить трек');
    }
  };

  // ---- радио ----
  const [radioCity, setRadioCity] = useState(() => getString('music_radio_city', 'Красноярск'));
  const [radioQuery, setRadioQuery] = useState('');
  const [radioFilter, setRadioFilter] = useState<RadioFilter>('ru');
  const [radioAll, setRadioAll] = useState<PlayerTrack[]>([]);
  const [radioLoading, setRadioLoading] = useState(false);
  const [radioStatus, setRadioStatus] = useState('');
  const radioInit = useRef(false);
  const radioQueryRef = useRef('');

  const autotune = useCallback(async (notify: boolean) => {
    const city = radioCity.trim() || 'Красноярск';
    setRadioLoading(true);
    setRadioStatus(`Ищем волны: ${city}…`);
    try {
      setString('music_radio_city', city);
      const list = await radioAutotune(city);
      setRadioAll(list);
      setRadioStatus(list.length ? '' : 'Ничего не найдено. Проверьте интернет.');
      if (notify) showToast(`Найдено волн: ${list.length}`);
    } catch {
      setRadioStatus('Ничего не найдено. Проверьте интернет.');
    } finally {
      setRadioLoading(false);
    }
  }, [radioCity, showToast]);

  useEffect(() => {
    if (tab !== 'radio' || radioInit.current) return;
    radioInit.current = true;
    void autotune(false);
  }, [tab, autotune]);

  // Живой поиск волн: после 2 символов и паузы 600 мс, как в Android.
  useEffect(() => {
    if (tab !== 'radio') return;
    const q = radioQuery.trim();
    radioQueryRef.current = q;
    if (q.length < 2) return;
    const timer = window.setTimeout(async () => {
      try {
        const found = await radioSearch(q);
        if (radioQueryRef.current !== q) return;
        setRadioAll(prev => {
          const seen = new Set(prev.map(t => t.url));
          return [...prev, ...found.filter(t => t.url && !seen.has(t.url))];
        });
      } catch {
        // поиск не удался — остаётся локальная фильтрация
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [radioQuery, tab]);

  const radioVisible = useMemo(() => {
    const q = radioQuery.trim().toLowerCase();
    return radioAll.filter(t => {
      if (radioFilter === 'fav' && !isLiked(t)) return false;
      if (radioFilter === 'ru' && !isRuStation(t)) return false;
      if (q && !`${t.title} ${t.artist} ${t.genre || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [radioAll, radioFilter, radioQuery]);

  // ---- онлайн ----
  const [onlineQuery, setOnlineQuery] = useState('');
  const [onlineAll, setOnlineAll] = useState<PlayerTrack[]>([]);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState('');
  const [genres, setGenres] = useState<string[]>([]);
  const [genresOpen, setGenresOpen] = useState(false);
  const onlineInit = useRef(false);

  const loadOnline = useCallback(async (selected: string[], notify: boolean) => {
    setOnlineLoading(true);
    setOnlineStatus('Загрузка полных треков…');
    try {
      const list = selected.length ? await onlineByGenres(selected) : await onlineTrending();
      setOnlineAll(list);
      setOnlineStatus(list.length ? '' : 'Нет сети или ничего не найдено. Проверьте интернет.');
      if (notify && list.length) showToast(`Найдено треков: ${list.length}`);
    } catch {
      setOnlineAll([]);
      setOnlineStatus('Нет сети или ничего не найдено. Проверьте интернет.');
    } finally {
      setOnlineLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (tab !== 'online' || onlineInit.current) return;
    onlineInit.current = true;
    void loadOnline([], false);
  }, [tab, loadOnline]);

  const onlineVisible = useMemo(() => {
    const q = onlineQuery.trim().toLowerCase();
    if (!q) return onlineAll;
    return onlineAll.filter(t => `${t.title} ${t.artist}`.toLowerCase().includes(q));
  }, [onlineAll, onlineQuery]);

  const doOnlineSearch = async () => {
    const q = onlineQuery.trim();
    if (!q) {
      await loadOnline(genres, false);
      return;
    }
    setOnlineLoading(true);
    setOnlineStatus('Поиск…');
    try {
      const list = await onlineSearch(q, genres);
      setOnlineAll(list);
      setOnlineStatus(list.length
        ? ''
        : (genres.length ? 'В выбранных жанрах ничего не найдено' : 'Ничего не найдено'));
    } catch {
      setOnlineAll([]);
      setOnlineStatus('Ничего не найдено');
    } finally {
      setOnlineLoading(false);
    }
  };

  const toggleGenre = (g: string) => {
    const next = genres.includes(g) ? genres.filter(x => x !== g) : [...genres, g];
    setGenres(next);
    void loadOnline(next, true);
  };

  // ---- любимое ----
  const favorites = likedTracks();

  const playFrom = (list: PlayerTrack[], track: PlayerTrack) => {
    const i = list.findIndex(t => t.id === track.id);
    playQueue(list, i < 0 ? 0 : i);
  };

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'local', label: 'Моя музыка' },
    { id: 'radio', label: 'Радио' },
    { id: 'online', label: 'Онлайн' },
    { id: 'fav', label: 'Любимое' },
  ];

  const live = !!player.track?.live;
  const duration = player.duration;
  const position = Math.min(player.position, duration || player.position);

  return (
    <div
      className="w-full max-w-3xl mx-auto flex flex-col h-[100dvh]"
      style={{ background: 'var(--color-bg)', paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="shrink-0 z-30" style={{ background: 'var(--color-bg)' }}>
        <PageHeader
          title="Плеер"
          onBack={() => navigate('/')}
          right={
            <div className="flex items-center">
              <button
                onClick={() => navigate('/music/eq')}
                aria-label="Эквалайзер"
                className="w-11 h-11 flex items-center justify-center rounded-full active:bg-black/5"
              >
                <MaskIcon src={asset('icons/ic_equalizer.svg')} color="var(--p-labels-text)" size={24} />
              </button>
              <button
                onClick={() => stopAll()}
                aria-label="Остановить"
                className="w-11 h-11 flex items-center justify-center rounded-full active:bg-black/5"
              >
                <MaskIcon src={asset('icons/ic_stop.svg')} color="var(--p-labels-text)" size={24} />
              </button>
            </div>
          }
        />
        <div className="px-3 pb-2 flex flex-wrap gap-1.5">
          {tabs.map(t => (
            <Chip key={t.id} on={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</Chip>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto fg-scroll fg-no-select">
        {tab === 'local' && (
          <div
            className="px-4 pt-1 min-h-full"
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
            onDrop={e => {
              e.preventDefault();
              const files = Array.from(e.dataTransfer.files || []);
              if (files.length) void addFiles(files, false);
            }}
          >
            <input
              value={localQuery}
              onChange={e => setLocalQuery(e.target.value)}
              placeholder="Поиск по своей музыке…"
              className="fg-input"
              style={{ color: 'var(--color-text-main)' }}
            />
            <div className="flex gap-2 mt-1.5">
              <PlayerButton onClick={() => { void onAddTracks(); }} className="flex-1">Добавить треки</PlayerButton>
              <PlayerButton onClick={() => { void onFindAll(); }} className="flex-1">Найти всё</PlayerButton>
            </div>
            {localBusy && <Status>{localBusy}</Status>}
            {!localBusy && localVisible.length === 0 && !localLoading && (
              <Status>
                {localRecords.length === 0 ? (
                  <>
                    <div>На телефоне музыка не найдена. Добавьте треки кнопкой выше.</div>
                    <div className="text-[12px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                      Браузер не сканирует память сам — выберите файлы или папку.
                    </div>
                  </>
                ) : 'Ничего не найдено'}
              </Status>
            )}
            {localLoading && <Status>Загрузка…</Status>}
            <div className="pb-3">
              {localVisible.map(t => (
                <TrackRow
                  key={t.id}
                  track={t}
                  onPlay={() => playFrom(localVisible, t)}
                  onLike={() => toggleLike(t)}
                  onDelete={() => setDeleteTarget(t)}
                />
              ))}
            </div>
          </div>
        )}

        {tab === 'radio' && (
          <div className="px-4 pt-1">
            <div className="flex gap-2 items-center">
              <input
                value={radioCity}
                onChange={e => setRadioCity(e.target.value)}
                placeholder="Город"
                className="fg-input flex-1 min-w-0"
                style={{ color: 'var(--color-text-main)' }}
              />
              <PlayerButton onClick={() => { void autotune(true); }} className="flex-shrink-0">Автотюн</PlayerButton>
            </div>
            <input
              value={radioQuery}
              onChange={e => setRadioQuery(e.target.value)}
              placeholder="Поиск волны…"
              className="fg-input mt-1.5"
              style={{ color: 'var(--color-text-main)' }}
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Chip on={radioFilter === 'all'} onClick={() => setRadioFilter('all')}>Все страны</Chip>
              <Chip on={radioFilter === 'ru'} onClick={() => setRadioFilter('ru')}>Россия</Chip>
              <Chip on={radioFilter === 'fav'} onClick={() => setRadioFilter('fav')}>Любимые</Chip>
            </div>
            {(radioLoading || radioStatus) && <Status>{radioLoading ? 'Поиск…' : radioStatus}</Status>}
            {!radioLoading && !radioStatus && radioVisible.length === 0 && <Status>Ничего не найдено</Status>}
            <div className="pb-3">
              {radioVisible.map(t => (
                <TrackRow
                  key={t.id}
                  track={t}
                  onPlay={() => playFrom(radioVisible, t)}
                  onLike={() => toggleLike(t)}
                />
              ))}
            </div>
          </div>
        )}

        {tab === 'online' && (
          <div className="px-4 pt-1">
            <div className="text-[13px]" style={{ color: 'var(--color-text-main)' }}>
              Треки целиком, по жанрам
            </div>
            <input
              value={onlineQuery}
              onChange={e => setOnlineQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void doOnlineSearch(); }}
              placeholder="По названию или исполнителю…"
              className="fg-input mt-1"
              style={{ color: 'var(--color-text-main)' }}
            />
            <PlayerButton onClick={() => setGenresOpen(v => !v)} className="w-full mt-1.5">Жанры</PlayerButton>
            {genresOpen && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {GENRES.map(g => (
                  <Chip key={g} on={genres.includes(g)} onClick={() => toggleGenre(g)}>{g}</Chip>
                ))}
              </div>
            )}
            {(onlineLoading || onlineStatus) && <Status>{onlineLoading ? 'Загрузка полных треков…' : onlineStatus}</Status>}
            {!onlineLoading && !onlineStatus && onlineVisible.length === 0 && <Status>Ничего не найдено</Status>}
            <div className="pb-3">
              {onlineVisible.map(t => (
                <TrackRow
                  key={t.id}
                  track={t}
                  onPlay={() => playFrom(onlineVisible, t)}
                  onLike={() => toggleLike(t)}
                />
              ))}
            </div>
          </div>
        )}

        {tab === 'fav' && (
          <div className="px-4 pt-1">
            {favorites.length === 0 && (
              <Status>Пока пусто. Жмите ♥ на треках и волнах.</Status>
            )}
            <div className="pb-3">
              {favorites.map(t => (
                <TrackRow
                  key={t.id}
                  track={t}
                  onPlay={() => playFrom(favorites, t)}
                  onLike={() => toggleLike(t)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Нижняя панель — как блок под FrameLayout в activity_player.xml */}
      <div
        className="shrink-0 z-30 px-4 pt-1.5 pb-2"
        style={{
          background: 'var(--color-bg)',
          borderTop: '1px solid var(--color-stroke)',
          paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
        }}
      >
        <div className="text-[15px] font-bold truncate" style={{ color: 'var(--color-text-main)' }}>
          {player.track?.title || 'Выберите трек'}
        </div>
        <div className="text-[12px] truncate" style={{ color: 'var(--color-text-main)' }}>
          {player.error || player.track?.artist || ''}
        </div>

        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] tabular-nums flex-shrink-0" style={{ color: 'var(--color-text-main)' }}>
            {live ? 'LIVE' : fmt(player.position)}
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(1, duration)}
            step={0.1}
            value={live ? 0 : position}
            disabled={live || duration <= 0}
            onChange={e => seek(parseFloat(e.target.value))}
            className="flex-1 min-w-0"
            style={{ accentColor: 'var(--p-labels-text)' }}
            aria-label="Позиция трека"
          />
          <span className="text-[11px] tabular-nums flex-shrink-0" style={{ color: 'var(--color-text-main)' }}>
            {live ? '' : fmt(duration)}
          </span>
        </div>

        <div className="flex items-center justify-center gap-1 mt-0.5">
          <button
            onClick={() => prevTrack()}
            aria-label="Назад"
            className="w-11 h-11 flex items-center justify-center rounded-full active:bg-black/10"
          >
            <MaskIcon src={asset('icons/ic_skip_prev.svg')} color="var(--p-labels-text)" size={26} />
          </button>
          <button
            onClick={() => togglePlay()}
            aria-label="Играть / пауза"
            className="w-[52px] h-[52px] flex items-center justify-center rounded-full active:bg-black/10"
          >
            <MaskIcon
              src={asset(player.playing ? 'icons/ic_pause.svg' : 'icons/ic_play.svg')}
              color="var(--p-labels-text)"
              size={32}
            />
          </button>
          <button
            onClick={() => nextTrack()}
            aria-label="Дальше"
            className="w-11 h-11 flex items-center justify-center rounded-full active:bg-black/10"
          >
            <MaskIcon src={asset('icons/ic_skip_next.svg')} color="var(--p-labels-text)" size={26} />
          </button>
          <button
            onClick={() => toggleShuffle()}
            aria-label="Перемешать"
            className="w-11 h-11 flex items-center justify-center rounded-full active:bg-black/10"
            style={{ opacity: player.shuffle ? 1 : 0.35 }}
          >
            <MaskIcon src={asset('icons/ic_shuffle.svg')} color="var(--p-labels-text)" size={24} />
          </button>
          <button
            onClick={() => cycleRepeat()}
            aria-label="Повтор"
            className="w-11 h-11 flex items-center justify-center rounded-full active:bg-black/10"
            style={{ opacity: player.repeat === 0 ? 0.35 : 1 }}
          >
            <MaskIcon src={asset('icons/ic_repeat.svg')} color="var(--p-labels-text)" size={24} />
          </button>
          <button
            onClick={() => stopAll()}
            aria-label="Остановить"
            className="w-11 h-11 flex items-center justify-center rounded-full active:bg-black/10"
          >
            <MaskIcon src={asset('icons/ic_close.svg')} color="var(--p-labels-text)" size={24} />
          </button>
        </div>
      </div>

      {toast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 bottom-28 px-4 py-2 rounded-full text-[13px] font-medium z-[60] max-w-[90vw] text-center"
          style={{ background: 'var(--p-labels)', color: 'var(--p-on-labels)' }}
        >
          {toast}
        </div>
      )}

      {deleteTarget && (
        <Dialog
          title="Удалить трек"
          onClose={() => setDeleteTarget(null)}
          actions={
            <>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2.5 rounded-full text-[14px] font-bold"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => { void doDelete(); }}
                className="px-4 py-2.5 rounded-full text-[14px] font-bold"
                style={{ color: 'var(--p-labels-text)' }}
              >
                Удалить
              </button>
            </>
          }
        >
          <div className="text-[15px] pb-1" style={{ color: 'var(--color-text-main)' }}>
            {deleteTarget.title}
          </div>
        </Dialog>
      )}
    </div>
  );
}
