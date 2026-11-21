// FitGuide Web — адаптивный расход: TDEE по факту, а не только по формуле.
//
// Формула Миффлина не знает ни NEAT, ни реальной активности: ошибка ±15 %
// обычна. Но у приложения уже есть два ряда данных — вес (BodyLog) и калории
// (дневник питания). По ним расход считается честнее: TDEE = средний приход
// минус перепад веса в пересчёте на энергию (7700 ккал на кг).
//
// Правила осторожности: мало взвешиваний или мало дней с едой — цифру не
// показываем; короткий отрезок и почти неподвижный вес — помечаем как
// ориентировочную, потому что вода и соль двигают стрелку сильнее жира.

import { formulaTdee } from './goals';

const DAY_MS = 86400000;

export interface WeighIn {
  date: number;
  weightKg: number;
}

export interface IntakeDay {
  day: string; // yyyy-MM-dd
  kcal: number;
}

export type AdaptiveStatus = 'ok' | 'few-weights' | 'few-food';

export interface AdaptiveTdee {
  status: AdaptiveStatus;
  /** Длина окна в днях. */
  windowDays: number;
  weighIns: number;
  spanDays: number;
  foodDays: number;
  /** Средний приход по дням, где питание записано. */
  avgIntake: number;
  /** Тренд веса, кг в неделю (минус — худеем). */
  trendKgWeek: number;
  /** Оценка расхода, ккал/день; 0 — данных не хватило. */
  estimate: number;
  formulaTdee: number;
  /** Отклонение оценки от формулы, % (плюс — факт выше формулы). */
  deltaPct: number;
  /** Вес сдвинулся достаточно, чтобы верить тренду, а не воде. */
  reliable: boolean;
}

const EMPTY: Omit<AdaptiveTdee, 'formulaTdee'> = {
  status: 'few-weights', windowDays: 0, weighIns: 0, spanDays: 0, foodDays: 0,
  avgIntake: 0, trendKgWeek: 0, estimate: 0, deltaPct: 0, reliable: false,
};

function dayStart(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function parseDay(day: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return 0;
  return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
}

/**
 * Оценка расхода по факту. `formulaTdee` — что говорит формула (BMR ×
 * коэффициент активности); нужна только для сравнения и текста.
 */
export function adaptiveTdee(
  weighIns: WeighIn[] | null | undefined,
  food: IntakeDay[] | null | undefined,
  formulaTdee: number,
  now: number = Date.now(),
  windowDays = 28,
): AdaptiveTdee {
  const out: AdaptiveTdee = { ...EMPTY, windowDays, formulaTdee: Math.max(0, Math.round(formulaTdee)) };
  const from = now - windowDays * DAY_MS;

  // Взвешивания: одно на день (последнее за день), только окно и только вес > 0.
  const byDay = new Map<number, number>();
  for (const w of weighIns || []) {
    if (!w || !(w.weightKg > 0) || w.date < from || w.date > now) continue;
    byDay.set(dayStart(w.date), w.weightKg);
  }
  const points = [...byDay.entries()].sort((a, b) => a[0] - b[0])
    .map(([date, weightKg]) => ({ date, weightKg }));
  out.weighIns = points.length;
  if (points.length < 4) return out;
  const spanDays = Math.round((points[points.length - 1].date - points[0].date) / DAY_MS);
  out.spanDays = spanDays;
  if (spanDays < 10) return out;

  // Приход: сумма за день, дни без еды и «пустые» (меньше 400 ккал) не считаем.
  const perDay = new Map<number, number>();
  for (const f of food || []) {
    if (!f || !(f.kcal > 0)) continue;
    const t = parseDay(f.day);
    if (!t || t < from || t > now) continue;
    perDay.set(t, (perDay.get(t) || 0) + f.kcal);
  }
  const days = [...perDay.values()].filter(v => v >= 400);
  out.foodDays = days.length;
  if (days.length < 7) {
    out.status = 'few-food';
    out.avgIntake = days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length / 10) * 10 : 0;
    return out;
  }
  const avg = days.reduce((a, b) => a + b, 0) / days.length;
  out.avgIntake = Math.round(avg / 10) * 10;

  // Наклон прямой по точкам: x — дни от первого взвешивания.
  const x0 = points[0].date;
  const n = points.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const p of points) {
    const x = (p.date - x0) / DAY_MS;
    sx += x;
    sy += p.weightKg;
    sxx += x * x;
    sxy += x * p.weightKg;
  }
  const denom = n * sxx - sx * sx;
  const slope = denom !== 0 ? (n * sxy - sx * sy) / denom : 0;
  out.trendKgWeek = Math.round(slope * 7 * 100) / 100;

  const estimate = avg - slope * 7700;
  out.estimate = estimate > 0 ? Math.round(estimate / 10) * 10 : 0;
  out.status = 'ok';
  out.deltaPct = formulaTdee > 0 && out.estimate > 0
    ? Math.round(((out.estimate - formulaTdee) / formulaTdee) * 100)
    : 0;
  out.reliable = Math.abs(points[n - 1].weightKg - points[0].weightKg) >= 0.4 || spanDays >= 21;
  return out;
}

/** Одна строка вывода: что видит человек под дневником питания. */
export function adaptiveTdeeVerdict(r: AdaptiveTdee): string {
  if (r.status === 'few-weights') {
    return 'Расход по факту посчитаю, когда будет хотя бы 4 взвешивания за 10 дней.';
  }
  if (r.status === 'few-food') {
    return 'Расход по факту посчитаю, когда будет 7 дней с записанным питанием.';
  }
  if (r.estimate <= 0) return 'Данных мало: перепад веса и калории не сходятся.';
  const trend = r.trendKgWeek === 0
    ? 'вес стоит'
    : r.trendKgWeek < 0
      ? `минус ${Math.abs(r.trendKgWeek).toFixed(1).replace('.', ',')} кг/нед`
      : `плюс ${r.trendKgWeek.toFixed(1).replace('.', ',')} кг/нед`;
  const base = `По факту: ~${r.estimate} ккал/день (${r.foodDays} дн. еды, ${trend}).`;
  if (r.formulaTdee <= 0) return base;
  if (Math.abs(r.deltaPct) < 5) {
    return `${base} Формула даёт ${r.formulaTdee} — цифры сходятся, менять нечего.`;
  }
  const word = r.deltaPct > 0 ? 'выше формулы' : 'ниже формулы';
  const advice = Math.abs(r.deltaPct) >= 10
    ? ' Ориентируйся на факт: разница больше 10 %.'
    : '';
  return `${base} Это на ${Math.abs(r.deltaPct)} % ${word} (${r.formulaTdee}).${advice}`;
}

export interface EffectiveTdee {
  adaptive: AdaptiveTdee;
  /** Данных достаточно, и факт расходится с формулой больше чем на 150 ккал. */
  useFact: boolean;
  /** Что брать в расчёт нормы: факт или формулу. */
  tdee: number;
  formula: number;
}

/**
 * Один вход для всех экранов питания: дневник, кухня, спортпит, тренер.
 * Иначе дневник считал бы по факту, а меню — по формуле, и цифры на экранах
 * расходились бы. Порог 150 ккал/день отсекает шум воды.
 */
export function effectiveTdee(
  profile: {
    weightKg?: number; heightCm?: number; age?: number;
    gender?: string; activityLevel?: string;
  } | null | undefined,
  weighIns: WeighIn[] | null | undefined,
  food: IntakeDay[] | null | undefined,
): EffectiveTdee {
  const formula = formulaTdee(profile);
  const adaptive = adaptiveTdee(weighIns, food, formula);
  const useFact = adaptive.status === 'ok' && adaptive.reliable
    && adaptive.estimate > 0 && Math.abs(adaptive.estimate - formula) >= 150;
  return { adaptive, useFact, tdee: useFact ? adaptive.estimate : formula, formula };
}
