// FitGuide Web — масштабирование PNG (декодер + билинейный ресайз)
// Нужен, чтобы взять настоящий логотип приложения (192px из Android-проекта)
// и сделать из него иконки 192 и 512 для веба.
// Запуск: node scripts/scale-png.mjs <вход.png> <выход.png> <размер>

import { deflateSync, inflateSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';

// ---------- Декодер PNG ----------

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/** Возвращает {width, height, rgba: Buffer} */
export function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('не PNG');

  let width = 0, height = 0, bitDepth = 8, colorType = 6, interlace = 0;
  const idat = [];
  let palette = null, trns = null;

  let off = 8;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    off += 12 + len;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'PLTE') {
      palette = data;
    } else if (type === 'tRNS') {
      trns = data;
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  if (interlace !== 0) throw new Error(' interlaced PNG не поддерживается');
  if (bitDepth !== 8) throw new Error(`битовая глубина ${bitDepth} не поддерживается`);

  const raw = inflateSync(Buffer.concat(idat));
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`тип цвета ${colorType} не поддерживается`);

  const bpp = channels;
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);

  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = raw.subarray(pos, pos + stride);
    pos += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;

    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = (prev && x >= bpp) ? prev[x - bpp] : 0;
      let v = line[x];
      switch (filter) {
        case 0: break;
        case 1: v = v + a; break;
        case 2: v = v + b; break;
        case 3: v = v + ((a + b) >> 1); break;
        case 4: v = v + paeth(a, b, c); break;
        default: throw new Error('неизвестный фильтр ' + filter);
      }
      cur[x] = v & 0xff;
    }
  }

  // Приводим к RGBA
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    let r, g, b, a = 255;
    if (colorType === 6) {
      r = out[i * 4]; g = out[i * 4 + 1]; b = out[i * 4 + 2]; a = out[i * 4 + 3];
    } else if (colorType === 2) {
      r = out[i * 3]; g = out[i * 3 + 1]; b = out[i * 3 + 2];
    } else if (colorType === 0) {
      r = g = b = out[i];
    } else if (colorType === 4) {
      r = g = b = out[i * 2]; a = out[i * 2 + 1];
    } else if (colorType === 3) {
      const idx = out[i];
      r = palette[idx * 3]; g = palette[idx * 3 + 1]; b = palette[idx * 3 + 2];
      if (trns && idx < trns.length) a = trns[idx];
    }
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = a;
  }

  return { width, height, rgba };
}

// ---------- Энкодер PNG ----------

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

export function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

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

// ---------- Билинейный ресайз ----------

export function resize(src, targetW, targetH) {
  const { width: sw, height: sh, rgba: src2 } = src;
  const dst = Buffer.alloc(targetW * targetH * 4);

  const sample = (x, y, c) => {
    const xx = Math.min(Math.max(x, 0), sw - 1);
    const yy = Math.min(Math.max(y, 0), sh - 1);
    return src2[(yy * sw + xx) * 4 + c];
  };

  for (let y = 0; y < targetH; y++) {
    const fy = (y + 0.5) * sh / targetH - 0.5;
    const y0 = Math.floor(fy);
    const ty = fy - y0;
    for (let x = 0; x < targetW; x++) {
      const fx = (x + 0.5) * sw / targetW - 0.5;
      const x0 = Math.floor(fx);
      const tx = fx - x0;
      const i = (y * targetW + x) * 4;
      for (let c = 0; c < 4; c++) {
        const p00 = sample(x0, y0, c);
        const p10 = sample(x0 + 1, y0, c);
        const p01 = sample(x0, y0 + 1, c);
        const p11 = sample(x0 + 1, y0 + 1, c);
        const top = p00 + (p10 - p00) * tx;
        const bot = p01 + (p11 - p01) * tx;
        dst[i + c] = Math.round(top + (bot - top) * ty);
      }
    }
  }
  return dst;
}

// ---------- CLI ----------

if (process.argv[1] && process.argv[1].endsWith('scale-png.mjs')) {
  const [, , input, output, sizeArg, padArg] = process.argv;
  const size = parseInt(sizeArg || '512', 10);
  // pad — доля размера, занимаемая рисунком (0.8 = картинка на 80%, остальное поля)
  const pad = padArg !== undefined ? parseFloat(padArg) : 1;

  const img = decodePNG(readFileSync(input));
  console.log(`Источник: ${img.width}x${img.height}`);

  let out;
  if (pad >= 1) {
    out = resize(img, size, size);
  } else {
    // Рисунок вписывается в size*pad и центрируется на белом фоне (maskable-безопасная зона)
    const inner = Math.round(size * pad);
    const scaled = resize(img, inner, inner);
    out = Buffer.alloc(size * size * 4);
    for (let i = 0; i < size * size; i++) { out[i * 4] = 255; out[i * 4 + 1] = 255; out[i * 4 + 2] = 255; out[i * 4 + 3] = 255; }
    const off = Math.round((size - inner) / 2);
    for (let y = 0; y < inner; y++) {
      for (let x = 0; x < inner; x++) {
        const si = (y * inner + x) * 4;
        const di = ((y + off) * size + (x + off)) * 4;
        const a = scaled[si + 3] / 255;
        out[di] = Math.round(scaled[si] * a + 255 * (1 - a));
        out[di + 1] = Math.round(scaled[si + 1] * a + 255 * (1 - a));
        out[di + 2] = Math.round(scaled[si + 2] * a + 255 * (1 - a));
        out[di + 3] = 255;
      }
    }
  }

  writeFileSync(output, encodePNG(size, size, out));
  console.log(`OK: ${output} — ${size}x${size}${pad < 1 ? ` (рисунок ${Math.round(pad * 100)}%)` : ''}`);
}
