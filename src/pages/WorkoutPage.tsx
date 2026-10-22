// FitGuide Web — тренировка (порт WorkoutActivity.java)
//
// Ведём подходы, вес/повторы, отдых и оценку «как зашло» по каждому упражнению.
// Оценка двигает веса программы: легко — плюс, тяжело — минус.

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight, Check, X, Clock, Dumbbell, RotateCcw, AlertTriangle, Zap } from 'lucide-react';
import { useCoachStore, useProgramsStore, useOneRmStore } from '../core/store';
import { createSession, applyFeelProgression, loadAdjust, setDelta, readinessScore, dayKey, plural } from '../core/coach';
import type { Session, SessionItem, Slot } from '../data/types';

export function WorkoutPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const coach = useCoachStore();
  const { programs, getById, save: savePrograms } = useProgramsStore();
  const oneRm = useOneRmStore();

  const programId = searchParams.get('program') || '';
  const week = parseInt(searchParams.get('week') || '1', 10);
  const dayTitle = decodeURIComponent(searchParams.get('day') || '');

  const program = getById(programId);
  const phase = program?.phases.find(p => week >= p.weekStart && week <= p.weekEnd);
  const day = phase?.days.find(d => d.title === dayTitle);

  const [session, setSession] = useState<Session | null>(null);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [showFinish, setShowFinish] = useState(false);
  const [sessionFeel, setSessionFeel] = useState<1 | 2 | 3 | null>(null);

  const checkin = coach.checkins.find(c => c.day === dayKey(Date.now()));
  const score = readinessScore(checkin);
  const delta = setDelta(program || null, week, score);

  // Создание/загрузка сессии
  useEffect(() => {
    if (!program || !day) { navigate('/'); return; }
    let existing = coach.sessions.find(s =>
      s.programId === programId && s.week === week && s.dayTitle === dayTitle);
    if (!existing) {
      existing = createSession(programId, week, dayTitle, program, day.slots);
      coach.addSession(existing);
    }
    setSession(existing);
  }, [programId, week, dayTitle, program, day]);

  // Таймер отдыха
  useEffect(() => {
    if (restEnd === null) return;
    const t = setInterval(() => {
      if (Date.now() >= restEnd) {
        setRestEnd(null);
        beep();
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
    }, 500);
    return () => clearInterval(t);
  }, [restEnd]);

  const updateItem = useCallback((slotIndex: number, updates: Partial<SessionItem>) => {
    setSession(prev => {
      if (!prev) return prev;
      const items = [...prev.items];
      const prevItem = items[slotIndex];
      const newSets = updates.sets ?? prevItem.sets;
      items[slotIndex] = { ...items[slotIndex], ...updates };
      const next: Session = { ...prev, items };
      // Пер-сет оценка: если подходов стало больше, записываем факт с текущей оценкой.
      const setFacts = (prev.setFacts || []) as Array<{ exercise: string; feel: 1 | 2 | 3; reps?: number; weightKg?: number; atMs?: number }>;
      if (newSets > (prevItem.sets || 0)) {
        const newFact = {
          exercise: prevItem.exercise,
          feel: (prevItem.feel || 3) as 1 | 2 | 3,
          reps: prevItem.reps || 0,
          weightKg: prevItem.weightKg || 0,
          atMs: Date.now(),
        };
        next.setFacts = [...setFacts, newFact];
      } else {
        next.setFacts = setFacts;
      }
      coach.updateSession(prev.id, { ...updates, items, setFacts: next.setFacts });
      return next;
    });
  }, [coach]);

  const setFeel = (slotIndex: number, feel: 1 | 2 | 3) => {
    if (!session || !program) return;
    updateItem(slotIndex, { feel });
    setSessionFeel(feel);

    // Двигаем вес в программе по оценке
    const item = session.items[slotIndex];
    const slot = day?.slots[slotIndex];
    if (!slot) return;
    const updated = applyFeelProgression(
      program, week, dayTitle, slot.exercise, item.weightKg, item.reps, feel);
    if (updated) {
      savePrograms(programs.map(p => (p.id === program.id ? updated : p)));
    }
  };

  const startRest = (slot: Slot) => {
    const minutes = parseInt(slot.rest) || 90;
    setRestEnd(Date.now() + minutes * 60000);
  };

  const finish = () => {
    if (!session) return;
    coach.updateSession(session.id, { feel: sessionFeel || undefined });
    setShowFinish(false);
    navigate('/coach');
  };

  if (!program || !day || !session) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <Dumbbell className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Тренировка не найдена</h2>
        <button onClick={() => navigate('/coach')} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          К тренеру
        </button>
      </div>
    );
  }

  const totalSets = day.slots.reduce((sum, s) => sum + (s.sets || 3), 0);
  const doneSets = session.items.reduce((sum, i) => sum + Math.min(i.sets, i.targetSets || i.sets), 0);
  const isDone = session.items.every((i, idx) => {
    const target = day.slots[idx]?.sets || 3;
    return i.sets >= target;
  });

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-24">
      {/* Шапка */}
      <div className="sticky top-0 z-10 bg-white dark:bg-dark-card border-b border-slate-200 dark:border-dark-border p-4 flex items-center justify-between">
        <button onClick={() => navigate('/coach')} className="p-2 hover:bg-slate-100 dark:hover:bg-dark-border rounded-lg">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h1 className="font-bold text-slate-900 dark:text-white">{day.title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Неделя {week} · {doneSets} / {totalSets} подходов
          </p>
        </div>
        <div className="w-10" />
      </div>

      <div className="h-1.5 bg-slate-200 dark:bg-dark-border rounded-full overflow-hidden">
        <div className="h-full bg-primary-600 transition-all duration-300"
          style={{ width: totalSets ? `${(doneSets / totalSets) * 100}%` : '0%' }} />
      </div>

      {delta !== 0 && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {delta < 0 ? 'Разгрузка или низкая готовность: на один подход меньше, вес ниже.' : ''}
        </div>
      )}

      {/* Упражнения */}
      <div className="space-y-3">
        {day.slots.map((slot, idx) => {
          const item = session.items[idx];
          const targetSets = slot.sets || 3;
          const sets = Math.max(0, targetSets + (delta < 0 ? -1 : 0));
          const isOpen = activeSlot === idx;

          return (
            <div key={`${slot.exercise}-${idx}`} className={clsx(
              'bg-white dark:bg-dark-card rounded-xl border overflow-hidden transition-colors',
              isOpen ? 'border-primary-400 dark:border-primary-600' : 'border-slate-200 dark:border-dark-border')}>
              <button onClick={() => setActiveSlot(isOpen ? null : idx)}
                className="w-full p-4 text-left flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={clsx('px-2 py-0.5 rounded text-xs font-medium',
                      slot.role === 'main' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      slot.role === 'secondary' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400')}>
                      {slot.role === 'main' ? 'Основное' : slot.role === 'secondary' ? 'Вспомогательное' : 'Изоляция'}
                    </span>
                  </div>
                  <h3 className="font-medium text-slate-900 dark:text-white">{slot.exercise}</h3>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400 mt-1">
                    <span>{sets} × {slot.reps}</span>
                    <span>⏱ {slot.rest}</span>
                    {item?.weightKg > 0 && <span>🏋️ {item.weightKg} кг</span>}
                  </div>
                </div>
                {isOpen ? <ChevronRight className="w-5 h-5 text-primary-500 flex-shrink-0" /> : <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />}
              </button>

              {isOpen && (
                <div className="border-t border-slate-200 dark:border-dark-border">
                  <div className="p-4 space-y-3">
                    {/* Вес и повторы */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Вес, кг</label>
                        <input
                          type="number" step="0.5" min="0"
                          value={item?.weightKg || 0}
                          onChange={e => updateItem(idx, { weightKg: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2.5 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white text-center font-mono text-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Повторы</label>
                        <input
                          type="number" min="0"
                          value={item?.reps || 0}
                          onChange={e => updateItem(idx, { reps: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2.5 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white text-center font-mono text-lg"
                        />
                      </div>
                    </div>

                    {/* Подходы */}
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                        Выполнено подходов: {item?.sets || 0} из {sets}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: sets }, (_, si) => (
                          <button
                            key={si}
                            onClick={() => {
                              const cur = item?.sets || 0;
                              const next = si < cur ? si : cur + 1;
                              updateItem(idx, { sets: next, targetSets });
                            }}
                            className={clsx(
                              'w-11 h-11 rounded-lg font-mono font-bold transition-colors',
                              (item?.sets || 0) > si
                                ? 'bg-green-500 text-white'
                                : 'bg-slate-100 dark:bg-dark-border text-slate-500 hover:bg-primary-100 dark:hover:bg-primary-900/30'
                            )}>
                            {si + 1}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Оценка */}
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">Как зашло?</label>
                      <div className="flex gap-2">
                        {([{ v: 1, l: '😰 Тяжело' }, { v: 2, l: '😐 В самый раз' }, { v: 3, l: '😎 Легко' }] as const).map(f => (
                          <button key={f.v} onClick={() => setFeel(idx, f.v)}
                            className={clsx('flex-1 py-2 rounded-lg text-xs font-medium transition-colors',
                              item?.feel === f.v
                                ? (f.v === 1 ? 'bg-red-500 text-white' : f.v === 2 ? 'bg-green-500 text-white' : 'bg-blue-500 text-white')
                                : 'bg-slate-100 dark:bg-dark-border text-slate-600 dark:text-slate-400')}>
                            {f.l}
                          </button>
                        ))}
                      </div>
                      {item?.feel === 1 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
                          Вес будет снижен на 10% — пока не станет легче.
                        </p>
                      )}
                      {item?.feel === 3 && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1.5">
                          Следующий раз можно добавить вес.
                        </p>
                      )}
                    </div>

                    <button onClick={() => startRest(slot)}
                      className="w-full py-2.5 bg-slate-100 dark:bg-dark-border text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-dark-border/50 flex items-center justify-center gap-2">
                      <Clock className="w-4 h-4" /> Отдых {slot.rest}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Таймер отдыха */}
      {restEnd !== null && (
        <div className="fixed bottom-20 left-4 right-4 z-30 max-w-2xl mx-auto px-4">
          <div className="bg-primary-600 text-white rounded-xl p-4 flex items-center justify-between shadow-lg">
            <div>
              <div className="text-sm opacity-90">Отдых</div>
              <div className="text-2xl font-mono font-bold">
                {Math.max(0, Math.ceil((restEnd - Date.now()) / 1000))} сек
              </div>
            </div>
            <button onClick={() => setRestEnd(null)} className="p-2 rounded-lg hover:bg-white/20">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Завершение */}
      <div className="fixed bottom-4 left-4 right-4 max-w-2xl mx-auto px-4 z-20">
        <button onClick={() => setShowFinish(true)}
          className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold text-lg hover:bg-green-700 flex items-center justify-center gap-2">
          <Check className="w-5 h-5" /> Завершить тренировку
        </button>
      </div>

      {showFinish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-dark-card rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Завершить тренировку?</h3>

            {!isDone && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mb-3 flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                Не все подходы выполнены. Тренер учтёт это в прогрессии.
              </p>
            )}

            <div className="mb-4">
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1.5">Тренировка в целом</label>
              <div className="flex gap-2">
                {([{ v: 1, l: 'Тяжело' }, { v: 2, l: 'Нормально' }, { v: 3, l: 'Легко' }] as const).map(f => (
                  <button key={f.v} onClick={() => setSessionFeel(f.v)}
                    className={clsx('flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                      sessionFeel === f.v
                        ? (f.v === 1 ? 'bg-red-500 text-white' : f.v === 2 ? 'bg-green-500 text-white' : 'bg-blue-500 text-white')
                        : 'bg-slate-100 dark:bg-dark-border text-slate-600 dark:text-slate-400')}>
                    {f.l}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowFinish(false)}
                className="flex-1 py-2 border border-slate-200 dark:border-dark-border rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-border">
                Продолжить
              </button>
              <button onClick={finish}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">
                Завершить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function beep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch { /* ignore */ }
}
