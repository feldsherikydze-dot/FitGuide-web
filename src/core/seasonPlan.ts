// FitGuide Web — сезонный план (порт SeasonPlan.java)
//
// Тренер ведёт спортсмена от межсезонья до сцены и на каждую фазу сезона
// собирает свой тренировочный блок:
//   межсезонье — объём и масса,
//   база       — сила,
//   сушка      — рельеф с сохранением мышц,
//   пик        — реализация силы,
//   старт      — подводка,
//   после старта — восстановление.
// Когда фаза меняется или блок закончился, тренер собирает новый блок и ставит
// его активным, а прежний оставляет в истории (можно вернуться).

import type { Program, UserProfile, SeasonBlock, CoachState } from '../data/types';
import { COMP_PHASE, GOAL, STYLE } from '../data/types';
import { GOALS } from './goals';
import * as CompCategory from './compCategory';

export const PERIOD_NONE = 0;
export const PERIOD_LINEAR = 1;
export const PERIOD_WAVE = 2;

export const TYPE_AUTO = 'auto';
export const TYPE_FULLBODY = 'fullbody';
export const TYPE_SPLIT = 'split';
export const TYPE_CIRCUIT = 'circuit';

export const COMP_PHASE_LABELS: Record<string, string> = {
  [COMP_PHASE.OFFSEASON]: 'Межсезонье',
  [COMP_PHASE.BUILD]: 'База',
  [COMP_PHASE.CUT]: 'Сушка',
  [COMP_PHASE.PEAK]: 'Пик',
  [COMP_PHASE.DAY]: 'День старта',
  [COMP_PHASE.RECOVERY]: 'Восстановление',
};

/** Описание тренировочного блока под фазу сезона. */
export function blockFor(phase: string | null, programType: string): SeasonBlock | null {
  if (!phase) return null;
  const type = programType || TYPE_AUTO;
  switch (phase) {
    case COMP_PHASE.OFFSEASON:
      return { phase, name: 'Межсезонье · база на массу', goal: GOALS.MASS, style: STYLE.BB, weeks: 8, period: PERIOD_LINEAR, type };
    case COMP_PHASE.BUILD:
      return { phase, name: 'База · сила', goal: GOALS.STRENGTH, style: STYLE.BB, weeks: 6, period: PERIOD_LINEAR, type };
    case COMP_PHASE.CUT:
      return { phase, name: 'Сушка · рельеф', goal: GOALS.CUT, style: STYLE.BB, weeks: 5, period: PERIOD_WAVE, type };
    case COMP_PHASE.PEAK:
      return { phase, name: 'Пик · реализация силы', goal: GOALS.STRENGTH, style: STYLE.PL, weeks: 3, period: PERIOD_WAVE, type };
    case COMP_PHASE.DAY:
      return { phase, name: 'Старт · подводка', goal: GOALS.STRENGTH, style: STYLE.PL, weeks: 1, period: PERIOD_NONE, type: TYPE_AUTO };
    case COMP_PHASE.RECOVERY:
      return { phase, name: 'Восстановление после старта', goal: GOALS.MAINTAIN, style: STYLE.ANY, weeks: 3, period: PERIOD_NONE, type: TYPE_AUTO };
    default:
      return null;
  }
}

/** Все фазы сезона по порядку — для UI. */
export const COMP_PHASE_ORDER = [
  COMP_PHASE.OFFSEASON,
  COMP_PHASE.BUILD,
  COMP_PHASE.CUT,
  COMP_PHASE.PEAK,
  COMP_PHASE.DAY,
  COMP_PHASE.RECOVERY,
] as const;

/**
 * Что тренер сейчас советует по питанию — с учётом текущего веса и фазы сезона.
 * Межсезонье: набираем, пока не дошли до ориентира межсезонья, дальше держим.
 * Сушка: режем, пока не вышли на ориентир сцены, дальше держим.
 * Без даты старта цель не трогаем.
 */
export function adviseGoal(params: {
  compPhase: string | null;
  profile: UserProfile | null;
  stageWeightKg: number;
  offseasonWeightKg: number;
}): string | null {
  const { compPhase, profile, stageWeightKg, offseasonWeightKg } = params;
  if (!compPhase || !profile) return null;

  const weight = profile.weightKg;
  switch (compPhase) {
    case COMP_PHASE.OFFSEASON:
      return offseasonWeightKg > 0 && weight >= offseasonWeightKg - 0.5 ? GOALS.MAINTAIN : GOALS.MASS;
    case COMP_PHASE.BUILD:
      return offseasonWeightKg > 0 && weight >= offseasonWeightKg - 0.5 ? GOALS.MAINTAIN : GOALS.STRENGTH;
    case COMP_PHASE.CUT:
      return stageWeightKg > 0 && weight <= stageWeightKg + 0.3 ? GOALS.MAINTAIN : GOALS.CUT;
    case COMP_PHASE.RECOVERY:
      return GOALS.MAINTAIN;
    default:
      return GOALS.STRENGTH;
  }
}

/**
 * Если фаза сезона сменилась или текущий блок отработан — нужно собрать новый блок.
 * Без даты старта ничего не делаем: сезон не идёт.
 */
export function shouldRotate(params: {
  compPhase: string | null;
  activeProgram: Program | null;
  builtFor: string;
  weeksSinceStart: number;
}): boolean {
  const { compPhase, activeProgram, builtFor, weeksSinceStart } = params;
  if (!compPhase) return false;
  let rotate = !activeProgram || compPhase !== builtFor;
  if (!rotate) {
    // блок считается отработанным только после его последней недели (а не на ней)
    rotate = activeProgram!.weeks > 0 && weeksSinceStart > activeProgram!.weeks;
  }
  return rotate;
}

/** Ориентир веса на сцене по категории и росту (CompCategory.stageWeightKg). */
export function stageWeightKg(heightCm: number, category: string): number {
  return CompCategory.stageWeightKg(heightCm, category);
}

/** Ориентир межсезонья: сцена плюс запас на сушку (CompCategory.offseasonKg). */
export function offseasonWeightKg(heightCm: number, category: string, _currentWeight?: number): number {
  return CompCategory.offseasonKg(heightCm, category);
}

// ---------------------------------------------------------------- фазы сезона

/** Сколько дней до старта отводим на сушку (10 недель) — минимум. */
export const CUT_DAYS = 70;
/** Сколько дней базы отводим до начала сушки. */
export const BUILD_AFTER_CUT_DAYS = 70;
/** Последняя неделя перед стартом — пик. */
export const PEAK_DAYS = 7;
/** Сколько дней после старта держим восстановление. */
export const RECOVERY_DAYS = 14;

/** Дней до старта: 0 — старт сегодня, меньше нуля — уже прошёл. null — даты нет. */
export function daysToComp(compDate: number | null | undefined, now: number): number | null {
  if (!compDate || compDate <= 0) return null;
  const day = 86400000;
  const from = Math.floor(now / day);
  const to = Math.floor(compDate / day);
  return to - from;
}

/** Фаза сезона по числу дней до старта (отрицательное — уже прошёл). */
export function compPhaseForDays(
  days: number,
  cutDays: number = CUT_DAYS,
  buildAfterCutDays: number = BUILD_AFTER_CUT_DAYS,
): string {
  if (days < 0) {
    return days >= -RECOVERY_DAYS ? COMP_PHASE.RECOVERY : COMP_PHASE.OFFSEASON;
  }
  if (days === 0) return COMP_PHASE.DAY;
  if (days <= PEAK_DAYS) return COMP_PHASE.PEAK;
  if (days <= cutDays) return COMP_PHASE.CUT;
  if (days <= cutDays + buildAfterCutDays) return COMP_PHASE.BUILD;
  return COMP_PHASE.OFFSEASON;
}
