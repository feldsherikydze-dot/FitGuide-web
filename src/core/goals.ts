// FitGuide Web — Goals (порт Goals.java)
// Единая логика шести целей: калории/белок/жиры/программы берутся отсюда.

import { GOAL } from '../data/types';

export const GOALS: Record<string, string> = {
  LOSE: GOAL.LOSE,
  STRENGTH: GOAL.STRENGTH,
  MASS: GOAL.MASS,
  CUT: GOAL.CUT,
  ENDURANCE: GOAL.ENDURANCE,
  RECOMP: GOAL.RECOMP,
  MAINTAIN: GOAL.MAINTAIN,
};

/** Порядок показа в UI. */
export const GOALS_ALL = [GOALS.MASS, GOALS.LOSE, GOALS.STRENGTH, GOALS.CUT, GOALS.ENDURANCE, GOALS.RECOMP] as const;

export const GOAL_LABELS: Record<string, string> = {
  [GOALS.MASS]: 'Масса',
  [GOALS.LOSE]: 'Похудение',
  [GOALS.STRENGTH]: 'Сила',
  [GOALS.CUT]: 'Рельеф',
  [GOALS.ENDURANCE]: 'Выносливость',
  [GOALS.RECOMP]: 'Рекомпозиция',
  [GOALS.MAINTAIN]: 'Поддержание',
};

export const GOAL_DESCRIPTIONS: Record<string, string> = {
  [GOALS.MASS]: 'Набрать мышечную массу',
  [GOALS.LOSE]: 'Снизить вес',
  [GOALS.STRENGTH]: 'Больше силы в базовых движениях',
  [GOALS.CUT]: 'Сухой рельеф с сохранением мышц',
  [GOALS.ENDURANCE]: 'Выносливость и объём',
  [GOALS.RECOMP]: 'Похудеть и набрать мышцы одновременно',
  [GOALS.MAINTAIN]: 'Держать текущую форму',
};

/** Старый ключ «gain» и пустые значения приводятся к каноничным. */
export function normalizeGoal(goal: string | null | undefined): string {
  if (!goal) return GOALS.MAINTAIN;
  if (goal.indexOf(',') >= 0) return normalizeGoal(primaryGoal(goal));
  if (goal === GOAL.GAIN) return GOALS.MASS;
  return goal;
}

/**
 * Первичная (ведущая) цель из комбинированного списка.
 * Приоритет: сила(90) > масса(80) > выносливость(60) > рельеф(40) > рекомп(30) > похудение(20).
 */
export function primaryGoal(combined: string | null | undefined): string {
  if (!combined) return GOALS.MAINTAIN;
  const parts = combined.split(',');
  let best = -1;
  let bestGoal = GOALS.MAINTAIN;
  for (const p of parts) {
    const g = normalizeGoal(p);
    if (!g) continue;
    const score = goalPriority(g);
    if (score > best) {
      best = score;
      bestGoal = g;
    }
  }
  return bestGoal;
}

function goalPriority(goal: string): number {
  switch (normalizeGoal(goal)) {
    case GOALS.STRENGTH: return 90;
    case GOALS.MASS: return 80;
    case GOALS.ENDURANCE: return 60;
    case GOALS.CUT: return 40;
    case GOALS.RECOMP: return 30;
    case GOALS.LOSE: return 20;
    default: return 0;
  }
}

/** Все выбранные цели списком (для подписей и UI). */
export function goalList(combined: string | null | undefined): string[] {
  if (!combined) return [GOALS.MAINTAIN];
  const set = new Set<string>();
  for (const p of combined.split(',')) {
    const g = normalizeGoal(p);
    if (g) set.add(g);
  }
  return set.size ? Array.from(set) : [GOALS.MAINTAIN];
}

/** Совместимы ли две цели (масса+сила/рельеф — да; масса+похудение — нет). */
export function goalsCompatible(a: string, b: string): boolean {
  const ga = normalizeGoal(a);
  const gb = normalizeGoal(b);
  if (ga === gb) return true;
  return isDeficit(ga) === isDeficit(gb);
}

export function goalLabel(goal: string): string {
  return GOAL_LABELS[normalizeGoal(goal)] ?? GOAL_LABELS[GOALS.MAINTAIN];
}

/** Сдвиг калорий от поддерживающей нормы (TDEE). */
export function calorieDelta(goal: string): number {
  switch (normalizeGoal(goal)) {
    case GOALS.LOSE: return -500;
    case GOALS.CUT: return -400;
    case GOALS.RECOMP: return -150;
    case GOALS.MASS: return +300;
    case GOALS.STRENGTH: return +150;
    case GOALS.ENDURANCE: return +100;
    default: return 0;
  }
}

/** Минимальная планка калорий (не даём упасть ниже). */
export function calorieFloor(goal: string, gender?: string | null): number {
  const male = gender === 'male';
  switch (normalizeGoal(goal)) {
    case GOALS.LOSE: return male ? 1500 : 1200;
    case GOALS.CUT: return male ? 1600 : 1400;
    case GOALS.RECOMP: return male ? 1700 : 1500;
    default: return male ? 1500 : 1200;
  }
}

/** Целевые калории с учётом пола (для корректного минимального порога). */
export function caloriesFor(tdee: number, goal: string, gender?: string | null): number {
  if (tdee <= 0) return 0;
  const delta = calorieDelta(goal);
  const target = tdee + delta;
  if (delta < 0) return Math.max(target, calorieFloor(goal, gender));
  return target;
}

/** Нормы белка, г на кг массы тела. */
export function proteinPerKg(goal: string): number {
  switch (normalizeGoal(goal)) {
    case GOALS.STRENGTH: return 1.8;
    case GOALS.MASS: return 2.0;
    case GOALS.LOSE: return 2.2;
    case GOALS.CUT: return 2.2;
    case GOALS.ENDURANCE: return 1.6;
    case GOALS.RECOMP: return 2.0;
    default: return 2.0;
  }
}

/** Нормы жиров, г на кг массы тела. */
export function fatsPerKg(goal: string): number {
  switch (normalizeGoal(goal)) {
    case GOALS.LOSE:
    case GOALS.CUT: return 0.8;
    case GOALS.MASS: return 1.0;
    case GOALS.ENDURANCE: return 0.8;
    default: return 0.9;
  }
}

/** Рекомендованная частота тренировок в неделю с учётом уровня и цели. */
export function recommendPerWeek(level: string, goal: string): number {
  let base: number;
  if (level === 'advanced') base = 5;
  else if (level === 'intermediate') base = 4;
  else base = 3;
  if (normalizeGoal(goal) === GOALS.ENDURANCE) return Math.min(base + 1, 6);
  return base;
}

/** Рекомендованное число дней в сплите под уровень/цель. */
export function recommendDays(level: string, goal: string): number {
  let base: number;
  if (level === 'advanced') base = 4;
  else base = 3;
  if (normalizeGoal(goal) === GOALS.ENDURANCE) return Math.min(base + 1, 6);
  return base;
}

/** Дефицит (калории ниже поддержки). */
export function isDeficit(goal: string): boolean {
  const g = normalizeGoal(goal);
  return g === GOALS.LOSE || g === GOALS.CUT;
}

export function isMass(goal: string): boolean {
  return normalizeGoal(goal) === GOALS.MASS;
}

/** Углеводы — остаток от калорий после белка и жиров. */
export function carbsPerKg(goal: string): number | null {
  // Не фиксированная норма: считается от остатка калорий.
  return null;
}
