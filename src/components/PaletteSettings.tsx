// FitGuide Web — экран палитр (порт ThemeManager + настройки тем в Android)
//
// Четыре независимых слота цвета, у каждого — свой пресет или свой RGB:
//   (A) Контур    — рамки карточек
//   (B) Ярлыки    — верхняя панель и кнопки
//   (C) Кругляшки — круг под иконкой в ярлыке
//   (D) Надписи   — текст на ярлыках

import { useState } from 'react';
import { clsx } from 'clsx';
import { Palette, RotateCcw, Check } from 'lucide-react';
import {
  PALETTE_KEYS, PRIMARY_COLORS, SECONDARY_COLORS,
  getPalette, setSlotPalette, setSlotCustom, resetPalette, subscribePalette,
  type SlotName,
} from '../core/palette';
import { usePaletteVars } from '../components/ui';

const SLOTS: { id: SlotName; title: string; desc: string }[] = [
  { id: 'outline', title: 'Контур', desc: 'Рамки карточек' },
  { id: 'labelsButtons', title: 'Ярлыки и кнопки', desc: 'Верхняя панель, кнопки' },
  { id: 'circleIcons', title: 'Кругляшки', desc: 'Круг под иконкой в ярлыке' },
  { id: 'labelsText', title: 'Надписи', desc: 'Текст на ярлыках' },
];

export function PaletteSettings() {
  usePaletteVars();
  const [, force] = useState(0);
  useState(() => subscribePalette(() => force(x => x + 1)));

  const [customSlot, setCustomSlot] = useState<SlotName | null>(null);
  const [customColor, setCustomColor] = useState('#12A594');
  const palette = getPalette();

  const apply = (slot: SlotName, index: number) => {
    setSlotPalette(slot, index);
    setCustomSlot(null);
  };

  const applyCustom = (slot: SlotName, color: string) => {
    setSlotCustom(slot, color);
  };

  return (
    <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Palette className="w-5 h-5 text-primary-600" />
          Палитра
        </h2>
        <button
          onClick={() => { resetPalette(); setCustomSlot(null); }}
          className="text-sm text-slate-500 dark:text-slate-400 hover:underline flex items-center gap-1"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Сброс
        </button>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Четыре независимых цвета оформления. Каждый — из пресета или свой.
      </p>

      <div className="space-y-4">
        {SLOTS.map(slot => {
          const custom = palette.custom[slot.id];
          const idx = palette.slots[slot.id];
          return (
            <div key={slot.id}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">{slot.title}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{slot.desc}</div>
                </div>
                {custom && (
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: custom + '22', color: custom }}>
                    свой цвет
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {PALETTE_KEYS.map((key, i) => (
                  <button
                    key={key}
                    onClick={() => apply(slot.id, i)}
                    title={key}
                    className={clsx(
                      'w-9 h-9 rounded-full flex items-center justify-center transition-transform active:scale-95',
                      !custom && idx === i && 'ring-2 ring-offset-2'
                    )}
                    style={{
                      background: slot.id === 'outline' || slot.id === 'labelsText'
                        ? SECONDARY_COLORS[i] : PRIMARY_COLORS[i],
                      // кольцо в цвет текста, чтобы читалось на любом фоне
                      ['--tw-ring-color' as any]: 'var(--color-text-main)',
                    }}
                  >
                    {!custom && idx === i && (
                      <Check className="w-4 h-4 text-white drop-shadow" />
                    )}
                  </button>
                ))}

                {/* Свой цвет */}
                <button
                  onClick={() => { setCustomSlot(slot.id); setCustomColor(custom || '#12A594'); }}
                  className={clsx(
                    'w-9 h-9 rounded-full flex items-center justify-center border-2 border-dashed',
                    customSlot === slot.id
                      ? 'border-slate-900 dark:border-white'
                      : 'border-slate-300 dark:border-dark-border'
                  )}
                  style={custom ? { background: custom } : undefined}
                  title="Свой цвет"
                >
                  {!custom && <span className="text-xs text-slate-400">+</span>}
                </button>

                {custom && (
                  <button
                    onClick={() => setSlotCustom(slot.id, null)}
                    className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 dark:bg-dark-border"
                    title="Убрать свой цвет"
                  >
                    <span className="text-xs text-slate-500">×</span>
                  </button>
                )}
              </div>

              {customSlot === slot.id && (
                <div className="mt-2 flex items-center gap-3 p-3 rounded-lg"
                  style={{ background: 'var(--color-surface-variant)' }}>
                  <input
                    type="color"
                    value={customColor}
                    onChange={e => { setCustomColor(e.target.value); applyCustom(slot.id, e.target.value); }}
                    className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent"
                  />
                  <input
                    type="text"
                    value={customColor}
                    onChange={e => { setCustomColor(e.target.value); applyCustom(slot.id, e.target.value); }}
                    className="fg-input flex-1"
                    style={{ padding: '8px 12px' }}
                  />
                  <span className="text-sm text-slate-500 dark:text-slate-400">свой цвет</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
