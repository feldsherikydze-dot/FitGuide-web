// FitGuide Web — генератор меню «Кухни» (порт KitchenGenerator.java).
// Подбор блюд под целевые калории с учётом любимых/исключённых продуктов.

import { goalList } from '../core/goals';

export interface Dish {
  name: string;
  kcal: number;
  p: number;
  f: number;
  c: number;
}

export interface Meal {
  title: string;
  dishes: Dish[];
}
function mealKcal(m: Meal): number { return m.dishes.reduce((s, d) => s + d.kcal, 0); }
function mealP(m: Meal): number { return m.dishes.reduce((s, d) => s + d.p, 0); }
function mealF(m: Meal): number { return m.dishes.reduce((s, d) => s + d.f, 0); }
function mealC(m: Meal): number { return m.dishes.reduce((s, d) => s + d.c, 0); }

export interface Day {
  name: string;
  meals: Meal[];
}

const DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const MEALS = ['Завтрак', 'Обед', 'Ужин', 'Перекус'];

// База блюд с калориями и БЖУ (гр).
const DISHES: Dish[] = [
  { name: 'Овсяная каша на воде с фруктами', kcal: 300, p: 10, f: 6, c: 54 },
  { name: 'Яичница из 2 яиц с тостом', kcal: 280, p: 14, f: 16, c: 22 },
  { name: 'Творог с мёдом и орехами', kcal: 240, p: 18, f: 10, c: 22 },
  { name: 'Банановый коктейль с протеином', kcal: 220, p: 22, f: 3, c: 30 },
  { name: 'Куриная грудка с рисом и овощами', kcal: 450, p: 38, f: 10, c: 48 },
  { name: 'Говядина с гречкой', kcal: 480, p: 36, f: 14, c: 42 },
  { name: 'Лосось запечённый с картофелем', kcal: 430, p: 32, f: 16, c: 40 },
  { name: 'Паста с томатами и сыром', kcal: 410, p: 16, f: 12, c: 60 },
  { name: 'Индейка с киноа и брокколи', kcal: 400, p: 38, f: 10, c: 36 },
  { name: 'Креветки с овощами на гриле', kcal: 290, p: 28, f: 8, c: 24 },
  { name: 'Омлет с овощами', kcal: 260, p: 16, f: 18, c: 10 },
  { name: 'Цезарь с курицей', kcal: 380, p: 30, f: 18, c: 24 },
  { name: 'Яблоко', kcal: 95, p: 0, f: 0, c: 25 },
  { name: 'Протеиновый коктейль', kcal: 150, p: 25, f: 2, c: 3 },
  { name: 'Горсть орехов (30 г)', kcal: 180, p: 6, f: 16, c: 6 },
  { name: 'Творожная запеканка', kcal: 280, p: 18, f: 10, c: 32 },
  { name: 'Рыба на пару с цукини', kcal: 320, p: 30, f: 10, c: 20 },
  { name: 'Куриный суп с лапшой', kcal: 260, p: 20, f: 8, c: 30 },
  { name: 'Бутерброд с авокадо и яйцом', kcal: 320, p: 14, f: 20, c: 24 },
];

function matchesFilters(d: Dish, favs: string[], dis: string[]): boolean {
  const n = d.name.toLowerCase();
  if (dis.some(x => x && n.includes(x.toLowerCase()))) return false;
  if (favs.length && !favs.some(x => x && n.includes(x.toLowerCase()))) return false;
  return true;
}

function pick(rng: () => number, pool: Dish[], targetKcal: number, taken: Set<string>): Dish | null {
  const avail = pool.filter(d => !taken.has(d.name));
  if (!avail.length) return null;
  // Жадный подбор: выбираем блюдо ближайшее к残りце калорий.
  let best: Dish | null = null;
  let bestDiff = Infinity;
  for (const d of avail) {
    const diff = Math.abs(d.kcal - targetKcal);
    if (diff < bestDiff || (diff === bestDiff && rng() < 0.5)) {
      bestDiff = diff;
      best = d;
    }
  }
  return best;
}

const seededRng = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s >>> 0) / 4294967296;
  };
};

export function week(targetKcal: number, goal: string, favs: string[], dis: string[]): Day[] {
  const rng = seededRng(Date.now() % 1000000);
  const favList = favs.filter(Boolean).map(x => x.trim());
  const disList = dis.filter(Boolean).map(x => x.trim());
  const pool = DISHES.filter(d => matchesFilters(d, favList, disList));
  const perMeal = Math.max(1, Math.round(targetKcal / 4));

  const days: Day[] = [];
  for (let d = 0; d < 7; d++) {
    const taken = new Set<string>();
    const meals: Meal[] = [];
    const base = targetKcal * (0.95 + rng() * 0.1); // ±5% вариативность в день
    let remaining = base;
    for (let m = 0; m < MEALS.length; m++) {
      const share = m === MEALS.length - 1 ? remaining : remaining * (0.25 + rng() * 0.15);
      const dish = pick(rng, pool, Math.max(50, Math.min(share, perMeal * 1.5)), taken);
      if (dish) {
        taken.add(dish.name);
        meals.push({ title: MEALS[m], dishes: [dish] });
        remaining -= dish.kcal;
      } else {
        meals.push({ title: MEALS[m], dishes: [] });
      }
    }
    days.push({ name: DAYS[d], meals });
  }
  return days;
}
