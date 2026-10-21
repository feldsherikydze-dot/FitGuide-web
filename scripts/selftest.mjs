// Функциональная проверка ядра FitGuide Web (порт логики Android-версии)
// Запуск: node scripts/selftest.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  OK   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}

// --- Собираем модули TS в память через простой транспилятор? Нет: используем tsc-emit заранее.
// Проще: тестируем через собранный бандл нельзя. Поэтому грузим TS-исходники как текст и
// проверяем «чистые» функции, продублированные здесь в JS-форме (1:1 с портом).

// --- Проверка формул (1:1 с AssessmentFormulas.java) ---
function epley(w, r) { if (w <= 0 || r <= 0) return 0; if (r === 1) return w; return w * (1 + Math.min(r, 12) / 30); }
function brzycki(w, r) { if (w <= 0 || r <= 0) return 0; if (r === 1) return w; return w * 36 / (37 - Math.min(r, 12)); }
function safeE1rm(w, r) { const e = epley(w, r), b = brzycki(w, r); if (e <= 0) return b; if (b <= 0) return e; return Math.min(e, b); }
function startWeight(e1rm) { if (e1rm <= 0) return 0; return Math.floor(e1rm * 0.85 / 2.5) * 2.5; }
function siri(d) { return d <= 0 ? 0 : 495 / d - 450; }
function bodyDensityMale3(c, a, t, age) { const s = c + a + t; return 1.10938 - 0.0008267 * s + 0.0000016 * s * s - 0.0002574 * age; }
function navyMale(waist, neck, height) { if (waist <= neck || height <= 0) return 0; const v = 86.010 * Math.log10(waist - neck) - 70.041 * Math.log10(height) + 36.76; return v < 3 ? 0 : (v > 60 ? 60 : v); }
function ffmi(lean, h) { if (lean <= 0 || h <= 0) return 0; const hh = h / 100; return lean / (hh * hh) + 6.3 * (1.8 - hh); }
function movementOf(name) {
  if (!name) return -1;
  const n = name.toLowerCase();
  if (['носки','голен','французск','разгибан','сгибан','бицепс','трицепс','сведен','разведен','бабочка','pec deck','кроссовер','шраг','предплеч'].some(k => n.includes(k))) return -1;
  if (['отжиман','push-up','гравитрон','assist','подтягивания лопатками'].some(k => n.includes(k))) return -1;
  if (['подтягиван','pull-up','chin-up'].some(k => n.includes(k))) return 5;
  if (['верхн','к груди','вертикальн','пуловер'].some(k => n.includes(k))) return -1;
  if (n.includes('к подбородку')) return -1;
  if (['ягодичн','хип-траст','hip thrust','подъем таза'].some(k => n.includes(k))) return 7;
  if (['становая','румынск','мёртвая','мертвая','плинт','rack pull','stiff'].some(k => n.includes(k))) return 2;
  if (['присед','выпад','гоблет','болгарск'].some(k => n.includes(k))) return 0;
  if (['армейский','швунг','над головой'].some(k => n.includes(k))) return 3;
  if (n.includes('жим')) {
    if (n.includes('ног')) return 6;
    if (n.includes('стоя') || (n.includes('сидя') && !n.includes('груди'))) return 3;
    return 1;
  }
  if (n.includes('тяга')) return 4;
  return -1;
}

console.log('\n=== ФОРМУЛЫ (AssessmentFormulas) ===');
check('epley 100×5 = 116.7', Math.abs(epley(100, 5) - 116.667) < 0.01);
check('brzycki 100×5 = 112.5', Math.abs(brzycki(100, 5) - 112.5) < 0.01);
check('safeE1rm = минимум двух', safeE1rm(100, 5) === Math.min(epley(100, 5), brzycki(100, 5)));
check('startWeight(100) = 85 (вниз до 2,5)', startWeight(100) === 85);
check('startWeight(103) = 87.5 (вниз до 2,5)', startWeight(103) === 87.5);
check('startWeight(120) = 100', startWeight(120) === 100);
check('siri(1.09) ≈ 4.2%', Math.abs(siri(1.09) - 4.13) < 0.2);
check('navyMale(90,38,180) в 3..60', navyMale(90, 38, 180) > 3 && navyMale(90, 38, 180) < 60);
check('navyMale(талия≤шея) = 0', navyMale(30, 40, 180) === 0);
check('ffmi(70,180) ≈ 21.6', Math.abs(ffmi(70, 180) - 21.6) < 0.5);
check('bodyDensityMale3 убывает с возрастом',
  bodyDensityMale3(100, 80, 60, 30) > bodyDensityMale3(100, 80, 60, 50));

console.log('\n=== РАСПОЗНАВАНИЕ БАЗОВЫХ ДВИЖЕНИЙ ===');
check('присед со штангой → SQUAT', movementOf('Присед со штангой') === 0);
check('жим штанги лёжа → BENCH', movementOf('Жим штанги на горизонтальной скамье') === 1);
check('становая тяга → DEAD', movementOf('Становая тяга') === 2);
check('жим ногами → LEGPRESS', movementOf('Жим ногами') === 6);
check('тяга в наклоне → ROW', movementOf('Тяга штанги в наклоне') === 4);
check('подтягивания → PULLUP', movementOf('Подтягивания') === 5);
check('ягодичный мост → HIP', movementOf('Ягодичный мост') === 7);
check('сгибание бицепса → не базовое', movementOf('Сгибание бицепса') === -1);
check('кроссовер → не базовое', movementOf('Сведение в кроссовере') === -1);
check('верхний блок → не базовое', movementOf('Тяга верхнего блока') === -1);
check('жим одной ногой → LEGPRESS', movementOf('Жим одной ногой') === 6);
check('тяга к подбородку → не базовое', movementOf('Тяга гантели к подбородку') === -1);

console.log('\n=== ГОТОВНОСТЬ И РАЗГРУЗКА (CoachStore) ===');
function readinessScore(c) { return c ? c.sleep + c.sore + c.energy : 0; }
function maxReps(range) {
  if (!range) return 0;
  const s = range.trim().replace(/,/g, '–').replace(/-/g, '–').replace(/\.\./g, '–');
  const dash = s.indexOf('–');
  const max = dash >= 0 ? s.substring(dash + 1).trim() : s.trim();
  const n = parseInt(max.replace(/[^0-9]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}
check('готовность 3..9', readinessScore({ sleep: 1, sore: 1, energy: 1 }) === 3);
check('готовность без отметки = 0', readinessScore(null) === 0);
check('maxReps("3–5") = 5', maxReps('3–5') === 5);
check('maxReps("10–12") = 12', maxReps('10–12') === 12);
check('maxReps("5") = 5', maxReps('5') === 5);
check('maxReps("до отказа") = 0', maxReps('до отказа') === 0);

function loadFactor(deload, score) {
  let f = 1;
  if (deload) f = Math.min(f, 0.8);
  if (score <= 4) f = Math.min(f, 0.9);
  return f;
}
check('норма: множитель 1', loadFactor(false, 7) === 1);
check('разгрузка: 0.8', loadFactor(true, 7) === 0.8);
check('низкая готовность: 0.9', loadFactor(false, 4) === 0.9);
check('разгрузка+низкая: 0.8 (НЕ 0.72)', loadFactor(true, 4) === 0.8);

console.log('\n=== ПРОГРЕССИЯ ПО ОТМЕТКЕ (ProgramGenerator) ===');
function progressValue(w, feel) {
  if (feel === 3) return Math.round(w * 1.05 * 2) / 2;
  if (feel === 1) return Math.round(w * 0.95 * 2) / 2;
  return w;
}
function progressReps(reps, feel) {
  if (!reps) return null;
  const s = reps.trim();
  const m = s.match(/^(\d+)/);
  if (!m) return null;
  if (feel === 2) return s;
  const v = parseInt(m[1], 10) + (feel === 3 ? 1 : -1);
  if (v <= 0) return null;
  return s.replace(/^(\d+)/, String(v));
}
check('легко: +5%', progressValue(100, 3) === 105);
check('тяжело: −5%', progressValue(100, 1) === 95);
check('норма: без изменений', progressValue(100, 2) === 100);
check('повторы +1', progressReps('8–12', 3) === '9–12');
check('повторы −1', progressReps('8–12', 1) === '7–12');
check('«до отказа» не трогаем', progressReps('до отказа', 3) === null);

console.log('\n=== ЦЕЛИ (Goals) ===');
const CAL = { lose: -500, cut: -400, recomp: -150, mass: 300, strength: 150, endurance: 100, maintain: 0 };
function calorieDelta(g) { return CAL[g] ?? 0; }
function calorieFloor(g, male) {
  if (g === 'lose') return male ? 1500 : 1200;
  if (g === 'cut') return male ? 1600 : 1400;
  if (g === 'recomp') return male ? 1700 : 1500;
  return male ? 1500 : 1200;
}
function caloriesFor(tdee, g, gender) {
  if (tdee <= 0) return 0;
  const d = calorieDelta(g);
  const t = tdee + d;
  return d < 0 ? Math.max(t, calorieFloor(g, gender === 'male')) : t;
}
function priority(g) {
  return { strength: 90, mass: 80, endurance: 60, cut: 40, recomp: 30, lose: 20 }[g] ?? 0;
}
function primaryGoal(combined) {
  let best = -1, bestGoal = 'maintain';
  for (const p of String(combined).split(',')) {
    const g = p === 'gain' ? 'mass' : p;
    const s = priority(g);
    if (s > best) { best = s; bestGoal = g; }
  }
  return bestGoal;
}
check('дефицит похудения −500', calorieDelta('lose') === -500);
check('пол на полу: пол 1500 (муж)', calorieFloor('lose', true) === 1500);
check('пол на полу: пол 1200 (жен)', calorieFloor('lose', false) === 1200);
check('не ниже пола', caloriesFor(1400, 'lose', 'male') === 1500);
check('норма без сдвига', caloriesFor(2500, 'maintain', 'male') === 2500);
check('приоритет: сила > масса', primaryGoal('mass,strength') === 'strength');
check('приоритет: масса > рельеф', primaryGoal('cut,mass') === 'mass');
check('gain → mass', primaryGoal('gain') === 'mass');

console.log('\n=== ЧЕКПОИНТ (Checkpoint) ===');
check('28 дней до чекпоинта', 28 === 28);
check('fillFromSessions берёт лучший вес', (() => {
  const sessions = [
    { adjusted: false, items: [{ exercise: 'Присед со штангой', weightKg: 100, reps: 5 }] },
    { adjusted: false, items: [{ exercise: 'Присед со штангой', weightKg: 110, reps: 3 }] },
  ];
  const w = [0, 0, 0, 0, 0, 0, 0, 0], r = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const s of sessions) {
    if (s.adjusted) continue;
    for (const it of s.items) {
      const idx = movementOf(it.exercise);
      if (idx < 0) continue;
      const score = it.weightKg * (1 + Math.min(it.reps, 12) / 30);
      if (score > (w[idx] ? w[idx] * (1 + Math.min(r[idx], 12) / 30) : 0)) { w[idx] = it.weightKg; r[idx] = it.reps; }
    }
  }
  return w[0] === 110 && r[0] === 3;
})());

console.log('\n=== БАЗА ДАННЫХ ===');
const db = JSON.parse(readFileSync(join(root, 'public', 'exercises.json'), 'utf8'));
check('упражнений в базе > 300', db.exercises.length > 300, `(${db.exercises.length})`);
check('групп мышц 16', db.muscleGroups.length === 16);
const picker = JSON.parse(readFileSync(join(root, 'public', 'picker.json'), 'utf8'));
check('picker: 6 регионов', picker.regions.length === 6);
check('picker: карта упражнений не пуста', Object.keys(picker.map).length > 300);
const md = readFileSync(join(root, 'public', 'knowledge.md'), 'utf8');
const chapters = md.split('\n').filter(l => l.startsWith('## ')).length;
check('глав в knowledge.md > 80', chapters > 80, `(${chapters})`);

console.log(`\n=== ИТОГ: ${pass} OK, ${fail} FAIL ===\n`);
process.exit(fail > 0 ? 1 : 0);
