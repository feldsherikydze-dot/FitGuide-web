// Дерево выбора упражнений (порт Picker.java + DataProvider.pickerNodeMatches).
//
// В picker.json три уровня: регион → мышца → головка/пучок, и карта
// «id упражнения → [мышца, головка]». Упражнение видно в узле, если мышца
// основная ИЛИ совпала с одной из вторичных (target / secondaryMuscles) —
// ровно как в Android.

import type { Exercise, MuscleGroup, PickerDB } from '../data/types';

export interface PickerIndex {
  /** id упражнения → мышца дерева. */
  muscleOf: Map<string, string>;
  /** id упражнения → головка/пучок ('' = не задана). */
  headOf: Map<string, string>;
  /** id упражнения → регион дерева. */
  regionOf: Map<string, string>;
  /** мышца дерева → регион. */
  regionByMuscle: Map<string, string>;
  /** имя вторичной мышцы (нижний регистр) → [мышца, головка]. */
  secondaryByName: Map<string, [string, string]>;
}

/** Наша группа мышц → мышцы анатомического дерева (как GROUP_TO_PICKER_MUSCLES). */
const GROUP_TO_PICKER_MUSCLES: Record<string, string[]> = {
  'Плечи': ['delts', 'rotator'],
  'Пресс': ['rectus', 'obliques', 'core'],
  'Трапеции': ['traps'],
  'Широчайшие': ['lats'],
  'Поясница': ['erectors'],
  'Ромбовидные': ['rhomboids'],
  'Бицепс': ['biceps'],
  'Трицепс': ['triceps'],
  'Предплечья': ['forearm'],
  'Квадрицепс': ['quads'],
  'Бицепс бедра': ['hams'],
  'Ягодицы': ['glutes'],
  'Приводящие': ['adductors'],
  'Икры': ['calves', 'tibialis'],
  'Шея': ['neck'],
  'Грудь': ['chest'],
};

const lower = (v: string | null | undefined) => (v || '').trim().toLowerCase();

/**
 * Мышца и головка дерева для упражнения по основной группе и подгруппе
 * (порт DataProvider.pickerMuscleFor). Подгруппа уточняет дельты и пресс.
 */
export function pickerMuscleFor(groupName: string, subgroupName: string): [string, string] {
  const list = GROUP_TO_PICKER_MUSCLES[groupName];
  const muscle = list && list.length ? list[0] : '';
  if (!muscle) return ['', ''];
  const sub = lower(subgroupName);
  if (groupName === 'Плечи') {
    if (sub.startsWith('передняя дельта')) return ['delts', 'front'];
    if (sub.startsWith('средняя дельта')) return ['delts', 'mid'];
    if (sub.startsWith('задняя дельта')) return ['delts', 'rear'];
    if (sub.startsWith('вращательная')) return ['rotator', ''];
  } else if (groupName === 'Пресс') {
    if (sub.startsWith('верхний отдел')) return ['rectus', 'upper'];
    if (sub.startsWith('нижний отдел')) return ['rectus', 'lower'];
    if (sub.startsWith('косые')) return ['obliques', ''];
    if (sub.startsWith('кор')) return ['core', ''];
  }
  return [muscle, ''];
}

/**
 * Имена вторичных мышц → [мышца, головка]. Имена, которые встречаются у
 * разных групп, не берём: по ним нельзя однозначно понять мышцу.
 */
function buildSecondaryByName(groups: MuscleGroup[]): Map<string, [string, string]> {
  const seen = new Map<string, number>();
  const bump = (name: string | null | undefined) => {
    const key = lower(name);
    if (!key) return;
    seen.set(key, (seen.get(key) || 0) + 1);
  };
  for (const g of groups || []) {
    bump(g.name);
    for (const sg of g.subgroups || []) bump(sg.name);
  }

  const out = new Map<string, [string, string]>();
  const put = (name: string, pair: [string, string]) => {
    const key = lower(name);
    if (!key || seen.get(key) !== 1 || !pair[0]) return;
    out.set(key, pair);
  };
  for (const g of groups || []) {
    const gn = g.name || '';
    if (!gn) continue;
    put(gn, pickerMuscleFor(gn, ''));
    for (const sg of g.subgroups || []) put(sg.name || '', pickerMuscleFor(gn, sg.name || ''));
  }
  return out;
}

export function buildPickerIndex(
  picker: PickerDB | null,
  groups: MuscleGroup[],
  exercises: Exercise[],
): PickerIndex {
  const index: PickerIndex = {
    muscleOf: new Map(),
    headOf: new Map(),
    regionOf: new Map(),
    regionByMuscle: new Map(),
    secondaryByName: buildSecondaryByName(groups),
  };
  if (!picker) return index;

  for (const r of picker.regions || []) {
    for (const m of r.muscles || []) index.regionByMuscle.set(m.id, r.id);
  }

  for (const ex of exercises || []) {
    const pair = picker.map?.[ex.id];
    if (!pair || !pair.length) continue;
    const muscle = pair[0] || '';
    index.muscleOf.set(ex.id, muscle);
    index.headOf.set(ex.id, pair[1] || '');
    index.regionOf.set(ex.id, index.regionByMuscle.get(muscle) || '');
  }
  return index;
}

/** Пары [мышца, головка] вторичных мышц упражнения. */
function secondaryPairs(index: PickerIndex, ex: Exercise): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const add = (name: string | null | undefined) => {
    const pair = index.secondaryByName.get(lower(name));
    if (pair) out.push(pair);
  };
  add(ex.target);
  for (const m of ex.secondaryMuscles || []) add(m);
  return out;
}

/** Совпадение упражнения с узлом дерева (порт pickerNodeMatches). */
export function pickerNodeMatches(
  index: PickerIndex,
  ex: Exercise,
  regionId: string,
  muscleId: string,
  headId: string,
): boolean {
  if (!ex || !ex.id || !index.muscleOf.has(ex.id)) return false;
  const byMuscle = !!muscleId;
  const byRegion = !!regionId;
  const byHead = !!headId;
  if (!byMuscle && !byRegion) return true;

  if (byMuscle) {
    if (muscleId === index.muscleOf.get(ex.id)) {
      const ph = index.headOf.get(ex.id) || '';
      if (!byHead || !ph || headId === ph) return true;
    }
    for (const [m, h] of secondaryPairs(index, ex)) {
      if (m !== muscleId) continue;
      if (!byHead || !h || headId === h) return true;
    }
    return false;
  }

  if (regionId === index.regionOf.get(ex.id)) return true;
  for (const [m] of secondaryPairs(index, ex)) {
    if (regionId === index.regionByMuscle.get(m)) return true;
  }
  return false;
}

/** Упражнения выбранного узла дерева. */
export function pickerExercises(
  index: PickerIndex,
  exercises: Exercise[],
  regionId: string,
  muscleId: string,
  headId: string,
): Exercise[] {
  return exercises.filter(ex => pickerNodeMatches(index, ex, regionId, muscleId, headId));
}

/** Упражнение пришло в узел по основной мышце (а не по вторичной). */
export function isPrimaryInPicker(
  index: PickerIndex,
  ex: Exercise | null | undefined,
  regionId: string,
  muscleId: string,
): boolean {
  if (!ex || !ex.id) return true;
  if (muscleId) return muscleId === index.muscleOf.get(ex.id);
  if (regionId) return regionId === index.regionOf.get(ex.id);
  return true;
}

/** Регион, в котором лежит мышца. */
export function regionOfMuscle(picker: PickerDB | null, muscleId: string): string {
  if (!picker || !muscleId) return '';
  for (const r of picker.regions || []) {
    if ((r.muscles || []).some(m => m.id === muscleId)) return r.id;
  }
  return '';
}
