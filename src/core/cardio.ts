// Кардио в программе: упражнения группы g17 идут по таймеру, а не по повторам.
//
// В каталоге у них bundle = "cardio". Слот получает workSec — тогда экран
// тренировки показывает обратный отсчёт подхода. Это зеркало Cardio.java,
// чтобы Android и веб давали одинаковые настройки.

import type { Exercise } from '../data/types';
import { GOALS, normalizeGoal } from './goals';

export const CARDIO_GROUP = 'g17';
/** 20 минут — дефолт, когда цель не известна. */
export const CARDIO_WORK_SEC = 20 * 60;
export const CARDIO_REPS = '20 мин';

/**
 * Доза кардио по умолчанию под цель: на массе и силе кардио только для
 * здоровья (10–15 мин), на сушке и похудении — рабочий инструмент дефицита
 * (30–35), на выносливости — основной объём (45). Цифры — стартовая точка:
 * слот всё равно редактируется вручную.
 */
export function cardioMinutes(goal?: string | null): number {
  switch (normalizeGoal(goal)) {
    case GOALS.MASS: return 15;
    case GOALS.STRENGTH: return 10;
    case GOALS.CUT: return 30;
    case GOALS.LOSE: return 35;
    case GOALS.RECOMP: return 25;
    case GOALS.ENDURANCE: return 45;
    default: return 20;
  }
}

/**
 * Недельная норма кардио, минут умеренного темпа. Доза на тренировку и норма
 * на неделю — разные вещи: 15 минут на массе не значит «15 в неделю».
 * Диапазоны держатся вокруг рекомендации ACSM для взрослых (150–300 мин),
 * с поправкой на цель: силе и массе хватает нижней половины, дефициту и
 * выносливости — верхней.
 */
export interface CardioWeeklyNorm {
  min: number;
  max: number;
  /** Почему именно столько — для подписи. */
  note: string;
}

export function cardioWeeklyNorm(goal?: string | null): CardioWeeklyNorm {
  switch (normalizeGoal(goal)) {
    case GOALS.STRENGTH:
      return { min: 75, max: 150, note: 'минимум для сердца; больше — только если не мешает восстановлению' };
    case GOALS.MASS:
      return { min: 90, max: 150, note: 'фон для сердца, не больше — иначе кардио съедает восстановление' };
    case GOALS.RECOMP:
      return { min: 120, max: 200, note: 'жиросжигание без ущерба для мышц' };
    case GOALS.CUT:
      return { min: 150, max: 250, note: 'рабочий инструмент дефицита' };
    case GOALS.LOSE:
      return { min: 180, max: 300, note: 'основной инструмент дефицита' };
    case GOALS.ENDURANCE:
      return { min: 240, max: 420, note: 'основной объём подготовки' };
    default:
      return { min: 150, max: 300, note: 'норма для здоровья' };
  }
}

/** Одна строка для экрана «Анализ»: сколько кардио нужно на неделю. */
export function cardioWeeklyTip(goal?: string | null): string {
  const n = cardioWeeklyNorm(goal);
  return `Норма кардио на неделю: ${n.min}–${n.max} мин умеренного темпа — ${n.note}. `
    + 'Дели как удобно: 3–5 занятий.';
}

export interface CardioPatch {
  sets: number;
  reps: string;
  rest: string;
  restEx: string;
  startWeight: number;
  workSec: number;
}

export function isCardioExercise(ex?: Exercise | null): boolean {
  return !!ex && (ex.bundle === 'cardio' || ex.muscleGroup === CARDIO_GROUP);
}

/** Настройки слота под кардио: один «подход» на дозу под цель (по умолчанию 20 мин). */
export function cardioDefaults(goal?: string | null): CardioPatch {
  const workSec = cardioMinutes(goal) * 60;
  return {
    sets: 1,
    reps: workLabel(workSec),
    rest: '0 сек',
    restEx: '60 сек',
    startWeight: 0,
    workSec,
  };
}

/** Обратный переход: кардио заменили силовым — убираем таймер. */
export function strengthDefaults(): CardioPatch {
  return {
    sets: 3,
    reps: '10–12',
    rest: '60–90 сек',
    restEx: '2–3 мин',
    startWeight: 0,
    workSec: 0,
  };
}

/** В повторах уже время («20 мин», «40 сек»)? Тогда хвост «· 20 мин» — дубль. */
export function repsHasTime(reps?: string | null): boolean {
  if (!reps) return false;
  const s = reps.toLowerCase();
  return s.includes('мин') || s.includes('сек') || /(^|\s)с$/.test(s);
}

/** Время по-человечески: 1200 → «20 мин», 40 → «40 с» (Cardio.workLabel). */
export function workLabel(sec: number): string {
  if (!sec || sec <= 0) return '';
  if (sec >= 60) {
    const m = Math.floor(sec / 60);
    const r = sec % 60;
    return r === 0 ? `${m} мин` : `${m} мин ${r} с`;
  }
  return `${sec} с`;
}
