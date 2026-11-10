// Данные иконок мышечных групп для веба из открытого набора body-muscles
// (Apache-2.0, https://github.com/vulovix/body-muscles).
//
// В наборе 70+ мышц с точными SVG-путями: вид спереди — x 0..35, вид
// сзади — x 37..70, высота 93. Генерируем TS-модуль с путями, а не SVG-
// файлы: иконки рисуются inline, чтобы цвет брался из темы и не мылился
// CSS-маской на мелких деталях.
//
// Запуск: node scripts/gen-muscle-icons.mjs

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { FRONT_MUSCLES, BACK_MUSCLES } = require('body-muscles');

const OUT = path.resolve('src/data/muscleIcons.ts');

// Соответствие групп приложения мышцам набора.
const GROUPS = {
  chest: ['front', ['chest-upper-left', 'chest-lower-left', 'chest-upper-right', 'chest-lower-right']],
  abs: ['front', ['abs-upper-left', 'abs-lower-left', 'abs-upper-right', 'abs-lower-right']],
  delts: ['front', ['shoulder-front-left', 'shoulder-side-left', 'shoulder-front-right', 'shoulder-side-right']],
  biceps: ['front', ['biceps-left', 'biceps-right']],
  forearms: ['front', ['forearm-left', 'forearm-right']],
  quads: ['front', ['quads-left', 'quads-right']],
  adductors: ['front', ['adductors-left', 'adductors-right']],
  neck: ['front', ['neck-left', 'neck-right']],
  trap: ['back', ['traps-upper-left', 'traps-mid-left', 'traps-lower-left',
    'traps-upper-right', 'traps-mid-right', 'traps-lower-right']],
  back: ['back', ['lats-upper-left', 'lats-mid-left', 'lats-lower-left',
    'lats-upper-right', 'lats-mid-right', 'lats-lower-right']],
  midback: ['back', ['traps-mid-left', 'traps-mid-right']],
  lowback: ['back', ['lower-back-erectors-left', 'lower-back-erectors-right', 'spine']],
  triceps: ['back', ['triceps-long-left', 'triceps-lateral-left',
    'triceps-long-right', 'triceps-lateral-right']],
  hamstrings: ['back', ['hamstrings-medial-left', 'hamstrings-lateral-left',
    'hamstrings-medial-right', 'hamstrings-lateral-right']],
  glutes: ['back', ['gluteus-maximus-left', 'gluteus-medius-left',
    'gluteus-maximus-right', 'gluteus-medius-right']],
  calves: ['back', ['calves-gastroc-medial-left', 'calves-gastroc-lateral-left', 'calves-soleus-left',
    'calves-gastroc-medial-right', 'calves-gastroc-lateral-right', 'calves-soleus-right']],
};

// Алиасы из Android ICON_MAP, чтобы ничего не отвалилось.
GROUPS.arms = ['front', [...GROUPS.biceps[1], ...GROUPS.forearms[1]]];
GROUPS.legs = ['front', [...GROUPS.quads[1], ...GROUPS.adductors[1]]];
GROUPS.shoulders = GROUPS.delts;

const front = new Map(FRONT_MUSCLES.map(m => [m.id, m.path]));
const back = new Map(BACK_MUSCLES.map(m => [m.id, m.path]));

const list = (map, arr) => '[\n' + arr.map(d => `    ${JSON.stringify(d)},`).join('\n') + '\n  ]';

let out = `// СГЕНЕРИРОВАНО scripts/gen-muscle-icons.mjs — руками не править.
// Источник: body-muscles (Apache-2.0), https://github.com/vulovix/body-muscles
//
// Координаты: вид спереди — x 0..35, вид сзади — x 37..70, высота 93.
// Тело рисуется всеми мышцами вида, целевая группа — отдельным слоем.

export type MuscleView = 'front' | 'back';

export const MUSCLE_BODY_FRONT: string[] = ${list(front, [...front.keys()].map(k => front.get(k)))};

export const MUSCLE_BODY_BACK: string[] = ${list(back, [...back.keys()].map(k => back.get(k)))};

export const MUSCLE_VIEW: Record<string, MuscleView> = {
`;

for (const [name, [view]] of Object.entries(GROUPS)) {
  out += `  ${name}: '${view}',\n`;
}

out += `};

export const MUSCLE_FIT: Record<string, string[]> = {
`;

for (const [name, [view, target]] of Object.entries(GROUPS)) {
  const map = view === 'front' ? front : back;
  const missing = target.filter(id => !map.has(id));
  if (missing.length) console.warn(`${name}: нет мышц ${missing.join(', ')}`);
  out += `  ${name}: ${list(map, target.filter(id => map.has(id)).map(id => map.get(id)))},\n`;
}

out += '};\n';

fs.writeFileSync(OUT, out);

// Заодно кладём SVG-файлы: они нужны для офлайн-превью и как запасной
// вариант, если inline-рендер где-то не подойдёт.
const VB = { front: '0 0 35 93', back: '37 0 35 93' };
const svg = (view, paths) => '<svg xmlns="http://www.w3.org/2000/svg" '
  + `viewBox="${VB[view]}" width="35" height="93">\n`
  + paths.map(d => `<path d="${d}" />`).join('\n') + '\n</svg>\n';
const iconsDir = path.resolve('public/icons');

for (const [name, [view, target]] of Object.entries(GROUPS)) {
  const map = view === 'front' ? front : back;
  const all = [...map.values()];
  fs.writeFileSync(path.join(iconsDir, `muscle_${name}_body.svg`), svg(view, all));
  fs.writeFileSync(path.join(iconsDir, `muscle_${name}_fit.svg`),
    svg(view, target.filter(id => map.has(id)).map(id => map.get(id))));
}

console.log(`Готово: ${OUT}, групп ${Object.keys(GROUPS).length}, `
  + `тело front ${front.size} / back ${back.size}`);
