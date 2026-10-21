// FitGuide Web — карманный тренер (порт CoachStore.java + DailyCoach.java)
//
// Логика один-в-один с Android-версией:
//  - отметка самочувствия: сон / забитость / энергия, каждая 1..3;
//  - готовность = сумма трёх шкал (3..9);
//  - разгрузка: фаза помечена ИЛИ последняя неделя фазы (если фаза длиннее недели);
//  - поправка нагрузки: разгрузка ×0.8, низкая готовность ×0.9 — берём более жёсткий, НЕ перемножаем;
//  - прогрессия: 3 стопора подряд → −10%; не добрал повторы → тот же вес или сброс;
//    масса + повторы не набраны → вес тот же (двойная прогрессия); всё выполнено → +2,5 / +5 кг;
//  - потолок: не выше 95% e1RM.

import type { Program, Session, SessionItem, Checkin, CoachState, Phase, Day, Slot } from '../data/types';
import { GOALS } from './goals';

// ---------------------------------------------------------------- утилиты

/** Ключ дня «yyyyMMdd» — отметка самочувствия одна на день. */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

/** Округление до 0,5 кг (шаг гантелей). */
export function roundHalf(v: number): number {
  return v <= 0 ? 0 : Math.round(v * 2) / 2;
}

/** Верхняя граница диапазона повторов: "3–5" → 5, "10–12" → 12, "5" → 5. */
export function maxReps(repRange: string | null | undefined): number {
  if (!repRange) return 0;
  const s = repRange.trim().replace(/,/g, '–').replace(/-/g, '–').replace(/\.\./g, '–');
  const dash = s.indexOf('–');
  const max = dash >= 0 ? s.substring(dash + 1).trim() : s.trim();
  const digits = max.replace(/[^0-9]/g, '');
  const n = parseInt(digits, 10);
  return isNaN(n) ? 0 : n;
}

export function isMassGoal(goal: string | null | undefined): boolean {
  return !!goal && goal.includes(GOALS.MASS);
}

/** Тоннаж сессии (вес × повторы × подходы). */
export function tonnage(s: Session): number {
  let t = 0;
  for (const it of s.items) t += it.weightKg * it.reps * it.sets;
  return t;
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

// ---------------------------------------------------------------- готовность

/** Суммарная готовность 3..9 (меньше — хуже). 0 — отметки нет. */
export function readinessScore(c: Checkin | null | undefined): number {
  if (!c) return 0;
  return c.sleep + c.sore + c.energy;
}

/** Множитель рабочего веса по готовности: низкая — 0.9, иначе 1.0. */
export function readinessFactor(score: number): number {
  return score <= 4 ? 0.9 : 1;
}

/** Есть ли сегодня сильная забитость мышц. */
export function sorenessHigh(c: Checkin | null | undefined): boolean {
  return !!c && c.sore === 1;
}

/** Рекомендуемый вес с поправкой на самочувствие (низкая готовность — минус 10%). */
export function readinessAdjust(weight: number, score: number): number {
  const f = readinessFactor(score);
  if (f >= 1 || weight <= 0) return weight;
  return roundHalf(weight * f);
}

// ---------------------------------------------------------------- периодизация

/** Фаза программы под неделю (периодизация). */
export function phaseForWeek(program: Program | null, week: number): Phase | null {
  if (!program || !program.phases.length) return null;
  for (const ph of program.phases) {
    if (week >= ph.weekStart && week <= ph.weekEnd) return ph;
  }
  return week < program.phases[0].weekStart
    ? program.phases[0]
    : program.phases[program.phases.length - 1];
}

/** Идёт ли разгрузочная неделя. */
export function isDeload(program: Program | null, week: number): boolean {
  if (!program) return false;
  const ph = phaseForWeek(program, week);
  if (!ph) return false;
  if (ph.deload) return true;
  return ph.weekEnd > ph.weekStart && week >= ph.weekEnd;
}

/** Поправка числа подходов: низкая готовность или разгрузка → −1 подход. */
export function setDelta(program: Program | null, week: number, score: number): number {
  const deload = isDeload(program, week);
  const low = score <= 4;
  return (deload || low) ? -1 : 0;
}

/** Общий множитель рабочего веса: разгрузка ×0.8, низкая готовность ×0.9 — берём более жёсткий. */
export function loadFactor(program: Program | null, week: number, score: number): number {
  let f = 1;
  if (isDeload(program, week)) f = Math.min(f, 0.8);
  if (score <= 4) f = Math.min(f, 0.9);
  return f;
}

/** Рекомендуемый вес с учётом разгрузки и готовности. */
export function loadAdjust(program: Program | null, week: number, weight: number, score: number): number {
  if (weight <= 0) return weight;
  const f = loadFactor(program, week, score);
  return f >= 1 ? weight : roundHalf(weight * f);
}

// ---------------------------------------------------------------- календарь недель

/** Сколько недель прошло с активации программы (без ограничения её длиной). */
export function weeksSinceStart(program: Program | null, activeSince: number | null, now: number): number {
  if (!program) return 1;
  if (!activeSince || activeSince <= 0) return 1;
  const days = Math.floor((now - activeSince) / 86400000) + 1;
  return Math.max(1, Math.floor((days + 6) / 7));
}

/**
 * Текущая неделя (1..weeks). После последней недели программа идёт по кругу:
 * недели, фазы и разгрузка повторяются, а история и прогрессия весов остаются.
 */
export function currentWeek(program: Program | null, activeSince: number | null, now: number): number {
  if (!program) return 1;
  const weeks = Math.max(1, program.weeks);
  return ((weeksSinceStart(program, activeSince, now) - 1) % weeks) + 1;
}

/** Круг: 1 — первый проход программы, 2 — второй и так далее. */
export function cycleNumber(program: Program | null, activeSince: number | null, now: number): number {
  if (!program) return 1;
  const weeks = Math.max(1, program.weeks);
  return Math.floor((weeksSinceStart(program, activeSince, now) - 1) / weeks) + 1;
}

/** Пройден ли первый проход программы по неделям. */
export function isProgramFinished(program: Program | null, activeSince: number | null, now: number): boolean {
  if (!program) return false;
  return weeksSinceStart(program, activeSince, now) > Math.max(1, program.weeks);
}

/** Начало текущей календарной недели программы (от activeSince, шаг 7 дней). */
export function currentWeekStart(activeSince: number | null, now: number): number {
  if (!activeSince || activeSince <= 0) return 0;
  const days = Math.max(0, Math.floor((now - activeSince) / 86400000));
  return activeSince + Math.floor(days / 7) * 7 * 86400000;
}

/** Номер текущей недели от активации (0-based). */
export function currentWeekIndex(activeSince: number | null, now: number): number {
  if (!activeSince || activeSince <= 0) return 0;
  const days = Math.max(0, Math.floor((now - activeSince) / 86400000));
  return Math.floor(days / 7);
}

/** Сколько тренировок программы записано в текущей календарной неделе. */
export function sessionsThisWeek(sessions: Session[], programId: string | null, activeSince: number | null, now: number): number {
  if (!programId) return 0;
  const weekStart = currentWeekStart(activeSince, now);
  if (weekStart <= 0) return 0;
  return sessions.filter(s => s.programId === programId && s.ts >= weekStart).length;
}

/** Сколько тренировок программы записано в историю. */
export function sessionCount(sessions: Session[], programId: string | null): number {
  if (!programId) return 0;
  return sessions.filter(s => s.programId === programId).length;
}

/** Последний выполненный день этой программы (для следующего шага). */
export function lastDayTitle(sessions: Session[], programId: string | null): string | null {
  if (!programId) return null;
  for (const s of sessions) {
    if (s.programId === programId && s.dayTitle) return s.dayTitle;
  }
  return null;
}

/** Индекс следующей тренировки в списке дней фазы (0..size-1); −1 — нет данных. */
export function nextDayIndex(sessions: Session[], program: Program | null, phase: Phase | null): number {
  if (!program || !phase || !phase.days.length) return -1;
  const last = lastDayTitle(sessions, program.id);
  if (last === null) return 0;
  for (let i = 0; i < phase.days.length; i++) {
    if (last === phase.days[i].title) return (i + 1) % phase.days.length;
  }
  return 0;
}

/** Следующая тренировка: день после последнего выполненного, по кругу. */
export function nextDay(sessions: Session[], program: Program | null, phase: Phase | null): Day | null {
  const idx = nextDayIndex(sessions, program, phase);
  if (idx < 0 || !phase) return null;
  return phase.days[idx];
}

// ---------------------------------------------------------------- прогрессия

/** Последний использованный вес (из тренера; сниженные сессии — не база). */
export function lastWeight(sessions: Session[], exercise: string | null): number {
  if (!exercise) return 0;
  for (const s of sessions) {
    if (s.adjusted) continue;
    for (const it of s.items) {
      if (it.exercise === exercise && it.weightKg > 0) return it.weightKg;
    }
  }
  return 0;
}

/** Выполнялись ли все плановые подходы в последний раз. */
export function completedLastSession(sessions: Session[], exercise: string): boolean {
  for (const s of sessions) {
    if (s.adjusted) continue;
    for (const it of s.items) {
      if (it.exercise === exercise) {
        return it.targetSets > 0 && it.sets >= it.targetSets;
      }
    }
  }
  return false;
}

/** Последние реально выполненные повторы упражнения (двойная прогрессия). */
export function lastReps(sessions: Session[], exercise: string | null): number {
  if (!exercise) return 0;
  for (const s of sessions) {
    if (s.adjusted) continue;
    for (const it of s.items) {
      if (it.exercise === exercise) return it.reps;
    }
  }
  return 0;
}

/**
 * Стопоры подряд: сколько последних сессий упражнение недовыполнено
 * (сделано подходов меньше плана). Успешная сессия обрывает серию.
 */
export function missedStreak(sessions: Session[], exercise: string | null): number {
  if (!exercise) return 0;
  let streak = 0;
  for (const s of sessions) {
    if (s.adjusted) continue;
    let found = false;
    for (const it of s.items) {
      if (it.exercise === exercise) {
        found = true;
        if (it.targetSets > 0 && it.sets < it.targetSets) {
          streak++;
        } else {
          return streak;
        }
      }
    }
    if (!found) return streak; // в сессии упражнения не было — серия оборвана
  }
  return streak;
}

/** Оценка «как прошло» для упражнения: сначала оценка упражнения, иначе — сессии. 0 — не оценено. */
export function lastFeel(sessions: Session[], exercise: string | null): number {
  if (!exercise) return 0;
  for (const s of sessions) {
    let has = false;
    for (const it of s.items) {
      if (it.exercise === exercise) {
        has = true;
        if (it.feel && it.feel > 0) return it.feel;
      }
    }
    if (has && s.feel && s.feel > 0) return s.feel;
  }
  return 0;
}

/** −10% после трёх стопоров подряд. */
export function dropWeight(sessions: Session[], exercise: string): number {
  const last = lastWeight(sessions, exercise);
  if (last <= 0) return 0;
  return roundHalf(last * 0.9);
}

/** Следующий вес с потолком 95% e1RM — не завышаем старт выше реальной силы. */
function nextWithinCeiling(e1rm: number, last: number, step: number): number {
  const next = roundHalf(last + step);
  if (e1rm > 0 && next > e1rm * 0.95) return last;
  return next;
}

/**
 * Рекомендуемый вес на следующую тренировку.
 * 0 — данных нет (первый подход, вес выбирает пользователь).
 *
 * Правила:
 *  - 3 стопора подряд → −10%;
 *  - не выполнены повторы → повтор веса (или сброс, если стопоров ≥2 / было тяжело);
 *  - масса + повторы ещё не набраны до верха диапазона → вес тот же;
 *  - всё выполнено → +2,5 кг (база: +5 кг).
 */
export function suggestWeight(params: {
  sessions: Session[];
  exercise: string;
  goal?: string | null;
  repRange?: string | null;
  e1rm?: number;
}): number {
  const { sessions, exercise, goal, repRange } = params;
  const e1rm = params.e1rm ?? 0;

  const last = lastWeight(sessions, exercise);
  if (last <= 0) {
    // Истории ещё нет — стартуем от 1ПМ (обратная формула Эпли).
    if (e1rm <= 0) return 0;
    let reps = maxReps(repRange);
    if (reps <= 0) reps = 10;
    reps = Math.min(reps, 12);
    return roundHalf(e1rm / (1 + reps / 30));
  }

  const completed = completedLastSession(sessions, exercise);
  const missed = missedStreak(sessions, exercise);
  const feel = lastFeel(sessions, exercise);

  if (missed >= 3) return dropWeight(sessions, exercise);

  if (!completed) {
    // «Не добрал» повторы дважды или тяжело не закрыл — снижаем вес.
    if (missed >= 2 || feel === 1) return dropWeight(sessions, exercise);
    return last;
  }

  if (feel === 1) return last; // было тяжело — вес не поднимаем

  const n = exercise.toLowerCase();
  const big = n.includes('присед') || n.includes('станов') || n.includes('жим ногами');

  if (isMassGoal(goal)) {
    // двойная прогрессия: сперва довести повторы до верхней границы
    const max = maxReps(repRange);
    const lr = lastReps(sessions, exercise);
    if (max > 0 && lr > 0 && lr < max) return last;
  }
  return nextWithinCeiling(e1rm, last, big ? 5 : 2.5);
}

// ---------------------------------------------------------------- сессия

/** Создаёт сессию по дню программы: веса стартуют с записанных в программе. */
export function createSession(
  programId: string, week: number, dayTitle: string, program: Program, slots: Slot[]
): Session {
  const items: SessionItem[] = slots.map(s => ({
    exercise: s.exercise,
    weightKg: s.startWeight || 0,
    reps: parseInt(s.reps) || 8,
    sets: 0,
    targetSets: s.sets || 3,
  }));
  return {
    id: crypto.randomUUID(),
    programId,
    week,
    dayTitle,
    ts: Date.now(),
    items,
  };
}

/**
 * Ход на следующий раз по отметке «как зашло».
 * Легко — +5%, тяжело — −5%, «в самый раз» — без изменений.
 * Без веса (своё тело) двигаем повторы.
 */
export function applyFeelProgression(
  program: Program, week: number, dayTitle: string, exercise: string,
  weightKg: number, reps: number, feel: 1 | 2 | 3
): Program | null {
  if (!program || !exercise || feel < 1 || feel > 3) return null;

  const phase = phaseForWeek(program, week);
  if (!phase) return null;
  const day = phase.days.find(d => d.title === dayTitle);
  if (!day) return null;
  const slot = day.slots.find(s => s.exercise === exercise);
  if (!slot) return null;
  if (feel === 2) return null; // «в самый раз» — работаем на том же

  let changed = false;
  if (weightKg > 0) {
    const next = progressValue(weightKg, feel);
    if (next > 0 && next !== slot.startWeight) {
      slot.startWeight = next;
      changed = true;
    }
  } else {
    const shifted = progressReps(slot.reps, feel);
    if (shifted && shifted !== slot.reps) {
      slot.reps = shifted;
      changed = true;
    }
  }
  return changed ? program : null;
}

/** Новый вес по отметке: легко +5%, тяжело −5%. */
export function progressValue(weightKg: number, feel: 1 | 2 | 3): number {
  if (feel === 3) return roundHalf(weightKg * 1.05);
  if (feel === 1) return roundHalf(weightKg * 0.95);
  return weightKg;
}

/** Новые повторы по отметке: сдвигаем первое число диапазона. */
export function progressReps(reps: string, feel: 1 | 2 | 3): string | null {
  if (!reps) return null;
  const s = reps.trim();
  const m = s.match(/^(\d+)/);
  if (!m) return null; // «до отказа», «максимум» и прочее — не число
  if (feel === 2) return s;
  const v = parseInt(m[1], 10) + (feel === 3 ? 1 : -1);
  if (v <= 0) return null;
  return s.replace(/^(\d+)/, String(v));
}

// ---------------------------------------------------------------- дневной план

export type PlanKind = 'train' | 'rest' | 'nocheckin' | 'checkpoint';

export interface DailyPlan {
  kind: PlanKind;
  title: string;
  loadLine: string;
  restLine: string;
  deload: boolean;
  light: boolean;
  canStart: boolean;
  dayTitle: string;
  week: number;
  cycle: number;
  /** Дней с последних замеров; −1 — замеров не было. */
  daysSinceAssessment: number;
  /** Пора ли чекпоинт. */
  checkpointDue: boolean;
  /** Сколько тренировок недели уже сделано. */
  doneThisWeek: number;
  plannedThisWeek: number;
  /** Следующая тренировка недели (если есть). */
  nextDay: Day | null;
  /** Готовность 0..9 (0 — нет отметки). */
  readiness: number;
  /** Множитель нагрузки. */
  factor: number;
}

/**
 * План на сегодня: checkpoint | rest | nocheckin | train.
 * Порт DailyCoach.plan.
 */
export function dailyPlan(params: {
  state: CoachState;
  program: Program | null;
  checkin: Checkin | null;
  now: number;
  checkpointDue: boolean;
  daysSinceAssessment: number;
}): DailyPlan {
  const { state, program, checkin, now, checkpointDue, daysSinceAssessment } = params;

  const empty: DailyPlan = {
    kind: 'train', title: '', loadLine: '', restLine: '',
    deload: false, light: false, canStart: false,
    dayTitle: '', week: 1, cycle: 1,
    daysSinceAssessment, checkpointDue,
    doneThisWeek: 0, plannedThisWeek: 0, nextDay: null,
    readiness: 0, factor: 1,
  };

  if (!program) return empty;

  const week = currentWeek(program, state.activeSince, now);
  const phase = phaseForWeek(program, week);
  if (!phase || !phase.days.length) return empty;

  // Чекпоинт важнее самой тренировки: по устаревшим замерам тренер подбирал бы
  // веса вслепую. Проверяем ДО недельной нормы, чтобы день не «провалился» в отдых.
  if (checkpointDue) {
    return {
      ...empty,
      kind: 'checkpoint',
      title: 'Пора повторные замеры',
      restLine: `Замерам ${daysSinceAssessment} ${plural(daysSinceAssessment, 'день', 'дня', 'дней')} — тренер пересчитает силу и веса`,
      week, cycle: cycleNumber(program, state.activeSince, now),
      readiness: readinessScore(checkin),
      factor: loadFactor(program, week, readinessScore(checkin)),
    };
  }

  const planned = program.daysPerWeek > 0 ? program.daysPerWeek : phase.days.length;
  const done = sessionsThisWeek(state.sessions, program.id, state.activeSince, now);

  if (done >= planned) {
    // Недельная норма выполнена. Молчаливый «отдых» выглядел бы как конец программы.
    const nextWeek = currentWeekStart(state.activeSince, now) + 7 * 86400000;
    const daysLeft = Math.max(0, Math.ceil((nextWeek - now) / 86400000));
    return {
      ...empty,
      kind: 'rest',
      title: 'Неделя закрыта — отдых',
      restLine: `Сделано ${Math.min(done, planned)} из ${planned}. Следующая неделя с ${formatDate(nextWeek)}, через ${daysLeft} ${plural(daysLeft, 'день', 'дня', 'дней')}`,
      week, cycle: cycleNumber(program, state.activeSince, now),
      doneThisWeek: done, plannedThisWeek: planned,
      readiness: readinessScore(checkin),
    };
  }

  const score = readinessScore(checkin);
  if (!checkin) {
    return {
      ...empty,
      kind: 'nocheckin',
      title: 'Отметь самочувствие',
      restLine: 'Сон, забитость, энергия — 1..3. От отметки зависит нагрузка на сегодня.',
      week, cycle: cycleNumber(program, state.activeSince, now),
      doneThisWeek: done, plannedThisWeek: planned,
    };
  }

  const next = nextDay(state.sessions, program, phase);
  const dayTitle = next ? next.title : '';
  const cycle = cycleNumber(program, state.activeSince, now);
  const deload = isDeload(program, week);
  const light = readinessFactor(score) < 1;
  const load = (deload || light) ? 'облегчённая' : 'полная';
  const factor = loadFactor(program, week, score);

  return {
    kind: 'train',
    title: `${dayTitle} · неделя ${week} из ${Math.max(1, program.weeks)} · круг ${Math.max(1, cycle)}`,
    loadLine: `Нагрузка: ${load} · готовность ${score}/9${deload ? ' · разгрузочная неделя' : ''}${factor < 1 ? ` · вес ×${factor}` : ''}`,
    restLine: '',
    deload, light,
    canStart: !!next && next.slots.length > 0,
    dayTitle, week, cycle,
    daysSinceAssessment, checkpointDue,
    doneThisWeek: done, plannedThisWeek: planned,
    nextDay: next,
    readiness: score,
    factor,
  };
}

/** Русское склонение: 1 день, 2 дня, 5 дней. */
export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
