// Генератор PWA-иконок FitGuide (PNG, без внешних зависимостей)
// Запуск: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public');

// --- Минимальный PNG-энкодер (RGBA, 8 бит) ---
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
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  // Каждой строке предшествует байт фильтра (0 = None)
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

// --- Рисуем иконку: скруглённый градиент + гантель ---
function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const r = size * 0.22; // радиус скругления
  const s = size / 100;   // масштаб от базовых 100x100

  // Параметры гантели (в базовых координатах 100x100)
  const bar = {
    x1: 27, x2: 73, y1: 26, y2: 74,      // центральный брус
    plate1x: 22, plate2x: 78,             // внешние блины
    plateTop: 20, plateBot: 80,
    innerTop: 32, innerBot: 68,
  };

  const inRounded = (x, y) => {
    // попадание в скруглённый прямоугольник
    const cx = Math.min(Math.max(x, r), size - r);
    const cy = Math.min(Math.max(y, r), size - r);
    const dx = x - cx, dy = y - cy;
    return dx * dx + dy * dy <= r * r || (x >= r && x <= size - r) || (y >= r && y <= size - r);
  };

  const inDumbbell = (x, y) => {
    const bx = x / s, by = y / s;
    // центральный брус
    if (bx >= bar.x1 && bx <= bar.x2 && by >= bar.y1 && by <= bar.y2) return true;
    // внешние блины (верхние и нижние)
    for (const px0 of [bar.plate1x, bar.plate2x]) {
      const dir = px0 < 40 ? 1 : -1;
      const x0 = px0, x1 = px0 + dir * 8;
      if (bx >= Math.min(x0, x1) && bx <= Math.max(x0, x1) && by >= bar.plateTop && by <= bar.plateBot) return true;
    }
    // средние блины (перед центральным брусом)
    for (const px0 of [bar.x1 - 6, bar.x2 + 6]) {
      const dir = px0 < 40 ? 1 : -1;
      const x0 = px0, x1 = px0 + dir * 5;
      if (bx >= Math.min(x0, x1) && bx <= Math.max(x0, x1) && by >= bar.innerTop && by <= bar.innerBot) return true;
    }
    return false;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (!inRounded(x + 0.5, y + 0.5)) {
        px[i] = 0; px[i + 1] = 0; px[i + 2] = 0; px[i + 3] = 0;
        continue;
      }
      // Градиент #0ea5e9 -> #0369a1 по диагонали
      const t = (x / size + y / size) / 2;
      const rr = Math.round(0x0e + (0x03 - 0x0e) * t);
      const gg = Math.round(0xa5 + (0x69 - 0xa5) * t);
      const bb = Math.round(0xe9 + (0xa1 - 0xe9) * t);

      if (inDumbbell(x + 0.5, y + 0.5)) {
        // Гантель белым
        px[i] = 255; px[i + 1] = 255; px[i + 2] = 255; px[i + 3] = 255;
      } else {
        px[i] = rr; px[i + 1] = gg; px[i + 2] = bb; px[i + 3] = 255;
      }
    }
  }
  return px;
}

mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  const png = encodePNG(size, size, drawIcon(size));
  const file = join(outDir, `icon-${size}.png`);
  writeFileSync(file, png);
  console.log(`OK: ${file} (${png.length} байт, ${size}x${size})`);
}
