// FitGuide Web — страница прогресса

import { useState, useMemo } from 'react';
import { Dumbbell, TrendingUp, Target, Calendar, BarChart3, Trophy, RotateCcw } from 'lucide-react';
import { clsx } from 'clsx';
import { useCoachStore, useProgramsStore } from '../core/store';
import { useExercises } from '../hooks/useExercises';
import { calculate1RM } from '../core/generator';
import type { Session } from '../data/types';

export function ProgressPage() {
  const { sessions } = useCoachStore();
  const { programs } = useProgramsStore();
  const { exercises, findById } = useExercises();

  const [selectedExercise, setSelectedExercise] = useState<string>('');
  const [timeRange, setTimeRange] = useState<'month' | 'quarter' | 'year' | 'all'>('month');

  // Get all unique exercises from sessions
  const exercisedNames = useMemo(() => {
    const names = new Set<string>();
    sessions.forEach(s => s.items.forEach(i => names.add(i.exercise)));
    return Array.from(names).sort();
  }, [sessions]);

  // Filter sessions by time range
  const filteredSessions = useMemo(() => {
    const now = Date.now();
    const ranges = {
      month: 30 * 24 * 60 * 60 * 1000,
      quarter: 90 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000,
      all: Infinity,
    };
    const cutoff = now - ranges[timeRange];
    return sessions.filter(s => s.ts >= cutoff);
  }, [sessions, timeRange]);

  // Calculate e1RM progression for selected exercise
  const e1rmData = useMemo(() => {
    if (!selectedExercise) return [];
    const data: { date: number; e1rm: number; weight: number; reps: number; volume: number }[] = [];
    filteredSessions.forEach(s => {
      s.items.forEach(item => {
        if (item.exercise === selectedExercise && item.weightKg > 0 && item.reps > 0) {
          data.push({
            date: s.ts,
            e1rm: calculate1RM(item.weightKg, item.reps),
            weight: item.weightKg,
            reps: item.reps,
            volume: item.weightKg * item.reps * (item.sets || 1),
          });
        }
      });
    });
    return data.sort((a, b) => a.date - b.date);
  }, [selectedExercise, filteredSessions]);

  // Stats
  const totalVolume = useMemo(() => 
    filteredSessions.reduce((sum, s) => sum + s.items.reduce((v, i) => v + i.weightKg * i.reps * (i.sets || 1), 0), 0), [filteredSessions]);
  const totalWorkouts = filteredSessions.length;
  const uniqueExercises = exercisedNames.length;

  return (
    <div className="max-w-6xl mx-auto space-y-6 w-full max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Прогресс</h1>
          <p className="text-slate-500 dark:text-slate-400">Анализ тренировок, e1RM и объёмов</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={e => setTimeRange(e.target.value as any)}
            className="px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white text-sm"
          >
            <option value="month">Месяц</option>
            <option value="quarter">Квартал</option>
            <option value="year">Год</option>
            <option value="all">Всё время</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Тренировок</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{totalWorkouts}</p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <Dumbbell className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Упражнений</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{uniqueExercises}</p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
              <Target className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Общий объём</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{Math.round(totalVolume / 1000)}т</p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
              <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Период</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">
                {timeRange === 'month' ? '30 дн' : timeRange === 'quarter' ? '90 дн' : timeRange === 'year' ? '365 дн' : 'Все'}
              </p>
            </div>
            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
              <Calendar className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Exercise Selector + Chart */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-dark-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="font-semibold text-slate-900 dark:text-white">Динамика e1RM</h2>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-500 dark:text-slate-400">Упражнение:</label>
            <select
              value={selectedExercise}
              onChange={e => setSelectedExercise(e.target.value)}
              className="px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white min-w-[250px]"
            >
              <option value="">Выбери упражнение</option>
              {exercisedNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedExercise ? (
          <div className="p-4 h-80">
            {e1rmData.length > 0 ? (
              <div className="h-full relative">
                {/* Simple SVG Chart */}
                <svg className="w-full h-full" viewBox="0 0 800 300" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <rect width="800" height="300" fill="transparent" />
                  
                  {/* Grid */}
                  <g stroke="#e2e8f0" strokeWidth="0.5" opacity="0.5">
                    {[0, 50, 100, 150, 200, 250, 300].map(y => (
                      <line key={y} x1="60" y1={y} x2="780" y2={y} />
                    ))}
                    {[0, 1, 2, 3, 4, 5, 6, 7].map(x => (
                      <line key={x} x1={60 + x * 100} y1="0" x2={60 + x * 100} y2="300" />
                    ))}
                  </g>

                  {/* Axes */}
                  <g stroke="#94a3b8" strokeWidth="1">
                    <line x1="60" y1="0" x2="60" y2="300" />
                    <line x1="60" y1="300" x2="780" y2="300" />
                  </g>

                  {/* Y labels */}
                  <g fontSize="10" fill="#94a3b8" textAnchor="end">
                    {(() => {
                      const maxE1rm = Math.max(...e1rmData.map(d => d.e1rm));
                      const minE1rm = Math.min(...e1rmData.map(d => d.e1rm));
                      const range = maxE1rm - minE1rm || 1;
                      return [0, 0.25, 0.5, 0.75, 1].map((t, i) => (
                        <text key={i} x="55" y={300 - i * 75} dominantBaseline="middle">
                          {Math.round(minE1rm + (1 - t) * range)}
                        </text>
                      ));
                    })()}
                  </g>

                  {/* Area */}
                  {e1rmData.length > 1 && (
                    <path
                      d={(() => {
                        const maxE1rm = Math.max(...e1rmData.map(d => d.e1rm));
                        const minE1rm = Math.min(...e1rmData.map(d => d.e1rm));
                        const range = maxE1rm - minE1rm || 1;
                        const timeRange2 = e1rmData[e1rmData.length - 1].date - e1rmData[0].date || 1;
                        return 'M' + e1rmData.map((d, i) => {
                          const x = 60 + (i / (e1rmData.length - 1)) * 720;
                          const y = 300 - ((d.e1rm - minE1rm) / range) * 240;
                          return `${x},${y}`;
                        }).join(' L') + ` L${780},300 L60,300 Z`;
                      })()}
                      fill="url(#gradient)"
                    />
                  )}

                  {/* Line */}
                  {e1rmData.length > 1 && (
                    <path
                      d={(() => {
                        const maxE1rm = Math.max(...e1rmData.map(d => d.e1rm));
                        const minE1rm = Math.min(...e1rmData.map(d => d.e1rm));
                        const range = maxE1rm - minE1rm || 1;
                        return 'M' + e1rmData.map((d, i) => {
                          const x = 60 + (i / (e1rmData.length - 1)) * 720;
                          const y = 300 - ((d.e1rm - minE1rm) / range) * 240;
                          return `${x},${y}`;
                        }).join(' L');
                      })()}
                      stroke="#0ea5e9"
                      strokeWidth="2"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Points */}
                  <g>
                    {e1rmData.map((d, i) => {
                      const maxE1rm = Math.max(...e1rmData.map(d => d.e1rm));
                      const minE1rm = Math.min(...e1rmData.map(d => d.e1rm));
                      const range = maxE1rm - minE1rm || 1;
                      const x = 60 + (i / Math.max(1, e1rmData.length - 1)) * 720;
                      const y = 300 - ((d.e1rm - minE1rm) / range) * 240;
                      return (
                        <g key={i}>
                          <circle cx={x} cy={y} r={4} fill="#0ea5e9" stroke="white" strokeWidth={2} />
                        </g>
                      );
                    })}
                  </g>
                </svg>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400">
                Нет данных по этому упражнению за выбранный период
              </div>
            )}
          </div>
        ) : (
          <div className="h-80 flex items-center justify-center text-slate-500 dark:text-slate-400">
            Выбери упражнение выше, чтобы увидеть график прогресса
          </div>
        )}

        {/* Last session details */}
        {selectedExercise && e1rmData.length > 0 && (
          <div className="border-t border-slate-200 dark:border-dark-border p-4">
            <h3 className="font-medium text-slate-900 dark:text-white mb-3">Последние замеры</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-dark-border">
                    <th className="pb-2">Дата</th>
                    <th className="pb-2">Вес</th>
                    <th className="pb-2">Повторы</th>
                    <th className="pb-2">e1RM</th>
                    <th className="pb-2">Объём</th>
                  </tr>
                </thead>
                <tbody>
                  {e1rmData.slice(-10).reverse().map((d, i) => (
                    <tr key={i} className="border-b border-slate-100 dark:border-dark-border/50">
                      <td className="py-2">{new Date(d.date).toLocaleDateString('ru-RU')}</td>
                      <td className="py-2 font-mono">{d.weight} кг</td>
                      <td className="py-2 font-mono">{d.reps}</td>
                      <td className="py-2 font-mono font-semibold text-primary-600 dark:text-primary-400">{d.e1rm} кг</td>
                      <td className="py-2 font-mono">{Math.round(d.volume / 100) / 10} т</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Personal Records */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-dark-border">
          <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Личные рекорды (e1RM)
          </h2>
        </div>
        <div className="p-4">
          {(() => {
            const records: Record<string, number> = {};
            sessions.forEach(s => {
              s.items.forEach(item => {
                if (item.weightKg > 0 && item.reps > 0) {
                  const e1rm = calculate1RM(item.weightKg, item.reps);
                  if (!records[item.exercise] || e1rm > records[item.exercise]) {
                    records[item.exercise] = e1rm;
                  }
                }
              });
            });
            return Object.entries(records)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10)
              .map(([ex, e1rm], i) => (
                <div key={ex} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-dark-border/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="w-8 text-center text-slate-400 dark:text-slate-500 font-bold">{i + 1}</span>
                    <span className="font-medium text-slate-900 dark:text-white truncate max-w-[200px]">{ex}</span>
                  </div>
                  <span className="font-mono font-bold text-primary-600 dark:text-primary-400">{Math.round(e1rm)} кг</span>
                </div>
              ));
          })()}
          {Object.keys({}).length === 0 && (
            <p className="text-slate-500 dark:text-slate-400 text-center py-8">Нет данных для рекордов. Начни тренироваться!</p>
          )}
        </div>
      </div>
    </div>
  );
}