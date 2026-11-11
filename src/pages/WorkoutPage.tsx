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
import { createSession, applyFeelProgression, loadFeel, setDelta, readinessScore, dayKey, estimateOneRepMax } from '../core/coach';
import { playSignal } from '../core/signal';
import { useExercises } from '../hooks/useExercises';
import { ReplaceExercisePicker } from './progress/common';
import type { Session, SessionItem, Slot, Program } from '../data/types';

const FEELS = [
  { v: 1 as const, label: 'До отказа' },
  { v: 2 as const, label: 'Предотказ' },
  { v: 3 as const, label: 'Легко' },
];

/** Оценка тренировки целиком: тут «до отказа» не подходит — спрашиваем про
 *  то, как далась вся работа, а не про отдельный подход. */
const SESSION_FEELS = [
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

function roundHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

/** Вес без лишнего «.0», как WorkoutText.formatWeight(). */
function fmtKg(w: number): string {
  return w === Math.round(w) ? String(Math.round(w)) : String(w);
}

/** Упражнение одной строкой: название · подходы×повторы · вес (WorkoutText.exerciseLine). */
function lineOf(it: SessionItem, slot?: Slot): string {
  let s = it.exercise;
  const sets = slot?.sets || it.targetSets || it.sets;
  if (sets > 0) {
    s += ` · ${sets}`;
    const reps = slot?.reps || (it.reps > 0 ? String(it.reps) : '');
    if (reps) s += `×${reps}`;
  }
  if (it.weightKg > 0) s += ` · ${fmtKg(it.weightKg)} кг`;
  return s;
}

export function WorkoutPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const coach = useCoachStore();
  const { programs, getById, save: savePrograms } = useProgramsStore();
  const oneRm = useOneRmStore();
  const { profile } = useProfileStore();
  const { exercises } = useExercises();

  const adHocNames = (searchParams.get('names') || '').split('|').map(s => s.trim()).filter(Boolean);
  const adHoc = adHocNames.length > 0;
  const programId = adHoc ? 'adhoc' : (searchParams.get('program') || '');
  const week = adHoc ? 1 : parseInt(searchParams.get('week') || '1', 10);
  const dayTitle = adHoc
    ? (searchParams.get('title') || 'Своя тренировка')
    : decodeURIComponent(searchParams.get('day') || '');

  // Тренировка «с нуля» (WorkoutActivity.EXTRA_EXERCISES в Android):
  // упражнения, повторы, подходы и отдых приходят параметрами.
  const adHocProgram = useMemo<Program | null>(() => {
    if (!adHoc) return null;
    const reps = searchParams.get('reps') || '10';
    const sets = parseInt(searchParams.get('sets') || '0', 10) || 3;
    const rest = searchParams.get('rest') || '';
    const slots: Slot[] = adHocNames.map(name => ({
      exercise: name, group: '', reps, rest, sets,
    }));
    return {
      id: 'adhoc', name: dayTitle, goal: '', level: '', daysPerWeek: 1, weeks: 1,
      createdAt: Date.now(),
      phases: [{
        weekStart: 1, weekEnd: 1, label: '', scheme: '', deload: false,
        days: [{ title: dayTitle, slots }],
      }],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adHoc, searchParams]);

  const storedProgram = getById(programId);
  const program = adHocProgram || storedProgram;
  const phase = program?.phases.find(p => week >= p.weekStart && week <= p.weekEnd);
  const day = adHoc ? adHocProgram?.phases[0].days[0] : phase?.days.find(d => d.title === dayTitle);

  const [session, setSession] = useState<Session | null>(null);
  const [idx, setIdx] = useState(0);
  const [, setTick] = useState(0);
  const [begun, setBegun] = useState(false);
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [restTotal, setRestTotal] = useState(0);
  const [restPaused, setRestPaused] = useState(false);
  const [restKind, setRestKind] = useState<'set' | 'ex'>('set');
  const [awaitingFeel, setAwaitingFeel] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [sessionFeel, setSessionFeel] = useState<1 | 2 | 3 | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [weightsOpen, setWeightsOpen] = useState(false);
  const [records, setRecords] = useState<string[] | null>(null);
  const [restEditOpen, setRestEditOpen] = useState(false);
  const [restEditValue, setRestEditValue] = useState('90');
  // Сколько повторов реально получилось в подходе (как promptSetReps в APK).
  const [repsOpen, setRepsOpen] = useState(false);
  const [repsValue, setRepsValue] = useState('10');
  const [pendingReps, setPendingReps] = useState<number | null>(null);
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
    // Тренировка «с нуля» всегда начинается заново: у неё нет сохранённого дня программы.
    if (!adHoc) {
      const valid = coach.sessions.find(s =>
        s.programId === programId && s.week === week && s.dayTitle === dayTitle
        && s.items.length === day.slots.length);
      if (valid) {
        setSession(valid);
        return;
      }
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
    playSignal('restOver');
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

  const elapsed = session && session.startedAt
    ? Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000))
    : 0;

  // Тренировка «начата» — как shot.started в WorkoutService: до первого нажатия
  // кнопка называется «Начать», а не «Подход выполнен».
  const started = begun || completedSets > 0 || !!session?.startedAt;
  const allDone = session
    ? session.items.every((it, i) => it.sets >= (it.targetSets || day?.slots[i]?.sets || 3))
    : false;
  const doneExercises = session ? session.items.filter(it => it.sets > 0).length : 0;
  const tonnage = session
    ? Math.round(session.items.reduce((n, it) => n + (it.sets > 0 ? it.sets * it.reps * it.weightKg : 0), 0))
    : 0;

  // MET-оценка как в WorkoutSession.kcalPerSec(). Считаем только активное время,
  // как activeSec: отдых и простой в калории не идут.
  const kcalPerSec = 5.0 * 3.5 * Math.max(30, profile?.weightKg || 75) / 200 / 60;
  const liveSec = restEnd === null ? Math.max(0, (Date.now() - setStartRef.current) / 1000) : 0;
  const kcalWorkout = Math.round((workSecRef.current + liveSec) * kcalPerSec);
  const kcalExercise = Math.round((exSecRef.current + liveSec) * kcalPerSec);
  const kcalSet = Math.round(lastSetSecRef.current * kcalPerSec);

  // Превью следующего упражнения — только на последнем подходе текущего,
  // ровно как nextPreview() в WorkoutActivity.
  const nextPreview = (doneSets === targetSets - 1 && idx + 1 < (session?.items.length || 0))
    ? `Следующее упражнение: ${lineOf(session!.items[idx + 1], day?.slots[idx + 1])}`
    : '';

  const progressText = restEnd !== null
    ? (restKind === 'ex'
        ? (idx + 1 < (session?.items.length || 0)
            ? `Следующее упражнение: ${lineOf(session!.items[idx + 1], day?.slots[idx + 1])}`
            : 'Отдых между упражнениями')
        : 'Отдых между подходами')
    : `Подход ${doneSets} из ${targetSets}`;

  const warmup = (() => {
    const w = curItem?.weightKg || 0;
    if (w <= 0) return 'Разминка: пустой гриф (или лёгкий вес) × 12–15';
    const pct = [0.4, 0.6, 0.8];
    const reps = [10, 6, 3];
    const parts: string[] = [];
    let prev = -1;
    pct.forEach((p, i) => {
      const kg = roundHalf(w * p);
      if (kg < 2.5 || kg <= prev) return;
      prev = kg;
      parts.push(`${fmtKg(kg)} кг ×${reps[i]}`);
    });
    return parts.length
      ? `Разминка: ${parts.join(' · ')}`
      : 'Разминка: пустой гриф (или лёгкий вес) × 12–15';
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
    const repsDone = pendingReps ?? curItem.reps;
    const nextSets = Math.min(targetSets, doneSets + 1);
    const feels = [...(curItem.setFeels || []), feel];
    const repsList = [...(curItem.setReps || []), repsDone];
    const items = [...session.items];
    items[idx] = { ...curItem, sets: nextSets, feel, setFeels: feels, setReps: repsList };
    const activeSec = Math.max(1, Math.round((Date.now() - setStartRef.current) / 1000));
    const plannedSec = Math.max(0, curSlot.workSec || 40);
    const facts = [...(session.setFacts || []), {
      exercise: curItem.exercise,
      feel,
      reps: repsDone,
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

    setAwaitingFeel(false);
    setPendingReps(null);
    setStartRef.current = Date.now();
    const isLast = nextSets >= targetSets;
    const restValue = isLast ? (curSlot.restEx || curSlot.rest) : curSlot.rest;
    startRest(parseRest(restValue, 90), isLast ? 'ex' : 'set');
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
    setRestEditValue(String(restLeft > 0 ? restLeft : 90));
    setRestEditOpen(true);
  };

  const applyRest = () => {
    const seconds = Math.max(5, parseInt(restEditValue, 10) || 90);
    setRestTotal(seconds);
    setRestEnd(Date.now() + seconds * 1000);
    setRestPaused(false);
    setRestEditOpen(false);
  };

  /** Подтвердили фактические повторы подхода: дальше — оценка «как прошло». */
  const applyReps = () => {
    const n = Math.max(1, parseInt(repsValue, 10) || 1);
    setPendingReps(n);
    setRepsOpen(false);
    setAwaitingFeel(true);
    setStartRef.current = Date.now();
  };

  /** «Не предлагать»: CoachStore.setBanned — упражнение уходит из замен и прогрессии. */
  const banCurrent = () => {
    if (!curItem) return;
    if (!coach.banned.includes(curItem.exercise)) coach.toggleBanned(curItem.exercise);
    setSwapOpen(false);
    setToast('Ок, больше не предложу это упражнение.');
  };

  const goExercise = (dir: -1 | 1) => {
    if (!session) return;
    const next = Math.min(session.items.length - 1, Math.max(0, idx + dir));
    setIdx(next);
    setAwaitingFeel(false);
    setPendingReps(null);
    setHintOpen(false);
    setRestEnd(null);
    exStartRef.current = Date.now();
    exSecRef.current = 0;
    setStartRef.current = Date.now();
  };

  const finish = () => {
    if (!session) return;
    const durationSec = Math.max(0, Math.round((Date.now() - (session.startedAt || session.ts)) / 1000));
    coach.updateSession(session.id, {
      feel: sessionFeel || undefined,
      setFacts: session.setFacts,
      durationSec,
    });

    // Автопрогрессия — один раз за тренировку, как progressByFeel в Android:
    // решение по нагрузочному сигналу (отказ первого/большинства подходов),
    // а не по последнему подходу.
    if (program) {
      let changed = false;
      for (const it of session.items) {
        if (it.sets <= 0) continue;
        const f = loadFeel(it.setFeels) || it.feel;
        if (!f || f < 1 || f > 3) continue;
        const updated = applyFeelProgression(
          program, week, dayTitle, it.exercise, it.weightKg, it.reps, f as 1 | 2 | 3);
        if (updated) changed = true;
      }
      if (changed) savePrograms(programs.map(p => (p.id === program.id ? program : p)));
    }

    // Рекорды — buildCongrats() из WorkoutActivity: сравниваем с прошлыми тренировками.
    const prev1rm: Record<string, number> = {};
    const prevWeight: Record<string, number> = {};
    for (const s of coach.sessions) {
      if (s.id === session.id || s.durationSec == null) continue;
      for (const it of s.items) {
        const r = estimateOneRepMax(it.weightKg, it.reps);
        if (prev1rm[it.exercise] == null || r > prev1rm[it.exercise]) prev1rm[it.exercise] = r;
        if (prevWeight[it.exercise] == null || it.weightKg > prevWeight[it.exercise]) prevWeight[it.exercise] = it.weightKg;
      }
    }
    const lines: string[] = [];
    for (const it of session.items) {
      if (it.sets <= 0 || it.weightKg <= 0) continue;
      const r = estimateOneRepMax(it.weightKg, it.reps);
      const best = prev1rm[it.exercise];
      const new1rm = best == null || r > best + 0.01;
      const w = prevWeight[it.exercise];
      if (new1rm) {
        lines.push(`${it.exercise} — ${fmtKg(it.weightKg)} кг × ${it.reps} (1ПМ ${fmtKg(r)} кг)`);
      } else if (w == null || it.weightKg > w) {
        lines.push(`${it.exercise} — взята новая масса ${fmtKg(it.weightKg)} кг`);
      }
    }

    setFinishOpen(false);
    if (lines.length > 0) {
      setRecords(lines);
      return;
    }
    setToast('Тренировка сохранена в журнале');
    window.setTimeout(() => navigate('/coach'), 1600);
  };

  /** «Не сохранять»: тренировка закрыта, черновик тоже — как service.discard(). */
  const discard = () => {
    if (session) coach.removeSession(session.id);
    navigate('/coach');
  };

  /** Главная кнопка: начать → оценка подхода → к пропущенным / итог. */
  const onPrimary = () => {
    if (!session || !curItem || !curSlot) return;
    if (!started) {
      setBegun(true);
      // Таймер тренировки стартует здесь, а не при открытии экрана.
      if (session && !session.startedAt) {
        const at = Date.now();
        setSession({ ...session, startedAt: at });
        coach.updateSession(session.id, { startedAt: at });
      }
      playSignal('setStart');
      setStartRef.current = Date.now();
      return;
    }
    if (!exerciseDone) {
      // Сначала фактическое число повторов, потом оценка подхода — как в APK.
      const planned = Math.max(1, curItem.reps || parseInt(curSlot.reps || '10', 10) || 10);
      setRepsValue(String(planned));
      setRepsOpen(true);
      return;
    }
    if (!allDone) {
      const i = session.items.findIndex((it, k) => it.sets < (it.targetSets || day?.slots[k]?.sets || 3));
      if (i >= 0) {
        setIdx(i);
        setHintOpen(false);
        setRestEnd(null);
        exStartRef.current = Date.now();
        setStartRef.current = Date.now();
      }
      return;
    }
    setFinishOpen(true);
  };

  const mainLabel = !started
    ? 'Начать'
    : !exerciseDone
      ? `Подход выполнен (${doneSets + 1}/${targetSets})`
      : allDone ? 'Завершить' : 'К пропущенным';

  const swapTo = (name: string) => {
    if (!session || !curItem) return;
    const items = [...session.items];
    items[idx] = { ...curItem, exercise: name, sets: 0, feel: undefined, setFeels: [], setReps: [] };
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

  // Как OneRmStore.effective: только сохранённый 1ПМ, без оценки «на глаз».
  const oneRmValue = oneRm.get(curItem.exercise) || 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg)' }}>
      {/* ---------- Шапка ---------- */}
      <div className="flex items-center px-2">
        <button onClick={() => setExitOpen(true)} className="w-12 h-12 flex items-center justify-center rounded-full active:bg-black/5"
          aria-label="Назад">
          <ChevronLeft size={26} style={{ color: 'var(--p-labels-text)' }} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[18px] font-bold leading-tight" style={{ color: 'var(--p-labels-text)' }}>Тренировка</div>
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
        <div className="text-center pt-3.5 pb-1.5 text-[14px] leading-snug whitespace-pre-line"
          style={{ color: 'var(--color-text-secondary)' }}>
          {progressText}{nextPreview ? `\n${nextPreview}` : ''}
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
          style={{ color: 'var(--p-labels-text)' }}>
          {curItem.exercise}
        </h1>
        <div className="text-center pt-1 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
          {warmup}
        </div>
        {oneRmValue > 0 && (
          <div className="text-center pt-1 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
            1ПМ ≈ {fmtKg(oneRmValue)} кг
          </div>
        )}

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
        {!awaitingFeel && restEnd === null && (
          <button onClick={onPrimary} className="fg-wk-main mt-3 w-full">
            {mainLabel}
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

        {/* Калории — только когда тренировка уже началась, как shot.started */}
        {started && (
          <div className="text-center mt-2 text-[13px]" style={{ color: 'var(--p-labels-text)' }}>
            {curSlot.workSec && curSlot.workSec > 0
              ? `Подходов: ${completedSets} · Повторов: ${session.items.reduce((n, it) => n + it.sets * it.reps, 0)} · Всего: ${kcalWorkout} ккал`
              : `Подход: ${kcalSet} ккал · Упражнение: ${kcalExercise} ккал · Тренировка: ${kcalWorkout} ккал`}
          </div>
        )}

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
          <div className="pt-2 text-[13px] space-y-1.5" style={{ color: 'var(--color-text-main)' }}>
            <div>{exercise ? [exercise.target, ...(exercise.secondaryMuscles || [])].filter(Boolean).join(' · ') : curSlot.group}</div>
            <div className="whitespace-pre-line">
              {exercise?.steps?.length
                ? exercise.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')
                : (exercise?.description || '')}
            </div>
            {exercise?.mistakes?.length ? (
              <div>Ошибки: {exercise.mistakes.join('; ')}</div>
            ) : null}
          </div>
        )}

        <div className="h-6" />
      </div>

      {/* ---------- Тосты ---------- */}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 px-4 py-2 rounded-full text-[13px] font-medium text-white z-40"
          style={{ background: 'var(--p-labels)' }}>
          {toast}
        </div>
      )}

      {/* ---------- Завершение ---------- */}
      {finishOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-6">
          <div className="w-full max-w-md rounded-2xl p-5" style={{ background: 'var(--p-labels)' }}>
            <h3 className="text-[18px] font-bold mb-2" style={{ color: 'var(--color-text-main)' }}>
              Тренировка завершена!
            </h3>
            <p className="text-[15px] leading-snug whitespace-pre-line" style={{ color: 'var(--color-text-main)' }}>
              {`Упражнений: ${doneExercises}, подходов: ${completedSets}\nВремя: ${fmt(elapsed)}, объём: ${tonnage} кг\nСожжено: ${kcalWorkout} ккал`}
            </p>
            <p className="text-[14px] mt-3.5 mb-2" style={{ color: 'var(--color-text-main)' }}>
              Как прошла тренировка?
            </p>
            <div className="flex gap-2 mb-4">
              {SESSION_FEELS.map(f => (
                <button key={f.v} onClick={() => setSessionFeel(f.v)}
                  className={clsx('fg-wk-chip flex-1', sessionFeel === f.v && 'fg-wk-chip-on')}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={discard} className="fg-wk-outline flex-1">Не сохранять</button>
              <button onClick={finish} className="fg-wk-main flex-1">Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Выход из тренировки ---------- */}
      {exitOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-6">
          <div className="w-full max-w-md rounded-2xl p-5" style={{ background: 'var(--p-labels)' }}>
            <p className="text-[15px] leading-snug mb-4" style={{ color: 'var(--color-text-main)' }}>
              Выйти из тренировки? Прогресс сохранится — продолжишь с этого места.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setExitOpen(false)} className="fg-wk-outline flex-1">Назад</button>
              <button
                onClick={() => {
                  setExitOpen(false);
                  setToast('Прогресс сохранён — продолжишь с этого места.');
                  window.setTimeout(() => navigate('/coach'), 1200);
                }}
                className="fg-wk-main flex-1">
                Завершить позже
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Замена упражнения: альтернативы + список группы ---------- */}
      {swapOpen && (
        <ReplaceExercisePicker
          currentName={curItem.exercise}
          groupId={curSlot.group}
          onPick={swapTo}
          onClose={() => setSwapOpen(false)}
          onBan={banCurrent}
        />
      )}

      {/* ---------- Фактические повторы подхода ---------- */}
      {repsOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-6"
          onClick={() => setRepsOpen(false)}>
          <div className="w-full max-w-md rounded-2xl p-5" style={{ background: 'var(--p-labels)' }}
            onClick={e => e.stopPropagation()}>
            <h3 className="text-[18px] font-bold mb-2" style={{ color: 'var(--color-text-main)' }}>
              Сколько повторов получилось?
            </h3>
            <div className="text-[13px] mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              План: {curItem.reps} · подход {doneSets + 1} из {targetSets}
            </div>
            <input
              value={repsValue}
              onChange={e => setRepsValue(e.target.value.replace(/[^0-9]/g, ''))}
              inputMode="numeric"
              className="w-full px-3 py-3 rounded-xl border text-[15px]"
              style={{ background: 'var(--p-labels)', borderColor: 'var(--p-outline)', color: 'var(--color-text-main)' }}
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setRepsOpen(false)} className="fg-wk-outline flex-1">Отмена</button>
              <button onClick={applyReps} className="fg-wk-main flex-1">Дальше</button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Новые рекорды (buildCongrats) ---------- */}
      {records && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-6">
          <div className="w-full max-w-md rounded-2xl p-5 max-h-[80vh] overflow-y-auto" style={{ background: 'var(--p-labels)' }}>
            <h3 className="text-[18px] font-bold mb-2" style={{ color: 'var(--color-text-main)' }}>
              Новые рекорды!
            </h3>
            <p className="text-[14px] leading-relaxed whitespace-pre-line" style={{ color: 'var(--color-text-main)' }}>
              {records.join('\n')}
            </p>
            <button
              onClick={() => { setRecords(null); navigate('/coach'); }}
              className="fg-wk-main w-full mt-4">
              Отлично
            </button>
          </div>
        </div>
      )}

      {/* ---------- Отдых между подходами ---------- */}
      {restEditOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-6"
          onClick={() => setRestEditOpen(false)}>
          <div className="w-full max-w-md rounded-2xl p-5" style={{ background: 'var(--p-labels)' }}
            onClick={e => e.stopPropagation()}>
            <h3 className="text-[18px] font-bold mb-2" style={{ color: 'var(--color-text-main)' }}>
              Отдых между подходами
            </h3>
            <div className="text-[13px] font-bold mb-1" style={{ color: 'var(--color-text-secondary)' }}>Секунды</div>
            <input
              value={restEditValue}
              onChange={e => setRestEditValue(e.target.value.replace(/[^0-9]/g, ''))}
              inputMode="numeric"
              className="w-full px-3 py-3 rounded-xl border text-[15px]"
              style={{ background: 'var(--p-labels)', borderColor: 'var(--p-outline)', color: 'var(--color-text-main)' }}
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setRestEditOpen(false)} className="fg-wk-outline flex-1">Отмена</button>
              <button onClick={applyRest} className="fg-wk-main flex-1">Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Рабочие веса ---------- */}
      {weightsOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-6"
          onClick={() => setWeightsOpen(false)}>
          <div className="w-full max-w-md rounded-2xl p-5" style={{ background: 'var(--p-labels)' }}
            onClick={e => e.stopPropagation()}>
            <h3 className="text-[18px] font-bold mb-1" style={{ color: 'var(--color-text-main)' }}>
              Рабочие веса · 1ПМ {fmtKg(oneRmValue)} кг
            </h3>
            <p className="text-[13px] mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              {curItem.exercise}
            </p>
            {oneRmValue > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {[90, 85, 80, 75, 70].map(p => (
                  <button key={p} onClick={() => { patchItem({ weightKg: roundHalf(oneRmValue * p / 100) }); setWeightsOpen(false); }}
                    className="fg-wk-outline">
                    {p}% — {fmtKg(roundHalf(oneRmValue * p / 100))} кг
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                Сначала сохраните 1ПМ в «Мой прогресс» → вкладка 1ПМ
              </p>
            )}
            <button onClick={() => setWeightsOpen(false)} className="fg-wk-outline w-full mt-3">Закрыть</button>
          </div>
        </div>
      )}
    </div>
  );
}
