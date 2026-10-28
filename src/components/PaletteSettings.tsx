// FitGuide Web — экран палитры (порт SettingsActivity.setupPalette / buildPaletteGroup
// и ColorCircleView из Android 1.17)
//
// Ровно как в APK:
//   • четыре строки — Контур (A), Ярлыки + кнопки (B), Кругляшки внутри ярлыков (C), Надписи (D);
//   • в строке один свотч во всю ширину (34dp, скругление в половину высоты);
//   • обводка свотча — статический цвет темы textMain, толщина 3dp;
//   • заливка — свой цвет, если задан, иначе colorSurface;
//   • глиф: ✓ — свой цвет задан, ✎ — не задан;
//   • клик открывает колорпикер: круг HSV + ползунок яркости + кружок-превью.

import { useEffect, useRef, useState } from 'react';
import {
  slotColor, contrastOn, setSlotCustom, getPalette, subscribePalette,
  type SlotName,
} from '../core/palette';

const SLOTS: { id: SlotName; title: string }[] = [
  { id: 'outline', title: 'Контур' },
  { id: 'labelsButtons', title: 'Ярлыки + кнопки' },
  { id: 'circleIcons', title: 'Кругляшки внутри ярлыков' },
  { id: 'labelsText', title: 'Надписи' },
];

// ---------------------------------------------------------------- HSV

function rgbToHsv(hex: string): { h: number; s: number; v: number } {
  const h6 = hex.replace('#', '');
  const r = parseInt(h6.slice(0, 2), 16) / 255;
  const g = parseInt(h6.slice(2, 4), 16) / 255;
  const b = parseInt(h6.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let hue = 0;
  if (d !== 0) {
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return { h: hue, s: max === 0 ? 0 : d / max, v: max };
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) { r = c; g = x; }
  else if (hp < 2) { r = x; g = c; }
  else if (hp < 3) { g = c; b = x; }
  else if (hp < 4) { g = x; b = c; }
  else if (hp < 5) { r = x; b = c; }
  else { r = c; b = x; }
  const m = v - c;
  const to = (n: number) => Math.round(Math.min(255, Math.max(0, (n + m) * 255)))
    .toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

// ---------------------------------------------------------------- круг цвета

function ColorWheel({ hue, sat, value, size, onPick }: {
  hue: number; sat: number; value: number; size: number;
  onPick: (h: number, s: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = size * dpr;
    cv.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const r = size / 2;
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - r + 0.5;
        const dy = y - r + 0.5;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const i = (y * size + x) * 4;
        if (dist > r) { img.data[i + 3] = 0; continue; }
        let angle = Math.atan2(dy, dx) * 180 / Math.PI;
        if (angle < 0) angle += 360;
        const hex = hsvToHex(angle, Math.min(1, dist / r), value);
        img.data[i] = parseInt(hex.slice(1, 3), 16);
        img.data[i + 1] = parseInt(hex.slice(3, 5), 16);
        img.data[i + 2] = parseInt(hex.slice(5, 7), 16);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [size, value]);

  const pick = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const r = rect.width / 2;
    const dx = e.clientX - rect.left - r;
    const dy = e.clientY - rect.top - r;
    const dist = Math.sqrt(dx * dx + dy * dy);
    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    if (angle < 0) angle += 360;
    onPick(angle, Math.min(1, dist / r));
  };

  const rad = (hue * Math.PI) / 180;
  const pr = sat * (size / 2 - 8);
  const px = size / 2 + Math.cos(rad) * pr;
  const py = size / 2 + Math.sin(rad) * pr;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <canvas
        ref={ref}
        style={{ width: size, height: size, borderRadius: '50%', touchAction: 'none', display: 'block' }}
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); pick(e); }}
        onPointerMove={e => { if (e.buttons) pick(e); }}
      />
      <span
        className="absolute rounded-full pointer-events-none"
        style={{
          left: px - 9, top: py - 9, width: 18, height: 18,
          border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,0.45)',
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------- экран

export function PaletteSettings() {
  const [, force] = useState(0);
  useEffect(() => subscribePalette(() => force(x => x + 1)), []);

  const [editSlot, setEditSlot] = useState<SlotName | null>(null);
  const [hue, setHue] = useState(0);
  const [sat, setSat] = useState(0);
  const [val, setVal] = useState(1);

  const palette = getPalette();

  const openPicker = (slot: SlotName) => {
    const custom = palette.custom[slot];
    const hsv = rgbToHsv(custom || slotColor(slot));
    setHue(hsv.h);
    setSat(hsv.s);
    setVal(hsv.v || 1);
    setEditSlot(slot);
  };

  const preview = hsvToHex(hue, sat, val);
  const editTitle = SLOTS.find(s => s.id === editSlot)?.title ?? '';

  return (
    <div
      className="rounded-[18px] p-4"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-stroke)' }}
    >
      <h2 className="text-[15px] font-bold" style={{ color: 'var(--color-text-main)' }}>Палитра</h2>
      <p className="text-[13px] mt-0.5 mb-3" style={{ color: 'var(--color-text-secondary)' }}>
        Цветовая схема приложения
      </p>

      <div className="space-y-3">
        {SLOTS.map(slot => {
          const custom = palette.custom[slot.id];
          const bg = custom || 'var(--color-surface)';
          // На сворче палитры галочка/карандаш всегда белые (как на скриншоте Android).
          const fg = '#FFFFFF';
          return (
            <div key={slot.id}>
              <div className="text-[15px] font-bold mb-1.5" style={{ color: 'var(--color-text-main)' }}>
                {slot.title}
              </div>
              <button
                onClick={() => openPicker(slot.id)}
                aria-label={`Свой цвет: ${slot.title}`}
                className="w-full flex items-center px-3 active:opacity-90"
                style={{
                  height: 34,
                  borderRadius: 17,
                  background: bg,
                  border: '3px solid var(--color-text-main)',
                  color: fg,
                  fontSize: 15,
                  lineHeight: 1,
                }}
              >
                {custom ? '✓' : '✎'}
              </button>
            </div>
          );
        })}
      </div>

      {editSlot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={() => setEditSlot(null)}
        >
          <div
            className="w-full max-w-[360px] rounded-[20px] p-4"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-stroke)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-[17px] font-bold mb-1" style={{ color: 'var(--color-text-main)' }}>
              Свой цвет
            </div>
            <div className="text-[13px] mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              {editTitle}
            </div>

            <div className="flex flex-col items-center">
              <ColorWheel hue={hue} sat={sat} value={val} size={220} onPick={(h, s) => { setHue(h); setSat(s); }} />
              <span
                className="mt-3 rounded-full"
                style={{
                  width: 48, height: 48, background: preview,
                  border: `2px solid ${contrastOn(preview)}`,
                }}
              />
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(val * 100)}
                onChange={e => setVal(Number(e.target.value) / 100)}
                className="w-full mt-3"
                style={{ accentColor: 'var(--p-labels-text)' }}
              />
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setEditSlot(null)}
                className="px-4 py-2 rounded-full text-[14px] font-medium"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Отмена
              </button>
              <button
                onClick={() => { setSlotCustom(editSlot, preview); setEditSlot(null); }}
                className="px-4 py-2 rounded-full text-[14px] font-medium"
                style={{ color: 'var(--p-labels-text)' }}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
