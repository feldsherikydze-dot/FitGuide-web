// FitGuide Web — загрузчик базы упражнений

import type { Exercise, MuscleGroup, ExercisesDB } from '../data/types';

let exercisesCache: ExercisesDB | null = null;
let exercisesInFlight: Promise<ExercisesDB> | null = null;

export async function loadExercisesDB(): Promise<ExercisesDB> {
  if (exercisesCache) return exercisesCache;

  // Несколько экранов могут запросить базу одновременно (анализ, программы,
  // база упражнений) — держим один запрос, а не три.
  if (exercisesInFlight) return exercisesInFlight;

  exercisesInFlight = (async () => {
    try {
      // Путь ОТНОСИТЕЛЬНЫЙ: приложение может лежать в подпапке
      // (https://user.github.io/repo/) — абсолютный '/exercises.json' даёт 404.
      const res = await fetch(`${import.meta.env.BASE_URL}exercises.json`);
      if (!res.ok) throw new Error(`exercises.json: HTTP ${res.status}`);
      exercisesCache = await res.json();
      return exercisesCache!;
    } catch (e) {
      console.error('Failed to load exercises:', e);
      // Пустую базу НЕ кэшируем: иначе один сбой сети кладёт анализ объёма
      // до перезапуска приложения. Следующий экран попробует ещё раз.
      return { version: 3, muscleGroups: [], exercises: [] };
    } finally {
      exercisesInFlight = null;
    }
  })();

  return exercisesInFlight;
}

/**
 * Ключ сопоставления упражнения с базой: регистр, «ё», лишние пробелы.
 * Программы приходят из Android, из старых бэкапов и из ручных правок —
 * «Жим  штанги ЛЕЖА» и «жим штанги лежа» должны найти одну карточку.
 */
export function normalizeExerciseKey(name: string): string {
  return String(name || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
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

// Короткое имя для карточек программы: скобки с уточнениями убираем,
// длинный хвост режем по слову. Полное имя остаётся на экране упражнения.
export function shortExerciseName(full: string): string {
  if (!full) return '';
  const stripped = full.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  const s = stripped || full.trim();
  if (s.length <= 44) return s;
  let cut = s.lastIndexOf(' ', 44);
  if (cut < 20) cut = 44;
  // Хвостовые «/», «·», «-» после обрезки читаются как обрыв, а не имя.
  const head = s.slice(0, cut).replace(/[^\p{L}\p{N})]+$/u, '').trim();
  return head ? `${head}…` : s;
}

// Человеческое имя целевой мышцы для карточек: в каталоге поле target
// смешивает латынь и русский («средняя (грудинная) часть m. pectoralis major»
// рядом с «грудь»). Для поиска данные не трогаем, но показываем по-русски.
export function humanMuscle(raw: string): string {
  if (!raw || !raw.trim()) return '';
  const s = raw.trim();
  const l = s.toLowerCase();
  if (l.includes('дельт') || l.includes('deltoideus')) {
    if (l.includes('передн')) return 'Передняя дельта';
    if (l.includes('задн')) return 'Задняя дельта';
    if (l.includes('средн')) return 'Средняя дельта';
    return 'Плечи';
  }
  if (l.includes('широчайш') || l.includes('latissimus')) return 'Широчайшие';
  if (l.includes('трапец') || l.includes('trapezius')) return 'Трапеция';
  if (l.includes('ромбовид')) return 'Ромбовидные';
  if (l.includes('поясниц') || l.includes('erector spinae')) return 'Поясница';
  if (l.includes('бицепс бедра') || l.includes('biceps femoris') || l.includes('hamstring')) return 'Бицепс бедра';
  if (l.includes('квадрицепс') || l.includes('quadriceps')) return 'Квадрицепс';
  if (l.includes('ягодич') || l.includes('gluteus')) return 'Ягодицы';
  if (l.includes('трицепс') || l.includes('triceps')) return 'Трицепс';
  if (l.includes('бицепс') || l.includes('biceps') || l.includes('brachialis')) return 'Бицепс';
  if (l.includes('предплеч') || l.includes('brachioradialis')) return 'Предплечья';
  if (l.includes('икронож') || l.includes('камбаловид') || l.includes('gastrocnemius') || l.includes('soleus')) return 'Икры';
  if (l.includes('большеберц') || l.includes('tibialis')) return 'Передняя большеберцовая';
  if (l.includes('косые') || l.includes('obliquus')) return 'Косые мышцы живота';
  if (l.includes('пресс') || l.includes('прямая мышца живота') || l.includes('rectus abdominis')) return 'Пресс';
  if (l.includes('приводящ') || l.includes('adductor')) return 'Приводящие';
  if (l.includes('зубчат') || l.includes('serratus')) return 'Зубчатая';
  if (l.includes('вращательн') || l.includes('infraspinatus') || l.includes('teres')) return 'Вращательная манжета';
  if (l.includes('шея') || l.includes('sternocleidomastoid') || l.includes('грудино-ключично')) return 'Шея';
  if (l.includes('груд') || l.includes('pectoralis')) return 'Грудь';
  if (l.includes('сердечно') || l.includes('cardio')) return 'Кардио';
  if (l.includes('хват')) return 'Хват и предплечья';
  const out = s.replace(/\([^)]*\)/g, ' ').replace(/m\.\s*[A-Za-z. ]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!out) return s;
  return out.charAt(0).toUpperCase() + out.slice(1);
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

/**
 * Звёзды рейтинга: шесть позиций, половина звезды — «½».
 * Оценка эффективности идёт с шагом 0.5, поэтому половина допускается.
 */
export function ratingStars(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  let out = '';
  for (let i = 0; i < 6; i++) {
    if (i < full) out += '★';
    else if (i === full && half) out += '½';
    else out += '☆';
  }
  return out;
}

/** Оценка числом с запятой: «4,5». */
export function ratingText(rating: number): string {
  return Number.isInteger(rating) ? String(rating) : String(rating).replace('.', ',');
}