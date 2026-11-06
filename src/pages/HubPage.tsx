// FitGuide Web — главный экран (порт MainActivity.java 1:1)
//
// Структура как в activity_main.xml:
//   хедер (лимовый градиент C) → время/дату/погоду/неделю → поиск → сетка плиток → мини-плеер.
//
// Цвета строго по Android (SplashActivity defaults):
//   A = #FF005B (розовый контур)   B = #000000 (чёрный фон плиток)
//   C = #8FFF00 (лайм кругляшки)   D = наследует A

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { useProfileStore, useProgramsStore, useCoachStore } from '../core/store';
import { usePaletteVars, TopBar, TopBarButton, ToolTile, MiniPlayer, SearchField, MaskIcon, type ToolDef, asset } from '../components/ui';
import { getJSON, setJSON, KEYS, getString } from '../core/storage';
import { usePlayer } from '../core/player';
import { useWeather } from '../core/weather';
import { slotColor } from '../core/palette';

// Порядок ярлыков — как buildTools() в MainActivity
const TOOLS: ToolDef[] = [
  { key: 'workout', title: 'Карманный тренер', subtitle: 'Подсказки, прогрессия и старт тренировки', icon: asset('icons/ic_tool_coach.svg'), to: '/coach' },
  { key: 'music', title: 'Музыка', subtitle: 'Плеер: своя музыка, радио, онлайн', icon: asset('icons/ic_tool_music.svg'), to: '/music' },
  { key: 'myprogress', title: 'Мой прогресс', subtitle: 'Тренировки, рекорды и тело', icon: asset('icons/ic_tool_progress.svg'), to: '/progress' },
  { key: 'programs', title: 'Программы', subtitle: 'Лучшие программы, генератор и база', icon: asset('icons/ic_tool_program.svg'), to: '/programs' },
  { key: 'search', title: 'Поиск', subtitle: 'Поиск по всей базе упражнений', icon: asset('icons/ic_search.svg'), to: '/search' },
  { key: 'nutrition', title: 'Питание', subtitle: 'Калории, БЖУ и спортпит', icon: asset('icons/ic_tool_kbju.svg'), to: '/nutrition' },
  { key: 'timer', title: 'Таймер', subtitle: 'Часы, секундомер, таймер отдыха', icon: asset('icons/ic_tool_timer.svg'), to: '/timer' },
  { key: 'profile', title: 'Профиль', subtitle: 'Анкета, цель и немного о себе', icon: asset('icons/ic_tool_profile.svg'), to: '/profile' },
  { key: 'knowledge', title: 'Библиотека', subtitle: 'Энциклопедия: тренинг, питание, наука', icon: asset('icons/ic_knowledge.svg'), to: '/knowledge' },
  { key: 'settings', title: 'Настройки', subtitle: 'Темы, музыка, общие настройки', icon: asset('icons/ic_settings.svg'), to: '/settings' },
];

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function HubPage() {
  const navigate = useNavigate();
  const { profile } = useProfileStore();
  const { programs } = useProgramsStore();
  const { sessions } = useCoachStore();
  usePaletteVars();

  const circle = slotColor('circleIcons');
  const outline = slotColor('outline');
  const labels = slotColor('labelsButtons');
  const onCircle = slotColor('circleIcons') === '#000000' ? '#FFFFFF' : '#000000'; // будет пересчитано ниже

  const [now, setNow] = useState(new Date());
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState<string[]>(TOOLS.map(t => t.key));
  const [dragEnabled, setDragEnabled] = useState(() => getString('home_drag_enabled', '1') !== '0');
  const [searchEnabled, setSearchEnabled] = useState(() => getString('home_search_enabled', '1') !== '0');
  const [dragSrc, setDragSrc] = useState<number | null>(null);
  const player = usePlayer();
  const weatherCity = getString('weather_city', 'Красноярск');
  const weather = useWeather(weatherCity);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Сохранённый порядок ярлыков (как tools_customize в Android)
  useEffect(() => {
    const saved = getJSON<string[]>(KEYS.TOOL_ORDER, []);
    if (saved.length) {
      const known = saved.filter(k => TOOLS.some(t => t.key === k));
      const rest = TOOLS.map(t => t.key).filter(k => !known.includes(k));
      setOrder([...known, ...rest]);
    }
  }, []);

  const tools = useMemo(() => {
    const map = new Map(TOOLS.map(t => [t.key, t]));
    return order.map(k => map.get(k)!).filter(Boolean);
  }, [order]);

  const setToolOrder = (next: string[]) => {
    setOrder(next);
    setJSON(KEYS.TOOL_ORDER, next);
  };

  // Перетаскивание ярлыков (long-press + drag, как на Android)
  const orderRef = useRef(order);
  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  const dragSrcRef = useRef<number | null>(null);
  const touchTimer = useRef<number | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const touchDragging = useRef(false);
  const suppressClick = useRef(false);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [touchActive, setTouchActive] = useState(false);

  // На тач-устройствах нативный HTML5 drag конфликтует с долгим нажатием
  const isCoarse = useMemo(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches,
    []
  );

  const cancelLongPress = () => {
    if (touchTimer.current !== null) {
      clearTimeout(touchTimer.current);
      touchTimer.current = null;
    }
  };

  const applyReorder = (from: number, to: number) => {
    if (from === to) return;
    const next = [...orderRef.current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    orderRef.current = next;
    setOrder(next);
    dragSrcRef.current = to;
    setDragSrc(to);
  };

  const resetTouch = () => {
    cancelLongPress();
    touchDragging.current = false;
    touchStart.current = null;
    dragSrcRef.current = null;
    setTouchActive(false);
    setDragSrc(null);
  };

  const finishTouch = () => {
    cancelLongPress();
    if (touchDragging.current) {
      setJSON(KEYS.TOOL_ORDER, orderRef.current);
      // после перетаскивания гасим случайный клик по ссылке
      suppressClick.current = true;
    }
    resetTouch();
  };

  // Долгое нажатие на телефоне: нативные обработчики.
  // touchstart НЕ отменяем — иначе браузер перестаёт прокручивать страницу.
  // Выделение текста и меню убираем через CSS (user-select / touch-callout).
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const onTouchStart = (e: TouchEvent) => {
      if (!dragEnabled || e.touches.length !== 1) return;
      const target = e.target as HTMLElement;
      const tileEl = target.closest('[data-tile-index]') as HTMLElement | null;
      if (!tileEl) return;
      const idx = Number(tileEl.dataset.tileIndex);
      if (Number.isNaN(idx)) return;
      const t = e.touches[0];
      suppressClick.current = false;
      touchStart.current = { x: t.clientX, y: t.clientY };
      cancelLongPress();
      touchTimer.current = window.setTimeout(() => {
        touchTimer.current = null;
        touchDragging.current = true;
        dragSrcRef.current = idx;
        setDragSrc(idx);
        setTouchActive(true);
        try {
          navigator.vibrate?.(15);
        } catch {}
      }, 300);
    };

    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      if (touchDragging.current) {
        e.preventDefault();
        const el = document.elementFromPoint(t.clientX, t.clientY);
        const tileEl = el?.closest('[data-tile-index]') as HTMLElement | null;
        if (!tileEl) return;
        const over = Number(tileEl.dataset.tileIndex);
        if (!Number.isNaN(over) && dragSrcRef.current !== null && over !== dragSrcRef.current) {
          applyReorder(dragSrcRef.current, over);
        }
        return;
      }
      if (touchStart.current) {
        const dx = Math.abs(t.clientX - touchStart.current.x);
        const dy = Math.abs(t.clientY - touchStart.current.y);
        if (dx > 10 || dy > 10) {
          cancelLongPress();
        }
      }
    };

    const onTouchEnd = () => finishTouch();

    grid.addEventListener('touchstart', onTouchStart, { passive: false });
    grid.addEventListener('touchmove', onTouchMove, { passive: false });
    grid.addEventListener('touchend', onTouchEnd);
    grid.addEventListener('touchcancel', resetTouch);
    return () => {
      grid.removeEventListener('touchstart', onTouchStart);
      grid.removeEventListener('touchmove', onTouchMove);
      grid.removeEventListener('touchend', onTouchEnd);
      grid.removeEventListener('touchcancel', resetTouch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragEnabled]);

  const onDragStart = (idx: number) => {
    if (!dragEnabled) return;
    setDragSrc(idx);
  };
  const onDragOver = (e: React.DragEvent, idx: number) => {
    if (!dragEnabled || dragSrc === null || dragSrc === idx) return;
    e.preventDefault();
  };
  const onDrop = (idx: number) => {
    if (!dragEnabled || dragSrc === null || dragSrc === idx) return;
    setDragSrc(null);
    const next = [...order];
    const [moved] = next.splice(dragSrc, 1);
    next.splice(idx, 0, moved);
    setOrder(next);
    setToolOrder(next);
  };
  const onDragEnd = () => {
    setDragSrc(null);
  };

  // Неделя: 7 дней, сегодняшний подсвечен лимовым кругом (C)
  const weekDays = useMemo(() => {
    const today = new Date();
    const dow = (today.getDay() + 6) % 7; // пн=0
    const monday = new Date(today);
    monday.setDate(today.getDate() - dow);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return { date: d, isToday: d.toDateString() === today.toDateString() };
    });
  }, [now]);

  const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  // В Android поиск уходит по actionSearch (Enter), а не на каждую букву.
  const handleSearch = (v: string) => {
    setQuery(v);
  };

  const submitSearch = () => {
    if (query.trim()) navigate('/search?q=' + encodeURIComponent(query.trim()));
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg)' }}>
      {/* Хедер — лимовый градиент (C), как на Android */}
      <header className="relative z-20">
        <div className="fg-topbar safe-top px-5 pt-2.5 pb-2.5 flex items-center gap-2"
          style={{ background: 'linear-gradient(135deg, var(--p-circle-from), var(--p-circle-to))' }}>
          <div className="flex-1 min-w-0">
            <div className="fg-topbar-title truncate">
              FitGuide
            </div>
            <div className="fg-topbar-sub truncate">
              Создай лучшую версию себя
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={() => navigate('/profile')} aria-label="Профиль" className="p-2.5 rounded-full active:bg-black/10 flex-shrink-0">
              <MaskIcon src={asset('icons/ic_tool_profile.svg')} color="var(--p-on-circle)" size={24} />
            </button>
            <button onClick={() => navigate('/settings')} aria-label="Настройки" className="p-2.5 rounded-full active:bg-black/10 flex-shrink-0">
              <MaskIcon src={asset('icons/ic_settings.svg')} color="var(--p-on-circle)" size={24} />
            </button>
          </div>
        </div>
      </header>

      {/* Карточка: часы, погода, неделя — чёрный фон (B), розовая обводка (A) */}
      <div className="mx-4 mt-2 mb-1 fg-banner px-3.5 py-2.5 select-none"
        style={{ background: labels, border: `1px solid ${outline}`, borderRadius: '16px', color: '#FFFFFF' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[36px] font-bold leading-none" style={{ color: '#FFFFFF' }}>
              {timeStr}
            </div>
            <div className="mt-0.5 text-[13px]" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {dateStr}
            </div>
          </div>
          <div className="text-right flex-shrink-0 flex-col items-end gap-1">
            {weather.loading ? (
              <span className="text-[26px]">·</span>
            ) : weather.temp !== null ? (
              <>
                <span className="text-[26px] font-bold" style={{ color: '#FFFFFF' }}>
                  {weather.temp > 0 ? '+' : ''}{Math.round(weather.temp)}°C
                </span>
                <span className="text-[26px]">{weather.emoji}</span>
              </>
            ) : null}
            {weather.city && (
              <div className="text-[12px]" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {weather.city}
              </div>
            )}
          </div>
        </div>

        {/* Полоска недели */}
        <div className="mt-2 grid grid-cols-7 gap-1">
          {weekDays.map(({ date, isToday }) => {
            const hasSession = sessions.some(s => {
              const d = new Date(s.ts);
              return d.toDateString() === date.toDateString();
            });
            return (
              <div key={date.toISOString()} className="flex flex-col items-center">
                <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {WEEKDAYS[(date.getDay() + 6) % 7]}
                </span>
                <span
                  className={clsx('mt-0.5 w-7 h-7 rounded-full flex items-center justify-center text-[13px]')}
                  style={isToday
                    ? { background: circle, color: '#000000', fontWeight: '700' }
                    : { color: '#FFFFFF' }}
                >
                  {date.getDate()}
                </span>
                {hasSession && (
                  <span className="mt-0.5 w-1 h-1 rounded-full"
                    style={{ background: circle }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Поиск — скрыт если выключено в настройках */}
      {searchEnabled && (
        <div
          onKeyDown={e => { if (e.key === 'Enter') submitSearch(); }}
          className="mx-4 mt-1 mb-1"
        >
          <SearchField
            value={query}
            onChange={handleSearch}
            placeholder="Поиск упражнений, мышц…"
          />
        </div>
      )}

      {/* Сетка ярлыков — 2 колонки, карточки чёрные (B) с розовой обводкой (A) */}
      <div
        className="flex-1 fg-scroll fg-no-select px-2 pt-1 pb-4"
        onContextMenu={e => e.preventDefault()}
      >
        <div ref={gridRef} className="grid grid-cols-2 gap-0">
          {tools.map((tool, idx) => (
            <div
              key={tool.key}
              className="p-2"
              data-tile-index={idx}
              onContextMenu={e => e.preventDefault()}
              onClickCapture={e => {
                if (suppressClick.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  suppressClick.current = false;
                }
              }}
            >
              <div
                className="fg-drag-tile"
                draggable={dragEnabled && !isCoarse}
                onDragStart={() => onDragStart(idx)}
                onDragOver={e => onDragOver(e, idx)}
                onDrop={() => onDrop(idx)}
                onDragEnd={onDragEnd}
                style={{
                  opacity: dragSrc === idx ? 0.5 : 1,
                  pointerEvents: touchActive && dragSrc === idx ? 'none' : undefined,
                  transform: touchActive && dragSrc === idx ? 'scale(1.03)' : undefined,
                }}
              >
                <ToolTile tool={tool} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Мини-плеер — как <include layout="@layout/mini_player"> в activity_main.xml */}
      {player.visible && (
        <MiniPlayer state={{
          title: player.title,
          subtitle: player.subtitle,
          playing: player.playing,
          onToggle: player.toggle,
          onPrev: player.prev,
          onNext: player.next,
          onClose: player.close,
        }} />
      )}
    </div>
  );
}