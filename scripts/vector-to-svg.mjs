// Конвертер Android vector-drawable -> SVG (1:1, тот же pathData)
// Запуск: node scripts/vector-to-svg.mjs <res/drawable> <out/svg> [имя1 имя2 ...]
// Если список имён не задан — конвертируются все .xml

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const srcDir = process.argv[2];
const outDir = process.argv[3];
const only = process.argv.slice(4);

if (!srcDir || !outDir) {
  console.error('Использование: node scripts/vector-to-svg.mjs <drawable-dir> <out-dir> [names...]');
  process.exit(1);
}
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const files = readdirSync(srcDir).filter(f => f.endsWith('.xml'));
const list = only.length ? files.filter(f => only.some(o => f.startsWith(o))) : files;

let done = 0, skipped = 0;

for (const file of list) {
  const xml = readFileSync(join(srcDir, file), 'utf8');

  // Это не вектор — пропускаем (это <shape> и прочее)
  if (!xml.includes('<vector')) { skipped++; continue; }

  const vw = (xml.match(/android:viewportWidth="([\d.]+)"/) || [])[1] || '24';
  const vh = (xml.match(/android:viewportHeight="([\d.]+)"/) || [])[1] || '24';

  // Все <path> с fillColor и pathData
  const paths = [];
  const pathRe = /<path\b([\s\S]*?)\/>/g;
  let m;
  while ((m = pathRe.exec(xml)) !== null) {
    const attrs = m[1];
    const d = (attrs.match(/android:pathData="([^"]*)"/) || [])[1];
    let fill = (attrs.match(/android:fillColor="([^"]*)"/) || [])[1] || '#000000';
    // Android красит иконку сплошным цветом (app:tint) — все непрозрачные пиксели
    // становятся одним цветом. В вебе иконка идёт через CSS mask, где форма
    // берётся из альфы, а цвет — из background. Поэтому все пути красим в белый:
    // так маска одинакова для любой иконки (в т.ч. с тёмной заливкой в исходнике).
    fill = '#FFFFFF';
    const stroke = (attrs.match(/android:strokeColor="([^"]*)"/) || [])[1];
    const sw = (attrs.match(/android:strokeWidth="([^"]*)"/) || [])[1];
    if (!d) continue;

    let attrsOut = `d="${d.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" fill="${fill}"`;
    if (stroke) attrsOut += ` stroke="${stroke}" stroke-width="${sw || 1}" stroke-linecap="round" stroke-linejoin="round"`;
    paths.push(`  <path ${attrsOut}/>`);
  }

  if (!paths.length) { skipped++; continue; }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" width="${vw}" height="${vh}">\n${paths.join('\n')}\n</svg>\n`;
  const out = join(outDir, file.replace(/\.xml$/, '.svg'));
  writeFileSync(out, svg);
  done++;
}

console.log(`Готово: ${done} SVG, пропущено ${skipped}`);
