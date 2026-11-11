// Аудит интерпретации «Анализа» по всем упражнениям каталога.
// Строит по каждому упражнению правдоподобную историю 4 недели и смотрит,
// какие советы/флаги вылезают. Цель — найти абсурд в текстах и правилах.
const path = require('path');
const { buildReport } = require('./core/workAnalysis.js');
const catalog = require(path.join(__dirname, '..', 'public', 'exercises.json')).exercises;

const DAY = 24 * 3600 * 1000;
const WEEK = 7 * DAY;

function parseReps(s) {
  const str = String(s || '').trim();
  const staticEx = /сек/i.test(str);
  const steps = /шаг/i.test(str);
  // sets: «4×8–12» → 4
  const mSets = str.match(/^(\d+)\s*[xх×]/);
  const sets = mSets ? parseInt(mSets[1], 10) : 3;
  // повторы: последний диапазон «8–12» или число после ×
  const body = mSets ? str.slice(mSets[0].length) : str;
  const nums = (body.match(/\d+(?:[.,]\d+)?/g) || []).map(Number);
  const reps = nums.length >= 2 ? Math.round((nums[0] + nums[1]) / 2) : (nums[0] || 8);
  return { staticEx, steps, sets, reps };
}

function makeSession(ex, idx) {
  const { staticEx, steps, sets, reps } = parseReps(ex.reps);
  const name = ex.name;
  const planReps = reps;
  const actualReps = planReps; // по плану
  const actualSec = staticEx ? planReps : actualReps * 3;
  const weight = /не требуется|своё тело|вес тела/i.test(String(ex.equipmentType || '')) ? 0 : 20;
  const facts = [];
  for (let i = 0; i < sets; i++) {
    facts.push({
      exercise: name, feel: 2, reps: actualReps, weightKg: weight,
      actualSec, plannedSec: 0, atMs: idx * WEEK + i * 120000,
    });
  }
  return {
    id: 's' + idx, programId: 'audit', week: idx + 1, dayTitle: 'День', ts: idx * WEEK + DAY,
    durationSec: 3600, items: [], setFacts: facts,
  };
}

const from = 0;
const to = 4 * WEEK + DAY;
const results = [];
for (const ex of catalog) {
  const sessions = [0, 1, 2, 3].map(i => makeSession(ex, i));
  const kind = /сек/i.test(String(ex.reps||'')) ? 'static' : (/шаг/i.test(String(ex.reps||'')) ? 'steps' : 'dynamic');
  const r = buildReport(sessions, from, to, undefined, () => kind);
  const st = [...r.byExercise.values()][0];
  results.push({
    name: ex.name, reps: ex.reps, type: ex.type,
    staticEx: /сек/i.test(String(ex.reps || '')), steps: /шаг/i.test(String(ex.reps || '')),
    tips: r.tips.map(t => t.title + ' :: ' + t.text),
    flags: r.flags.map(f => f.code + ' :: ' + f.text),
    tempo: st ? st.tempoSecPerRep : 0,
    repsDone: st ? st.repsDone : 0, repsPlan: st ? st.repsPlan : 0,
    weight: st ? st.weightLast : 0,
  });
}

const byKind = { staticEx: [], steps: [], dynamic: [] };
for (const x of results) byKind[x.staticEx ? 'staticEx' : x.steps ? 'steps' : 'dynamic'].push(x);

console.log('=== Всего упражнений:', results.length,
  '| статика:', byKind.staticEx.length, '| шаги:', byKind.steps.length, '| динамика:', byKind.dynamic.length);

console.log('\n=== Статика: какие советы получает ===');
for (const x of byKind.staticEx) {
  console.log('\n' + x.name + '  [' + x.reps + ']');
  for (const t of x.tips) console.log('  TIP ' + t);
  for (const f of x.flags) console.log('  FLAG ' + f);
}

const badVerb = results.filter(x => x.tips.some(t => /Тяни быстрее/.test(t)));
console.log('\n=== «Тяни быстрее» сработало у', badVerb.length, 'упражнений ===');
for (const x of badVerb.slice(0, 25)) console.log('  ' + x.name + '  темп ' + x.tempo.toFixed(1));

const repDrop = results.filter(x => x.tips.some(t => /повторы просели/i.test(t)));
console.log('\n=== «Повторы просели» при работе по плану:', repDrop.length, '===');
for (const x of repDrop.slice(0, 20)) console.log('  ' + x.name + '  план ' + x.repsPlan + ' факт ' + x.repsDone);

const weightTipNoWeight = results.filter(x => x.weight === 0 && x.tips.some(t => /рабочий вес|можно тяжелее|нужно легче/i.test(t)));
console.log('\n=== Советы про вес без веса:', weightTipNoWeight.length, '===');
for (const x of weightTipNoWeight.slice(0, 20)) console.log('  ' + x.name);

const overPlan = results.filter(x => x.flags.some(f => /^over/.test(f)));
console.log('\n=== Флаг «время больше плана»:', overPlan.length, '===');

// Полный список уникальных текстов советов — чтобы глазами вычитать формулировки
const texts = new Set();
for (const x of results) for (const t of x.tips) texts.add(t.replace(/^[^:]+: /, '').slice(0, 90));
console.log('\n=== Уникальные начала текстов советов:', texts.size, '===');
for (const t of [...texts].sort()) console.log('  ' + t);
