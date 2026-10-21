// FitGuide Web — страница таймера

import { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Plus, Minus, X, Bell, BellOff, Settings, SkipForward, SkipBack, Dumbbell } from 'lucide-react';
import { clsx } from 'clsx';
import { useCoachStore } from '../core/store';

const PRESET_TIMERS = [
  { name: 'Разминка', time: 5 * 60 },
  { name: 'Отдых 60с', time: 60 },
  { name: 'Отдых 90с', time: 90 },
  { name: 'Отдых 2мин', time: 120 },
  { name: 'Отдых 3мин', time: 180 },
  { name: 'Табата', time: 4 * 60 }, // 20с работа / 10с отдых x 8
] as const;

export function TimerPage() {
  const [timeLeft, setTimeLeft] = useState(60);
  const [totalTime, setTotalTime] = useState(60);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<'countdown' | 'stopwatch'>('countdown');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrateEnabled, setVibrateEnabled] = useState(true);
  const [showPresets, setShowPresets] = useState(false);
  const [stopwatchTime, setStopwatchTime] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);

  const { activeProgramId, sessions } = useCoachStore();

  // Auto-set rest timer from active workout
  useEffect(() => {
    if (activeProgramId) {
      const activeSession = sessions.find(s => s.programId === activeProgramId && !s.finishedAt);
      if (activeSession) {
        // Could auto-detect rest time from current exercise
      }
    }
  }, [activeProgramId, sessions]);

  // Countdown timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isRunning && mode === 'countdown') {
      interval = window.setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (soundEnabled) playSound();
            if (vibrateEnabled && navigator.vibrate) navigator.vibrate([200, 100, 200]);
            setIsRunning(false);
            return totalTime;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isRunning, mode, timeLeft, totalTime, soundEnabled, vibrateEnabled]);

  // Stopwatch
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isRunning && mode === 'stopwatch') {
      interval = window.setInterval(() => {
        setStopwatchTime(prev => prev + 1);
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isRunning, mode]);

  const playSound = () => {
    // Simple beep using Web Audio API
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const formatStopwatch = (ms: number) => {
    const m = Math.floor(ms / 60).toString().padStart(2, '0');
    const s = (ms % 60).toString().padStart(2, '0');
    const cs = Math.floor((ms * 100) % 100).toString().padStart(2, '0');
    return `${m}:${s}.${cs}`;
  };

  const handlePreset = (seconds: number) => {
    setTimeLeft(seconds);
    setTotalTime(seconds);
    setIsRunning(false);
    setShowPresets(false);
  };

  const addTime = (seconds: number) => {
    setTimeLeft(prev => Math.max(0, prev + seconds));
    setTotalTime(prev => prev + seconds);
  };

  const toggleRunning = () => setIsRunning(!isRunning);
  const reset = () => {
    setIsRunning(false);
    setTimeLeft(totalTime);
    setStopwatchTime(0);
    setLaps([]);
  };
  const lap = () => {
    if (mode === 'stopwatch') {
      setLaps(prev => [stopwatchTime, ...prev]);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Таймер</h1>
          <p className="text-slate-500 dark:text-slate-400">Отдых между подходами, табата, секундомер</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={clsx('p-2 rounded-lg', soundEnabled ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-slate-100 dark:bg-dark-border text-slate-500')}
            title={soundEnabled ? 'Звук вкл' : 'Звук выкл'}
          >
            {soundEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setVibrateEnabled(!vibrateEnabled)}
            className={clsx('p-2 rounded-lg', vibrateEnabled ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'bg-slate-100 dark:bg-dark-border text-slate-500')}
            title={vibrateEnabled ? 'Вибрация вкл' : 'Вибрация выкл'}
          >
            <Bell className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-1 flex">
        <button
          onClick={() => { setMode('countdown'); setIsRunning(false); }}
          className={clsx(
            'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors',
            mode === 'countdown' ? 'bg-primary-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-border'
          )}
        >
          Обратный отсчёт
        </button>
        <button
          onClick={() => { setMode('stopwatch'); setIsRunning(false); }}
          className={clsx(
            'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors',
            mode === 'stopwatch' ? 'bg-primary-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-border'
          )}
        >
          Секундомер
        </button>
      </div>

      {/* Timer Display */}
      <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-dark-border p-8 relative overflow-hidden">
        {/* Background ring */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 280 280">
          <circle
            cx="140" cy="140" r="110"
            stroke="#e2e8f0"
            strokeWidth="8"
            fill="none"
            className="dark:stroke-dark-border"
          />
          {mode === 'countdown' && totalTime > 0 && (
            <circle
              cx="140" cy="140" r="110"
              stroke="#0ea5e9"
              strokeWidth="8"
              fill="none"
              strokeDasharray={2 * Math.PI * 110}
              strokeDashoffset={2 * Math.PI * 110 * (1 - timeLeft / totalTime)}
              strokeLinecap="round"
              className="transform -rotate-90 transition-all duration-1000 ease-linear"
            />
          )}
        </svg>

        <div className="relative z-10 flex flex-col items-center justify-center h-64">
          <div className="text-6xl font-mono font-bold text-slate-900 dark:text-white tabular-nums">
            {mode === 'countdown' ? formatTime(timeLeft) : formatStopwatch(stopwatchTime)}
          </div>
          {mode === 'countdown' && totalTime > 0 && (
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              из {formatTime(totalTime)}
            </div>
          )}
        </div>

        {/* Quick time adjust */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <button onClick={() => addTime(-10)} className="p-2 rounded-lg bg-slate-100 dark:bg-dark-border hover:bg-slate-200 dark:hover:bg-dark-border/50" disabled={isRunning}>
            <Minus className="w-5 h-5" /> 10с
          </button>
          <button onClick={() => addTime(10)} className="p-2 rounded-lg bg-slate-100 dark:bg-dark-border hover:bg-slate-200 dark:hover:bg-dark-border/50" disabled={isRunning}>
            +10с <Plus className="w-5 h-5" />
          </button>
          <button onClick={() => addTime(30)} className="p-2 rounded-lg bg-slate-100 dark:bg-dark-border hover:bg-slate-200 dark:hover:bg-dark-border/50" disabled={isRunning}>
            +30с
          </button>
          <button onClick={() => addTime(60)} className="p-2 rounded-lg bg-slate-100 dark:bg-dark-border hover:bg-slate-200 dark:hover:bg-dark-border/50" disabled={isRunning}>
            +1м
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={reset}
          className="p-3 rounded-xl bg-slate-100 dark:bg-dark-border text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-dark-border/50"
          disabled={!isRunning && ((mode === 'countdown' && timeLeft === totalTime) || (mode === 'stopwatch' && stopwatchTime === 0))}
        >
          <RotateCcw className="w-6 h-6" />
        </button>
        <button
          onClick={lap}
          className={clsx(
            'p-3 rounded-xl text-white font-medium transition-colors',
            mode === 'stopwatch' && isRunning ? 'bg-primary-600 hover:bg-primary-700' : 'bg-slate-300 dark:bg-slate-600 cursor-not-allowed'
          )}
          disabled={!(mode === 'stopwatch' && isRunning)}
        >
          <SkipForward className="w-6 h-6" />
        </button>
        <button
          onClick={toggleRunning}
          className={clsx(
            'w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-xl transition-all shadow-lg',
            isRunning ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
          )}
        >
          {isRunning ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
        </button>
      </div>

      {/* Presets */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-slate-900 dark:text-white">Быстрые таймеры</h3>
          <button
            onClick={() => setShowPresets(!showPresets)}
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            {showPresets ? 'Скрыть' : 'Показать'}
          </button>
        </div>
        {showPresets && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {PRESET_TIMERS.map(preset => (
              <button
                key={preset.name}
                onClick={() => handlePreset(preset.time)}
                className="p-3 rounded-lg border border-slate-200 dark:border-dark-border text-left hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
              >
                <div className="font-medium text-slate-900 dark:text-white">{preset.name}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400 font-mono">{formatTime(preset.time)}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Laps */}
      {mode === 'stopwatch' && laps.length > 0 && (
        <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-dark-border flex items-center justify-between">
            <h3 className="font-medium text-slate-900 dark:text-white">Круги</h3>
            <button onClick={() => setLaps([])} className="text-sm text-red-600 hover:underline">Очистить</button>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-dark-border max-h-64 overflow-y-auto">
            {laps.slice().reverse().map((lapTime, i) => (
              <div key={i} className="px-4 py-2 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Круг {laps.length - i}</span>
                <span className="font-mono text-slate-900 dark:text-white">{formatStopwatch(lapTime)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Auto-rest from workout hint */}
      {activeProgramId && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Dumbbell className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <p className="font-medium text-blue-800 dark:text-blue-300">Активная тренировка</p>
              <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                Таймер может автоматически подставлять время отдыха из текущего упражнения.
                Перейди в <a href="/workout" className="underline hover:text-blue-600">тренировку</a>, чтобы увидеть.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}