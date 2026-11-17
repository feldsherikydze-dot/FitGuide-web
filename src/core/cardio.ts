// Кардио в программе: упражнения группы g17 идут по таймеру, а не по повторам.
//
// В каталоге у них bundle = "cardio". Слот получает workSec — тогда экран
// тренировки показывает обратный отсчёт подхода. Это зеркало Cardio.java,
// чтобы Android и веб давали одинаковые настройки.

import type { Exercise } from '../data/types';

export const CARDIO_GROUP = 'g17';
/** 20 минут — рабочий дефолт для дорожки, велотренажёра и т. п. */
export const CARDIO_WORK_SEC = 20 * 60;
export const CARDIO_REPS = '20 мин';

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

/** Настройки слота под кардио: один «подход» на 20 минут. */
export function cardioDefaults(): CardioPatch {
  return {
    sets: 1,
    reps: CARDIO_REPS,
    rest: '0 сек',
    restEx: '60 сек',
    startWeight: 0,
    workSec: CARDIO_WORK_SEC,
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
