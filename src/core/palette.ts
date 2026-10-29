// FitGuide Web — система палитр (порт ThemeManager.java + BaseActivity.tintTree)
//
// Четыре независимых слота цвета — ровно как в Android:
//   (A) Контур    — обводки карточек, чипов, полей; значок внутри кругляшка
//   (B) Ярлыки+кнопки — фон ярлыков, кнопок, полей ввода, мини-плеера
//   (C) Кругляшки — шапка (градиент), кружок под иконкой, выбранные чипы
//   (D) Надписи   — заголовки, текст и значки кнопок, ползунки.
//                   Пока не задан вручную — повторяет контур (A).
//
// Текст НА ярлыке (B) и НА кругляшке (C) — не слот, а авто-контраст к заливке.

import { getJSON, setJSON, KEYS } from './storage';

export const PALETTE_KEYS = ['emerald', 'ocean', 'indigo', 'berry', 'sunset', 'graphite', 'kolizey'] as const;
export type PaletteKey = typeof PALETTE_KEYS[number];

/** Primary-цвета пресетов (совпадают с p_*_primary). */
export const PRIMARY_COLORS = [
  '#12A594', // emerald
  '#2F6FED', // ocean
  '#6C5CE7', // indigo
  '#D81B60', // berry
  '#E8590C', // sunset
  '#495057', // graphite
  '#00953E', // kolizey
];

/** Secondary-цвета пресетов (совпадают с p_*_accent). */
export const SECONDARY_COLORS = [
  '#FF9F1C', // emerald
  '#00B8D9', // ocean
  '#FF6B6B', // indigo
  '#8E24AA', // berry
  '#FFC300', // sunset
  '#20C997', // graphite
  '#F3C20F', // kolizey
];

/** Базовые цвета интерфейса (colors.xml). */
export const BASE = {
  surface: '#FFFFFF',
  background: '#F5F8F6',
  textMain: '#1B1E20',
  textSecondary: '#6E767B',
  stroke: '#D8E4DC',
  outline: '#BFCFC4',
  surfaceVariant: '#EDF4EF',
  warning: '#C0392B',
  white: '#FFFFFF',
};

export type SlotName = 'outline' | 'labelsButtons' | 'circleIcons' | 'labelsText';

export interface PaletteState {
  /** Версия схемы: старые сохранённые палитры сбрасываются к дефолту Android. */
  v?: number;
  primary: number;
  secondary: number;
  /** Индекс пресета для слота. labelsText: null = наследует контур (A). */
  slots: { outline: number; labelsButtons: number; circleIcons: number; labelsText: number | null };
  /** Свой RGB (null = выключен). */
  custom: Record<SlotName, string | null>;
}

/** Версия схемы палитры. 2 — точные дефолты Android 1.18 (SplashActivity.java). */
const PALETTE_SCHEMA = 2;

const DEFAULT_PALETTE: PaletteState = {
  v: PALETTE_SCHEMA,
  primary: 0,
  secondary: 0,
  slots: { outline: 0, labelsButtons: 0, circleIcons: 0, labelsText: null },
  /**
   * Дефолт чистого запуска ровно как в SplashActivity.java:
   *   A (контур)        = rgb(255, 0, 91)  = #FF005B
   *   B (ярлыки+кнопки) = rgb(0, 0, 0)     = #000000
   *   C (кругляшки)     = rgb(143, 255, 0) = #8FFF00
   *   D (надписи)       = не задан вручную, повторяет A (в UI — карандаш).
   */
  custom: {
    outline: '#FF005B',
    labelsButtons: '#000000',
    circleIcons: '#8FFF00',
    labelsText: null,
  },
};

let state: PaletteState = loadPalette();
const listeners = new Set<() => void>();

function loadPalette(): PaletteState {
  const raw = getJSON<Partial<PaletteState>>(KEYS.PALETTE, {});
  // Старая схема (без v:2) могла хранить цвета других пресетов — сбрасываем
  // к дефолту Android, иначе пользователь видит «палитру не как в APK».
  if (raw.v !== PALETTE_SCHEMA) return { ...DEFAULT_PALETTE };
  return {
    ...DEFAULT_PALETTE,
    ...raw,
    slots: { ...DEFAULT_PALETTE.slots, ...(raw.slots || {}) },
    custom: { ...DEFAULT_PALETTE.custom, ...(raw.custom || {}) },
  };
}

export function getPalette(): PaletteState {
  return state;
}

export function subscribePalette(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function commit(next: PaletteState) {
  state = next;
  setJSON(KEYS.PALETTE, next);
  listeners.forEach(fn => fn());
}

export function setSlotPalette(slot: SlotName, index: number | null) {
  commit({ ...state, slots: { ...state.slots, [slot]: index } });
}

export function setSlotCustom(slot: SlotName, rgb: string | null) {
  commit({ ...state, custom: { ...state.custom, [slot]: rgb } });
}

export function resetPalette() {
  commit({ ...DEFAULT_PALETTE });
}

/** Затемнение цвета как darken() в Android (factor 0.82). */
export function darken(hex: string, factor = 0.82): string {
  const h = hex.replace('#', '');
  if (h.length < 6) return hex;
  const r = Math.min(255, Math.round(parseInt(h.slice(0, 2), 16) * factor));
  const g = Math.min(255, Math.round(parseInt(h.slice(2, 4), 16) * factor));
  const b = Math.min(255, Math.round(parseInt(h.slice(4, 6), 16) * factor));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/** Цвет слота: свой RGB, если задан, иначе цвет пресета. */
export function slotColor(slot: SlotName): string {
  const custom = state.custom[slot];
  if (custom) return custom;
  switch (slot) {
    case 'outline':
      return SECONDARY_COLORS[state.slots.outline] ?? SECONDARY_COLORS[0];
    case 'labelsButtons':
      return PRIMARY_COLORS[state.slots.labelsButtons] ?? PRIMARY_COLORS[0];
    case 'circleIcons':
      return PRIMARY_COLORS[state.slots.circleIcons] ?? PRIMARY_COLORS[0];
    case 'labelsText': {
      // (D) по умолчанию повторяет контур (A), как cacheText в ThemeManager.
      const idx = state.slots.labelsText;
      if (idx === null) return slotColor('outline');
      return SECONDARY_COLORS[idx] ?? SECONDARY_COLORS[0];
    }
  }
}

/** Градиент круга под иконкой: C → darken(C, 0.82), как applyGradient(). */
export function circleGradient(): { from: string; to: string } {
  const c = slotColor('circleIcons');
  return { from: c, to: darken(c) };
}

/** Градиент шапки — тот же, что у кругляшков (C), как tintHeader(). */
export function topBarGradient(): { from: string; to: string } {
  return circleGradient();
}

/** Контрастный цвет текста на заливке (как ThemeManager.contrastOn). */
export function contrastOn(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length < 6) return '#111111';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#111111' : '#FFFFFF';
}

/** Тот же цвет с прозрачностью (withAlpha в Android). */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  if (h.length < 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
