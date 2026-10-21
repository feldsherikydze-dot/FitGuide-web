// FitGuide Web — формулы оценки (порт AssessmentFormulas.java)
// e1RM, стартовые веса, состав тела. Без UI-зависимостей.

import { MOV, type Assessment } from '../data/types';

/** e1RM по Эпли: вес × (1 + повторы/30). Повторы 1–12. */
export function epley(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  const r = Math.min(reps, 12);
  return weightKg * (1 + r / 30);
}

/** e1RM по Брижицки — для кросс-проверки. */
export function brzycki(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  const r = Math.min(reps, 12);
  return weightKg * 36 / (37 - r);
}

/** Консервативный e1RM: минимум двух формул, чтобы не завысить старт. */
export function safeE1rm(weightKg: number, reps: number): number {
  const e = epley(weightKg, reps);
  const b = brzycki(weightKg, reps);
  if (e <= 0) return b;
  if (b <= 0) return e;
  return Math.min(e, b);
}

/** Стартовый рабочий вес мезоцикла: 85% e1RM, округление до 2,5 кг ВНИЗ. */
export function startWeight(e1rm: number): number {
  if (e1rm <= 0) return 0;
  const raw = e1rm * 0.85;
  return Math.floor(raw / 2.5) * 2.5;
}

/** Плотность тела по Джексону–Поллоку, 3 точки (мужчины: грудь/живот/бедро). */
export function bodyDensityMale3(chest: number, abdominal: number, thigh: number, age: number): number {
  const sum = chest + abdominal + thigh;
  return 1.10938 - 0.0008267 * sum + 0.0000016 * sum * sum - 0.0002574 * age;
}

/** Плотность тела по Джексону–Поллоку, 3 точки (женщины: трицепс/надподвздошная/бедро). */
export function bodyDensityFemale3(triceps: number, suprailiac: number, thigh: number, age: number): number {
  const sum = triceps + suprailiac + thigh;
  return 1.0994921 - 0.0009929 * sum + 0.0000023 * sum * sum - 0.0001392 * age;
}

/** Плотность тела по Джексону–Поллоку, 7 точек (мужчины). */
export function bodyDensityMale7(
  chest: number, midaxillary: number, triceps: number, subscapular: number,
  abdominal: number, suprailiac: number, thigh: number, age: number
): number {
  const sum = chest + midaxillary + triceps + subscapular + abdominal + suprailiac + thigh;
  return 1.112 - 0.00043499 * sum + 0.00000055 * sum * sum - 0.00028826 * age;
}

/** % жира по Сири из плотности. */
export function siri(density: number): number {
  if (density <= 0) return 0;
  return 495 / density - 450;
}

/** % жира по US Navy, мужчины: 86.010·log10(талия−шея) − 70.041·log10(рост) + 36.76. */
export function navyMale(waistCm: number, neckCm: number, heightCm: number): number {
  if (waistCm <= neckCm || heightCm <= 0) return 0;
  const v = 86.010 * Math.log10(waistCm - neckCm) - 70.041 * Math.log10(heightCm) + 36.76;
  return clampFat(v);
}

/** % жира по US Navy, женщины: 163.205·log10(талия+бедра−шея) − 97.684·log10(рост) − 78.387. */
export function navyFemale(waistCm: number, hipsCm: number, neckCm: number, heightCm: number): number {
  if (waistCm + hipsCm <= neckCm || heightCm <= 0) return 0;
  const v = 163.205 * Math.log10(waistCm + hipsCm - neckCm) - 97.684 * Math.log10(heightCm) - 78.387;
  return clampFat(v);
}

function clampFat(v: number): number {
  // Ниже 3 % не бывает: такое значение означает несогласованные обхваты, а не замер.
  if (v < 3) return 0;
  if (v > 60) return 60;
  return v;
}

/** Сухая масса, кг. */
export function leanMass(weightKg: number, fatPct: number): number {
  if (weightKg <= 0) return 0;
  const f = Math.max(0, Math.min(60, fatPct));
  return weightKg * (1 - f / 100);
}

/** FFMI с нормализацией роста. */
export function ffmi(leanKg: number, heightCm: number): number {
  if (leanKg <= 0 || heightCm <= 0) return 0;
  const h = heightCm / 100;
  const raw = leanKg / (h * h);
  return raw + 6.3 * (1.8 - h);
}

/**
 * Дозаполнение Assessment: жир (складки → US Navy), сухая масса, FFMI.
 * Порт fillBodyComp.
 */
export function fillBodyComp(a: Assessment, age: number, female: boolean): void {
  if (!a) return;
  let fat = 0;

  const seven = a.skinfoldChest > 0 && a.skinfoldMidaxillary > 0 && a.skinfoldTriceps > 0
    && a.skinfoldSubscapular > 0 && a.skinfoldAbdominal > 0
    && a.skinfoldSuprailiac > 0 && a.skinfoldThigh > 0;
  const threeM = a.skinfoldChest > 0 && a.skinfoldAbdominal > 0 && a.skinfoldThigh > 0;
  const threeF = a.skinfoldTriceps > 0 && a.skinfoldSuprailiac > 0 && a.skinfoldThigh > 0;

  if (!female && seven) {
    fat = siri(bodyDensityMale7(
      a.skinfoldChest, a.skinfoldMidaxillary, a.skinfoldTriceps, a.skinfoldSubscapular,
      a.skinfoldAbdominal, a.skinfoldSuprailiac, a.skinfoldThigh, age));
  } else if (!female && threeM) {
    fat = siri(bodyDensityMale3(a.skinfoldChest, a.skinfoldAbdominal, a.skinfoldThigh, age));
  } else if (female && threeF) {
    fat = siri(bodyDensityFemale3(a.skinfoldTriceps, a.skinfoldSuprailiac, a.skinfoldThigh, age));
  }

  if ((fat <= 0 || fat > 60) && a.neckCm > 0 && a.waistCm > 0 && a.heightCm > 0) {
    fat = female
      ? navyFemale(a.waistCm, a.hipsCm, a.neckCm, a.heightCm)
      : navyMale(a.waistCm, a.neckCm, a.heightCm);
  }

  if (fat > 0 && fat <= 60) a.bodyFatPct = Math.round(fat * 10) / 10;
  a.leanMassKg = Math.round(leanMass(a.weightKg, a.bodyFatPct) * 10) / 10;
  a.ffmi = Math.round(ffmi(a.leanMassKg, a.heightCm) * 10) / 10;
}

/** Стартовые веса по всем e1RM. Порт fillStartWeights. */
export function fillStartWeights(a: Assessment): void {
  if (!a) return;
  a.startSquat = startWeight(a.e1rmSquat);
  a.startBench = startWeight(a.e1rmBench);
  a.startDeadlift = startWeight(a.e1rmDeadlift);
  a.startOHP = startWeight(a.e1rmOHP);
  a.startRow = startWeight(a.e1rmRow);
  a.startLegPress = startWeight(a.e1rmLegPress);
  a.startHipThrust = startWeight(a.e1rmHipThrust);
}

/**
 * Какое ключевое движение в названии упражнения; −1 — движение не базовое.
 * Одна точка правды: по ней и чекпоинт подбирает фактические веса, и калибровка
 * разносит максимумы по слотам программы.
 */
export function movementOf(exercise: string | null | undefined): number {
  if (!exercise) return -1;
  const n = exercise.toLowerCase();

  // Изоляция не говорит о силе базового движения: там свой рабочий вес.
  if (n.includes('носки') || n.includes('голен') || n.includes('французск')
    || n.includes('разгибан') || n.includes('сгибан') || n.includes('бицепс')
    || n.includes('трицепс') || n.includes('сведен') || n.includes('разведен')
    || n.includes('бабочка') || n.includes('pec deck') || n.includes('кроссовер')
    || n.includes('шраг') || n.includes('предплеч')) {
    return -1;
  }

  // Своё тело вместо снаряда. Гравитрон — противовес: там вес означает помощь.
  if (n.includes('отжиман') || n.includes('push-up') || n.includes('гравитрон')
    || n.includes('assist') || n.includes('подтягивания лопатками')) {
    return -1;
  }

  // Вертикальные тяги — другое движение: вес в наклоне не подходит.
  if (n.includes('подтягиван') || n.includes('pull-up') || n.includes('chin-up')) {
    return MOV.PULLUP;
  }
  if (n.includes('верхн') || n.includes('к груди') || n.includes('вертикальн')
    || n.includes('пуловер')) {
    return -1;
  }

  // Тяга к подбородку — плечевое движение с лёгкими весами.
  if (n.includes('к подбородку')) {
    return -1;
  }

  if (n.includes('ягодичн') || n.includes('хип-траст') || n.includes('hip thrust')
    || n.includes('подъем таза')) {
    return MOV.HIP;
  }

  // «Тяга штанги в наклоне» — это тяга в наклоне, а не становая.
  if (n.includes('становая') || n.includes('румынск') || n.includes('мёртвая')
    || n.includes('мертвая') || n.includes('плинт') || n.includes('rack pull')
    || n.includes('stiff')) {
    return MOV.DEAD;
  }

  if (n.includes('присед') || n.includes('выпад') || n.includes('гоблет')
    || n.includes('болгарск')) {
    return MOV.SQUAT;
  }

  if (n.includes('армейский') || n.includes('швунг') || n.includes('над головой')) {
    return MOV.OHP;
  }

  if (n.includes('жим')) {
    // «Жим ногами» и «жим одной ногой» — платформа, не грудь.
    if (n.includes('ног')) return MOV.LEGPRESS;
    if (n.includes('стоя') || (n.includes('сидя') && !n.includes('груди'))) return MOV.OHP;
    return MOV.BENCH;
  }

  if (n.includes('тяга')) return MOV.ROW;

  return -1;
}

/** Названия 8 базовых движений в порядке калибровки. */
export const MOVEMENT_NAMES = [
  'Присед',
  'Жим лёжа',
  'Становая',
  'Жим стоя',
  'Тяга в наклоне',
  'Подтягивания',
  'Жим ногами',
  'Ягодичный мост',
] as const;
