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
import { GROUPS } from './muscle-groups.mjs';

const require = createRequire(import.meta.url);
const { FRONT_MUSCLES, BACK_MUSCLES } = require('body-muscles');

const OUT = path.resolve('src/data/muscleIcons.ts');

const front = new Map(FRONT_MUSCLES.map(m => [m.id, m.path]));
const back = new Map(BACK_MUSCLES.map(m => [m.id, m.path]));

const list = arr => '[\n' + arr.map(d => `    ${JSON.stringify(d)},`).join('\n') + '\n  ]';

let out = `// СГЕНЕРИРОВАНО scripts/gen-muscle-icons.mjs — руками не править.
// Источник: body-muscles (Apache-2.0), https://github.com/vulovix/body-muscles
//
// Координаты: вид спереди — x 0..35, вид сзади — x 37..70, высота 93.
// Тело рисуется всеми мышцами вида, целевая группа — отдельным слоем.

export type MuscleView = 'front' | 'back';

export const MUSCLE_BODY_FRONT: string[] = ${list([...front.values()])};

export const MUSCLE_BODY_BACK: string[] = ${list([...back.values()])};

export const MUSCLE_VIEW: Record<string, MuscleView> = {
`;

for (const [name, g] of Object.entries(GROUPS)) {
  out += `  ${name}: '${g.view}',\n`;
}

out += `};

export const MUSCLE_FIT: Record<string, string[]> = {
`;

for (const [name, g] of Object.entries(GROUPS)) {
  const map = g.view === 'front' ? front : back;
  const missing = g.ids.filter(id => !map.has(id));
  if (missing.length) console.warn(`${name}: нет мышц ${missing.join(', ')}`);
  out += `  ${name}: ${list(g.ids.filter(id => map.has(id)).map(id => map.get(id)))},\n`;
}

out += '};\n';

fs.writeFileSync(OUT, out);

console.log(`Готово: ${OUT}, групп ${Object.keys(GROUPS).length}, `
  + `тело front ${front.size} / back ${back.size}`);
