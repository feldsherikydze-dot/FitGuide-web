// FitGuide Web — генератор программ (порт ProgramGenerator.java)
//
// Что учитывает (всё это реально меняет программу):
//  - цели (мультицели, ведущая цель по приоритету);
//  - уровень подготовки — объём на день;
//  - направление (пауэрлифтинг/бодибилдинг/без разницы);
//  - тип программы (авто/фулбоди/сплит/круговая);
//  - число дней и недель;
//  - периодизация (без / линейная / волнообразная);
//  - место тренировок (зал/дом) — через подбор упражнений.
//
// Научные ориентиры: MAV по RP (rpstrength / arvo.guru volume-landmarks),
// отдых по диапазону повторов (Тибадо), объём 6–16 подходов на мышцу в неделю.

import type { Program, Slot, Phase, Day, Exercise, GeneratorInput, ExercisesDB } from '../data/types';
import { STYLE, GOAL } from '../data/types';
import { GOALS, normalizeGoal, primaryGoal } from './goals';
import { getEquipCategory, isBasicExercise } from './exercises';

export const TYPE_AUTO = 'auto';
export const TYPE_FULLBODY = 'fullbody';
export const TYPE_SPLIT = 'split';
export const TYPE_CIRCUIT = 'circuit';

export const PERIOD_NONE = 0;
export const PERIOD_LINEAR = 1;
export const PERIOD_WAVE = 2;

/** Индекс разгрузочной фазы. */
const PHASE_DELOAD = 3;

export const ROLE_MAIN = 'main';
export const ROLE_SECONDARY = 'secondary';
export const ROLE_ISOLATION = 'isolation';

// ---------------------------------------------------------------- утилиты

/** Java String.hashCode — чтобы отбор упражнений совпадал с Android-версией. */
function javaHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

function floorMod(a: number, b: number): number {
  return ((a % b) + b) % b;
}

function settingsSeed(...parts: string[]): number {
  const sb = parts.map(p => p + '|').join('');
  return Math.abs(javaHash(sb));
}

function roundHalf(v: number): number {
  return v <= 0 ? 0 : Math.round(v * 2) / 2;
}

/** Уровень сложности упражнения как ранг: 1 — все, 2 — средний, 3 — сложный. */
export function levelRank(level: string | null | undefined): number {
  if (!level) return 3;
  const l = level.trim().toLowerCase();
  if (!l) return 3;
  if (l === 'beginner' || l === 'все' || l === 'начинающий') return 1;
  if (l === 'intermediate' || l === 'средний' || l === 'средний–продвинутый') return 2;
  return 3;
}

function difficultyRank(difficulty: string | null | undefined): number {
  const d = (difficulty || '').toLowerCase();
  if (d.includes('средний–продвинутый') || d.includes('средний-продвинутый') || d.includes('продвинутый')) return 3;
  if (d.includes('средний')) return 2;
  return 1;
}

/** Направление тренировок: пауэрлифтинг — только база, бодибилдинг — всё. */
export function isPowerExercise(ex: Exercise): boolean {
  if (isBasicExercise(ex)) return true;
  const n = (ex.name || '').toLowerCase();
  return n.includes('присед') || n.includes('станов') || n.includes('жим л')
    || n.includes('жим лежа') || n.includes('тяга') || n.includes('подтягива');
}

function trainDirFilter(list: Exercise[], style: string): Exercise[] {
  if (style !== STYLE.PL) return list;
  const out = list.filter(isPowerExercise);
  return out.length ? out : list;
}

// ---------------------------------------------------------------- шаблоны

interface Template { id: string; titles: string[] }

/** Кандидат слота: группа + приоритет подбора + роль + ключевые слова + запреты. */
interface Spec {
  group: string;
  priority: string;
  role: string;
  keys: string[];
  ban: string[];
  fixedSets: number;
  fixedReps: string | null;
}

function splitKeys(s: string): string[] {
  if (!s) return [];
  return s.split(';').map(p => p.trim().toLowerCase()).filter(Boolean);
}

function s(group: string, priority: string, role: string, keys: string, ban: string): Spec {
  return { group, priority, role, keys: splitKeys(keys), ban: splitKeys(ban), fixedSets: 0, fixedReps: null };
}

function sFix(group: string, priority: string, role: string, keys: string, ban: string, fixedSets: number, fixedReps: string): Spec {
  return { group, priority, role, keys: splitKeys(keys), ban: splitKeys(ban), fixedSets, fixedReps };
}

/** Матрица: дни/неделю → классический шаблон. Сила меняет схемы, не титулы. */
function buildTemplate(days: number, type: string, power: boolean): Template {
  if (type === TYPE_FULLBODY) {
    return { id: 'fullbody_ab', titles: cycle(days, 'Полное тело A', 'Полное тело B') };
  }
  if (type === TYPE_CIRCUIT) {
    return { id: 'circuit', titles: cycle(days, 'Круговая A · 3 круга', 'Круговая B · 3 круга') };
  }
  switch (days) {
    case 2:
      return { id: 'fullbody_ab', titles: ['Полное тело A', 'Полное тело B'] };
    case 3:
      if (type === TYPE_SPLIT) return { id: 'bro3', titles: ['Грудь', 'Спина', 'Ноги'] };
      return { id: 'fullbody_ab', titles: ['Полное тело A', 'Полное тело B', 'Полное тело A'] };
    case 4:
      if (power) {
        return { id: 'phul', titles: ['Верх · сила', 'Низ · сила', 'Верх · объём', 'Низ · объём'] };
      }
      return { id: 'upper_lower', titles: ['Верх A', 'Низ A', 'Верх B', 'Низ B'] };
    case 5:
      return { id: 'ulppl', titles: ['Верх · жим', 'Низ · квадрицепс', 'Толкай', 'Тяни', 'Ноги'] };
    default:
      return { id: 'ppl_ab', titles: cycle(days, 'Толкай A', 'Тяни A', 'Ноги A', 'Толкай B', 'Тяни B', 'Ноги B') };
  }
}

function cycle(days: number, ...titles: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < days; i++) out.push(titles[i % titles.length]);
  return out;
}

/** Силовой ли день: здесь действуют низкие повторы (3–5 на базе). */
function isPowerDay(templateId: string, dayTitle: string, power: boolean): boolean {
  if (!power) return false;
  const t = dayTitle;
  if (t.includes('сила') || t.includes('Полное тело')) return true;
  if (templateId === 'ppl_ab') return t.includes(' A');
  return !t.includes('объём');
}

// ---------------------------------------------------------------- планы дней

function planForDay(dayTitle: string, female: boolean, strengthB: boolean): Spec[] {
  const t = dayTitle;
  const variantB = t.includes('B') || t.includes('объём');
  if (t.includes('Круговая')) return circuitPlan(variantB);
  if (t.includes('Полное тело')) {
    if (variantB) return strengthB ? fullbodyBStrength(female) : fullbodyB(female);
    return fullbodyA(female);
  }
  if (t.includes('Верх')) {
    if (variantB) return female ? upperBFemale() : upperB();
    return female ? upperAFemale() : upperA();
  }
  if (t.includes('Низ')) {
    if (variantB) return female ? lowerBFemale() : lowerB();
    return female ? lowerAFemale() : lowerA();
  }
  if (t.includes('Толкай')) {
    if (female) return pushFemale();
    return variantB ? pushB() : pushA();
  }
  if (t.includes('Тяни')) return variantB ? pullB() : pullA();
  if (t.includes('Ноги')) {
    if (female) return legsAFemale();
    return variantB ? legsB() : legsA();
  }
  if (t.includes('Грудь')) return pushA();
  if (t.includes('Спина')) return pullA();
  // фолбэк: тяги + руки
  return [
    s('Широчайшие', 'row', ROLE_MAIN, 'наклон', 'блок'),
    s('Ромбовидные', 'row', ROLE_SECONDARY, 'гантел;нижнего', ''),
    s('Бицепс', 'curl', ROLE_ISOLATION, 'сгибан;молот', ''),
  ];
}

function circuitPlan(variantB: boolean): Spec[] {
  if (variantB) {
    return [
      s('Широчайшие', 'row', ROLE_SECONDARY, 'блок;подтягиван', ''),
      s('Квадрицепс', 'squat', ROLE_MAIN, 'присед;выпад', ''),
      s('Трицепс', 'iso', ROLE_ISOLATION, '', ''),
      s('Плечи', 'press', ROLE_SECONDARY, 'жим;махи', ''),
      s('Икры', 'calf', ROLE_ISOLATION, 'носк', ''),
      s('Бицепс', 'curl', ROLE_ISOLATION, 'сгибан', ''),
    ];
  }
  return [
    s('Квадрицепс', 'squat', ROLE_MAIN, 'присед;выпад', ''),
    s('Грудь', 'bench', ROLE_MAIN, 'жим;отжиман', ''),
    s('Широчайшие', 'row', ROLE_SECONDARY, 'тяга;блок', ''),
    s('Плечи', 'press', ROLE_SECONDARY, 'жим;махи', ''),
    s('Бицепс бедра', 'hinge', ROLE_SECONDARY, 'румын;сгибан', ''),
    s('Бицепс', 'curl', ROLE_ISOLATION, 'сгибан', ''),
  ];
}

function fullbodyA(female: boolean): Spec[] {
  const plan = [
    s('Квадрицепс', 'squat', ROLE_MAIN, 'приседания со штангой;классические приседания', 'фронт;гакк'),
    s('Грудь', 'bench', ROLE_MAIN, 'горизонтальной', 'наклон;обратным'),
    s('Широчайшие', 'row', ROLE_MAIN, 'наклон', 'блок;подтягиван;пуловер'),
    s('Плечи', 'press', ROLE_SECONDARY, 'стоя;сидя', 'махи;развед;блок'),
    s('Бицепс бедра', 'hinge', ROLE_SECONDARY, 'румын;сгибан', 'гипер'),
  ];
  if (female) {
    // женский акцент: ягодицы в каждом фулбоди-дне
    plan.push(s('Ягодицы', 'hinge', ROLE_SECONDARY, 'мост;хип-траст;выпад', ''));
  }
  return plan;
}

function fullbodyB(female: boolean): Spec[] {
  const plan: Spec[] = [
    s('Квадрицепс', 'squat', ROLE_MAIN, 'приседания со штангой;классические приседания', 'фронт;гакк'),
    s('Плечи', 'press', ROLE_MAIN, 'армейский;жим гантелей сидя', 'махи;развед'),
    s('Широчайшие', 'row', ROLE_MAIN, 'подтягиван;блок', 'наклон'),
  ];
  if (!female) {
    plan.push(s('Грудь', 'bench', ROLE_SECONDARY, 'наклон', 'вниз;обратным'));
  } else {
    plan.push(s('Ягодицы', 'hinge', ROLE_SECONDARY, 'мост;хип-траст', ''));
    plan.push(s('Бицепс бедра', 'hinge', ROLE_SECONDARY, 'румын;сгибан', ''));
  }
  plan.push(s('Бицепс', 'curl', ROLE_ISOLATION, 'сгибан;молот', ''));
  return plan;
}

function fullbodyBStrength(female: boolean): Spec[] {
  const plan: Spec[] = [
    s('Квадрицепс', 'squat', ROLE_MAIN, 'приседания со штангой;классические приседания', 'фронт;гакк'),
    s('Плечи', 'press', ROLE_MAIN, 'армейский;жим гантелей сидя', 'махи;развед'),
    sFix('Поясница', 'hinge', ROLE_MAIN, 'классич', 'румын;мёртв;мертв;гипер;сумо', 1, '5'),
  ];
  if (female) plan.push(s('Ягодицы', 'hinge', ROLE_SECONDARY, 'мост;хип-траст', ''));
  plan.push(s('Бицепс', 'curl', ROLE_ISOLATION, 'сгибан;молот', ''));
  return plan;
}

function upperA(): Spec[] {
  return [
    s('Грудь', 'bench', ROLE_MAIN, 'горизонтальной', 'наклон;обратным'),
    s('Широчайшие', 'row', ROLE_MAIN, 'наклон', 'блок;подтягиван;пуловер'),
    s('Плечи', 'press', ROLE_SECONDARY, 'стоя;сидя', 'махи;развед;блок'),
    s('Широчайшие', 'row', ROLE_SECONDARY, 'блок', 'наклон;подтягиван;за голову'),
    s('Плечи', 'iso', ROLE_ISOLATION, 'стороны', 'перед собой;наклон;блок;тренажер;кроссовер'),
    s('Бицепс', 'curl', ROLE_ISOLATION, 'сгибан;молот', ''),
    s('Трицепс', 'iso', ROLE_ISOLATION, 'блок;канат', 'французск;лежа'),
  ];
}

function upperB(): Spec[] {
  return [
    s('Широчайшие', 'row', ROLE_MAIN, 'подтягиван', 'гравитрон;лопатк'),
    s('Грудь', 'bench', ROLE_MAIN, 'наклон', 'вниз;обратным'),
    s('Плечи', 'press', ROLE_SECONDARY, 'сидя', 'махи'),
    s('Ромбовидные', 'row', ROLE_SECONDARY, 'гантел;одной', 'блок;рычажн'),
    s('Грудь', 'iso', ROLE_ISOLATION, 'развед;кроссовер;пуловер', ''),
    s('Трицепс', 'iso', ROLE_ISOLATION, 'французск', ''),
    s('Бицепс', 'curl', ROLE_ISOLATION, 'молот', ''),
  ];
}

function upperAFemale(): Spec[] {
  return [
    s('Широчайшие', 'row', ROLE_MAIN, 'наклон', 'блок;подтягиван'),
    s('Грудь', 'bench', ROLE_SECONDARY, 'горизонтальной', 'наклон'),
    s('Плечи', 'press', ROLE_SECONDARY, 'стоя;сидя', 'махи'),
    s('Ромбовидные', 'row', ROLE_SECONDARY, 'гантел;блок', ''),
    s('Плечи', 'iso', ROLE_ISOLATION, 'стороны', 'перед собой;блок'),
    s('Бицепс', 'curl', ROLE_ISOLATION, 'сгибан', ''),
    s('Трицепс', 'iso', ROLE_ISOLATION, 'блок', ''),
  ];
}

function upperBFemale(): Spec[] {
  return [
    s('Широчайшие', 'row', ROLE_MAIN, 'подтягиван;блок', 'наклон'),
    s('Плечи', 'press', ROLE_SECONDARY, 'сидя;стоя', 'махи'),
    s('Ромбовидные', 'row', ROLE_SECONDARY, 'гантел;нижнего', ''),
    s('Грудь', 'bench', ROLE_SECONDARY, 'наклон', 'вниз'),
    s('Плечи', 'iso', ROLE_ISOLATION, 'стороны', ''),
    s('Бицепс', 'curl', ROLE_ISOLATION, 'сгибан;молот', ''),
    s('Трицепс', 'iso', ROLE_ISOLATION, 'блок;канат', ''),
  ];
}

function lowerA(): Spec[] {
  return [
    s('Квадрицепс', 'squat', ROLE_MAIN, 'классические;широкой', 'фронт;гакк'),
    s('Квадрицепс', 'squat', ROLE_SECONDARY, 'выпад;болгар;ногами', 'фронт'),
    s('Бицепс бедра', 'hinge', ROLE_SECONDARY, 'румын;сгибан', ''),
    s('Икры', 'calf', ROLE_ISOLATION, 'носк', ''),
    s('Пресс', 'core', ROLE_ISOLATION, 'скручиван;планка', 'блок'),
  ];
}

function lowerB(): Spec[] {
  return [
    s('Бицепс бедра', 'hinge', ROLE_MAIN, 'румын;станов', 'гипер;мертв;мёртв'),
    s('Ягодицы', 'hinge', ROLE_SECONDARY, 'мост;хип-траст', ''),
    s('Квадрицепс', 'squat', ROLE_SECONDARY, 'разгибан', ''),
    s('Икры', 'calf', ROLE_ISOLATION, 'носк', ''),
    s('Пресс', 'core', ROLE_ISOLATION, 'скручиван;планка', 'блок'),
  ];
}

function lowerAFemale(): Spec[] {
  return [
    s('Ягодицы', 'hinge', ROLE_MAIN, 'мост;хип-траст', ''),
    s('Квадрицепс', 'squat', ROLE_MAIN, 'классические;широкой;приседания со штангой', 'фронт;гакк'),
    s('Бицепс бедра', 'hinge', ROLE_SECONDARY, 'румын;сгибан', ''),
    s('Ягодицы', 'iso', ROLE_ISOLATION, 'назад;коленях;разведение', 'тренажер'),
    s('Икры', 'calf', ROLE_ISOLATION, 'носк', ''),
  ];
}

function lowerBFemale(): Spec[] {
  return [
    s('Квадрицепс', 'squat', ROLE_SECONDARY, 'болгар;выпад', ''),
    s('Ягодицы', 'hinge', ROLE_SECONDARY, 'выпад;сплит', 'мост'),
    s('Бицепс бедра', 'hinge', ROLE_SECONDARY, 'сгибан;румын', ''),
    s('Ягодицы', 'iso', ROLE_ISOLATION, 'назад;разведение', ''),
    s('Пресс', 'core', ROLE_ISOLATION, 'скручиван;планка', ''),
  ];
}

function pushA(): Spec[] {
  return [
    s('Грудь', 'bench', ROLE_MAIN, 'горизонтальной', 'наклон;обратным'),
    s('Грудь', 'bench', ROLE_SECONDARY, 'наклон', 'вниз;обратным'),
    s('Плечи', 'press', ROLE_SECONDARY, 'стоя', 'махи'),
    s('Грудь', 'iso', ROLE_ISOLATION, 'развед;кроссовер;пуловер;брус', ''),
    s('Плечи', 'iso', ROLE_ISOLATION, 'стороны', ''),
    s('Трицепс', 'iso', ROLE_ISOLATION, 'блок;канат', 'французск;лежа'),
    s('Трицепс', 'iso', ROLE_ISOLATION, 'французск;лежа', 'блок'),
  ];
}

function pushB(): Spec[] {
  return [
    s('Плечи', 'press', ROLE_MAIN, 'стоя', 'махи'),
    s('Грудь', 'bench', ROLE_MAIN, 'наклон', 'вниз;обратным'),
    s('Плечи', 'press', ROLE_SECONDARY, 'сидя', 'махи'),
    s('Плечи', 'iso', ROLE_ISOLATION, 'стороны', ''),
    s('Трицепс', 'iso', ROLE_ISOLATION, 'французск', ''),
    s('Трицепс', 'iso', ROLE_ISOLATION, 'блок;канат', 'французск'),
    s('Грудь', 'iso', ROLE_ISOLATION, 'кроссовер;развед', ''),
  ];
}

function pushFemale(): Spec[] {
  return [
    s('Плечи', 'press', ROLE_MAIN, 'стоя', 'махи'),
    s('Грудь', 'bench', ROLE_SECONDARY, 'наклон', 'вниз;обратным'),
    s('Плечи', 'press', ROLE_SECONDARY, 'сидя', 'махи'),
    s('Плечи', 'iso', ROLE_ISOLATION, 'стороны', ''),
    s('Грудь', 'iso', ROLE_ISOLATION, 'развед', ''),
    s('Трицепс', 'iso', ROLE_ISOLATION, 'блок', ''),
    s('Трицепс', 'iso', ROLE_ISOLATION, 'французск', 'блок'),
  ];
}

function pullA(): Spec[] {
  return [
    s('Широчайшие', 'row', ROLE_MAIN, 'наклон', 'блок'),
    s('Широчайшие', 'row', ROLE_SECONDARY, 'блок', 'наклон;подтягиван'),
    s('Ромбовидные', 'row', ROLE_SECONDARY, 'гантел;нижнего;рычажн', ''),
    s('Плечи', 'iso', ROLE_ISOLATION, 'наклон;обратные', 'блок'),
    s('Бицепс', 'curl', ROLE_ISOLATION, 'сгибан', 'молот'),
    s('Бицепс', 'curl', ROLE_ISOLATION, 'молот;скотта', ''),
  ];
}

function pullB(): Spec[] {
  return [
    s('Широчайшие', 'row', ROLE_MAIN, 'подтягиван;блок', 'наклон'),
    s('Ромбовидные', 'row', ROLE_SECONDARY, 'нижнего;сидя', 'гантел'),
    s('Широчайшие', 'row', ROLE_SECONDARY, 'пуловер', ''),
    s('Плечи', 'iso', ROLE_ISOLATION, 'наклон', 'блок;тренажер'),
    s('Бицепс', 'curl', ROLE_ISOLATION, 'молот', ''),
    s('Бицепс', 'curl', ROLE_ISOLATION, 'сгибан', 'молот'),
  ];
}

function legsA(): Spec[] {
  return [
    s('Квадрицепс', 'squat', ROLE_MAIN, 'классические;широкой', 'фронт;гакк'),
    s('Бицепс бедра', 'hinge', ROLE_MAIN, 'румын;станов', 'гипер'),
    s('Квадрицепс', 'squat', ROLE_SECONDARY, 'выпад;ногами;болгар', ''),
    s('Ягодицы', 'hinge', ROLE_SECONDARY, 'мост;хип-траст', ''),
    s('Икры', 'calf', ROLE_ISOLATION, 'носк', ''),
    s('Пресс', 'core', ROLE_ISOLATION, 'скручиван;планка', ''),
  ];
}

function legsB(): Spec[] {
  return [
    s('Бицепс бедра', 'hinge', ROLE_MAIN, 'станов;румын', 'гипер'),
    s('Квадрицепс', 'squat', ROLE_MAIN, 'приседания со штангой;ногами', 'фронт'),
    s('Ягодицы', 'hinge', ROLE_SECONDARY, 'мост;выпад', ''),
    s('Квадрицепс', 'squat', ROLE_SECONDARY, 'разгибан', ''),
    s('Икры', 'calf', ROLE_ISOLATION, 'носк', ''),
    s('Пресс', 'core', ROLE_ISOLATION, 'планка;скручиван', ''),
  ];
}

function legsAFemale(): Spec[] {
  return [
    s('Ягодицы', 'hinge', ROLE_MAIN, 'мост;хип-траст', ''),
    s('Квадрицепс', 'squat', ROLE_MAIN, 'классические;широкой', 'фронт;гакк'),
    s('Бицепс бедра', 'hinge', ROLE_SECONDARY, 'румын;сгибан', ''),
    s('Квадрицепс', 'squat', ROLE_SECONDARY, 'выпад;болгар', ''),
    s('Ягодицы', 'iso', ROLE_ISOLATION, 'назад;разведение', ''),
    s('Икры', 'calf', ROLE_ISOLATION, 'носк', ''),
  ];
}

// ---------------------------------------------------------------- объём

/** Сколько раз в неделю мышца встречается в сплите (число дней, где она есть). */
function weeklyFrequency(dayTitles: string[], templateId: string, power: boolean, female: boolean): Map<string, number> {
  const freq = new Map<string, number>();
  for (const title of dayTitles) {
    const seen = new Set<string>();
    const strengthB = power && templateId === 'fullbody_ab' && title.includes('B');
    for (const spec of planForDay(title, female, strengthB)) seen.add(spec.group);
    for (const muscle of seen) freq.set(muscle, (freq.get(muscle) || 0) + 1);
  }
  return freq;
}

/**
 * Целевой недельный объём на мышцу (подходов/нед) — середина MAV по RP,
 * скорректированная под цель, уровень, фазу и профиль.
 */
function weeklyTargetSets(muscle: string, goal: string, level: string, phaseIndex: number,
                          deload: boolean, senior: boolean, female: boolean): number {
  let mav: number;
  if (female) {
    // женская ветка: акцент низ и спина, грудь и руки поддерживающе
    switch (muscle) {
      case 'Грудь': mav = 10; break;
      case 'Широчайшие': mav = 16; break;
      case 'Плечи': mav = 12; break;
      case 'Квадрицепс': mav = 15; break;
      case 'Бицепс бедра': mav = 12; break;
      case 'Ягодицы': mav = 16; break;
      case 'Бицепс':
      case 'Трицепс': mav = 10; break;
      case 'Икры': mav = 12; break;
      case 'Поясница': mav = 10; break;
      default: mav = 12;
    }
  } else {
    switch (muscle) {
      case 'Грудь': mav = 15; break;       // MEV 6–8 / MAV 12–18
      case 'Широчайшие': mav = 17; break; // MAV 14–20
      case 'Ромбовидные': mav = 12; break;
      case 'Плечи': mav = 14; break;      // MAV 12–16
      case 'Квадрицепс': mav = 15; break; // MAV 12–18
      case 'Бицепс бедра': mav = 12; break; // MAV 10–14
      case 'Ягодицы': mav = 13; break;
      case 'Бицепс': mav = 12; break;      // MAV 10–14
      case 'Трицепс': mav = 11; break;    // MAV 10–12
      case 'Икры': mav = 14; break;       // MAV 12–16
      case 'Поясница': mav = 10; break;
      default: mav = 12;
    }
  }

  let f = 1;
  const g = normalizeGoal(goal);
  if (g === GOALS.STRENGTH) f *= 0.85;      // сила: меньше объёма, выше интенсивность
  else if (g === GOALS.ENDURANCE) f *= 1.1;
  if (level === 'beginner') f *= 0.7;
  else if (level === 'advanced') f *= 1.1;
  if (deload) f *= 0.5;                      // разгрузочная неделя
  else if (phaseIndex === 2) f *= 0.85;      // пик: объём снижается, интенсивность растёт
  if (senior) f *= 0.85;

  const weekly = Math.round(mav * f);
  if (deload) return Math.max(4, weekly);   // разгрузка — исключение из нижней границы
  if (level === 'beginner') return Math.max(10, Math.min(12, weekly));
  return Math.max(10, Math.min(20, weekly));
}

/** Подходы на одну встречу мышцы в неделю: недельный объём / число встреч. */
function sessionSets(weeklyDays: Map<string, number>, goal: string, level: string,
                     phaseIndex: number, deload: boolean, senior: boolean, female: boolean): Map<string, number> {
  const out = new Map<string, number>();
  for (const [muscle, days] of weeklyDays) {
    const sessions = Math.max(1, days);
    const weekly = weeklyTargetSets(muscle, goal, level, phaseIndex, deload, senior, female);
    out.set(muscle, Math.max(2, Math.round(weekly / sessions)));
  }
  return out;
}

// ---------------------------------------------------------------- отдых и повторы

function maxRepsOf(reps: string | null | undefined): number {
  if (!reps) return 10;
  let max = 0;
  for (const part of reps.split(/[^0-9]+/)) {
    if (!part) continue;
    const n = parseInt(part, 10);
    if (!isNaN(n)) max = Math.max(max, n);
  }
  return max > 0 ? max : 10;
}

/** Диапазон отдыха в секундах: {lo, hi}. */
function restRangeSeconds(reps: string, deltaSec: number): [number, number] {
  const maxReps = maxRepsOf(reps);
  let lo: number, hi: number;
  if (maxReps <= 3) { lo = 180; hi = 240; }
  else if (maxReps <= 5) { lo = 120; hi = 180; }
  else if (maxReps <= 8) { lo = 90; hi = 120; }
  else if (maxReps <= 12) { lo = 60; hi = 90; }
  else if (maxReps <= 15) { lo = 45; hi = 60; }
  else if (maxReps <= 20) { lo = 30; hi = 45; }
  else { lo = 30; hi = 30; }
  lo = Math.max(15, lo + deltaSec);
  hi = Math.max(lo, hi + deltaSec);
  return [lo, hi];
}

/** Оформление диапазона секунд: «90–120 сек» / «2–3 мин». */
function formatRest(lo: number, hi: number): string {
  if (lo >= 120) {
    const a = Math.floor(lo / 60);
    let b = Math.ceil(hi / 60);
    if (b <= a) b = a + 1;
    return `${a}–${b} мин`;
  }
  return lo === hi ? `${lo} сек` : `${lo}–${hi} сек`;
}

function restForReps(reps: string, deltaSec: number): string {
  const [lo, hi] = restRangeSeconds(reps, deltaSec);
  return formatRest(lo, hi);
}

/** Отдых для слота: роль задаёт пол, повторы — базу, цель и профиль — правки. */
function restForMuscle(role: string, muscle: string, reps: string, deltaSec: number, goal: string): string {
  let [lo, hi] = restRangeSeconds(reps, 0);
  if (role === ROLE_MAIN) {
    // база: минимум 2–3 мин, даже если повторов много
    lo = Math.max(lo, 120);
    hi = Math.max(hi, 180);
  }
  if (role === ROLE_ISOLATION) {
    // изоляция: кап 60–90 с
    lo = Math.min(lo, 60);
    hi = Math.min(hi, 90);
  }
  const g = normalizeGoal(goal);
  if (g === GOALS.CUT || g === GOALS.LOSE || g === GOALS.ENDURANCE) {
    // сушка и выносливость: отдых на ступень короче
    lo = Math.max(15, lo - 15);
    hi = Math.max(lo, hi - 15);
  }
  lo = Math.max(15, lo + deltaSec);
  hi = Math.max(lo, hi + deltaSec);
  return formatRest(lo, hi);
}

/**
 * Диапазон повторов слота: таблица «цель × роль».
 * Силовой контекст — низкие на базе.
 */
function slotReps(role: string, goal: string, phaseIndex: number, style: string, powerDay: boolean): string {
  if (style === STYLE.PL) powerDay = true;
  const g = normalizeGoal(goal);

  if (powerDay) {
    if (role === ROLE_MAIN) return phaseIndex >= 2 ? '2–3' : '3–5';
    if (role === ROLE_SECONDARY) return '5–8';
    return '8–12';
  }
  if (g === GOALS.CUT) {
    if (role === ROLE_MAIN) return '10–12';
    if (role === ROLE_SECONDARY) return '12–15';
    return '15–20';
  }
  if (g === GOALS.ENDURANCE || g === GOALS.LOSE) {
    if (role === ROLE_MAIN) return '12–15';
    return '15–20';
  }
  // масса / рекомпозиция / поддержание
  if (role === ROLE_MAIN) return '6–10';
  if (role === ROLE_SECONDARY) return '8–12';
  return '12–15';
}

/** Подходы слота: вес роли в дневной норме мышцы (main 3 / secondary 2 / isolation 1). */
function slotSetsFor(role: string, dayTarget: number, weightSum: number, senior: boolean): number {
  const w = role === ROLE_MAIN ? 3 : (role === ROLE_SECONDARY ? 2 : 1);
  let sets = Math.round(dayTarget * w / Math.max(1, weightSum));
  if (role === ROLE_MAIN) sets = Math.max(3, Math.min(6, sets));
  else if (role === ROLE_SECONDARY) sets = Math.max(2, Math.min(5, sets));
  else sets = Math.max(2, Math.min(4, sets));
  if (senior) sets = Math.max(2, sets - 1);
  return sets;
}

// ---------------------------------------------------------------- фазы

/** plan: {weekStart, weekEnd, phaseIndex}. Последняя неделя при 6+ неделях — разгрузка. */
function phasePlan(totalWeeks: number, periodType: number): { start: number; end: number; idx: number }[] {
  const plan: { start: number; end: number; idx: number }[] = [];
  const withDeload = totalWeeks >= 6;
  const workWeeks = withDeload ? totalWeeks - 1 : totalWeeks;

  if (periodType === PERIOD_NONE) {
    plan.push({ start: 1, end: workWeeks, idx: 1 });
  } else if (periodType === PERIOD_WAVE) {
    // блоки по 2 недели, волна: объём → интенсивность → пик → интенсивность
    const blockLen = Math.max(1, Math.min(2, Math.floor(workWeeks / 3)));
    const pattern = [0, 1, 2, 1];
    let week = 1;
    let i = 0;
    while (week <= workWeeks) {
      const end = Math.min(week + blockLen - 1, workWeeks);
      addBlock(plan, week, end, pattern[i % pattern.length]);
      week = end + 1;
      i++;
    }
  } else {
    // линейная: равные трети мезоцикла
    const phaseLen = Math.max(1, Math.floor(workWeeks / 3));
    let week = 1;
    while (week <= workWeeks) {
      const idx = Math.min(2, Math.floor((week - 1) / phaseLen));
      const end = Math.min(week + phaseLen - 1, workWeeks);
      addBlock(plan, week, end, idx);
      week = end + 1;
    }
  }

  if (withDeload) {
    // смягчённый микроцикл в конце мезоцикла
    plan.push({ start: totalWeeks, end: totalWeeks, idx: PHASE_DELOAD });
  }
  return plan;
}

function addBlock(plan: { start: number; end: number; idx: number }[], start: number, end: number, idx: number): void {
  if (plan.length) {
    const last = plan[plan.length - 1];
    if (last.idx === idx && last.end + 1 === start) {
      last.end = end;
      return;
    }
  }
  plan.push({ start, end, idx });
}

const PHASE_LABELS: Record<number, string> = {
  0: 'Аккумуляция',
  1: 'Интенсификация',
  2: 'Пик',
  3: 'Разгрузка',
};

const PHASE_HINTS: Record<number, string> = {
  0: 'объём и техника',
  1: 'рабочий вес',
  2: 'интенсивность',
  3: 'восстановление',
};

/** Подходы на упражнение: сила тяжёлая, выносливость многоповторная, уровень корректирует. */
function setsFor(goal: string, phaseIndex: number, style: string, level: string): number {
  let sets: number;
  if (style === STYLE.PL) {
    sets = 5;
  } else {
    const g = normalizeGoal(goal);
    if (g === GOALS.STRENGTH) sets = 5;
    else if (g === GOALS.ENDURANCE) sets = 2 + Math.min(phaseIndex, 1);
    else if (g === GOALS.LOSE || g === GOALS.CUT || g === GOALS.RECOMP) sets = 3 + Math.min(phaseIndex, 1);
    else sets = 3 + phaseIndex;
  }
  if (level === 'beginner') sets = Math.max(2, sets - 1);
  else if (level === 'advanced' && style !== STYLE.PL) sets = sets + 1;
  return sets;
}

/** Авто: новичку и 2–3 дням — фулбоди (частота 2–3× на мышцу), дальше сплит. */
function resolveType(type: string, level: string, days: number): string {
  if (type === TYPE_FULLBODY || type === TYPE_SPLIT || type === TYPE_CIRCUIT) return type;
  if (level === 'beginner' || days <= 3) return TYPE_FULLBODY;
  return TYPE_SPLIT;
}

function exercisesPerDay(level: string, type: string): number {
  if (type === TYPE_CIRCUIT) return 6;
  if (level === 'beginner') return 4;
  if (level === 'advanced') return 6;
  return 5;
}

// ---------------------------------------------------------------- подбор упражнений

/** Домашний инвентарь: белый список; штанга, стойки, блоки и тренажёры — только зал. */
function homeOk(ex: Exercise): boolean {
  const s = `${ex.equipmentType || ''} ${ex.equipment || ''} ${ex.name || ''}`.toLowerCase();
  const gymBlack = ['штанг', 'гриф', 'стойк', 'смит', 'блин', 'блок', 'кроссовер',
    'тренажёр', 'тренажер', 'рычажн', 'гравитрон', 'бабочк', 'гакк', 'хаммер',
    'hammer', 'т-гриф', 'гиперэкстенз', 'помост', 'машина', 'станок'];
  for (const k of gymBlack) if (s.includes(k)) return false;

  const homeWhite = ['гантел', 'гир', 'собственн', 'не требуется', 'турник', 'брус',
    'эспандер', 'резин', 'коврик', 'фитбол', 'скамь', 'trx', 'кольца', 'упор',
    'паралет', 'степ', 'платформ', 'медбол', 'мяч', 'скакалк', 'петл', 'пол',
    'стул', 'лавк', 'ролик', 'роллер', 'стен', 'тело', 'вес тела'];
  for (const k of homeWhite) if (s.includes(k)) return true;
  return false;
}

function poolFor(all: Exercise[], spec: Spec, levelFilter: string, place: string, style: string,
                homeStrict: boolean, equipment: string[]): Exercise[] {
  let base = all;
  if (levelFilter) {
    const maxRank = levelRank(levelFilter);
    base = base.filter(ex => difficultyRank(ex.difficulty) <= maxRank);
  }
  base = trainDirFilter(base, style);

  const pool: Exercise[] = [];
  for (const ex of base) {
    if (homeStrict && !homeOk(ex)) continue;

    // оборудование зала: упражнение должно уметь выполняться на том, что отмечено
    if (equipment.length) {
      const cat = getEquipCategory(ex);
      if (cat !== '' && !equipment.includes(cat)) continue;
    }

    const n = (ex.name || '').toLowerCase();
    const basic = isBasicExercise(ex);
    let match: boolean;
    switch (spec.priority) {
      case 'squat':
        match = n.includes('присед') || n.includes('жим ногами') || n.includes('выпад');
        break;
      case 'hinge':
        match = n.includes('станов') || n.includes('румын') || n.includes('тяга')
          || n.includes('ягодичный мост') || n.includes('разгибани')
          || n.includes('мост') || n.includes('сгибан');
        break;
      case 'curl':
        match = n.includes('сгибан') || n.includes('подъем') || n.includes('подъём')
          || n.includes('молот');
        break;
      case 'bench':
        match = n.includes('жим') || n.includes('отжиман') || basic;
        break;
      case 'press':
        match = n.includes('жим') || n.includes('махи') || n.includes('развед') || basic;
        break;
      case 'row':
        match = n.includes('тяга') || n.includes('тянут') || n.includes('подтягиван')
          || n.includes('пуловер') || basic;
        break;
      case 'iso':
        match = !basic;
        break;
      case 'calf':
        match = n.includes('подъем') || n.includes('подъём') || n.includes('икр')
          || n.includes('носк');
        break;
      default:
        match = true;
    }
    if (!match) continue;

    if (spec.keys.length) {
      let keyHit = false;
      for (const k of spec.keys) { if (n.includes(k)) { keyHit = true; break; } }
      if (!keyHit) continue;
    }

    let banned = false;
    for (const b of spec.ban) { if (n.includes(b)) { banned = true; break; } }
    if (banned) continue;

    pool.push(ex);
  }
  return pool;
}

/** База первой для main/secondary, изоляция первой для isolation. */
function orderPool(pool: Exercise[], spec: Spec): Exercise[] {
  const basicFirst = spec.role !== ROLE_ISOLATION;
  const ordered: Exercise[] = [];
  for (const ex of pool) if (isBasicExercise(ex) === basicFirst) ordered.push(ex);
  for (const ex of pool) if (isBasicExercise(ex) !== basicFirst) ordered.push(ex);
  return ordered.length ? ordered : pool;
}

/**
 * Стадии: (1) уровень + ключи → (2) без уровня, ключи держим →
 * (3) полное ослабление. Ключи важнее уровня: снимаем уровень первым.
 */
function pick(groupExercises: Exercise[], spec: Spec, phaseIndex: number, seed: number,
              level: string, place: string, style: string, salt: string,
              used: Set<string>, equipment: string[]): Slot | null {
  const home = place === 'home';

  for (let stage = 0; stage < 3; stage++) {
    const levelFilter = stage === 0 ? level : '';
    const useSpec: Spec = (stage === 2 && spec.keys.length)
      ? { ...spec, keys: [], ban: [] }
      : spec;

    const pool = poolFor(groupExercises, useSpec, levelFilter, place, style, home, equipment);
    const ordered = orderPool(pool, spec);
    if (!ordered.length) continue;

    const saltHash = salt ? javaHash(salt) : 0;
    const base = floorMod(seed + saltHash + phaseIndex * 7, ordered.length);
    for (let k = 0; k < ordered.length; k++) {
      const chosen = ordered[(base + k) % ordered.length];
      if (!chosen.name || used.has(chosen.name)) continue;
      used.add(chosen.name);
      return { exercise: chosen.name, group: spec.group, reps: '', rest: '', sets: 0 };
    }
  }
  return null;
}

// ---------------------------------------------------------------- сборка дня

interface BuildDayParams {
  dayTitle: string;
  templateId: string;
  goal: string;
  phaseIndex: number;
  seed: number;
  level: string;
  place: string;
  style: string;
  power: boolean;
  female: boolean;
  senior: boolean;
  rest: string;
  exLimit: number;
  sessionSets: Map<string, number> | null;
  phaseSets: number;
  restDelta: number;
  equipment: string[];
  groupIdByName: (name: string) => string | null;
  exercisesOf: (groupId: string) => Exercise[];
}

function buildDaySlots(p: BuildDayParams): Slot[] {
  const slots: Slot[] = [];
  const circuit = p.sessionSets === null;
  const strengthB = p.power && p.templateId === 'fullbody_ab' && p.dayTitle.includes('B');
  const plan = planForDay(p.dayTitle, p.female, strengthB);
  const powerDay = circuit ? false : isPowerDay(p.templateId, p.dayTitle, p.power);
  const fullbody = p.templateId === 'fullbody_ab';
  const beginner = p.level === 'beginner';

  const limit = Math.min(plan.length, Math.max(2, p.exLimit));
  const used = new Set<string>();
  const taken: Spec[] = [];

  for (let i = 0; i < limit; i++) {
    const spec = plan[i];
    const groupId = p.groupIdByName(spec.group);
    if (!groupId) continue;
    const slot = pick(p.exercisesOf(groupId), spec, p.phaseIndex, p.seed, p.level, p.place,
      p.style, `${p.dayTitle}|${spec.group}|${spec.role}|${i}`, used, p.equipment);
    if (!slot) continue;

    slot.group = spec.group;
    slot.role = spec.role as Slot['role'];
    slot.reps = circuit ? '12–15'
      : (spec.fixedReps ?? slotReps(spec.role, p.goal, p.phaseIndex, p.style, powerDay));
    slot.rest = circuit ? p.rest
      : restForMuscle(spec.role, spec.group, slot.reps, p.restDelta, p.goal);
    slots.push(slot);
    taken.push(spec);
  }

  if (circuit) {
    for (const s of slots) s.sets = p.phaseSets;
    return slots;
  }

  // подходы: дневная норма мышцы делится между её слотами по весу роли
  const weightSum = new Map<string, number>();
  for (const spec of taken) {
    const w = spec.role === ROLE_MAIN ? 3 : (spec.role === ROLE_SECONDARY ? 2 : 1);
    weightSum.set(spec.group, (weightSum.get(spec.group) || 0) + w);
  }

  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    const spec = taken[i];
    if (spec.fixedSets > 0) { s.sets = spec.fixedSets; continue; }
    const dayTarget = p.sessionSets!.get(s.group) ?? p.phaseSets;
    let sets = slotSetsFor(spec.role, dayTarget, weightSum.get(s.group) ?? 1, p.senior);
    if (powerDay && fullbody && spec.role === ROLE_MAIN) {
      sets = beginner ? 5 : Math.max(4, Math.min(5, sets));
    }
    if (p.female && s.group === 'Грудь') sets = Math.min(sets, 3);
    s.sets = sets;
  }

  // гардрейл: подходов в день ≤24 (новичок ≤16). main неприкосновенен —
  // режем только secondary/isolation, не ниже 2 подходов.
  const dayCap = beginner ? 16 : 24;
  let total = slots.reduce((sum, s) => sum + s.sets, 0);
  while (total > dayCap) {
    let best = -1;
    for (let i = 0; i < slots.length; i++) {
      const sp = taken[i];
      const s = slots[i];
      if (sp.fixedSets > 0 || sp.role === ROLE_MAIN || s.sets <= 2) continue;
      if (best < 0 || s.sets > slots[best].sets) best = i;
    }
    if (best < 0) break;
    slots[best].sets--;
    total--;
  }

  return slots;
}

// ---------------------------------------------------------------- главная функция

export interface GenerateOptions {
  name: string;
  goal: string;
  level: string;
  daysPerWeek: number;
  weeks: number;
  place: string;
  style: string;
  periodType: number;
  type: string;
  equipment?: string[];
  age?: number;
  female?: boolean;
}

export function generateProgram(opts: GenerateOptions, db: ExercisesDB): Program {
  const totalWeeks = opts.weeks > 0 ? opts.weeks : 12;
  const days = Math.max(2, Math.min(7, opts.daysPerWeek));
  const style = opts.style || STYLE.ANY;
  const resolvedType = resolveType(opts.type, opts.level, days);
  const circuit = resolvedType === TYPE_CIRCUIT;
  const primaryGoal = normalizeGoal(opts.goal);
  const power = style === STYLE.PL || primaryGoal === GOALS.STRENGTH;

  const equipment = opts.equipment || [];
  const seed = settingsSeed(opts.name, opts.goal, opts.level, String(days), String(totalWeeks),
    resolvedType, style, opts.place, String(opts.periodType), equipment.join(','));
  const template = buildTemplate(days, resolvedType, power);
  const exLimit = exercisesPerDay(opts.level, resolvedType);

  const age = opts.age || 0;
  const female = !!opts.female;
  const senior = age >= 40;
  const restDelta = (female ? -15 : 0) + (senior ? 30 : 0);

  // группы по имени
  const groupIdByName = (name: string): string | null => {
    const g = db.muscleGroups.find(x => x.name === name);
    return g ? g.id : null;
  };
  const exercisesOf = (groupId: string): Exercise[] =>
    db.exercises.filter(e => e.muscleGroup === groupId);

  const p: Program = {
    id: crypto.randomUUID(),
    name: opts.name,
    goal: opts.goal,
    level: opts.level,
    daysPerWeek: days,
    weeks: totalWeeks,
    createdAt: Date.now(),
    template: template.id,
    phases: [],
  };

  for (const block of phasePlan(totalWeeks, opts.periodType)) {
    const phaseIndex = block.idx;
    const deload = phaseIndex === PHASE_DELOAD;
    const schemeIndex = deload ? 1 : phaseIndex;

    const phase: Phase = {
      weekStart: block.start,
      weekEnd: block.end,
      label: deload ? PHASE_LABELS[3]
        : (opts.periodType === PERIOD_NONE ? 'Единый блок' : PHASE_LABELS[phaseIndex]),
      scheme: '',
      deload,
      days: [],
    };

    let sets = setsFor(opts.goal, schemeIndex, style, opts.level);
    if (senior) sets = Math.max(2, sets - 1);
    let reps = slotReps(ROLE_MAIN, opts.goal, schemeIndex, style, power);
    if (senior && (reps === '1–3' || reps === '2–3')) reps = '3–5';
    let rest = restForReps(reps, restDelta);
    if (circuit) { sets = 3; reps = '12–15'; rest = '30–45 сек'; }
    if (deload) sets = Math.max(2, sets - 2);

    const hint = PHASE_HINTS[phaseIndex] ?? PHASE_HINTS[2];
    let schemeReps = slotReps(ROLE_MAIN, opts.goal, schemeIndex, style, power);
    if (senior && (schemeReps === '1–3' || schemeReps === '2–3')) schemeReps = '3–5';
    const prog = deload ? '' : (power ? ' · прогрессия силы' : ' · прогрессия массы');

    phase.scheme = circuit
      ? `${sets}×${reps}, ${rest} · ${hint}`
      : `${schemeReps} на базу · ${hint}${prog}`;

    const dayTitles = template.titles;
    const weeklyDays = weeklyFrequency(dayTitles, template.id, power, female);
    const daySets = circuit ? null
      : sessionSets(weeklyDays, opts.goal, opts.level, phaseIndex, deload, senior, female);

    for (const dayTitle of dayTitles) {
      const day: Day = {
        title: dayTitle,
        slots: buildDaySlots({
          dayTitle, templateId: template.id, goal: opts.goal, phaseIndex, seed,
          level: opts.level, place: opts.place, style, power, female, senior,
          rest, exLimit, sessionSets: daySets, phaseSets: sets, restDelta,
          equipment, groupIdByName, exercisesOf,
        }),
      };
      phase.days.push(day);
    }
    p.phases.push(phase);
  }

  return p;
}

/** Удобная обёртка: из GeneratorInput. */
export function generateFromInput(input: GeneratorInput, db: ExercisesDB, profile?: {
  age?: number; female?: boolean; style?: string;
}): Program {
  const goal = primaryGoal(input.goals.join(','));
  return generateProgram({
    name: buildProgramName(input.type, input.daysPerWeek, goal),
    goal,
    level: input.level,
    daysPerWeek: input.daysPerWeek,
    weeks: input.weeks,
    place: input.location,
    style: profile?.style || STYLE.ANY,
    periodType: input.periodization === 'linear' ? PERIOD_LINEAR
      : input.periodization === 'wave' ? PERIOD_WAVE : PERIOD_NONE,
    type: input.type,
    equipment: input.equipment,
    age: profile?.age ?? input.age,
    female: profile?.female ?? (input.gender === 'female'),
  }, db);
}

export function buildProgramName(type: string, days: number, goal: string): string {
  const typeNames: Record<string, string> = {
    auto: 'Авто', fullbody: 'Фулбоди', split: 'Сплит', circuit: 'Круговая',
  };
  const goalNames: Record<string, string> = {
    [GOALS.STRENGTH]: 'Сила', [GOALS.MASS]: 'Масса',
    [GOALS.ENDURANCE]: 'Выносливость', [GOALS.CUT]: 'Рельеф', [GOALS.LOSE]: 'Похудение',
  };
  return `${typeNames[type] || type} ${days}дн · ${goalNames[normalizeGoal(goal)] || goal}`;
}

// ---------------------------------------------------------------- формулы e1RM

export function epley1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return weight * (1 + reps / 30);
}

export function brzycki1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return weight * 36 / (37 - reps);
}

export function calculate1RM(weight: number, reps: number): number {
  const e = epley1RM(weight, reps);
  const b = brzycki1RM(weight, reps);
  return Math.round(Math.min(e, b));
}

export { roundHalf };
