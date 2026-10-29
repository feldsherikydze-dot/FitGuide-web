// FitGuide Web — главный экран (порт MainActivity.java)
//
// Структура как в activity_main.xml:
//   верхняя панель (градиент) → карточка часов/погоды/недели →
//   поиск → сетка ярлыков → мини-плеер.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { useProfileStore, useProgramsStore, useCoachStore } from '../core/store';
import { usePaletteVars, TopBar, TopBarButton, ToolTile, MiniPlayer, SearchField, type ToolDef, asset } from '../components/ui';
import { getJSON, setJSON, KEYS, getString } from '../core/storage';
import { usePlayer } from '../core/player';
import { useWeather } from '../core/weather';

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

  const [now, setNow] = useState(new Date());
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState<string[]>(TOOLS.map(t => t.key));
  const [dragEnabled, setDragEnabled] = useState(() => getString('home_drag_enabled', '1') !== '0');
  const [searchEnabled, setSearchEnabled] = useState(() => getString('home_search_enabled', '1') !== '0');
  const [dragSrc, setDragSrc] = useState<number | null>(null);
  const player = usePlayer();
  const weather = useWeather(profile?.city || '');

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

  // Неделя: 7 дней, сегодняшний подсвечен
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
    <div className="min-h-screen flex flex-col">
      {/* Верхняя панель */}
      <TopBar
        title="FitGuide"
        subtitle="Создай лучшую версию себя"
        right={
          <>
            <TopBarButton onClick={() => navigate('/profile')} icon={asset('icons/ic_tool_profile.svg')} label="Профиль" />
            <TopBarButton onClick={() => navigate('/settings')} icon={asset('icons/ic_settings.svg')} label="Настройки" />
          </>
        }
      />

      {/* Карточка: часы, погода, неделя */}
      <div className="mx-4 mt-2.5 mb-1.5 fg-banner px-3.5 py-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[36px] font-bold leading-none"
              style={{ color: 'var(--p-on-circle)', textShadow: '1px 1px 2px rgba(0,0,0,0.2)' }}>
              {timeStr}
            </div>
            <div className="mt-0.5 text-[13px] capitalize" style={{ color: 'var(--color-text-secondary)' }}>
              {dateStr}
            </div>
          </div>
          <div className="text-right flex-shrink-0 flex items-center gap-1.5">
            {weather.loading ? (
              <span className="text-[26px]">·</span>
            ) : weather.temp !== null ? (
              <>
                <span className="text-[26px] font-bold" style={{ color: 'var(--p-on-circle)' }}>
                  {weather.temp > 0 ? '+' : ''}{Math.round(weather.temp)}°C
                </span>
                <span className="text-[26px]">{weather.emoji}</span>
              </>
            ) : null}
            {weather.city && (
              <div className="absolute" />
            )}
          </div>
        </div>
        {weather.city && (
          <div className="text-[12px] text-right" style={{ color: 'var(--color-text-secondary)' }}>
            {weather.city}
          </div>
        )}

        {/* Полоска недели */}
        <div className="mt-2 grid grid-cols-7 gap-1">
          {weekDays.map(({ date, isToday }) => {
            const hasSession = sessions.some(s => {
              const d = new Date(s.ts);
              return d.toDateString() === date.toDateString();
            });
            return (
              <div key={date.toISOString()} className="flex flex-col items-center">
                <span className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                  {WEEKDAYS[(date.getDay() + 6) % 7]}
                </span>
                <span
                  className={clsx('mt-0.5 w-7 h-7 rounded-full flex items-center justify-center text-[13px]',
                    isToday ? 'font-bold' : '')}
                  style={isToday
                    ? { background: 'var(--p-circle-from)', color: '#fff' }
                    : { color: 'var(--color-text-main)' }}
                >
                  {date.getDate()}
                </span>
                {hasSession && (
                  <span className="mt-0.5 w-1 h-1 rounded-full"
                    style={{ background: 'var(--p-circle)' }} />
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
        >
          <SearchField
            value={query}
            onChange={handleSearch}
            placeholder="Поиск упражнений, мышц…"
          />
        </div>
      )}

      {/* Сетка ярлыков */}
      <div className="flex-1 fg-scroll px-2 pt-1 pb-4">
        <div className="grid grid-cols-2 gap-0">
          {tools.map((tool, idx) => (
            <div key={tool.key} className="p-2">
              <div
                draggable={dragEnabled}
                onDragStart={() => onDragStart(idx)}
                onDragOver={e => onDragOver(e, idx)}
                onDrop={() => onDrop(idx)}
                onDragEnd={onDragEnd}
                style={{ opacity: dragSrc === idx ? 0.5 : 1 }}
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
