// FitGuide Web — подготовка своих картинок заставки.
//
// localStorage даёт ~5 МБ на сайт, а веб-бэкап хранит картинки как data-URL
// внутри JSON. Фото из галереи весит 3–6 МБ, поэтому в исходном виде
// помещается одна-две штуки, и владелец видит «добавилось», но фон не
// меняется. Здесь фото уменьшается по длинной стороне и пережимается в
// JPEG: сначала мягко, а если всё ещё тяжело — сильнее.

/** Предел на одну картинку в символах data-URL (≈250 КБ бинарника). */
export const MAX_IMAGE_CHARS = 330_000;

/** Общий бюджет на все свои фоны: остальное в localStorage нужно приложению. */
export const SPLASH_IMAGES_BUDGET = 4_000_000;

const STEPS: { side: number; quality: number }[] = [
  { side: 1440, quality: 0.82 },
  { side: 1200, quality: 0.78 },
  { side: 1024, quality: 0.74 },
  { side: 900, quality: 0.68 },
  { side: 720, quality: 0.62 },
];

type BitmapLike = {
  width: number;
  height: number;
  close?: () => void;
};

async function loadBitmap(file: File): Promise<BitmapLike> {
  // createImageBitmap сам учитывает EXIF-поворот (imageOrientation)
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Safari старых версий не умеет опции — пробуем без них
      try {
        return await createImageBitmap(file);
      } catch {
        // ниже обычный <img>
      }
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawJpeg(bitmap: BitmapLike, side: number, quality: number): string {
  const longest = Math.max(bitmap.width, bitmap.height) || 1;
  const scale = Math.min(1, side / longest);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas-2d');
  // Заставка тёмная: прозрачные PNG не должны становиться белыми
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Готовит data-URL для хранения: длинная сторона ≤1440, JPEG, при
 * необходимости — следующие ступени сжатия. Если даже последняя ступень
 * не влезла в MAX_IMAGE_CHARS, возвращаем её: бюджет проверит вызывающий.
 */
export async function compressSplashImage(file: File): Promise<string> {
  const bitmap = await loadBitmap(file);
  try {
    let last = '';
    for (const step of STEPS) {
      last = drawJpeg(bitmap, step.side, step.quality);
      if (last.length <= MAX_IMAGE_CHARS) return last;
    }
    return last;
  } finally {
    bitmap.close?.();
  }
}
