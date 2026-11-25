// FitGuide Web — разбор программы (порт PlanAdvisor.java)
//
// Объём считается по id упражнения через дерево picker, а не по slot.group:
// в своих программах group пустой. Для сгенерированных программ, где group
// заполнен, он используется как запасной вариант.

import type { Program, Phase, Exercise, PickerDB } from '../data/types';
import { volumeNorm } from './volumeNorms';

export interface PlanReport {
  /** Регион (Грудь, Спина, Ноги…) → подходы в неделю. */
  regionVolume: [string, number][];
  /** Мышца (Квадрицепс, Широчайшие…) → подходы в неделю. */
  muscleVolume: [string, number][];
  totalSets: number;
  empty: boolean;
  /** true — предупреждений нет, план сбалансирован. */
  ok: boolean;
  /** Сначала предупреждения, потом советы. */
  tips: string[];
}

/** Порядок показа регионов. */
const REGION_ORDER = ['chest', 'back', 'legs', 'shoulders', 'arms', 'abs'];

/** Обязательные регионы: если пусто — предупреждаем. */
const REQUIRED_REGIONS = ['chest', 'back', 'legs'];

/**
 * Жим и тяга для проверки баланса.
 * Сравниваются СОПОСТАВИМЫЕ вещи: жим груди против тяги спины. Дельты, трицепс
 * и бицепс — отдельные мышцы со своими нормами, в сумму жимов/тяг не попадают.
 */
const PUSH = new Set(['chest']);
const PULL = new Set(['lats', 'traps', 'rhomboids']);

/** Соответствие наших групп мышц мышцам дерева (порт DataProvider.GROUP_TO_PICKER_MUSCLES). */
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

/** Мышца дерева для нашей группы по умолчанию ("" если группы нет в карте). */
export function pickerMuscleForGroup(groupName: string): string {
  const list = GROUP_TO_PICKER_MUSCLES[groupName];
  return list && list.length ? list[0] : '';
}

/** id мышцы дерева → наша группа, у которой есть норма объёма. */
const PICKER_TO_GROUP: Record<string, string> = {
  chest: 'Грудь',
  lats: 'Широчайшие',
  delts: 'Плечи',
  quads: 'Квадрицепс',
  hams: 'Бицепс бедра',
  glutes: 'Ягодицы',
  traps: 'Трапеции',
  biceps: 'Бицепс',
  triceps: 'Трицепс',
  calves: 'Икры',
  rectus: 'Пресс',
  erectors: 'Поясница',
  rhomboids: 'Ромбовидные',
  forearm: 'Предплечья',
  adductors: 'Приводящие',
  neck: 'Шея',
};

/** Рекомендуемый диапазон подходов в неделю для мышцы, которой нет в общей таблице. */
function range(muscleId: string): [number, number] | null {
  switch (muscleId) {
    case 'chest': return [8, 20];
    case 'lats': return [8, 20];
    case 'delts': return [6, 20];
    case 'quads': return [8, 20];
    case 'hams': return [6, 16];
    case 'glutes': return [4, 16];
    case 'traps': return [4, 16];
    case 'biceps': return [4, 16];
    case 'triceps': return [4, 16];
    case 'calves': return [4, 16];
    case 'rectus': return [0, 16];
    default: return null;
  }
}

export interface PlanAdvisorContext {
  picker: PickerDB | null;
  /** id группы (g1…) → название группы. */
  groupNameById: Record<string, string>;
  /** id упражнения → само упражнение (для поиска по имени). */
  byName: Map<string, Exercise>;
  /** Цель профиля — сдвигает нормы объёма (как в анализе тренировок). */
  goal?: string | null;
  /** Уровень профиля — нормы объёма как в анализе тренировок. */
  level?: string | null;
}

/** Разбор фазы: объём по мышцам + подсказки. */
export function analyzePhase(phase: Phase | null, ctx: PlanAdvisorContext): PlanReport {
  const r: PlanReport = {
    regionVolume: [], muscleVolume: [], totalSets: 0,
    empty: false, ok: true, tips: [],
  };
  if (!phase) { r.empty = true; return r; }

  const schemeSets = parseSets(phase.scheme);
  const byMuscleId = new Map<string, number>();
  const byLabel = new Map<string, number>();

  for (const day of phase.days || []) {
    for (const s of day.slots || []) {
      let sets = s.sets > 0 ? s.sets : schemeSets;
      if (sets <= 0) sets = 3;

      const ex = ctx.byName.get(s.exercise);
      let muscleId: string | null = null;

      if (ex) {
        const groupName = ctx.groupNameById[ex.muscleGroup] || '';
        const m = pickerMuscleForGroup(groupName);
        if (m) {
          muscleId = m;
        } else {
          // Группы в карте нет — берём разметку дерева.
          const tree = ctx.picker?.map?.[ex.id];
          if (tree && tree.length && tree[0]) muscleId = tree[0];
        }
      }

      if (muscleId) {
        byMuscleId.set(muscleId, (byMuscleId.get(muscleId) || 0) + sets);
      } else {
        const label = (s.group && s.group.length) ? s.group : 'Прочее';
        byLabel.set(label, (byLabel.get(label) || 0) + sets);
      }
      r.totalSets += sets;
    }
  }

  if (r.totalSets === 0) { r.empty = true; return r; }

  // Раскладываем по регионам/мышцам, сохраняя порядок регионов.
  const picker = ctx.picker;
  for (const regionId of REGION_ORDER) {
    const region = picker?.regions?.find(x => x.id === regionId);
    if (!region) continue;
    let regionSum = 0;
    for (const m of region.muscles) {
      const v = byMuscleId.get(m.id);
      if (v && v > 0) {
        r.muscleVolume.push([m.name, v]);
        regionSum += v;
      }
    }
    if (regionSum > 0) r.regionVolume.push([region.name, regionSum]);
  }
  // Незнакомые упражнения — отдельной строкой, чтобы объём не терялся.
  for (const [label, v] of byLabel) r.muscleVolume.push([label, v]);

  buildTips(r, picker, byMuscleId, ctx.goal, ctx.level);
  return r;
}

/** Число подходов из схемы фазы: "4x8-12" → 4. */
export function parseSets(scheme: string): number {
  if (!scheme) return 0;
  const m = scheme.match(/(\d+)\s*[x×]/);
  return m ? parseInt(m[1], 10) : 0;
}

function buildTips(r: PlanReport, picker: PickerDB | null, byMuscleId: Map<string, number>,
                   goal?: string | null, level?: string | null): void {
  const warnings: string[] = [];
  const advice: string[] = [];

  // 1. Обязательные регионы без нагрузки.
  for (const regionId of REQUIRED_REGIONS) {
    const region = picker?.regions?.find(x => x.id === regionId);
    if (!region) continue;
    let sum = 0;
    for (const m of region.muscles) sum += byMuscleId.get(m.id) || 0;
    if (sum === 0) warnings.push(`Нет нагрузки на «${region.name}» — добавьте упражнения этой группы`);
  }

  // 2. Баланс жим/тяга.
  const push = sumOf(byMuscleId, PUSH);
  const pull = sumOf(byMuscleId, PULL);
  if (push >= 6 && pull > 0 && pull < push * 0.7) {
    warnings.push('Тяга заметно отстаёт от жима — добавьте упражнения на спину');
  } else if (pull >= 6 && push > 0 && push < pull * 0.6) {
    warnings.push('Жим заметно отстаёт от тяги — добавьте упражнения на грудь');
  }

  // 3. Объём по ключевым мышцам — по той же таблице норм, что в анализе
  // тренировок: план не должен говорить «сбалансирован», а анализ после
  // тренировки — «недобрал» (аудит 1.69, D-01).
  for (const m of muscleByIds(picker, byMuscleId)) {
    const v = byMuscleId.get(m.id);
    if (v === undefined) continue;
    const group = PICKER_TO_GROUP[m.id];
    let rng: { lo: number; hi: number } | null = null;
    if (group) {
      rng = volumeNorm(group, goal, level);
    } else {
      const soft = range(m.id);
      if (soft) rng = { lo: soft[0], hi: soft[1] };
    }
    if (!rng) continue;
    // Ниже 3 подходов группа не считается проработанной — тот же порог, что
    // в анализе тренировок: иначе поясница с одним тяжёлым подходом получала
    // бы «мало» вопреки замыслу программы.
    if (rng.lo > 0 && v >= 3 && v < rng.lo) {
      warnings.push(`${m.name}: ${v} подходов в неделю — мало (нужно от ${rng.lo})`);
    } else if (rng.hi > 0 && v > rng.hi) {
      warnings.push(`${m.name}: ${v} подходов в неделю — много (норма до ${rng.hi})`);
    }
  }

  // 4. Поясница: бережём спину.
  const erectors = byMuscleId.get('erectors') || 0;
  if (erectors === 0) {
    advice.push('Добавьте упражнение на поясницу — она разгружает спину под нагрузкой');
  } else if (erectors > 12) {
    warnings.push(`Поясница: ${erectors} подходов в неделю — много (берегите спину)`);
  }

  // 5. Баланс ног: квадрицепс против задней цепи.
  const quads = byMuscleId.get('quads') || 0;
  const back = (byMuscleId.get('hams') || 0) + (byMuscleId.get('glutes') || 0);
  if (quads > 0 && back > 0 && quads > back * 2) {
    advice.push('Задняя цепь отстаёт — добавьте ягодицы и заднюю поверхность бедра');
  }

  // 6. Базовые советы.
  advice.push('Прогрессию веса держите по 2,5–5 кг, когда все подходы выполнены');
  advice.push('Отдых между подходами — по диапазону повторов: 1–5 повторов 3–4 мин, 9–12 — 60–90 сек');
  advice.push('Разминка: 5–10 минут суставная гимнастика + 2–3 подхода с нарастающим весом');
  advice.push('В конце мезоцикла — разгрузочная неделя: меньше подходов, вес ниже');

  r.ok = warnings.length === 0;
  r.tips.push(...warnings);
  // Советы — не больше 3, чтобы не превращать описание в полотно.
  for (let i = 0; i < advice.length && i < 3; i++) r.tips.push(advice[i]);
  if (!r.tips.length) r.tips.push(advice[0]);
}

function muscleByIds(picker: PickerDB | null, ids: Map<string, number>) {
  const out: { id: string; name: string }[] = [];
  if (!picker) return out;
  for (const regionId of REGION_ORDER) {
    const region = picker.regions.find(x => x.id === regionId);
    if (!region) continue;
    for (const m of region.muscles) {
      if (ids.has(m.id)) out.push({ id: m.id, name: m.name });
    }
  }
  return out;
}

function sumOf(map: Map<string, number>, ids: Set<string>): number {
  let sum = 0;
  for (const id of ids) sum += map.get(id) || 0;
  return sum;
}
