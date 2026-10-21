// FitGuide Web — страница тренировки (активный лог)

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check, X, Plus, Minus, Save, RotateCcw, Clock, AlertTriangle, Dumbbell, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import { useCoachStore, useProgramsStore } from '../core/store';
import { createSession, finishSession, applyFeelProgression, type Session, type SessionItem } from '../core/coach';
import type { Program } from '../data/types';

interface WorkoutParams {
  programId: string;
  week: number;
  dayTitle: string;
}

export function WorkoutPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { sessions, addSession, updateSession, feels } = useCoachStore();
  const { programs, getById, save } = useProgramsStore();

  const params: WorkoutParams = {
    programId: searchParams.get('program') || '',
    week: parseInt(searchParams.get('week') || '1'),
    dayTitle: decodeURIComponent(searchParams.get('day') || ''),
  };

  const program = params.programId ? getById(params.programId) : null;
  const phase = program?.phases.find(p => params.week >= p.weekStart && params.week <= p.weekEnd);
  const day = phase?.days.find(d => d.title === params.dayTitle);

  const [session, setSession] = useState<Session | null>(null);
  const [activeSet, setActiveSet] = useState<{ slotIndex: number; setIndex: number } | null>(null);
  const [restTimer, setRestTimer] = useState<{ endTime: number; slotIndex: number; setIndex: number } | null>(null);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  // Load or create session
  useEffect(() => {
    if (!program || !day) {
      navigate('/');
      return;
    }

    let existing = sessions.find(s =>
      s.programId === params.programId &&
      s.week === params.week &&
      s.dayTitle === params.dayTitle
    );

    if (!existing) {
      existing = createSession(params.programId, params.week, params.dayTitle, program);
      addSession(existing);
    }
    setSession(existing);
  }, [params, program, day, sessions, addSession, navigate]);

  // Rest timer countdown
  useEffect(() => {
    if (!restTimer) return;
    const interval = setInterval(() => {
      setRestTimer(t => {
        if (!t) return null;
        const remaining = t.endTime - Date.now();
        if (remaining <= 0) {
          // Play notification sound
          new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAA=').play().catch(() => {});
          return null;
        }
        return t;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [restTimer]);

  const updateItem = useCallback((slotIndex: number, setIndex: number, updates: Partial<SessionItem>) => {
    if (!session) return;
    const newItems = [...session.items];
    const item = { ...newItems[slotIndex] };
    Object.assign(item, updates);
    newItems[slotIndex] = item;
    const newSession = { ...session, items: newItems };
    setSession(newSession);
    updateSession(session.id, { items: newItems });
  }, [session, updateSession]);

  const startRestTimer = (slotIndex: number, setIndex: number, restStr: string) => {
    const minutes = parseInt(restStr) || 90;
    const endTime = Date.now() + minutes * 1000;
    setRestTimer({ endTime, slotIndex, setIndex });
    setActiveSet({ slotIndex, setIndex });
  };

  const completeSet = (slotIndex: number, setIndex: number) => {
    updateItem(slotIndex, setIndex, { feel: 2 }); // default "в самый раз"
    const slot = day?.slots[slotIndex];
    if (slot && setIndex === (slot.sets || 3) - 1) {
      // Last set - ask feel
    }
    if (restTimer?.slotIndex === slotIndex && restTimer?.setIndex === setIndex) {
      setRestTimer(null);
    }
  };

  const handleFeel = (slotIndex: number, feel: 1 | 2 | 3) => {
    if (!session || !program) return;
    const item = session.items[slotIndex];
    updateItem(slotIndex, session.items[slotIndex].sets - 1, { feel });
    
    // Apply progression to program
    const updatedProgram = applyFeelProgression(
      program,
      params.week,
      params.dayTitle,
      item.exercise,
      item.weightKg,
      item.reps.toString(),
      feel
    );
    if (updatedProgram) {
      save([...programs.map(p => p.id === program.id ? updatedProgram : p)]);
    }
  };

  const finishWorkout = () => {
    if (!session) return;
    const finished = finishSession(session);
    updateSession(session.id, { finishedAt: finished.finishedAt });
    setShowFinishConfirm(false);
    navigate(`/coach`);
  };

  if (!program || !day || !session) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <Dumbbell className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Тренировка не найдена</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-4">Проверьте параметры и попробуйте снова</p>
        <button onClick={() => navigate('/coach')} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          К тренеру
        </button>
      </div>
    );
  }

  const isFinished = !!session.finishedAt;
  const completedSets = session.items.reduce((sum, item) => sum + (item.sets || 0), 0);
  const totalSets = day.slots.reduce((sum, slot) => sum + (slot.sets || 0), 0);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-dark-card border-b border-slate-200 dark:border-dark-border p-4 flex items-center justify-between">
        <button onClick={() => navigate('/coach')} className="p-2 hover:bg-slate-100 dark:hover:bg-dark-border rounded-lg">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center flex-1">
          <h1 className="font-bold text-slate-900 dark:text-white">{day.title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Неделя {params.week} · {program.name}
          </p>
        </div>
        <div className="w-10" />
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-slate-500 dark:text-slate-400">Прогресс тренировки</span>
          <span className="font-mono font-bold text-slate-900 dark:text-white">{completedSets} / {totalSets} подходов</span>
        </div>
        <div className="h-2 bg-slate-200 dark:bg-dark-border rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-600 rounded-full transition-all duration-300"
            style={{ width: totalSets > 0 ? `${(completedSets / totalSets) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Exercises */}
      <div className="px-4 pb-4 space-y-4">
        {day.slots.map((slot, slotIndex) => {
          const item = session.items[slotIndex];
          const sets = slot.sets || 3;
          const isActive = activeSet?.slotIndex === slotIndex;

          return (
            <div key={slot.exercise} className={clsx(
              'bg-white dark:bg-dark-card rounded-xl border overflow-hidden transition-all',
              isActive ? 'border-primary-300 dark:border-primary-700 ring-2 ring-primary-500/20' : 'border-slate-200 dark:border-dark-border'
            )}>
              {/* Exercise header */}
              <div className="p-4 bg-slate-50 dark:bg-dark-border/50 border-b border-slate-200 dark:border-dark-border flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={clsx(
                      'px-2 py-0.5 rounded text-xs font-medium',
                      slot.role === 'main' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      slot.role === 'secondary' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    )}>
                      {slot.role === 'main' ? 'Основное' : slot.role === 'secondary' ? 'Вспомогательное' : 'Изоляция'}
                    </span>
                    {slot.workSec && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        ⏱ {slot.workSec}с
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-slate-900 dark:text-white truncate">{slot.exercise}</h3>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400 mt-1">
                    <span>{sets} × {slot.reps}</span>
                    <span>⏱ {slot.rest}</span>
                    {item?.weightKg > 0 && <span>🏋️ {item.weightKg} кг</span>}
                  </div>
                </div>
                {!isFinished && (
                  <button
                    onClick={() => setActiveSet(isActive ? null : { slotIndex, setIndex: 0 })}
                    className={clsx(
                      'p-2 rounded-lg transition-colors flex-shrink-0',
                      isActive ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-border'
                    )}
                  >
                    {isActive ? <X className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </button>
                )}
              </div>

              {/* Sets */}
              <div className={clsx('divide-y divide-slate-200 dark:divide-dark-border', isActive ? '' : 'hidden')}>
                {Array.from({ length: sets }, (_, setIndex) => {
                  const setData = item;
                  const isCurrentSet = activeSet?.setIndex === setIndex;
                  const isCompleted = setData && setIndex < (setData.sets || 0);
                  const setFeel = setData?.feel;

                  return (
                    <div key={setIndex} className={clsx(
                      'p-4 flex items-center justify-between gap-4 transition-colors',
                      isCurrentSet ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                    )}>
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button
                          onClick={() => {
                            if (!isFinished) completeSet(slotIndex, setIndex);
                          }}
                          className={clsx(
                            'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-all',
                            isCompleted ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
                            isCurrentSet ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 ring-2 ring-primary-500' :
                            'bg-slate-100 dark:bg-dark-border text-slate-400'
                          )}
                          disabled={isFinished}
                        >
                          {isCompleted ? <Check className="w-5 h-5" /> : <span className="font-mono text-lg">{setIndex + 1}</span>}
                        </button>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-slate-400 dark:text-slate-500">Вес, кг</label>
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                value={setData?.weightKg || 0}
                                onChange={e => updateItem(slotIndex, setIndex, { weightKg: parseFloat(e.target.value) || 0 })}
                                disabled={isFinished}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white text-center font-mono text-lg focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-400 dark:text-slate-500">Повторы</label>
                              <input
                                type="number"
                                min="0"
                                value={setData?.reps || parseInt(slot.reps) || 8}
                                onChange={e => updateItem(slotIndex, setIndex, { reps: parseInt(e.target.value) || 0 })}
                                disabled={isFinished}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white text-center font-mono text-lg focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                              />
                            </div>
                          </div>
                          {!isFinished && isCurrentSet && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500 dark:text-slate-400">Как зашло:</span>
                              {[1, 2, 3].map(f => (
                                <button
                                  key={f}
                                  onClick={() => handleFeel(slotIndex, f as 1 | 2 | 3)}
                                  className={clsx(
                                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                                    setFeel === f
                                      ? (f === 1 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                         f === 2 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                         'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400')
                                      : 'bg-slate-100 dark:bg-dark-border text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-dark-border/50'
                                  )}
                                >
                                  {f === 1 ? '😰 Тяжело' : f === 2 ? '😐 В самый раз' : '😎 Легко'}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Rest timer */}
                      {restTimer?.slotIndex === slotIndex && restTimer?.setIndex === setIndex && (
                        <div className="flex flex-col items-end gap-2 min-w-[100px]">
                          <div className="text-center">
                            <div className="text-2xl font-mono font-bold text-primary-600 dark:text-primary-400">
                              {Math.ceil((restTimer.endTime - Date.now()) / 1000)}с
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Отдых</div>
                          </div>
                          <button
                            onClick={() => setRestTimer(null)}
                            className="px-3 py-1 text-xs text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                          >
                            Отмена
                          </button>
                        </div>
                      )}
                      {setIndex === sets - 1 && !isFinished && !restTimer && (
                        <button
                          onClick={() => startRestTimer(slotIndex, setIndex, slot.rest)}
                          className="px-3 py-2 bg-slate-100 dark:bg-dark-border text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-dark-border/50 flex items-center gap-1 text-sm"
                        >
                          <Clock className="w-4 h-4" />
                          Отдых
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Finish button */}
      {!isFinished && (
        <div className="fixed bottom-4 left-4 right-4 max-w-2xl mx-auto px-4 pb-4 z-20">
          <button
            onClick={() => setShowFinishConfirm(true)}
            className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold text-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" />
            Завершить тренировку
          </button>
        </div>
      )}

      {isFinished && (
        <div className="fixed bottom-4 left-4 right-4 max-w-2xl mx-auto px-4 pb-4 z-20">
          <div className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-xl p-6 text-center">
            <Check className="w-12 h-12 text-green-600 dark:text-green-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-green-800 dark:text-green-300 mb-1">Тренировка завершена!</h3>
            <p className="text-green-700 dark:text-green-400 mb-4">Отличная работа! Данные сохранены.</p>
            <button onClick={() => navigate('/coach')} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              К тренеру
            </button>
          </div>
        </div>
      )}

      {/* Finish confirm modal */}
      {showFinishConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-dark-card rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Завершить тренировку?</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">Прогресс сохранен. Ты сможешь продолжить позже.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowFinishConfirm(false)} className="flex-1 py-2 border border-slate-200 dark:border-dark-border rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-border">
                Продолжить
              </button>
              <button onClick={finishWorkout} className="flex-1 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">
                Завершить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}