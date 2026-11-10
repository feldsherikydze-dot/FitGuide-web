// FitGuide Web — генератор меню «Кухни» (порт KitchenGenerator.java).
// Подбор блюд под целевые калории с учётом любимых/исключённых продуктов.
// День собирается из 5 приёмов, затем порции масштабируются под цель: сумма
// дня сходится с цифрой в поле, а не «сколько получилось из фиксированных блюд».

import { GOALS, goalList } from '../core/goals';

export interface Dish {
  name: string;
  kcal: number;
  p: number;
  f: number;
  c: number;
  tag?: string;
  /** Множитель порции: 1 — как в рецепте, 1.3 — порция больше. */
  portion?: number;
}

export interface Meal {
  title: string;
  dishes: Dish[];
}

export interface Day {
  name: string;
  meals: Meal[];
}

const DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

// Завтраки (~450-650 ккал)
const BREAKFASTS: Dish[] = [
  { name: 'Овсянка на молоке + банан + арахис', kcal: 560, p: 18, f: 18, c: 78, tag: 'mass' },
  { name: 'Омлет из 3 яиц + хлеб + сыр', kcal: 520, p: 28, f: 34, c: 22, tag: 'any' },
  { name: 'Творог 5% + мёд + орехи', kcal: 480, p: 32, f: 22, c: 34, tag: 'mass' },
  { name: 'Гречка на молоке + яйцо', kcal: 540, p: 22, f: 16, c: 74, tag: 'any' },
  { name: 'Сырники + сметана', kcal: 590, p: 26, f: 24, c: 62, tag: 'mass' },
  { name: 'Омлет с овощами + овсянка', kcal: 420, p: 24, f: 20, c: 36, tag: 'cut' },
  { name: 'Творог 2% + ягоды', kcal: 320, p: 30, f: 8, c: 28, tag: 'cut' },
  { name: 'Пшённая каша + тыква', kcal: 450, p: 12, f: 12, c: 72, tag: 'any' },
  { name: 'Овсянка + протеин + банан', kcal: 480, p: 38, f: 8, c: 66, tag: 'any' },
  { name: 'Творог 2% + протеин + ягоды', kcal: 360, p: 42, f: 5, c: 30, tag: 'cut' },
];

// Обеды (~650-800)
const LUNCHES: Dish[] = [
  { name: 'Куриная грудка + рис + овощи', kcal: 720, p: 48, f: 14, c: 92, tag: 'mass' },
  { name: 'Индейка + гречка + салат', kcal: 700, p: 46, f: 16, c: 84, tag: 'any' },
  { name: 'Говядина + макароны + овощи', kcal: 780, p: 44, f: 22, c: 88, tag: 'mass' },
  { name: 'Рыба + картофель + овощи', kcal: 680, p: 40, f: 18, c: 78, tag: 'any' },
  { name: 'Куриный суп + хлеб + грудка', kcal: 640, p: 42, f: 14, c: 76, tag: 'cut' },
  { name: 'Индейка + булгур + овощи', kcal: 620, p: 44, f: 12, c: 72, tag: 'cut' },
  { name: 'Тунец + рис + салат', kcal: 600, p: 46, f: 10, c: 68, tag: 'cut' },
  { name: 'Свинина постная + гречка', kcal: 760, p: 42, f: 24, c: 82, tag: 'mass' },
  { name: 'Куриная грудка + гречка + овощи', kcal: 660, p: 55, f: 10, c: 76, tag: 'cut' },
  { name: 'Индейка + рис + овощи', kcal: 700, p: 52, f: 12, c: 88, tag: 'any' },
];

// Ужины (~400-550)
const DINNERS: Dish[] = [
  { name: 'Творог + кефир + орехи', kcal: 450, p: 34, f: 20, c: 24, tag: 'mass' },
  { name: 'Омлет + овощи', kcal: 380, p: 26, f: 24, c: 10, tag: 'cut' },
  { name: 'Рыба на пару + овощи', kcal: 420, p: 38, f: 16, c: 18, tag: 'cut' },
  { name: 'Курица + салат', kcal: 460, p: 40, f: 16, c: 22, tag: 'any' },
  { name: 'Индейка + овощи на гриле', kcal: 440, p: 38, f: 14, c: 20, tag: 'any' },
  { name: 'Творожная запеканка', kcal: 500, p: 30, f: 18, c: 48, tag: 'mass' },
  { name: 'Яйца + фасоль + овощи', kcal: 480, p: 26, f: 20, c: 42, tag: 'any' },
  { name: 'Кефир + творог 2%', kcal: 320, p: 30, f: 10, c: 22, tag: 'cut' },
  { name: 'Треска + овощи + творог', kcal: 430, p: 45, f: 10, c: 20, tag: 'cut' },
  { name: 'Куриная грудка + овощи', kcal: 400, p: 45, f: 10, c: 14, tag: 'cut' },
];

// Перекусы (~150-250)
const SNACKS: Dish[] = [
  { name: 'Банан + арахис 20г', kcal: 220, p: 6, f: 12, c: 26, tag: 'mass' },
  { name: 'Йогурт + мёд', kcal: 200, p: 10, f: 4, c: 32, tag: 'any' },
  { name: 'Творожок + ягоды', kcal: 180, p: 16, f: 4, c: 20, tag: 'cut' },
  { name: 'Орехи 30г + яблоко', kcal: 240, p: 6, f: 16, c: 20, tag: 'any' },
  { name: 'Протеиновый коктейль на молоке', kcal: 230, p: 28, f: 4, c: 20, tag: 'mass' },
  { name: 'Кефир + банан', kcal: 200, p: 8, f: 4, c: 34, tag: 'any' },
  { name: 'Яйцо + хлебец', kcal: 160, p: 10, f: 8, c: 12, tag: 'cut' },
  { name: 'Творог + банан', kcal: 250, p: 20, f: 6, c: 30, tag: 'mass' },
  { name: 'Протеиновый батончик', kcal: 220, p: 20, f: 7, c: 20, tag: 'any' },
  { name: 'Творог 2% + протеин', kcal: 250, p: 35, f: 4, c: 18, tag: 'any' },
];

const seededRng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s >>> 0) / 4294967296;
  };
};

const shuffled = (pool: Dish[], rng: () => number): Dish[] => {
  const out = pool.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = out[i];
    out[i] = out[j];
    out[j] = t;
  }
  return out;
};

const words = (s: string[]): string[] =>
  s.map(x => (x || '').trim().toLowerCase()).filter(x => x.length > 1);

const isMass = (goal: string): boolean =>
  goalList(goal).some(g => g === GOALS.MASS || g === GOALS.STRENGTH);

const pool = (arr: Dish[], mass: boolean): Dish[] => {
  const out = arr.filter(d => mass || d.tag !== 'mass');
  return out.length ? out : arr.slice();
};

const favHit = (d: Dish, favs: string[]): boolean => {
  if (!favs.length) return false;
  const n = d.name.toLowerCase();
  return favs.some(w => n.includes(w));
};

const disliked = (d: Dish, dis: string[]): boolean => {
  if (!dis.length) return false;
  const n = d.name.toLowerCase();
  return dis.some(w => n.includes(w));
};

/** Выбор блюда со сдвигом и защитой от повторов; «не ем» — жёсткий фильтр. */
const pick = (
  list: Dish[], recent: Set<string>, favs: string[], dis: string[], shift: number,
): Dish => {
  if (!list.length) return { name: '—', kcal: 0, p: 0, f: 0, c: 0 };
  let allowed = list.filter(d => !disliked(d, dis));
  if (!allowed.length) allowed = list;
  const size = allowed.length;
  const at = (k: number) => allowed[((shift + k) % size + size) % size];
  for (let k = 0; k < size; k++) {
    const d = at(k);
    if (recent.has(d.name)) continue;
    if (favHit(d, favs)) {
      recent.add(d.name);
      return d;
    }
  }
  for (let k = 0; k < size; k++) {
    const d = at(k);
    if (recent.has(d.name)) continue;
    recent.add(d.name);
    return d;
  }
  const d = at(0);
  recent.add(d.name);
  return d;
};

const mealKcal = (m: Meal): number => m.dishes.reduce((s, d) => s + d.kcal, 0);

/**
 * Потолок плотности белка: выше ~9% калорий из белка эти пулы блюд не тянут.
 * Норма 2.0 г/кг при жёстком дефиците калорий требует 35%+ калорий из белка —
 * обычной едой это не собрать.
 */
const PROTEIN_DENSITY_MAX = 0.09;

const density = (d: Dish): number => (d.kcal > 0 ? d.p / d.kcal : 0);

/** Сколько граммов белка приходится на 1 ккал цели. */
const proteinDensity = (protein: number, kcal: number): number => {
  if (!(protein > 0) || !(kcal > 0)) return 0;
  return Math.min(protein / kcal, PROTEIN_DENSITY_MAX);
};

/**
 * Сужаем пул до блюд, которые не проваливают цель по белку. Порог мягкий (65%
 * от нужной плотности), чтобы неделя не превратилась в одно и то же блюдо; если
 * под него не проходит хотя бы три блюда — берём три самых белковых.
 */
const byProtein = (list: Dish[], r: number): Dish[] => {
  if (!(r > 0) || list.length <= 3) return list;
  const keep = list.filter(d => d.kcal > 0 && d.p >= d.kcal * r * 0.65);
  if (keep.length >= 3) return keep;
  return list.slice().sort((a, b) => density(b) - density(a)).slice(0, 3);
};

/** Копия блюда с масштабом порции: КБЖУ пересчитаны, исходник не тронут. */
const scaled = (d: Dish, k: number): Dish => ({
  name: d.name,
  kcal: Math.round(d.kcal * k),
  p: Math.round(d.p * k),
  f: Math.round(d.f * k),
  c: Math.round(d.c * k),
  tag: d.tag,
  portion: Math.round(k * 100) / 100,
});

/**
 * Подгон дня под цель: сначала страхуем края (совсем маленькая цель — убираем
 * второй перекус, совсем большая — добавляем), затем масштабируем порции одним
 * коэффициентом. Так сумма дня сходится с целью.
 */
const fitDay = (
  day: Day, target: number, snackPool: Dish[],
  favs: string[], dis: string[], shift: number,
): void => {
  if (!day || target <= 0) return;
  let guard = 0;
  while (dayKcal(day) * 2 < target * 0.95 && day.meals.length >= 3 && guard++ < 3) {
    day.meals[2].dishes.push(pick(snackPool, new Set<string>(), favs, dis, shift + guard));
  }
  guard = 0;
  while (dayKcal(day) * 0.5 > target * 1.05 && day.meals.length > 3 && guard++ < 2) {
    day.meals.pop();
  }
  const base = dayKcal(day);
  if (base <= 0) return;
  let scale = target / base;
  if (scale < 0.5) scale = 0.5;
  if (scale > 2) scale = 2;
  if (Math.abs(scale - 1) < 0.005) return;
  for (const m of day.meals) {
    m.dishes = m.dishes.map(d => scaled(d, scale));
  }
};

const dayKcal = (d: Day): number => d.meals.reduce((s, m) => s + mealKcal(m), 0);

const dayP = (d: Day): number =>
  d.meals.reduce((s, m) => s + m.dishes.reduce((x, dd) => x + dd.p, 0), 0);

const usedName = (day: Day, name: string): boolean =>
  day.meals.some(m => m.dishes.some(d => d.name === name));

/**
 * Дневной баланс белка: если средняя плотность дня ушла от цели, меняем одно
 * блюдо на другое из его же пула — так, чтобы плотность стала ближе всего к
 * цели. Один фильтр пула этого не даёт: при цели 180 г день мог выйти и на
 * 140, и на 227 г. Калории дня почти не двигаются — их потом выравнивает fitDay.
 */
const rebalanceProtein = (
  day: Day, targetProtein: number, targetKcal: number, pools: Dish[][], dis: string[],
): void => {
  if (!(targetProtein > 0) || dayKcal(day) <= 0) return;
  // Плотность цели — от ЦЕЛЕВЫХ калорий: масштаб порций плотность не меняет.
  const rTarget = proteinDensity(targetProtein, targetKcal);
  for (let iter = 0; iter < 8; iter++) {
    const kcal = dayKcal(day);
    const prot = dayP(day);
    if (kcal <= 0) return;
    const rNow = prot / kcal;
    if (Math.abs(rNow - rTarget) <= rTarget * 0.04) return;
    let bestMeal = -1;
    let bestNew: Dish | null = null;
    let bestErr = Math.abs(rNow - rTarget);
    for (let i = 0; i < day.meals.length && i < pools.length; i++) {
      const m = day.meals[i];
      if (m.dishes.length !== 1) continue;
      const cur = m.dishes[0];
      for (const cand of pools[i]) {
        if (cand.name === cur.name || usedName(day, cand.name) || disliked(cand, dis)) continue;
        const k2 = kcal - cur.kcal + cand.kcal;
        const p2 = prot - cur.p + cand.p;
        if (k2 <= 0) continue;
        const err = Math.abs(p2 / k2 - rTarget);
        if (err < bestErr - 0.0005) {
          bestErr = err;
          bestMeal = i;
          bestNew = cand;
        }
      }
    }
    if (bestMeal < 0 || !bestNew) return;
    day.meals[bestMeal].dishes = [bestNew];
  }
};

export function week(
  targetKcal: number, targetProtein: number, goal: string, favs: string[], dis: string[],
): Day[] {
  const seed = Math.floor(Date.now() / 1000) % 1000000;
  const rng = seededRng(seed);
  const mass = isMass(goal);
  const fw = words(favs);
  const dw = words(dis);
  const r = proteinDensity(targetProtein, targetKcal);

  const bf = byProtein(shuffled(pool(BREAKFASTS, mass), rng), r);
  const ln = byProtein(shuffled(pool(LUNCHES, mass), rng), r);
  const dn = byProtein(shuffled(pool(DINNERS, mass), rng), r);
  const sn1 = byProtein(shuffled(pool(SNACKS, mass), rng), r);
  const sn2 = byProtein(shuffled(pool(SNACKS, mass), rng), r);

  const base = ((seed % 997) + 997) % 997;
  const out: Day[] = [];
  const recent = new Set<string>();

  for (let d = 0; d < 7; d++) {
    const day: Day = { name: DAYS[d], meals: [] };
    day.meals.push({ title: 'Завтрак', dishes: [pick(bf, recent, fw, dw, base + d * 3)] });
    day.meals.push({ title: 'Обед', dishes: [pick(ln, recent, fw, dw, base + d * 3 + 1)] });
    day.meals.push({ title: 'Перекус', dishes: [pick(sn1, recent, fw, dw, base + d * 2)] });
    day.meals.push({ title: 'Ужин', dishes: [pick(dn, recent, fw, dw, base + d * 3 + 2)] });
    day.meals.push({ title: 'Перекус 2', dishes: [pick(sn2, recent, fw, dw, base + d * 2 + 1)] });
    rebalanceProtein(day, targetProtein, targetKcal, [bf, ln, dn, sn1, sn2], dw);
    fitDay(day, targetKcal, sn1, fw, dw, base + d + 40);
    out.push(day);
    if (recent.size > 24) recent.clear();
  }
  return out;
}
