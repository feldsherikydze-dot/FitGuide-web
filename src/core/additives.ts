// FitGuide Web — спортпит (порт AdditiveDatabase.java)

import { GOAL } from '../data/types';
import { GOALS, normalizeGoal } from './goals';

export interface AdditiveProduct {
  name: string;
  format: string;
  price: string;
  best: boolean;
}

export interface Additive {
  key: string;
  name: string;
  dose: string;
  why: string;
  products: AdditiveProduct[];
}

function p(name: string, format: string, price: string, best: boolean): AdditiveProduct {
  return { name, format, price, best };
}

function dosePerKg(weight: number, hasWeight: boolean, perKg: string, fallback: string): string {
  if (!hasWeight || weight <= 0) return fallback;
  const parts = perKg.split('–');
  const lo = parseFloat(parts[0].trim());
  const hi = parts.length > 1 ? parseFloat(parts[1].trim()) : lo;
  if (isNaN(lo)) return fallback;
  const gramsLo = Math.round(weight * lo);
  const gramsHi = Math.round(weight * hi);
  return `${gramsLo}–${gramsHi} г в день (${perKg} г/кг, тело ${Math.round(weight)} кг)`;
}

/**
 * Подбор дополнений под цель, уровень, бюджет и параметры пользователя.
 */
export function additivesForProfile(params: {
  goal: string;
  level: string;
  budget: string;
  weightKg: number;
  age: number;
  gender: string;
}): Additive[] {
  const goal = normalizeGoal(params.goal);
  const weight = params.weightKg;
  const hasWeight = weight > 0;
  const level = params.level || 'beginner';
  const budget = params.budget || 'medium';

  const result: Additive[] = [];

  // Белок: дозировка привязана к весу тела пользователя.
  if (budget === 'econom') {
    result.push({
      key: 'whey_concentrate',
      name: 'Сывороточный протеин',
      dose: dosePerKg(weight, hasWeight, '0.8–1.0', 'Главный источник аминокислот, покрывает норму белка, если её трудно добирать из еды.'),
      why: 'Покрывает потребность в белке, если не хватает из обычной еды.',
      products: [
        p('Optimum Nutrition — Gold Standard 100% Whey', 'порошок 2,27 кг · 70 порций', '≈ 6500 ₽', true),
        p('MyProtein — Impact Whey', 'порошок 2,5 кг · 80 порций', '≈ 5200 ₽', false),
        p('QNT — Metapure Zero Carb', 'порошок 2 кг · 55 порций', '≈ 5500 ₽', false),
        p('Pure Protein — Whey Concentrate', 'порошок 1,5 кг', '≈ 2900 ₽', false),
        p('Олимп / Гвардия — концентрат сыворотки', 'порошок 1 кг', '≈ 1500–1900 ₽', false),
      ],
    });
  } else {
    result.push({
      key: 'whey_isolate',
      name: 'Изолят сывороточного протеина',
      dose: dosePerKg(weight, hasWeight, '1.6–2.2', 'Быстро усваивается и удобно добирать норму белка сразу после тренировки.'),
      why: 'Быстро усваивается, удобно добирать норму белка после тренировки.',
      products: [
        p('Dymatize — ISO100 Hydrolyzed', 'порошок 2,3 кг · 70 порций', '≈ 8000 ₽', true),
        p('Optimum Nutrition — 100% Whey Gold Standard', 'порошок 2,27 кг', '≈ 6500 ₽', true),
        p('MyProtein — Whey Isolate', 'порошок 2,5 кг', '≈ 6800 ₽', false),
        p('Scitec Nutrition — 100% Whey Protein Isolate', 'порошок 2,05 кг', '≈ 6000 ₽', false),
        p('Nutrend — 100% Whey Isolate', 'порошок 1,8 кг', '≈ 5200 ₽', false),
      ],
    });
  }

  if (goal !== GOAL.LOSE) {
    result.push({
      key: 'creatine',
      name: 'Креатин моногидрат',
      dose: hasWeight && weight >= 55 ? `3–${Math.round(weight * 0.08)} г в день (0.03–0.05 г/кг)` : '3–5 г в день',
      why: 'Единственная добавка с доказанным эффектом на силу и сухую массу.',
      products: [
        p('Optimum Nutrition — Micronized Creatine', 'порошок 600 г', '≈ 1600 ₽', true),
        p('MyProtein — Creatine Monohydrate', 'порошок 1 кг', '≈ 1500 ₽', true),
        p('IronMaxx — Creatine Powder', 'порошок 500 г', '≈ 1200 ₽', false),
        p('Pure / Vitamin&Sport — моногидрат', 'порошок 500 г', '≈ 900 ₽', false),
      ],
    });
  }

  if (level === 'advanced' || level === 'intermediate') {
    result.push({
      key: 'vitamin_d',
      name: 'Витамин D3 + K2',
      dose: '2000–5000 МЕ + 100 мкг/день',
      why: 'Частый дефицит, особенно зимой. Влияет на гормоны, иммунитет, кости и восстановление.',
      products: [
        p('Now Foods — Vitamin D-3 + K-2', 'капсулы · 120 шт', '≈ 1100 ₽', true),
        p("Doctor's Best — Vitamin D3 + K2", 'капсулы · 60 шт', '≈ 1300 ₽', false),
        p('Solgar — Vitamin D3 50 мкг + K2', 'капсулы · 100 шт', '≈ 1600 ₽', false),
      ],
    });
    result.push({
      key: 'omega3',
      name: 'Омега-3 (EPA/DHA)',
      dose: '1–2 г EPA+DHA в день',
      why: 'Противовоспалительный эффект, поддержка суставов, сердца и мозга при интенсивных нагрузках.',
      products: [
        p('Nordic Naturals — Ultimate Omega', 'капсулы · 120 шт', '≈ 3100 ₽', true),
        p('Now Foods — Super Omega-3', 'капсулы · 180 шт', '≈ 1800 ₽', false),
        p('Solgar — Omega-3 950 mg', 'капсулы · 60 шт', '≈ 1700 ₽', false),
        p('MyProtein — Omega-3 Fish Oil', 'капсулы · 90 шт', '≈ 1300 ₽', false),
      ],
    });
    result.push({
      key: 'magnesium',
      name: 'Магний (цитрат/глицинат)',
      dose: '300–400 мг вечером',
      why: 'Улучшает сон и восстановление, снижает судороги и тревожность.',
      products: [
        p("Doctor's Best — Magnesium Glycinate Chelated", 'таблетки · 120 шт', '≈ 1400 ₽', true),
        p('Now Foods — Magnesium Glycinate', 'таблетки · 180 шт', '≈ 1500 ₽', false),
        p('Solgar — Magnesium Citrate', 'таблетки · 100 шт', '≈ 1400 ₽', false),
        p('GymBeam — Magnesium Chelate', 'таблетки · 120 шт', '≈ 800 ₽', false),
      ],
    });
  }

  if (goal === GOAL.LOSE || goal === GOAL.CUT) {
    result.push({
      key: 'caffeine',
      name: 'Кофеин',
      dose: '200 мг перед тренировкой',
      why: 'Повышает работоспособность и расход энергии, помогает пережить дефицит калорий.',
      products: [
        p('MyProtein — Caffeine Tablets', 'таблетки 200 мг · 100 шт', '≈ 700 ₽', true),
        p('Now Foods — Caffeine 200 mg', 'таблетки · 250 шт', '≈ 900 ₽', false),
        p('Олимп — Caffeine', 'таблетки · 120 шт', '≈ 700 ₽', false),
      ],
    });
    result.push({
      key: 'carnitine',
      name: 'L-карнитин',
      dose: '1–2 г перед тренировкой',
      why: 'Поддерживает транспорт жирных кислот в митохондрии. Работает только вместе с дефицитом калорий.',
      products: [
        p('Now Foods — L-Carnitine', 'капсулы 500 мг · 120 шт', '≈ 1500 ₽', true),
        p('MyProtein — L-Carnitine', 'капсулы · 180 шт', '≈ 1100 ₽', false),
        p('Olimp — L-Carnitine 3000 Extreme', 'ампулы/жидкая форма', '≈ 900 ₽', false),
      ],
    });
  } else if (goal === GOALS.MASS) {
    result.push({
      key: 'gainer',
      name: 'Гейнер',
      dose: 'по потребности',
      why: 'Удобный способ добавить калории, если не получается набрать массу обычной едой.',
      products: [
        p('Optimum Nutrition — Serious Mass', 'порошок 2,7 кг', '≈ 5200 ₽', true),
        p('MyProtein — Weight Gainer', 'порошок 2,5 кг', '≈ 3200 ₽', false),
        p('Maxler — Mass Gainer', 'порошок 2,2 кг', '≈ 2800 ₽', false),
        p('BSN — True-Mass', 'порошок 1,53 кг', '≈ 4200 ₽', false),
      ],
    });
    result.push({
      key: 'zma',
      name: 'Цинк + магний (ZMA)',
      dose: 'вечером',
      why: 'Цинк и магний связаны с синтезом тестостерона и качеством сна — важны при наборе.',
      products: [
        p('Now Foods — ZMA', 'капсулы · 90 шт', '≈ 1300 ₽', true),
        p('Advanced Labs — ZMA', 'капсулы · 90 шт', '≈ 1500 ₽', false),
        p('IronMaxx — ZMA', 'капсулы · 120 шт', '≈ 1000 ₽', false),
      ],
    });
  } else if (level === 'beginner') {
    result.push({
      key: 'magnesium',
      name: 'Магний',
      dose: '300–400 мг вечером',
      why: 'Поддерживает восстановление и сон при регулярных тренировках.',
      products: [
        p("Doctor's Best — Magnesium Glycinate Chelated", 'таблетки · 120 шт', '≈ 1400 ₽', true),
        p('Now Foods — Magnesium Glycinate', 'таблетки · 180 шт', '≈ 1500 ₽', false),
        p('Solgar — Magnesium Citrate', 'таблетки · 100 шт', '≈ 1400 ₽', false),
      ],
    });
  } else if (goal === GOALS.ENDURANCE) {
    result.push({
      key: 'betaalanine',
      name: 'Бета-аланин',
      dose: '3–5 г в день',
      why: 'Буферизирует кислотность мышц, добавляя выносливость в подходах 15–25 повторов.',
      products: [
        p('Now Foods — Beta-Alanine', 'порошок · 100 порций', '≈ 1500 ₽', true),
        p('MyProtein — Beta-Alanine', 'порошок 500 г', '≈ 1200 ₽', false),
        p('IronMaxx — Beta Alanine', 'капсулы · 120 шт', '≈ 1100 ₽', false),
      ],
    });
  }

  if (budget === 'premium') {
    result.push({
      key: 'bcaa',
      name: 'BCAA',
      dose: '5–10 г при тренировке',
      why: 'Лейцин участвует в запуске синтеза белка; удобно пить прямо во время тренинга.',
      products: [
        p('Scivation — Xtend', 'порошок · 30 порций', '≈ 2400 ₽', true),
        p('Optimum Nutrition — BCAA 1000 Caps', 'капсулы · 200 шт', '≈ 2200 ₽', false),
        p('MyProtein — Instant BCAA', 'порошок 500 г', '≈ 1600 ₽', false),
      ],
    });
    result.push({
      key: 'betaalanine',
      name: 'Бета-аланин',
      dose: '3–5 г в день',
      why: 'Буферизирует кислотность мышц и добавляет выносливость в подходах 8–15 повторов.',
      products: [
        p('Now Foods — Beta-Alanine', 'порошок · 100 порций', '≈ 1500 ₽', true),
        p('MyProtein — Beta-Alanine', 'порошок 500 г', '≈ 1200 ₽', false),
        p('IronMaxx — Beta Alanine', 'капсулы · 120 шт', '≈ 1100 ₽', false),
      ],
    });
  }

  // Убираем дубли по ключу, сохраняя порядок.
  const seen = new Set<string>();
  return result.filter(a => (a.key && seen.has(a.key) ? false : (seen.add(a.key), true)));
}
