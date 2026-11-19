// FitGuide Web — проверка акцента на РЕАЛЬНЫХ программах, не на копии логики.
// Запуск: node scripts/gencheck.mjs
//
// Собирает src/core/generator.ts через esbuild и гоняет генератор на настоящей
// базе упражнений. Проверяем то, что видно на экране: приоритетная группа
// получает больше подходов и второе упражнение, день не удлиняется, а группа
// из чужой семьи в день не подмешивается.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.join(path.dirname(new URL(import.meta.url).pathname).replace(/^\//, ''), '..');
const out = path.join(process.env.TEMP || '.', `fg-gen-${process.pid}.mjs`);
await build({
  entryPoints: [path.join(root, 'src/core/generator.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'error',
});
const gen = await import(pathToFileURL(out).href);
const db = JSON.parse(fs.readFileSync(path.join(root, 'public/exercises.json'), 'utf8'));

let pass = 0;
let fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  OK   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}

function makeProgram(focus, type = 'split', daysPerWeek = 4) {
  return gen.generateProgram({
    name: 'Тест', goal: 'mass', level: 'intermediate', daysPerWeek, weeks: 8,
    place: 'gym', style: 'any', periodType: 0, type, equipment: [],
    age: 30, female: false, emphasis: 'balanced', focus,
  }, db);
}

/** Подходы в неделю по группам за первый (рабочий) блок. */
function weeklySets(p) {
  const per = new Map();
  for (const d of p.phases[0].days) {
    for (const s of d.slots) {
      if (s.group === 'Кардио') continue;
      per.set(s.group, (per.get(s.group) || 0) + (s.sets || 0));
    }
  }
  return per;
}

const base = makeProgram('');
const baseSets = weeklySets(base);

console.log('\n=== АКЦЕНТ: РЕАЛЬНЫЕ ПРОГРАММЫ (4 дня, сплит, масса) ===');

for (const [key, group, minGain] of [
  ['chest', 'Грудь', 3],
  ['back', 'Широчайшие', 3],
  ['legs', 'Квадрицепс', 0],
  ['abs', 'Пресс', 4],
  ['calves', 'Икры', 3],
]) {
  const p = makeProgram(key);
  const sets = weeklySets(p);
  const before = baseSets.get(group) || 0;
  const after = sets.get(group) || 0;
  check(`акцент «${key}»: ${group} ${before} → ${after} подходов/нед`,
    after >= before + minGain, `(нужно ≥ +${minGain})`);
  check(`акцент «${key}»: ${group} не больше 22`, after <= 22, `(${after})`);
  const maxSlots = Math.max(...p.phases[0].days.map(d => d.slots.length));
  const baseMax = Math.max(...base.phases[0].days.map(d => d.slots.length));
  check(`акцент «${key}»: день не удлиняется`, maxSlots <= baseMax, `(${maxSlots} vs ${baseMax})`);
}

const arms = makeProgram('arms');
const armsSets = weeklySets(arms);
check('акцент «arms»: бицепс 0 → больше нуля', (armsSets.get('Бицепс') || 0) > 0,
  `(${armsSets.get('Бицепс') || 0})`);
check('акцент «arms»: трицепс 0 → больше нуля', (armsSets.get('Трицепс') || 0) > 0,
  `(${armsSets.get('Трицепс') || 0})`);

// Руки в фулбоди: раньше день считался «уже с руками» по одному бицепсу, и
// акцент давал +1 подход. Теперь добавляется недостающая мышца.
for (const [type, days] of [['fullbody', 3], ['auto', 2]]) {
  const baseArms = weeklySets(makeProgram('', type, days));
  const armArms = weeklySets(makeProgram('arms', type, days));
  const before = (baseArms.get('Бицепс') || 0) + (baseArms.get('Трицепс') || 0);
  const after = (armArms.get('Бицепс') || 0) + (armArms.get('Трицепс') || 0);
  check(`акцент «arms» ${type} ${days}д: руки ${before} → ${after} подходов/нед`,
    after >= before + 6, `(${before} → ${after})`);
}

// Ягодицы: акцент не должен выкидывать пресс из недели целиком.
const glutesProgram = makeProgram('glutes');
const glutesSets = weeklySets(glutesProgram);
check('акцент «glutes»: ягодицы выросли', (glutesSets.get('Ягодицы') || 0) > 5,
  `(${glutesSets.get('Ягодицы') || 0})`);
check('акцент «glutes»: пресс остался в неделе', (glutesSets.get('Пресс') || 0) > 0,
  `(${glutesSets.get('Пресс') || 0})`);
const lowerDay = glutesProgram.phases[0].days.find(d => /Низ/.test(d.title));
check('акцент «glutes»: в дне ног ягодицы в первых двух слотах',
  !!lowerDay && lowerDay.slots.slice(0, 2).some(s => s.group === 'Ягодицы'),
  lowerDay ? lowerDay.slots.map(s => s.group).join(', ') : 'нет дня ног');

const chestDay = makeProgram('chest').phases[0].days[0];
const chestSlots = chestDay.slots.filter(s => s.group === 'Грудь');
check('акцент «chest»: в дне верха два упражнения на грудь', chestSlots.length === 2,
  `(${chestSlots.map(s => s.exercise).join(' / ')})`);
check('акцент «chest»: это разные упражнения',
  new Set(chestSlots.map(s => s.exercise)).size === chestSlots.length);

const legsProgram = makeProgram('chest');
const chestInLegs = legsProgram.phases[0].days
  .filter(d => /Низ/.test(d.title))
  .flatMap(d => d.slots)
  .filter(s => s.group === 'Грудь');
check('акцент «chest»: грудь не подмешана в день ног', chestInLegs.length === 0,
  chestInLegs.map(s => s.exercise).join('; '));

const plain = makeProgram('');
check('без акцента в программе нет поля focus', !plain.focus);
check('акцент попадает в поле программы', makeProgram('chest').focus === 'chest');
check('акцент хранится канонически', makeProgram('arms,chest').focus === 'chest,arms');

// --- Больше двух групп: лимита нет, перекос просто мягче.
const oneChest = weeklySets(makeProgram('chest')).get('Грудь') || 0;
const four = makeProgram('chest,back,arms,abs');
const fourSets = weeklySets(four);
const fourChest = fourSets.get('Грудь') || 0;
check('4 группы: грудь не срезана акцентом', fourChest >= (baseSets.get('Грудь') || 0),
  `(${baseSets.get('Грудь') || 0} → ${fourChest})`);
check('4 группы: приоритеты в сумме получают больше',
  ['Грудь', 'Широчайшие', 'Бицепс', 'Трицепс', 'Пресс']
    .reduce((sum, g) => sum + (fourSets.get(g) || 0), 0)
  > ['Грудь', 'Широчайшие', 'Бицепс', 'Трицепс', 'Пресс']
    .reduce((sum, g) => sum + (baseSets.get(g) || 0), 0),
  `(${['Грудь', 'Широчайшие', 'Бицепс', 'Трицепс', 'Пресс']
    .reduce((sum, g) => sum + (baseSets.get(g) || 0), 0)} → ${['Грудь', 'Широчайшие', 'Бицепс', 'Трицепс', 'Пресс']
    .reduce((sum, g) => sum + (fourSets.get(g) || 0), 0)})`);
check('4 группы: перекос мягче, чем при одной группе', fourChest <= oneChest,
  `(${fourChest} vs ${oneChest})`);
check('4 группы: день не удлиняется',
  Math.max(...four.phases[0].days.map(d => d.slots.length))
  <= Math.max(...base.phases[0].days.map(d => d.slots.length)));

// --- Все восемь: перекоса нет, программа как обычная, но выбор сохранён.
const allKey = 'chest,back,shoulders,arms,legs,glutes,abs,calves';
const all = makeProgram(allKey);
const allSets = weeklySets(all);
check('все 8: выбор сохранён целиком', all.focus === allKey, `(${all.focus})`);
check('все 8: грудь как без акцента',
  (allSets.get('Грудь') || 0) === (baseSets.get('Грудь') || 0),
  `(${baseSets.get('Грудь') || 0} vs ${allSets.get('Грудь') || 0})`);
check('все 8: день не удлиняется',
  Math.max(...all.phases[0].days.map(d => d.slots.length))
  <= Math.max(...base.phases[0].days.map(d => d.slots.length)),
  `(${Math.max(...all.phases[0].days.map(d => d.slots.length))} vs ${Math.max(...base.phases[0].days.map(d => d.slots.length))})`);

// --- Согласованность слоёв объёма: программа обязана набирать хотя бы 80 %
// собственной недельной цели по каждой мышце, которая в ней есть. Аудит 1.51
// нашёл обратное: цель 12–13, факт 3–4, и «Анализ» ругал программу приложения.
console.log('\n=== ОБЪЁМ: ЦЕЛЬ vs ФАКТ (муж/жен, новичок/средний/продвинутый) ===');
for (const [level, days, female] of [
  ['beginner', 3, false], ['beginner', 3, true],
  ['intermediate', 4, false], ['intermediate', 4, true],
  ['advanced', 5, false], ['advanced', 5, true],
]) {
  const prog = gen.generateProgram({
    name: 'Объём', goal: 'mass', level, daysPerWeek: days, weeks: 8,
    place: 'gym', style: 'any', periodType: 0, type: 'auto', equipment: [],
    age: 30, female, emphasis: female ? 'glutes_legs' : 'balanced', focus: '',
  }, db);
  const fact = weeklySets(prog);
  const tag = `${level}/${days}д/${female ? 'жен' : 'муж'}`;
  for (const [group, sets] of fact) {
    if (!sets) continue;
    const target = gen.weeklyTargetFor(group, 'mass', level, '', female, false, 0, false);
    const ratio = target > 0 ? sets / target : 1;
    check(`${tag}: ${group} ${sets}/${target} ≥ 80 %`, ratio >= 0.8,
      `(${Math.round(ratio * 100)} %)`);
  }
}

console.log(`\n=== ИТОГ: ${pass} OK, ${fail} FAIL ===\n`);
try { fs.unlinkSync(out); } catch { /* временный файл могли уже убрать */ }
process.exit(fail > 0 ? 1 : 0);
