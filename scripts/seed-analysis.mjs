// Генератор синтетики для проверки вкладки «Анализ» в вебе.
// Пишет dist/seed-analysis.js: скрипт для браузера, который кладёт
// coach_state в localStorage и перезагружает страницу.
import fs from 'node:fs';

const DAY = 24 * 3600 * 1000;
const now = Date.now();
const WEEKS = 12;
const PER_WEEK = 3;

const days = [
  {
    title: 'Грудь',
    exercises: [
      { name: 'Жим штанги лежа классический', base: 60, inc: 2.5, reps: 10, planned: 40, actual: 40 },
      { name: 'Жим гантелей лежа', base: 22, inc: 1, reps: 10, planned: 40, actual: 40 },
      { name: 'Сведение гантелей на горизонтальной скамье', base: 12, inc: 0.5, reps: 12, planned: 35, actual: 35 },
      { name: 'Сведение рук в тренажере «Бабочка» (Pec Deck)', base: 40, inc: 2.5, reps: 12, planned: 35, actual: 35 },
    ],
  },
  {
    title: 'Спина',
    exercises: [
      { name: 'Тяга верхнего блока к груди широким хватом', base: 55, inc: 2.5, reps: 10, planned: 40, actual: 40 },
      { name: 'Тяга штанги в наклоне хватом сверху', base: 50, inc: 2.5, reps: 10, planned: 40, actual: 40 },
      { name: 'Тяга горизонтального блока к поясу', base: 45, inc: 2.5, reps: 10, planned: 40, actual: 40 },
      { name: 'Подтягивания в гравитроне широким хватом', base: 20, inc: 2.5, reps: 8, planned: 40, actual: 40 },
    ],
  },
  {
    title: 'Ноги',
    exercises: [
      { name: 'Классические приседания со штангой на плечах (Low-Bar / High-Bar)', base: 80, inc: 2.5, reps: 8, planned: 45, actual: 45 },
      { name: 'Жим ногами в тренажере (стандартный)', base: 160, inc: 5, reps: 10, planned: 45, actual: 45 },
      { name: 'Разгибания ног сидя в тренажере (Leg Extension)', base: 45, inc: 2.5, reps: 12, planned: 35, actual: 35 },
      { name: 'Сгибания ног в тренажере лежа (Lying Leg Curl)', base: 40, inc: 2.5, reps: 12, planned: 35, actual: 35 },
    ],
  },
];

const sessions = [];
let n = 0;
for (let w = 0; w < WEEKS; w++) {
  for (let d = 0; d < PER_WEEK; d++) {
    const dayIndex = w * PER_WEEK + d;
    const day = days[dayIndex % 3];
    const daysAgo = WEEKS * 7 - (w * 7 + d * 2 + 1);
    const ts = now - daysAgo * DAY + 18 * 3600 * 1000;
    const items = [];
    const setFacts = [];
    let at = ts + 5 * 60 * 1000;
    for (const ex of day.exercises) {
      const weight = Math.round((ex.base + w * ex.inc) * 2) / 2;
      const setReps = [ex.reps, ex.reps, ex.reps - 1, ex.reps - 2];
      items.push({
        exercise: ex.name,
        weightKg: weight,
        reps: ex.reps,
        sets: 4,
        targetSets: 4,
        feel: 2,
        setReps,
      });
      for (let s = 0; s < 4; s++) {
        setFacts.push({
          exercise: ex.name,
          feel: s === 3 ? 1 : 2,
          reps: setReps[s],
          weightKg: weight,
          atMs: at,
          actualSec: ex.actual,
          plannedSec: ex.planned,
        });
        at += 3 * 60 * 1000;
      }
    }
    sessions.push({
      id: `seed-${n++}`,
      programId: 'seed-prog',
      week: w + 1,
      dayTitle: day.title,
      ts,
      startedAt: ts,
      feel: 2,
      adjusted: false,
      items,
      durationSec: 3600,
      setFacts,
    });
  }
}

const state = {
  state: {
    activeProgramId: null,
    prevProgramId: null,
    activeSince: null,
    coachPath: 'own',
    coachProgramId: null,
    programPhase: '',
    programType: 'auto',
    sessions,
    checkins: [],
    feels: {},
    banned: [],
    limits: {},
    programUpdated: false,
    programUpdatedNote: '',
    resetAt: null,
    compPhase: null,
    compDate: null,
    compCategory: '',
    restrictions: [],
  },
  version: 0,
};

const payload = JSON.stringify(state);
const script = `(function () {
  localStorage.setItem('coach_state', ${JSON.stringify(payload)});
  localStorage.setItem('fitguide_web_onboarding_done', 'true');
  localStorage.setItem('fitguide_web_splash_enabled', 'false');
  location.hash = '#/progress';
  location.reload();
})();`;

fs.writeFileSync(new URL('../dist/seed-analysis.js', import.meta.url), script, 'utf8');
console.log('sessions', sessions.length, 'sets', sessions.reduce((s, x) => s + x.setFacts.length, 0), 'bytes', script.length);
