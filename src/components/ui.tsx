// FitGuide Web — общие компоненты интерфейса (порт Android-разметки)

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  slotColor, circleGradient, topBarGradient, contrastOn, subscribePalette, getPalette,
  type SlotName,
} from '../core/palette';

// ---------------------------------------------------------------- палитра

/**
 * Путь к файлу в public — относительный.
 * Приложение может лежать в подпапке (GitHub Pages /repo/): абсолютный
 * asset('icons/x.svg') ушёл бы в корень домена и дал 404.
 */
export function asset(path: string): string {
  const base = import.meta.env.BASE_URL || './';
  return base.endsWith('/') ? `${base}${path}` : `${base}/${path}`;
}

/** Подставляет цвета палитры в CSS-переменные. */
export function usePaletteVars() {
  const [, force] = useState(0);
  useEffect(() => subscribePalette(() => force(x => x + 1)), []);

  const outline = slotColor('outline');
  const labels = slotColor('labelsButtons');
  const labelsText = slotColor('labelsText');
  const circle = circleGradient();
  const grad = topBarGradient();

  const root = document.documentElement;
  root.style.setProperty('--p-outline', outline);
  root.style.setProperty('--p-labels', labels);
  root.style.setProperty('--p-labels-text', labelsText);
  root.style.setProperty('--p-circle-from', circle.from);
  root.style.setProperty('--p-circle-to', circle.to);
  root.style.setProperty('--p-on-labels', contrastOn(labels));
  root.style.setProperty('--p-grad-from', grad.from);
  root.style.setProperty('--p-grad-to', grad.to);
  root.style.setProperty('--p-ripple', hexToRgba(labels, 0.12));
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  if (h.length < 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ---------------------------------------------------------------- иконка-маска

/**
 * Иконка через CSS mask: цвет задаётся снаружи, поэтому иконка перекрашивается
 * вместе с палитрой (в Android вектор заливается цветом темы).
 */
export function MaskIcon({ src, color, size = 24, className }: {
  src: string; color: string; size?: number; className?: string;
}) {
  return (
    <span
      className={clsx('block flex-shrink-0', className)}
      style={{
        width: size, height: size,
        WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`,
        WebkitMaskSize: 'contain', maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
        backgroundColor: color,
      }}
    />
  );
}

// ---------------------------------------------------------------- верхняя панель

export function TopBar({ title, subtitle, right }: {
  title: string; subtitle?: string; right?: ReactNode;
}) {
  return (
    <header className="fg-topbar safe-top px-5 pt-2.5 pb-2.5 flex items-center gap-2 sticky top-0 z-30">
      <div className="flex-1 min-w-0">
        <div className="fg-topbar-title truncate">{title}</div>
        {subtitle && <div className="fg-topbar-sub truncate">{subtitle}</div>}
      </div>
      {right}
    </header>
  );
}

/** Кнопка-иконка в верхней панели (42dp, как в Android). */
export function TopBarButton({ onClick, icon, label }: { onClick: () => void; icon: string; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="p-2.5 rounded-full active:bg-white/15"
    >
      <span
        className="block w-[26px] h-[26px]"
        style={{
          WebkitMaskImage: `url(${icon})`, maskImage: `url(${icon})`,
          WebkitMaskSize: 'contain', maskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
          backgroundColor: '#fff',
        }}
      />
    </button>
  );
}

// ---------------------------------------------------------------- плитка ярлыка

export interface ToolDef {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  to: string;
}

export function ToolTile({ tool }: { tool: ToolDef }) {
  return (
    <Link to={tool.to} className="block">
      <div className="fg-tile flex flex-col items-center text-center px-4 py-[18px] h-full">
        <div className="fg-circle">
          <span
            className="block w-[26px] h-[26px]"
            style={{
              WebkitMaskImage: `url(${tool.icon})`, maskImage: `url(${tool.icon})`,
              WebkitMaskSize: 'contain', maskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
              backgroundColor: 'var(--p-labels-text)',
            }}
          />
        </div>
        <div className="mt-3 text-[15px] font-bold leading-tight" style={{ color: 'var(--p-labels-text)' }}>
          {tool.title}
        </div>
        <div className="mt-0.5 text-[12px] leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
          {tool.subtitle}
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------- мини-плеер

export interface MiniPlayerState {
  title: string;
  subtitle: string;
  playing: boolean;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

export function MiniPlayer({ state }: { state: MiniPlayerState }) {
  return (
    <div className="px-4 my-1">
      <div className="fg-miniplayer flex items-center gap-2 py-1.5 pl-4 pr-2">
        <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--color-surface-variant)' }}>
          <MaskIcon src={asset('icons/ic_music.svg')} color="var(--p-labels-text)" size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold truncate" style={{ color: 'var(--color-text-main)' }}>
            {state.title}
          </div>
          <div className="text-[12px] truncate mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            {state.subtitle}
          </div>
        </div>
        <button onClick={state.onPrev} aria-label="Предыдущий" className="p-2.5">
          <MaskIcon src={asset('icons/ic_skip_prev.svg')} color="var(--p-labels-text)" />
        </button>
        <button onClick={state.onToggle} aria-label="Играть/пауза" className="p-3">
          <MaskIcon src={asset(state.playing ? 'icons/ic_pause.svg' : 'icons/ic_play.svg')} color="var(--p-labels-text)" />
        </button>
        <button onClick={state.onNext} aria-label="Следующий" className="p-2.5">
          <MaskIcon src={asset('icons/ic_skip_next.svg')} color="var(--p-labels-text)" />
        </button>
        <button onClick={state.onClose} aria-label="Закрыть" className="p-2.5">
          <MaskIcon src={asset('icons/ic_close.svg')} color="var(--p-labels-text)" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- поле поиска

export function SearchField({ value, onChange, placeholder, onFocus }: {
  value: string; onChange: (v: string) => void; placeholder: string; onFocus?: () => void;
}) {
  return (
    <div className="px-4 my-1">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={onFocus}
          placeholder={placeholder}
          className="fg-input pr-10"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            aria-label="Очистить"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full"
          >
            <img src={asset('icons/ic_close.svg')} alt="" className="w-4 h-4 opacity-50" />
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- аналоговые часы

export function AnalogClock({ size = 170, style = 'classic' }: { size?: number; style?: string }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const h = now.getHours();
  const m = now.getMinutes();
  const s = now.getSeconds();
  const secAngle = s * 6;
  const minAngle = m * 6 + s * 0.1;
  const hourAngle = ((h % 12) + m / 60) * 30;

  const ticks = Array.from({ length: 60 }, (_, i) => {
    const isHour = i % 5 === 0;
    const len = isHour ? 12 : 5;
    const w = isHour ? 2 : 1;
    return { i, isHour, len, w };
  });

  return (
    <svg width={size} height={size} viewBox="0 0 200 200" style={{ display: 'block' }}>
      <circle cx="100" cy="100" r="96" fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth="3" />
      {ticks.map(t => {
        const a = (t.i * 6 - 90) * (Math.PI / 180);
        const r1 = 90, r2 = 90 - t.len;
        return (
          <line
            key={t.i}
            x1={100 + r1 * Math.cos(a)} y1={100 + r1 * Math.sin(a)}
            x2={100 + r2 * Math.cos(a)} y2={100 + r2 * Math.sin(a)}
            stroke="rgba(255,255,255,0.9)" strokeWidth={t.w} strokeLinecap="round"
          />
        );
      })}
      {/* часовая */}
      <line x1="100" y1="100"
        x2={100 + 45 * Math.cos((hourAngle - 90) * (Math.PI / 180))}
        y2={100 + 45 * Math.sin((hourAngle - 90) * (Math.PI / 180))}
        stroke="#fff" strokeWidth="6" strokeLinecap="round" />
      {/* минутная */}
      <line x1="100" y1="100"
        x2={100 + 70 * Math.cos((minAngle - 90) * (Math.PI / 180))}
        y2={100 + 70 * Math.sin((minAngle - 90) * (Math.PI / 180))}
        stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      {/* секундная */}
      <line x1="100" y1="100"
        x2={100 + 78 * Math.cos((secAngle - 90) * (Math.PI / 180))}
        y2={100 + 78 * Math.sin((secAngle - 90) * (Math.PI / 180))}
        stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="100" cy="100" r="5" fill="#fff" />
    </svg>
  );
}

// ---------------------------------------------------------------- экран-обёртка

export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('min-h-screen flex flex-col', className)}>
      {children}
    </div>
  );
}
