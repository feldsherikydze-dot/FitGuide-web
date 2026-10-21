// FitGuide Web — генератор PWA-иконок FitGuide (настоящий PNG, без зависимостей)
// Запуск: node scripts/generate-icons.mjs
//
// Рисуем гантель: центральный гриф + две пары блинов (внешние крупнее).
// Два варианта:
//   icon-192/512.png      — обычная иконка (any)
//   icon-maskable-512.png — с безопасной зоной (maskable: рисунок в центральных 80%)

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public');

// ---------- PNG-энкодер ----------

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- Геометрия ----------

/** Скруглённый прямоугольник: покрытие точки с учётом радиуса углов. */
function insideRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  // углы
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  const dx = x - cx, dy = y - cy;
  if (dx === 0 && dy === 0) return true;
  return dx * dx + dy * dy <= r * r;
}

/**
 * Гантель в координатах 0..100.
 *   гриф    — горизонтальный брус по центру
 *   блины   — две вертикальные стойки с каждой стороны (внешние выше)
 */
function insideDumbbell(x, y) {
  // гриф
  if (insideRoundRect(x, y, 24, 44, 76, 56, 5)) return true;
  // внутренние блины
  if (insideRoundRect(x, y, 30, 30, 40, 70, 4)) return true;
  if (insideRoundRect(x, y, 60, 30, 70, 70, 4)) return true;
  // внешние блины (крупнее)
  if (insideRoundRect(x, y, 18, 20, 28, 80, 4)) return true;
  if (insideRoundRect(x, y, 72, 20, 82, 80, 4)) return true;
  return false;
}

/**
 * size      — сторона иконки в пикселях
 * scale     — 1 = рисунок занимает весь холст; <1 = запас для maskable
 * radiusPct — радиус скругления фона (в долях размера)
 */
function drawIcon(size, scale, radiusPct) {
  const px = Buffer.alloc(size * size * 4);
  const S = size / 100;              // пикселей в единице координат
  const offset = (size - size * scale) / 2; // сдвиг для maskable-запаса
  const radius = size * radiusPct;

  const inRounded = (x, y) => {
    const cx = Math.min(Math.max(x, radius), size - radius);
    const cy = Math.min(Math.max(y, radius), size - radius);
    const dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy > radius * radius) {
      // вне скруглённого угла — но внутри прямых полос может быть ещё пиксель
      const insideX = x >= radius && x <= size - radius;
      const insideY = y >= radius && y <= size - radius;
      if (!(insideX || insideY)) return false;
    }
    return true;
  };

  for (let py = 0; py < size; py++) {
    for (let pxi = 0; pxi < size; pxi++) {
      const i = (py * size + pxi) * 4;
      const x = pxi + 0.5;
      const y = py + 0.5;

      if (!inRounded(x, y)) {
        px[i] = 0; px[i + 1] = 0; px[i + 2] = 0; px[i + 3] = 0;
        continue;
      }

      // Фон: диагональный градиент #0ea5e9 → #0369a1
      const t = (pxi / size + py / size) / 2;
      const r = Math.round(0x0e + (0x03 - 0x0e) * t);
      const g = Math.round(0xa5 + (0x69 - 0xa5) * t);
      const b = Math.round(0xe9 + (0xa1 - 0xe9) * t);

      // Гантель в системе координат 0..100 с учётом масштаба и сдвига
      const ux = (x - offset) / (size * scale) * 100;
      const uy = (y - offset) / (size * scale) * 100;

      if (insideDumbbell(ux, uy)) {
        px[i] = 255; px[i + 1] = 255; px[i + 2] = 255; px[i + 3] = 255;
      } else {
        px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
      }
    }
  }
  return px;
}

mkdirSync(outDir, { recursive: true });

const targets = [
  { file: 'icon-192.png', size: 192, scale: 1.0, radius: 0.22 },
  { file: 'icon-512.png', size: 512, scale: 1.0, radius: 0.22 },
  // maskable: рисунок в центральных 80%, фон на всю площадь
  { file: 'icon-maskable-512.png', size: 512, scale: 0.62, radius: 0 },
];

for (const t of targets) {
  const png = encodePNG(t.size, t.size, drawIcon(t.size, t.scale, t.radius));
  const file = join(outDir, t.file);
  writeFileSync(file, png);
  console.log(`OK: ${t.file} — ${png.length} байт, ${t.size}x${t.size}`);
}
