// FitGuide Web — тренировка (порт WorkoutActivity.java, 1:1 по разметке activity_workout.xml)
//
// Поток как в APK 1.16:
//   подходы/повторы/вес → «Подход выполнен» → «Как прошёл подход?»
//   → оценка → факт подхода → сразу таймер отдыха (без промежуточного экрана).
// Оценка хранится по каждому подходу (setFeels + setFacts) и уходит тренеру.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { ChevronLeft } from 'lucide-react';
import { useCoachStore, useProgramsStore, useOneRmStore, useProfileStore } from '../core/store';
import { createSession, applyFeelProgression, setDelta, readinessScore, dayKey } from '../core/coach';
import { useExercises } from '../hooks/useExercises';
import type { Session, SessionItem, Slot } from '../data/types';

const FEELS = [
  { v: 1 as const, label: 'Тяжело' },
  { v: 2 as const, label: 'В самый раз' },
  { v: 3 as const, label: 'Легко' },
];

function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/** «90 сек», «2 мин», «1:30» → секунды. */
function parseRest(v: string | undefined, fallback = 90): number {
  if (!v) return fallback;
  const s = String(v).trim().toLowerCase();
  const clock = s.match(/^(\d+):(\d+)$/);
  if (clock) return parseInt(clock[1], 10) * 60 + parseInt(clock[2], 10);
  const min = s.match(/(\d+(?:[.,]\d+)?)\s*мин/);
  if (min) return Math.round(parseFloat(min[1].replace(',', '.')) * 60);
  const sec = s.match(/(\d+)\s*сек/);
  if (sec) return parseInt(sec[1], 10);
  const num = s.match(/\d+/);
  return num ? parseInt(num[0], 10) : fallback;
}

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch { /* звук не критичен */ }
}

function roundHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

export function WorkoutPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const coach = useCoachStore();
  const { programs, getById, save: savePrograms } = useProgramsStore();
  const oneRm = useOneRmStore();
  const { profile } = useProfileStore();
  const { exercises } = useExercises();

  const programId = searchParams.get('program') || '';
  const week = parseInt(searchParams.get('week') || '1', 10);
  const dayTitle = decodeURIComponent(searchParams.get('day') || '');

  const program = getById(programId);
  const phase = program?.phases.find(p => week >= p.weekStart && week <= p.weekEnd);
  const day = phase?.days.find(d => d.title === dayTitle);

  const [session, setSession] = useState<Session | null>(null);
  const [idx, setIdx] = useState(0);
  const [, setTick] = useState(0);
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [restTotal, setRestTotal] = useState(0);
  const [restPaused, setRestPaused] = useState(false);
  const [restKind, setRestKind] = useState<'set' | 'ex'>('set');
  const [awaitingFeel, setAwaitingFeel] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [sessionFeel, setSessionFeel] = useState<1 | 2 | 3 | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [weightsOpen, setWeightsOpen] = useState(false);
  const [toast, setToast] = useState('');

  const exStartRef = useRef(Date.now());
  const setStartRef = useRef(Date.now());
  // Накопленное активное время: как activeSec в WorkoutSession.java.
  const workSecRef = useRef(0);
  const exSecRef = useRef(0);
  const lastSetSecRef = useRef(0);

  const checkin = coach.checkins.find(c => c.day === dayKey(Date.now()));
  const score = readinessScore(checkin);
  const delta = setDelta(program || null, week, score);

  // ------------------------------------------------------------ сессия
  useEffect(() => {
    if (!program || !day) return;
    const valid = coach.sessions.find(s =>
      s.programId === programId && s.week === week && s.dayTitle === dayTitle
      && s.items.length === day.slots.length);
    if (valid) {
      setSession(valid);
      return;
    }
    const created = createSession(programId, week, dayTitle, program, day.slots);
    coach.addSession(created);
    setSession(created);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId, week, dayTitle, program?.id, day?.title]);

  // ------------------------------------------------------------ тикеры
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const restLeft = restEnd === null ? 0 : Math.max(0, Math.ceil((restEnd - Date.now()) / 1000));

  // Отдых закончился — переходим к следующему упражнению, если текущее закрыто.
  useEffect(() => {
    if (restEnd === null || restPaused) return;
    if (Date.now() < restEnd) return;
    setRestEnd(null);
    beep();
    if (navigator.vibrate) navigator.vibrate([180, 90, 180]);
    if (!session || !day) return;
    const it = session.items[idx];
    const target = it?.targetSets || day.slots[idx]?.sets || 3;
    if (it && it.sets >= target && idx + 1 < session.items.length) {
      setIdx(idx + 1);
      setHintOpen(false);
      exStartRef.current = Date.now();
      setStartRef.current = Date.now();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restEnd, restPaused, restLeft]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // ------------------------------------------------------------ данные
  const curItem = session?.items[idx];
  const curSlot: Slot | undefined = day?.slots[idx];
  const targetSets = curItem?.targetSets || curSlot?.sets || 3;
  const doneSets = curItem?.sets || 0;
  const exerciseDone = doneSets >= targetSets;

  const totalSets = useMemo(
    () => session ? session.items.reduce((n, it) => n + Math.max(it.targetSets, 1), 0) : 0,
    [session],
  );
  const completedSets = useMemo(
    () => session ? session.items.reduce((n, it) => n + it.sets, 0) : 0,
    [session],
  );

  const exercise = exercises.find(e => e.name === curItem?.exercise);

  const elapsed = session ? Math.max(0, Math.floor((Date.now() - session.ts) / 1000)) : 0;

  // MET-оценка как в WorkoutSession.kcalPerSec(). Считаем только активное время,
  // как activeSec: отдых и простой в калории не идут.
  const kcalPerSec = 5.0 * 3.5 * Math.max(30, profile?.weightKg || 75) / 200 / 60;
  const liveSec = restEnd === null ? Math.max(0, (Date.now() - setStartRef.current) / 1000) : 0;
  const kcalWorkout = Math.round((workSecRef.current + liveSec) * kcalPerSec);
  const kcalExercise = Math.round((exSecRef.current + liveSec) * kcalPerSec);
  const kcalSet = Math.round(lastSetSecRef.current * kcalPerSec);

  const progressText = restEnd !== null
    ? (restKind === 'ex' ? 'Отдых между упражнениями' : 'Отдых между подходами')
    : exerciseDone
      ? `Следующее: ${session?.items[idx + 1]?.exercise || 'тренировка завершена'}`
      : `Подход ${doneSets} из ${targetSets}`;

  const warmup = (() => {
    const w = curItem?.weightKg || 0;
    if (w <= 0) return 'Разминка: пустой гриф (или лёгкий вес) × 12–15';
    return `Разминка: ${roundHalf(w * 0.4)} кг × 10 · ${roundHalf(w * 0.6)} кг × 6 · ${roundHalf(w * 0.8)} кг × 3`;
  })();

  // ------------------------------------------------------------ действия
  const patchItem = useCallback((patch: Partial<SessionItem>) => {
    setSession(prev => {
      if (!prev) return prev;
      const items = [...prev.items];
      items[idx] = { ...items[idx], ...patch };
      const next = { ...prev, items };
      coach.updateSession(prev.id, { items });
      return next;
    });
  }, [coach, idx]);

  const startRest = (seconds: number, kind: 'set' | 'ex') => {
    setRestKind(kind);
    setRestTotal(seconds);
    setRestPaused(false);
    setRestEnd(Date.now() + seconds * 1000);
    setStartRef.current = Date.now();
  };

  /** Оценка выбрана: пишем факт подхода и сразу уходим в отдых. */
  const onFeel = (feel: 1 | 2 | 3) => {
    if (!session || !curItem || !curSlot || !awaitingFeel) return;
    const nextSets = Math.min(targetSets, doneSets + 1);
    const feels = [...(curItem.setFeels || []), feel];
    const items = [...session.items];
    items[idx] = { ...curItem, sets: nextSets, feel, setFeels: feels };
    const activeSec = Math.max(1, Math.round((Date.now() - setStartRef.current) / 1000));
    const plannedSec = Math.max(0, curSlot.workSec || 40);
    const facts = [...(session.setFacts || []), {
      exercise: curItem.exercise,
      feel,
      reps: curItem.reps,
      weightKg: curItem.weightKg,
      atMs: Date.now(),
      actualSec: plannedSec > 0 && activeSec > plannedSec + 600 ? plannedSec : activeSec,
      plannedSec,
    }];
    const next: Session = { ...session, items, setFacts: facts };
    setSession(next);
    coach.updateSession(next.id, { items, setFacts: facts });

    // Активное время подхода — в калории (как kcalLastSet / activeSec).
    lastSetSecRef.current = activeSec;
    workSecRef.current += activeSec;
    exSecRef.current += activeSec;

    // Автопрогрессия веса программы — как progressByFeel в Android.
    const updated = applyFeelProgression(
      program!, week, dayTitle, curItem.exercise, curItem.weightKg, curItem.reps, feel);
    if (updated) savePrograms(programs.map(p => (p.id === updated.id ? updated : p)));

    setAwaitingFeel(false);
    setStartRef.current = Date.now();
    const isLast = nextSets >= targetSets;
    const restValue = isLast ? (curSlot.restEx || curSlot.rest) : curSlot.rest;
    startRest(parseRest(restValue, 90), isLast ? 'ex' : 'set');
    setToast(`Подход ${nextSets}/${targetSets} записан`);
  };

  const skipRest = () => {
    setRestEnd(null);
    if (!session) return;
    if (exerciseDone && idx + 1 < session.items.length) {
      setIdx(idx + 1);
      setHintOpen(false);
      exStartRef.current = Date.now();
      setStartRef.current = Date.now();
    }
  };

  const changeRest = () => {
    const v = window.prompt('Сколько секунд отдыхать?', String(restTotal || 90));
    if (!v) return;
    const seconds = Math.max(5, parseInt(v, 10) || 90);
    setRestTotal(seconds);
    setRestEnd(Date.now() + seconds * 1000);
    setRestPaused(false);
  };

  const goExercise = (dir: -1 | 1) => {
    if (!session) return;
    const next = Math.min(session.items.length - 1, Math.max(0, idx + dir));
    setIdx(next);
    setAwaitingFeel(false);
    setHintOpen(false);
    setRestEnd(null);
    exStartRef.current = Date.now();
    exSecRef.current = 0;
    setStartRef.current = Date.now();
  };

  const finish = () => {
    if (!session) return;
    const durationSec = Math.max(0, Math.round((Date.now() - session.ts) / 1000));
    coach.updateSession(session.id, {
      feel: sessionFeel || undefined,
      setFacts: session.setFacts,
      durationSec,
    });
    navigate('/coach');
  };

  const swapTo = (name: string) => {
    if (!session || !curItem) return;
    const items = [...session.items];
    items[idx] = { ...curItem, exercise: name, sets: 0, feel: undefined, setFeels: [] };
    const next = { ...session, items };
    setSession(next);
    coach.updateSession(next.id, { items });
    setSwapOpen(false);
    setToast('Упражнение заменено');
  };

  // ------------------------------------------------------------ рендер
  if (!program || !day || !session || !curItem || !curSlot) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4">
        <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-main)' }}>Тренировка не найдена</h2>
        <button onClick={() => navigate('/coach')} className="fg-btn fg-btn-primary px-6 py-3">
          К тренеру
        </button>
      </div>
    );
  }

  const alt = exercises
    .filter(e => e.muscleGroup === curSlot.group && e.name !== curItem.exercise)
    .slice(0, 8);

  const oneRmValue = oneRm.get(curItem.exercise) || (curItem.weightKg > 0 && curItem.reps > 0
    ? roundHalf(curItem.weightKg * (1 + curItem.reps / 30)) : 0);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg)' }}>
      {/* ---------- Шапка ---------- */}
      <div className="flex items-center px-2">
        <button onClick={() => navigate('/coach')} className="w-12 h-12 flex items-center justify-center rounded-full active:bg-black/5"
          aria-label="Назад">
          <ChevronLeft size={26} style={{ color: 'var(--p-labels)' }} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[18px] font-bold leading-tight" style={{ color: 'var(--p-labels)' }}>Тренировка</div>
          <div className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
            Упражнение {idx + 1} из {session.items.length}
          </div>
        </div>
        <button onClick={() => setFinishOpen(true)} className="px-3 py-2.5 text-[14px] font-bold"
          style={{ color: 'var(--p-labels-text)' }}>
          Завершить
        </button>
      </div>

      {/* ---------- Тело ---------- */}
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="text-center pt-3.5 pb-1.5 text-[14px] leading-snug"
          style={{ color: 'var(--color-text-secondary)' }}>
          {progressText}
        </div>
        <div className="text-center py-0.5 text-[16px] font-bold font-mono"
          style={{ color: 'var(--p-labels-text)' }}>
          Тренировка: {fmt(elapsed)}
        </div>
        {checkin && delta !== 0 && (
          <div className="text-center text-[12px] py-1" style={{ color: 'var(--color-warning)' }}>
            Разгрузка или низкая готовность: вес и объём скорректированы.
          </div>
        )}

        <h1 className="text-center pt-3 text-[22px] font-bold leading-tight"
          style={{ color: 'var(--p-labels)' }}>
          {curItem.exercise}
        </h1>
        <div className="text-center pt-1 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
          {warmup}
        </div>

        {/* Подходы / Повторы / Вес */}
        <div className="grid grid-cols-3 gap-2 mt-[18px]">
          <label className="fg-wk-field">
            <input
              type="number" min={1} max={20}
              value={targetSets}
              onChange={e => patchItem({ targetSets: Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)) })}
              className="fg-wk-input text-center font-mono text-[18px]"
            />
            <span>Подходы</span>
          </label>
          <label className="fg-wk-field">
            <input
              type="number" min={0}
              value={curItem.reps}
              onChange={e => patchItem({ reps: Math.max(0, parseInt(e.target.value, 10) || 0) })}
              className="fg-wk-input text-center font-mono text-[18px]"
            />
            <span>Повторы</span>
          </label>
          <label className="fg-wk-field">
            <input
              type="number" step="0.5" min={0}
              value={curItem.weightKg}
              onChange={e => patchItem({ weightKg: Math.max(0, parseFloat(e.target.value) || 0) })}
              className="fg-wk-input text-center font-mono text-[18px]"
            />
            <span>Вес, кг</span>
          </label>
        </div>

        <div className="text-center pt-[18px] text-[17px] font-bold" style={{ color: 'var(--color-text-main)' }}>
          Подход {doneSets} из {targetSets}
        </div>

        {/* Кнопка подхода / оценка */}
        {!awaitingFeel && !exerciseDone && restEnd === null && (
          <button
            onClick={() => {
              if (restEnd !== null) return;
              setAwaitingFeel(true);
              setStartRef.current = Date.now();
            }}
            className="fg-wk-main mt-3 w-full"
          >
            {doneSets === 0 ? 'Начать' : 'Подход выполнен'}
          </button>
        )}

        {!awaitingFeel && exerciseDone && restEnd === null && (
          <button
            onClick={() => {
              if (idx + 1 < session.items.length) {
                goExercise(1);
              } else {
                setFinishOpen(true);
              }
            }}
            className="fg-wk-main mt-3 w-full"
          >
            {idx + 1 < session.items.length ? 'Следующее упражнение' : 'Завершить тренировку'}
          </button>
        )}

        {awaitingFeel && (
          <>
            <div className="text-center pt-4 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
              Как прошёл подход?
            </div>
            <div className="flex justify-center gap-2 mt-2 flex-wrap">
              {FEELS.map(f => (
                <button key={f.v} onClick={() => onFeel(f.v)} className="fg-wk-chip">
                  {f.label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Отдых */}
        {restEnd !== null && (
          <div className="mt-4 flex flex-col items-center">
            <div className="text-[14px]" style={{ color: 'var(--color-text-secondary)' }}>Отдых</div>
            <div className="text-[56px] font-bold font-mono leading-none my-1"
              style={{ color: 'var(--p-labels-text)' }}>
              {fmt(restLeft)}
            </div>
            <button onClick={() => setRestPaused(p => !p)} className="fg-wk-accent w-full mt-1.5">
              {restPaused ? 'Продолжить' : 'Пауза'}
            </button>
            <div className="flex w-full mt-1">
              <button onClick={changeRest} className="flex-1 py-3 text-[14px]" style={{ color: 'var(--color-text-secondary)' }}>
                Свой отдых
              </button>
              <button onClick={skipRest} className="flex-1 py-3 text-[14px]" style={{ color: 'var(--color-text-secondary)' }}>
                Пропустить
              </button>
            </div>
          </div>
        )}

        {/* Калории */}
        <div className="text-center mt-2 text-[13px]" style={{ color: 'var(--p-labels-text)' }}>
          {curSlot.workSec && curSlot.workSec > 0
            ? `Подходов: ${completedSets} · Повторов: ${session.items.reduce((n, it) => n + it.sets * it.reps, 0)} · Всего: ${kcalWorkout} ккал`
            : `Подход: ${kcalSet} ккал · Упражнение: ${kcalExercise} ккал · Тренировка: ${kcalWorkout} ккал`}
        </div>

        {/* Переключение упражнений */}
        <div className="flex gap-2 mt-2">
          <button onClick={() => goExercise(-1)} disabled={idx === 0} className="fg-wk-outline flex-1 disabled:opacity-40">
            ← Упражнение
          </button>
          <button onClick={() => goExercise(1)} disabled={idx + 1 >= session.items.length} className="fg-wk-outline flex-1 disabled:opacity-40">
            Упражнение →
          </button>
        </div>

        {/* Заменить / рабочие веса / подсказка */}
        <button onClick={() => setSwapOpen(true)} className="fg-wk-outline w-full mt-3">
          Заменить упражнение
        </button>
        <button onClick={() => setWeightsOpen(true)} className="fg-wk-outline w-full mt-2">
          Рабочие веса от 1ПМ
        </button>
        <button onClick={() => setHintOpen(v => !v)} className="fg-wk-outline w-full mt-3">
          {hintOpen ? 'Скрыть подсказку' : 'Подсказка по упражнению'}
        </button>

        {hintOpen && (
          <div className="pt-2 text-[13px] space-y-2" style={{ color: 'var(--color-text-main)' }}>
            <div><b>Мышцы:</b> {exercise ? `${exercise.muscleGroup} · ${exercise.target}` : curSlot.group}</div>
            <div><b>Техника:</b> {exercise?.steps?.length ? exercise.steps.join(' · ') : 'Держи спину нейтрально, двигайся подконтрольно.'}</div>
            <div><b>Ошибки:</b> {exercise?.mistakes?.length ? exercise.mistakes.join(' · ') : 'Рывки, неполная амплитуда, потеря нейтральной спины.'}</div>
          </div>
        )}

        <div className="h-6" />
      </div>

      {/* ---------- Тосты ---------- */}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 px-4 py-2 rounded-full text-[13px] font-medium text-white z-40"
          style={{ background: 'rgba(27,30,32,0.9)' }}>
          {toast}
        </div>
      )}

      {/* ---------- Завершение ---------- */}
      {finishOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-6">
          <div className="w-full max-w-md rounded-2xl p-5" style={{ background: 'var(--color-surface)' }}>
            <h3 className="text-[18px] font-bold mb-1" style={{ color: 'var(--color-text-main)' }}>
              Как прошла тренировка?
            </h3>
            <p className="text-[13px] mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              Подходов: {completedSets} из {totalSets} · {Math.round(kcalWorkout)} ккал
            </p>
            <div className="flex gap-2 mb-4">
              {FEELS.map(f => (
                <button key={f.v} onClick={() => setSessionFeel(f.v)}
                  className={clsx('fg-wk-chip flex-1', sessionFeel === f.v && 'fg-wk-chip-on')}>
                  {f.label}
                </button>
              ))}
            </div>
            {completedSets < totalSets && (
              <p className="text-[12px] mb-3" style={{ color: 'var(--color-warning)' }}>
                Не все подходы выполнены. Тренер учтёт это в прогрессии.
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setFinishOpen(false)} className="fg-wk-outline flex-1">Завершить позже</button>
              <button onClick={finish} className="fg-wk-main flex-1">Завершить</button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Замена упражнения ---------- */}
      {swapOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
          onClick={() => setSwapOpen(false)}>
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[70vh] overflow-y-auto"
            style={{ background: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-[18px] font-bold mb-2" style={{ color: 'var(--color-text-main)' }}>Заменить на…</h3>
            {alt.length === 0 && (
              <p className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                Альтернатив не нашлось — попробуй после разминки или выбери другое.
              </p>
            )}
            <div className="space-y-2">
              {alt.map(e => (
                <button key={e.id} onClick={() => swapTo(e.name)}
                  className="w-full text-left px-3 py-3 rounded-xl border"
                  style={{ borderColor: 'var(--color-outline)', color: 'var(--color-text-main)' }}>
                  <div className="font-medium">{e.name}</div>
                  <div className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
                    {e.muscleGroup} · {e.equipmentType}
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setSwapOpen(false)} className="fg-wk-outline w-full mt-3">Отмена</button>
          </div>
        </div>
      )}

      {/* ---------- Рабочие веса ---------- */}
      {weightsOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-6"
          onClick={() => setWeightsOpen(false)}>
          <div className="w-full max-w-md rounded-2xl p-5" style={{ background: 'var(--color-surface)' }}
            onClick={e => e.stopPropagation()}>
            <h3 className="text-[18px] font-bold mb-1" style={{ color: 'var(--color-text-main)' }}>
              Рабочие веса от 1ПМ
            </h3>
            <p className="text-[13px] mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              {curItem.exercise}: 1ПМ ≈ {oneRmValue > 0 ? `${oneRmValue} кг` : 'не рассчитан'}
            </p>
            {oneRmValue > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {[40, 50, 60, 70, 80, 90].map(p => (
                  <button key={p} onClick={() => { patchItem({ weightKg: roundHalf(oneRmValue * p / 100) }); setWeightsOpen(false); }}
                    className="fg-wk-outline">
                    {p}% — {roundHalf(oneRmValue * p / 100)} кг
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                Сначала сохрани 1ПМ в «Профиле» или выполни подход с весом — расчёт появится сам.
              </p>
            )}
            <button onClick={() => setWeightsOpen(false)} className="fg-wk-outline w-full mt-3">Закрыть</button>
          </div>
        </div>
      )}
    </div>
  );
}
