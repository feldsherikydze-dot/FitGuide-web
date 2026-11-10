// Превью иконок мышечных групп в HTML — для визуальной проверки.
// Читает те же данные и те же соответствия, что генератор и приложение.
//
// Запуск: node scripts/preview-muscles.mjs [out.html] [--big]

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { GROUPS } from './muscle-groups.mjs';

const require = createRequire(import.meta.url);
const { FRONT_MUSCLES, BACK_MUSCLES } = require('body-muscles');

const OUT = path.resolve(process.argv[2] || 'muscle-preview.html');
const BIG = process.argv.includes('--big');

const maps = {
  front: new Map(FRONT_MUSCLES.map(m => [m.id, m.path])),
  back: new Map(BACK_MUSCLES.map(m => [m.id, m.path])),
};

const CARD_W = BIG ? 300 : 150;
const ART_H = BIG ? 440 : 164;
const ICON_H = BIG ? 420 : 150;
const ICON_W = Math.round((ICON_H * 35) / 93);
const COLS = BIG ? 4 : 8;

const card = ([name, g]) => {
  const all = [...maps[g.view].values()].map(d => `<path d="${d}" />`).join('');
  const fit = g.ids.map(id => `<path d="${maps[g.view].get(id)}" />`).join('');
  const vb = g.view === 'front' ? '0 0 35 93' : '37 0 35 93';
  return `
  <div class="card">
    <div class="art">
      <span class="halo"></span>
      <svg viewBox="${vb}" width="${ICON_W}" height="${ICON_H}" aria-hidden="true">
        <g fill="#9AA5A1" fill-opacity="0.5" stroke="#9AA5A1" stroke-opacity="0.28"
           stroke-width="0.12" stroke-linejoin="round">${all}</g>
        <g fill="#8FFF00" style="filter:drop-shadow(0 0 2.5px #8FFF00)">${fit}</g>
      </svg>
    </div>
    <div class="t">${g.title}</div>
  </div>`;
};

const html = `<!doctype html><meta charset="utf-8"><style>
  body { margin:0; background:#0D0F11; font-family:system-ui,sans-serif; padding:16px; }
  .grid { display:grid; grid-template-columns:repeat(${COLS}, ${CARD_W}px); gap:14px; }
  .card { background:#000; border:1px solid #FF005B; border-radius:20px; padding:18px 8px 14px; text-align:center; }
  .art { position:relative; width:${CARD_W}px; height:${ART_H}px; margin:0 auto;
    display:flex; align-items:center; justify-content:center; }
  .halo { position:absolute; inset:0; border-radius:50%;
    background:radial-gradient(circle at 50% 38%, rgba(143,255,0,.16) 0%, transparent 72%);
    border:1px solid rgba(143,255,0,.20); }
  .t { color:#fff; font-size:${BIG ? 18 : 14}px; font-weight:700; margin-top:10px; }
</style><div class="grid">${Object.entries(GROUPS).map(card).join('')}</div>`;

fs.writeFileSync(OUT, html);
console.log('Готово: ' + OUT);
