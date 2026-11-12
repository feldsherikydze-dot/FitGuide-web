// FitGuide Web — готовые планы «Программ легенд».
//
// Раньше карточка легенды хранила только название и описание, а упражнения
// подбирал генератор — то есть «программа чемпиона» была обёрткой над общим
// алгоритмом. Здесь лежат настоящие планы: день → упражнение → подходы ×
// повторы.
//
// Имена упражнений должны буквально совпадать с exercises.json: слоты
// тренировки ищут упражнение по названию (Slot.exercise = Exercise.name).

import type { Day, ExercisesDB, Program, Slot } from '../data/types';
import type { LegendProgram } from './legends';
import PLANS_JSON from '../data/legendPlans.json' with { type: 'json' };

export interface LegendPlanItem {
  name: string;
  sets: number;
  reps: string;
  rest?: string;
}

export interface LegendPlanDay {
  title: string;
  items: LegendPlanItem[];
}

export interface LegendPlan {
  id: string;
  days: LegendPlanDay[];
}

const PLANS = (PLANS_JSON as { plans: LegendPlan[] }).plans;
const BY_ID = new Map<string, LegendPlan>(PLANS.map(p => [p.id, p]));

/** План легенды по id либо null, если для неё плана нет (тогда работает генератор). */
export function legendPlanFor(id: string): LegendPlan | null {
  return BY_ID.get(id) ?? null;
}

/** Есть ли у легенды настоящий план тренировок. */
export function hasLegendPlan(id: string): boolean {
  return BY_ID.has(id);
}

/** Базовое упражнение — тяжёлое, отдых 90–120 с; остальное — 45–60 с. */
function isBasic(ex: { type?: string } | undefined): boolean {
  const t = (ex?.type || '').toLowerCase();
  return t.startsWith('базов') || t === 'basic';
}

/**
 * Собирает программу из плана легенды: одна фаза на весь цикл, дни — как в
 * источнике. Возвращает null, если плана нет или ни одно упражнение не
 * нашлось в базе (тогда вызывающий код откатывается на генератор).
 */
export function buildLegendProgram(p: LegendProgram, db: ExercisesDB | null): Program | null {
  const plan = legendPlanFor(p.id);
  if (!plan || !db || !db.exercises.length) return null;

  const groupName = new Map(db.muscleGroups.map(g => [g.id, g.name]));
  const byName = new Map(db.exercises.map(e => [e.name, e]));

  const days: Day[] = [];
  for (const d of plan.days) {
    const slots: Slot[] = [];
    for (const item of d.items) {
      const ex = byName.get(item.name);
      if (!ex) continue;
      const basic = isBasic(ex);
      slots.push({
        exercise: item.name,
        group: groupName.get(ex.muscleGroup) || '',
        reps: item.reps,
        rest: item.rest || (basic ? '90–120 сек' : '45–60 сек'),
        sets: item.sets,
        role: basic ? 'main' : 'isolation',
      });
    }
    if (slots.length) days.push({ title: d.title, slots });
  }
  if (!days.length) return null;

  const now = Date.now();
  return {
    id: `legend_${p.id}_${now}`,
    name: p.name,
    goal: p.goal,
    level: p.level,
    daysPerWeek: days.length,
    weeks: p.weeks,
    createdAt: now,
    phases: [{
      weekStart: 1,
      weekEnd: p.weeks,
      label: 'Основной цикл',
      scheme: '',
      deload: false,
      days,
    }],
  };
}
