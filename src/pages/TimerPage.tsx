// FitGuide Web — «Часы и таймер» (порт TimerActivity + activity_timer.xml)
//
// Три режима, как в Android: часы, секундомер с кругами и таймер обратного отсчёта.
// Форматы совпадают: часы HH:mm:ss, секундомер mm:ss.t, таймер mm:ss.cc.

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { PageHeader } from '../components/ui';
import { playTimerBeep } from '../core/signal';

type Mode = 'clock' | 'stopwatch' | 'timer';

const MODES: { value: Mode; label: string }[] = [
  { value: 'clock', label: 'Часы' },
  { value: 'stopwatch', label: 'Секундомер' },
  { value: 'timer', label: 'Таймер' },
];

const MINUTES_PRESETS = [1, 3, 5, 10, 15, 20];

interface Lap {
  n: number;
  total: string;
  delta: string;
}

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

/** Как formatStopwatch: mm:ss.t (десятые). */
function formatStopwatch(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const tenth = Math.floor((ms % 1000) / 100);
  return `${pad(min)}:${pad(sec)}.${tenth}`;
}

/** Как formatTimer: mm:ss.cc, при часах — hh:mm:ss.cc. */
function formatTimer(ms: number) {
  const safe = Math.max(0, ms);
  const totalSec = Math.floor(safe / 1000);
  const hours = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  const centi = Math.floor((safe % 1000) / 10);
  if (hours > 0) return `${pad(hours)}:${pad(min)}:${pad(sec)}.${pad(centi)}`;
  return `${pad(min)}:${pad(sec)}.${pad(centi)}`;
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Поле ввода минут/секунд — порт bg_edit.xml: surfaceVariant + stroke, фокус — colorPrimary. */
function TimeField({
  value, onChange, placeholder, maxLength,
}: {
  value: string; onChange: (v: string) => void; placeholder: string; maxLength: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, maxLength))}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      inputMode="numeric"
      className="w-16 h-[46px] text-center text-[18px] rounded-[14px] outline-none"
      style={{
        background: 'var(--color-surface-variant)',
        border: focused ? '1.5px solid var(--p-preset-primary)' : '1px solid var(--color-stroke)',
        color: 'var(--color-text-main)',
      }}
    />
  );
}

export function TimerPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('clock');
  const [now, setNow] = useState(() => new Date());

  // --- секундомер ---
  const [swRunning, setSwRunning] = useState(false);
  const [swElapsed, setSwElapsed] = useState(0);
  const swBase = useRef(0);
  const swOffset = useRef(0);
  const lastLapBase = useRef(0);
  const lapCount = useRef(0);
  const [laps, setLaps] = useState<Lap[]>([]);

  // --- таймер ---
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerRemain, setTimerRemain] = useState(0);
  const [timerTotal, setTimerTotal] = useState(0);
  const timerBase = useRef(0);
  const timerFinishedRef = useRef(false);
  const [toast, setToast] = useState<string | null>(null);
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [preset, setPreset] = useState<number | null>(null);

  // Тик 100 мс, как Handler в Android.
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = new Date();
      setNow(t);
      if (swRunning) {
        setSwElapsed(swBase.current + (performance.now() - swOffset.current));
      }
      if (timerRunning) {
        const remain = timerTotal - (performance.now() - timerBase.current);
        if (remain <= 0) {
          setTimerRunning(false);
          setTimerRemain(0);
          if (!timerFinishedRef.current) {
            timerFinishedRef.current = true;
            playTimerBeep();
            navigator.vibrate?.(800);
            setToast('Время вышло!');
            window.setTimeout(() => setToast(null), 3000);
          }
        } else {
          setTimerRemain(remain);
        }
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [swRunning, timerRunning, timerTotal]);

  const swToggle = () => {
    if (swRunning) {
      swBase.current += performance.now() - swOffset.current;
      setSwRunning(false);
    } else {
      swOffset.current = performance.now();
      setSwRunning(true);
    }
  };

  const swReset = () => {
    setSwRunning(false);
    swBase.current = 0;
    swOffset.current = 0;
    lastLapBase.current = 0;
    lapCount.current = 0;
    setSwElapsed(0);
    setLaps([]);
  };

  const swLap = () => {
    if (!swRunning) return;
    const total = swBase.current + (performance.now() - swOffset.current);
    const delta = total - lastLapBase.current;
    lastLapBase.current = total;
    lapCount.current += 1;
    setLaps(list => [{ n: lapCount.current, total: formatStopwatch(total), delta: formatStopwatch(delta) }, ...list]);
  };

  const readTimerInput = () => {
    let mm = parseInt(minutes, 10) || 0;
    let ss = parseInt(seconds, 10) || 0;
    if (ss >= 60) {
      mm += Math.floor(ss / 60);
      ss %= 60;
    }
    return mm * 60000 + ss * 1000;
  };

  const timerToggle = () => {
    if (timerRunning) {
      setTimerRunning(false);
      setTimerTotal(timerRemain);
      return;
    }
    let total = readTimerInput();
    if (total <= 0) {
      total = timerRemain > 0 ? timerRemain : 0;
      if (total <= 0) {
        setTimerRemain(0);
        return;
      }
    } else {
      setTimerTotal(total);
      setTimerRemain(total);
    }
    timerFinishedRef.current = false;
    timerBase.current = performance.now() - (total - (timerRemain > 0 ? timerRemain : total));
    setTimerRunning(true);
  };

  const timerReset = () => {
    setTimerRunning(false);
    setTimerRemain(timerTotal);
    timerFinishedRef.current = false;
  };

  const choosePreset = (m: number) => {
    if (timerRunning) return;
    const total = m * 60000;
    setTimerTotal(total);
    setTimerRemain(total);
    setMinutes(String(m));
    setSeconds('0');
    setPreset(m);
  };

  const clockStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const dateStr = capitalize(
    new Intl.DateTimeFormat('ru-RU', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }).format(now).replace(/\s*г\.$/, '')
  );

  return (
    <div className="max-w-xl mx-auto pb-4 w-full max-w-full">
      <PageHeader title="Часы и таймер" onBack={() => navigate('/')} />

      <div className="flex justify-center gap-1.5 mt-1.5">
        {MODES.map(m => (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            className={clsx('fg-chip', mode === m.value && 'fg-chip-on')}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'clock' && (
        <div className="flex flex-col items-center justify-center px-6 py-10 min-h-[55vh]">
          <div className="text-[72px] font-medium leading-none tabular-nums" style={{ color: 'var(--color-text-main)' }}>
            {clockStr}
          </div>
          <div className="mt-2 text-[18px]" style={{ color: 'var(--color-text-secondary)' }}>
            {dateStr}
          </div>
          <div className="mt-6 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
            Точное время
          </div>
        </div>
      )}

      {mode === 'stopwatch' && (
        <div className="px-4">
          <div className="mt-4 text-center text-[56px] font-medium leading-none tabular-nums"
            style={{ color: 'var(--color-text-main)' }}>
            {formatStopwatch(swElapsed)}
          </div>

          <div className="flex gap-2 mt-5">
            <button onClick={swReset}
              className="flex-1 h-12 rounded-[24px] text-[14px] font-bold uppercase tracking-[0.089em]"
              style={{ background: 'var(--p-labels)', border: '1px solid var(--p-outline)', color: 'var(--p-labels-text)' }}>
              Сброс
            </button>
            <button onClick={swToggle}
              className="flex-[2] h-12 rounded-[24px] text-[14px] font-bold uppercase tracking-[0.089em]"
              style={{ background: 'var(--p-labels)', border: '1px solid var(--p-outline)', color: 'var(--p-labels-text)' }}>
              {swRunning ? 'Стоп' : 'Старт'}
            </button>
            <button onClick={swLap}
              className="flex-1 h-12 rounded-[24px] text-[14px] font-bold uppercase tracking-[0.089em]"
              style={{ background: 'var(--p-labels)', border: '1px solid var(--p-outline)', color: 'var(--p-labels-text)' }}>
              Круг
            </button>
          </div>

          <div className="mt-4 text-[13px] font-bold" style={{ color: 'var(--color-text-secondary)' }}>
            Круги
          </div>
          <div className="mt-1.5">
            {laps.map(l => (
              <div key={l.n} className="flex items-center px-3 py-2.5 rounded-[14px]"
                style={{ background: 'var(--color-surface-variant)', border: '1px solid var(--color-stroke)' }}>
                <span className="w-10 text-[14px] font-bold" style={{ color: 'var(--color-text-secondary)' }}>{l.n}</span>
                <span className="flex-1 text-[15px] font-bold" style={{ color: 'var(--p-preset-primary)' }}>+{l.delta}</span>
                <span className="text-[15px]" style={{ color: 'var(--color-text-main)' }}>{l.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {mode === 'timer' && (
        <div className="px-4">
          <div className="mt-1 flex gap-1.5 overflow-x-auto fg-no-scrollbar">
            {MINUTES_PRESETS.map(m => (
              <button key={m} onClick={() => choosePreset(m)}
                className={clsx('fg-chip flex-shrink-0', preset === m && 'fg-chip-on')}>
                {m} мин
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center">
            <TimeField value={minutes} onChange={setMinutes} placeholder="01" maxLength={3} />
            <span className="px-1 text-[24px]" style={{ color: 'var(--color-text-secondary)' }}> : </span>
            <TimeField value={seconds} onChange={setSeconds} placeholder="00" maxLength={2} />
            <span className="ml-3 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
              минуты и секунды
            </span>
          </div>

          <div className="mt-5 text-center text-[64px] font-medium leading-none tabular-nums"
            style={{ color: 'var(--color-text-main)' }}>
            {formatTimer(timerRemain)}
          </div>

          <div className="mt-5 flex gap-2">
            <button onClick={timerReset}
              className="flex-1 h-12 rounded-[24px] text-[14px] font-bold uppercase tracking-[0.089em]"
              style={{ background: 'var(--p-labels)', border: '1px solid var(--p-outline)', color: 'var(--p-labels-text)' }}>
              Сброс
            </button>
            <button onClick={timerToggle}
              className="flex-1 h-12 rounded-[24px] text-[14px] font-bold uppercase tracking-[0.089em]"
              style={{ background: 'var(--p-labels)', border: '1px solid var(--p-outline)', color: 'var(--p-labels-text)' }}>
              {timerRunning ? 'Пауза' : 'Старт'}
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 px-4 py-2 rounded-full text-[13px] font-medium z-40"
          style={{ background: 'var(--p-labels)', color: 'var(--p-on-labels)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
