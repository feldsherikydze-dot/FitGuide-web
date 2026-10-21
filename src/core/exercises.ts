// FitGuide Web — загрузчик базы упражнений

import type { Exercise, MuscleGroup, ExercisesDB } from '../data/types';

let exercisesCache: ExercisesDB | null = null;

export async function loadExercisesDB(): Promise<ExercisesDB> {
  if (exercisesCache) return exercisesCache;

  try {
    // Путь ОТНОСИТЕЛЬНЫЙ: приложение может лежать в подпапке
    // (https://user.github.io/repo/) — абсолютный '/exercises.json' даёт 404.
    const res = await fetch(`${import.meta.env.BASE_URL}exercises.json`);
    if (!res.ok) throw new Error(`exercises.json: HTTP ${res.status}`);
    exercisesCache = await res.json();
    return exercisesCache!;
  } catch (e) {
    console.error('Failed to load exercises:', e);
    // Fallback minimal data
    exercisesCache = {
      version: 3,
      muscleGroups: [],
      exercises: [],
    };
    return exercisesCache;
  }
}

export function getAllExercises(db: ExercisesDB): Exercise[] {
  return db.exercises;
}

export function getExerciseById(db: ExercisesDB, id: string): Exercise | undefined {
  return db.exercises.find(e => e.id === id);
}

export function getExercisesByMuscleGroup(db: ExercisesDB, groupId: string): Exercise[] {
  return db.exercises.filter(e => e.muscleGroup === groupId);
}

export function getExercisesBySubgroup(db: ExercisesDB, groupId: string, subgroupId: string): Exercise[] {
  return db.exercises.filter(e => e.muscleGroup === groupId && e.subgroup === subgroupId);
}

export function getExerciseMuscleGroup(db: ExercisesDB, exerciseId: string): MuscleGroup | undefined {
  const ex = getExerciseById(db, exerciseId);
  if (!ex) return undefined;
  return db.muscleGroups.find(g => g.id === ex.muscleGroup);
}

export function getExerciseSubgroup(db: ExercisesDB, exerciseId: string): { group: MuscleGroup; subgroup: any } | undefined {
  const ex = getExerciseById(db, exerciseId);
  if (!ex) return undefined;
  const group = db.muscleGroups.find(g => g.id === ex.muscleGroup);
  if (!group) return undefined;
  const subgroup = group.subgroups.find(s => s.id === ex.subgroup);
  return subgroup ? { group, subgroup } : undefined;
}

// Фильтр по доступному оборудованию (как в Android версии)
export function filterByEquipment(db: ExercisesDB, availableEquipment: string[]): Exercise[] {
  if (!availableEquipment.length) return db.exercises;

  const eqSet = new Set(availableEquipment.map(e => e.toLowerCase()));

  return db.exercises.filter(ex => {
    const eq = (ex.equipmentType || '').toLowerCase();
    if (!eq) return true; // нет требований — доступно всегда

    // Проверяем, есть ли хоть одно совпадение
    return Array.from(eqSet).some(avail => eq.includes(avail));
  });
}

// Поиск упражнений
export function searchExercises(db: ExercisesDB, query: string): Exercise[] {
  const q = query.toLowerCase().trim();
  if (!q) return db.exercises;
  return db.exercises.filter(e =>
    e.name.toLowerCase().includes(q) ||
    e.target.toLowerCase().includes(q) ||
    e.muscleGroup.toLowerCase().includes(q) ||
    e.category?.toLowerCase().includes(q) ||
    e.equipmentType?.toLowerCase().includes(q)
  );
}

// Определение категории оборудования (порт с Exercise.equipCategory)
export const EQUIP_CAT = {
  BARBELL: 'barbell',
  DUMBBELL: 'dumbbell',
  CABLE: 'cable',
  SMITH: 'smith',
  MACHINE: 'machine',
  FREE: '',
} as const;

export function getEquipCategory(ex: Exercise): string {
  const e = (ex.equipmentType || '').toLowerCase();
  if (!e) return EQUIP_CAT.FREE;

  if (e.includes('смит')) {
    const slash = e.indexOf('/');
    if (slash >= 0 && e.indexOf('смит') > slash) return EQUIP_CAT.BARBELL;
    return EQUIP_CAT.SMITH;
  }
  if (e.includes('блин')) return EQUIP_CAT.DUMBBELL;
  if (e.includes('скотта')) return EQUIP_CAT.MACHINE;
  if (e.includes('штан') || e.includes('гриф')) return EQUIP_CAT.BARBELL;
  if (e.includes('гантел') || e.includes('гир')) return EQUIP_CAT.DUMBBELL;
  if (e.includes('блок') || e.includes('кроссовер')) return EQUIP_CAT.CABLE;
  if (e.includes('тренажёр') || e.includes('тренажер') || e.includes('рычажн')
    || e.includes('станок') || e.includes('маятник') || e.includes('гравитрон')
    || e.includes('ghd') || e.includes('v-squat') || e.includes('dynamax')
    || e.includes('hammer') || e.includes('жим ногами') || e.includes('экстензи')
    || e.includes('гиперэкстенз')) {
    return EQUIP_CAT.MACHINE;
  }
  return EQUIP_CAT.FREE;
}

export function isBasicExercise(ex: Exercise): boolean {
  const t = (ex.type || '').toLowerCase();
  return t === 'basic' || t.includes('базов');
}

export function isIsolationExercise(ex: Exercise): boolean {
  const t = (ex.type || '').toLowerCase();
  return t.includes('изолир');
}