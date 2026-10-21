// FitGuide Web — логика карманного тренера (порт с CoachStore)

import type { Program, Session, SessionItem, Checkin, CoachState, Exercise } from '../data/types';
import { roundHalf, calculate1RM } from './generator';

export type { Session, SessionItem };

// --- Готовность (readiness) ---
export function calculateReadiness(checkin: Checkin): number {
  // Среднее по 5 шкалам (1-9), нормализуем к 1-9
  const scores = [checkin.sleep, checkin.fatigue, checkin.soreness, checkin.mood, checkin.stress];
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.round(avg);
}

export function readinessFactor(readiness: number): number {
  // ≤4 → 0.9, 5-6 → 1.0, 7-9 → 1.05
  if (readiness <= 4) return 0.9;
  if (readiness >= 7) return 1.05;
  return 1.0;
}

// --- Разгрузка ---
export function isDeloadWeek(program: Program, week: number): boolean {
  const phase = program.phases.find(p => week >= p.weekStart && week <= p.weekEnd);
  if (!phase) return false;
  if (phase.deload) return true;
  // Последняя неделя фазы, если фаза длиннее недели
  return phase.weekEnd > phase.weekStart && week >= phase.weekEnd;
}

export function loadFactor(program: Program, week: number, readiness: number): number {
  let factor = 1;
  if (isDeloadWeek(program, week)) factor = Math.min(factor, 0.8);
  if (readiness <= 4) factor = Math.min(factor, 0.9);
  return factor;
}

// --- Прогрессия весов ---
export function suggestWeight(
  exercise: string,
  program: Program,
  week: number,
  sessions: Session[],
  exercisesDb: Exercise[],
  lastWeight: number,
  lastReps: number,
  feel: 1 | 2 | 3,
  goal: string
): { weight: number; reps: string } {
  // Находим упражнение в БД
  const ex = exercisesDb.find(e => e.name === exercise);
  const isBig = ex && (ex.name.includes('Присед') || ex.name.includes('Станов') || ex.name.includes('Жим ногами'));

  // e1RM из истории
  const e1rm = getEffective1RM(exercise, sessions);
  const ceiling = e1rm > 0 ? e1rm * 0.95 : Infinity;

  // Если feel=1 (тяжело) — не повышаем
  if (feel === 1) {
    return { weight: lastWeight, reps: ex?.reps || '8-12' };
  }

  // Двойная прогрессия для массы
  const isMass = goal === 'hypertrophy';
  if (isMass && ex) {
    const maxReps = parseMaxReps(ex.reps);
    if (maxReps > 0 && lastReps > 0 && lastReps < maxReps) {
      return { weight: lastWeight, reps: ex.reps };
    }
  }

  const step = isBig ? 5 : 2.5;
  let nextWeight = roundHalf(lastWeight + step);

  // Потолок 95% e1RM
  if (e1rm > 0 && nextWeight > ceiling) {
    nextWeight = lastWeight;
  }

  return { weight: nextWeight, reps: ex?.reps || '8-12' };
}

function getEffective1RM(exercise: string, sessions: Session[]): number {
  let best = 0;
  for (const s of sessions) {
    for (const item of s.items) {
      if (item.exercise === exercise && item.weightKg > 0 && item.reps > 0) {
        const e1rm = calculate1RM(item.weightKg, item.reps);
        if (e1rm > best) best = e1rm;
      }
    }
  }
  return best;
}

function parseMaxReps(reps: string): number {
  const match = reps.match(/(\d+)[-–](\d+)/);
  if (match) return parseInt(match[2]);
  const single = reps.match(/(\d+)/);
  return single ? parseInt(single[1]) : 0;
}

// --- Оценка тренировки (feel) ---
export function applyFeelProgression(
  program: Program,
  week: number,
  dayTitle: string,
  exercise: string,
  weight: number,
  reps: string,
  feel: 1 | 2 | 3
): Program | null {
  if (feel < 1 || feel > 3) return null;
  if (feel === 2) return null; // «в самый раз» — не меняем

  const phase = program.phases.find(p => week >= p.weekStart && week <= p.weekEnd);
  if (!phase) return null;

  const day = phase.days.find(d => d.title === dayTitle);
  if (!day) return null;

  const slot = day.slots.find(s => s.exercise === exercise);
  if (!slot) return null;

  const dir = feel === 3 ? 1 : -1;
  let changed = false;

  if (weight > 0) {
    const next = progressValue(weight, feel);
    if (next > 0 && next !== slot.startWeight) {
      slot.startWeight = next;
      changed = true;
    }
  } else {
    // Без веса — двигаем повторы
    const nextReps = progressReps(slot.reps, feel);
    if (nextReps && nextReps !== slot.reps) {
      slot.reps = nextReps;
      changed = true;
    }
  }

  return changed ? program : null;
}

function progressValue(current: number, feel: 1 | 2 | 3): number {
  // Упрощённо: ±5% за отметку
  const mult = feel === 3 ? 1.05 : 0.95;
  return roundHalf(current * mult);
}

function progressReps(current: string, feel: 1 | 2 | 3): string | null {
  // Пытаемся сдвинуть диапазон
  const match = current.match(/(\d+)[-–](\d+)/);
  if (!match) return null;
  const min = parseInt(match[1]);
  const max = parseInt(match[2]);
  const dir = feel === 3 ? 1 : -1;
  const newMin = Math.max(1, min + dir);
  const newMax = Math.max(newMin + 1, max + dir);
  return `${newMin}-${newMax}`;
}

// --- Чекпоинты ---
export interface CheckpointResult {
  e1rmChanges: Record<string, number>;
  bodyChanges: Record<string, number>;
  recommendations: string[];
}

export function runCheckpoint(
  program: Program,
  sessions: Session[],
  assessment: any, // Assessment type
  exercisesDb: Exercise[]
): CheckpointResult {
  const e1rmChanges: Record<string, number> = {};
  const recommendations: string[] = [];

  // Пересчитываем e1RM по последним тренировкам
  for (const ex of exercisesDb) {
    const newE1rm = getEffective1RM(ex.name, sessions);
    const oldE1rm = assessment.e1rm?.[ex.name] || 0;
    if (newE1rm > 0 && Math.abs(newE1rm - oldE1rm) > 2.5) {
      e1rmChanges[ex.name] = newE1rm;
    }
  }

  // Рекомендации на основе динамики
  if (Object.keys(e1rmChanges).length === 0) {
    recommendations.push('Силовые показатели стабильны. Продолжайте текущий темп.');
  } else {
    recommendations.push(`Обновлены e1RM по ${Object.keys(e1rmChanges).length} упражнениям.`);
  }

  return { e1rmChanges, bodyChanges: {}, recommendations };
}

// --- Сессии ---
export function createSession(
  programId: string,
  week: number,
  dayTitle: string,
  program: Program
): Session {
  const phase = program.phases.find(p => week >= p.weekStart && week <= p.weekEnd);
  const day = phase?.days.find(d => d.title === dayTitle);

  const items: SessionItem[] = day?.slots.map(s => ({
    exercise: s.exercise,
    weightKg: s.startWeight || 0,
    reps: parseInt(s.reps.split('-')[0]) || 8,
    sets: s.sets,
  })) || [];

  return {
    id: crypto.randomUUID(),
    programId,
    week,
    dayTitle,
    startedAt: Date.now(),
    items,
  };
}

export function finishSession(session: Session): Session {
  return { ...session, finishedAt: Date.now() };
}

// --- Ежедневный план тренера ---
export interface DailyPlan {
  program: Program | null;
  week: number;
  dayTitle: string;
  session: Session | null;
  readiness: number;
  factor: number;
  isDeload: boolean;
  checkpointDue: boolean;
  suggestedWeights: Record<string, { weight: number; reps: string }>;
}

export function getDailyPlan(
  state: CoachState,
  programs: Program[],
  checkins: Checkin[],
  exercisesDb: Exercise[]
): DailyPlan | null {
  if (!state.activeProgramId) return null;

  const program = programs.find(p => p.id === state.activeProgramId);
  if (!program) return null;

  // Текущая неделя (упрощённо: по дням с активности)
  const daysSinceStart = state.activeSince ? Math.floor((Date.now() - state.activeSince) / (1000 * 60 * 60 * 24)) : 0;
  const week = Math.min(Math.max(1, Math.floor(daysSinceStart / 7) + 1), program.weeks);

  // День недели цикла
  const dayIndex = state.activeSince ? Math.floor((Date.now() - state.activeSince) / (1000 * 60 * 60 * 24)) % program.daysPerWeek : 0;
  const phase = program.phases.find(p => week >= p.weekStart && week <= p.weekEnd);
  const day = phase?.days[dayIndex];

  if (!day) return null;

  // Последний чек-ин
  const todayCheckin = checkins.find(c => {
    const d = new Date(c.ts);
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  });

  const readiness = todayCheckin ? calculateReadiness(todayCheckin) : 5;
  const factor = loadFactor(program, week, readiness);
  const isDeload = isDeloadWeek(program, week);

  // Предлагаемые веса
  const suggestedWeights: Record<string, { weight: number; reps: string }> = {};
  for (const slot of day.slots) {
    const lastSession = [...state.sessions].reverse().find(s =>
      s.programId === program.id && s.week === week && s.dayTitle === day.title
    );
    const lastItem = lastSession?.items.find(i => i.exercise === slot.exercise);
    const lastWeight = lastItem?.weightKg || slot.startWeight || 0;
    const lastReps = lastItem?.reps || 8;
    const feel = lastItem?.feel || 2;

    suggestedWeights[slot.exercise] = suggestWeight(
      slot.exercise, program, week, state.sessions, exercisesDb, lastWeight, lastReps, feel, program.goal
    );
  }

  // Чекпоинт каждые 28 дней
  const checkpointDue = Boolean(state.activeSince && (Date.now() - state.activeSince) > 28 * 24 * 60 * 60 * 1000);

  return {
    program,
    week,
    dayTitle: day.title,
    session: state.sessions.find(s => s.programId === program.id && s.week === week && s.dayTitle === day.title) || null,
    readiness,
    factor,
    isDeload,
    checkpointDue,
    suggestedWeights,
  };
}