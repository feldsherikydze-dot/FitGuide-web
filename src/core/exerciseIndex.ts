// FitGuide Web — индекс упражнений (порт DataProvider.DeepIndex + TrainDir).
// Группа для упражнения может быть основной (muscleGroup) или вторичной
// (target / secondaryMuscles). Индекс строит обе связи, как в Android.

import type { Exercise, MuscleGroup } from '../data/types';
import { isBasicExercise, isIsolationExercise } from './exercises';

export interface ExerciseIndex {
  /** id группы → упражнения этой группы (порядок как в exercises.json). */
  byGroup: Map<string, Exercise[]>;
  /** id упражнения → вторичные мышцы в нижнем регистре. */
  secondaryLower: Map<string, Set<string>>;
  /** имя группы в нижнем регистре → id. */
  groupIdByLowerName: Map<string, string>;
  /** имя подгруппы в нижнем регистре → id групп, которым она принадлежит. */
  groupIdsByLowerSubgroup: Map<string, string[]>;
  /** id группы → (имя подгруппы в нижнем регистре → id подгруппы). */
  subgroupIdByLowerName: Map<string, Map<string, string>>;
  /** id группы → человекочитаемое имя. */
  groupNameById: Map<string, string>;
}

const lower = (v: string | null | undefined) => (v || '').trim().toLowerCase();

export function buildExerciseIndex(groups: MuscleGroup[], exs: Exercise[]): ExerciseIndex {
  const idx: ExerciseIndex = {
    byGroup: new Map(),
    secondaryLower: new Map(),
    groupIdByLowerName: new Map(),
    groupIdsByLowerSubgroup: new Map(),
    subgroupIdByLowerName: new Map(),
    groupNameById: new Map(),
  };

  for (const g of groups || []) {
    if (!g) continue;
    const gid = g.id || '';
    idx.groupNameById.set(gid, g.name || '');
    const lowGroup = lower(g.name);
    if (lowGroup) idx.groupIdByLowerName.set(lowGroup, gid);

    const subs = new Map<string, string>();
    for (const sg of g.subgroups || []) {
      const lowSub = lower(sg.name);
      if (!lowSub) continue;
      subs.set(lowSub, sg.id || '');
      const owners = idx.groupIdsByLowerSubgroup.get(lowSub) || [];
      if (!owners.includes(gid)) owners.push(gid);
      idx.groupIdsByLowerSubgroup.set(lowSub, owners);
    }
    idx.subgroupIdByLowerName.set(gid, subs);
  }

  for (const ex of exs || []) {
    if (!ex) continue;
    const exId = ex.id || '';
    const primary = ex.muscleGroup || '';

    const secondary = new Set<string>();
    const target = lower(ex.target);
    if (target) secondary.add(target);
    for (const muscle of ex.secondaryMuscles || []) {
      const low = lower(muscle);
      if (low) secondary.add(low);
    }
    idx.secondaryLower.set(exId, secondary);

    const hitGroups: string[] = [];
    if (primary) hitGroups.push(primary);
    for (const muscle of secondary) {
      const byGroupName = idx.groupIdByLowerName.get(muscle);
      if (byGroupName && !hitGroups.includes(byGroupName)) hitGroups.push(byGroupName);
      const bySubgroup = idx.groupIdsByLowerSubgroup.get(muscle);
      if (bySubgroup) {
        for (const gid of bySubgroup) {
          if (gid && !hitGroups.includes(gid)) hitGroups.push(gid);
        }
      }
    }

    for (const gid of hitGroups) {
      const list = idx.byGroup.get(gid) || [];
      list.push(ex);
      idx.byGroup.set(gid, list);
    }
  }

  return idx;
}

export function exercisesOf(idx: ExerciseIndex, groupId: string | null): Exercise[] {
  return (groupId && idx.byGroup.get(groupId)) || [];
}

export function isPrimaryForGroup(ex: Exercise | null | undefined, groupId: string | null): boolean {
  return !!ex && !!groupId && ex.muscleGroup === groupId;
}

/** Ранг сложности: beginner/все/начинающий = 1, intermediate/средний = 2, остальное = 3. */
export function levelRank(level: string | null | undefined): number {
  const l = (level || '').trim().toLowerCase();
  if (!l) return 3;
  if (l === 'beginner' || l === 'все' || l === 'начинающий') return 1;
  if (l === 'intermediate' || l === 'средний' || l === 'средний–продвинутый') return 2;
  return 3;
}

export function matchesType(ex: Exercise, typeFilter: string): boolean {
  if (!typeFilter || typeFilter === 'все') return true;
  if (typeFilter === 'basic' || typeFilter === 'базовое') return isBasicExercise(ex);
  if (typeFilter === 'isolation' || typeFilter === 'изолирующее') return isIsolationExercise(ex);
  return true;
}

function pass(ex: Exercise, levelFilter: string, typeFilter: string): boolean {
  return (!levelFilter || levelRank(ex.difficulty) <= levelRank(levelFilter))
    && matchesType(ex, typeFilter);
}

/** Только упражнения, где группа — основная (цель тренировки). */
export function byGroupPrimary(
  idx: ExerciseIndex, groupId: string, levelFilter = '', typeFilter = '',
): Exercise[] {
  return exercisesOf(idx, groupId).filter(ex => isPrimaryForGroup(ex, groupId) && pass(ex, levelFilter, typeFilter));
}

/** Только упражнения, где группа — вторичная мышца. */
export function secondaryForGroup(
  idx: ExerciseIndex, groupId: string, levelFilter = '', typeFilter = '',
): Exercise[] {
  return exercisesOf(idx, groupId).filter(ex => !isPrimaryForGroup(ex, groupId) && pass(ex, levelFilter, typeFilter));
}

/**
 * Подгруппа упражнения в контексте группы: для основного — своя подгруппа,
 * для вторичного — подгруппа, чьё имя совпало с вторичной мышцей. '' = нет.
 */
export function subgroupInGroup(idx: ExerciseIndex, ex: Exercise, groupId: string): string {
  if (!ex || !groupId) return '';
  if (ex.muscleGroup === groupId) return ex.subgroup || '';
  const subs = idx.subgroupIdByLowerName.get(groupId);
  if (!subs || subs.size === 0) return '';
  const secondary = idx.secondaryLower.get(ex.id);
  if (!secondary || secondary.size === 0) return '';
  for (const [name, id] of subs) {
    if (secondary.has(name)) return id;
  }
  return '';
}

/** TrainDir.isPower: пауэрлифтинг — только база и «большая тройка». */
export function isPowerExercise(ex: Exercise): boolean {
  if (!ex) return false;
  if (isBasicExercise(ex)) return true;
  const n = lower(ex.name);
  return n.includes('присед') || n.includes('станов') || n.includes('жим л')
    || n.includes('жим лежа') || n.includes('тяга') || n.includes('подтягива');
}

/** TrainDir.filter: при пауэрлифтинге оставляем силовые; пусто — возвращаем всё. */
export function filterByStyle(list: Exercise[], style: string): Exercise[] {
  if (style !== 'pl') return list;
  const out = list.filter(isPowerExercise);
  return out.length ? out : list;
}

/** Склонение «N упражнений» (MuscleGroupAdapter.plural). */
export function pluralExercises(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} упражнение`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} упражнения`;
  return `${n} упражнений`;
}
