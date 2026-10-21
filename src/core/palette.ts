// FitGuide Web — система палитр (порт ThemeManager.java)
//
// Четыре независимых слота цвета:
//   (A) Контур   — рамки карточек
//   (B) Ярлыки   — ярлыки и кнопки (верхняя панель, круглые иконки)
//   (C) Кругляшки— круг под иконкой внутри ярлыка
//   (D) Надписи  — текст на ярлыках
// Каждый слот: индекс пресета (0..6) ИЛИ свой RGB.

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

/** Градиент круга (как circle_icon: угол 315°). */
export const GRADIENT_STARTS = [
  '#2EB0A1', '#4880EF', '#7E70EA', '#DD3673', '#EB6D29', '#5F656B', '#00A546',
];
export const GRADIENT_ENDS = [
  '#0E8476', '#2659BE', '#564AB9', '#AD164D', '#BA470A', '#3A4046', '#007C33',
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
  whiteAlpha80: 'rgba(255,255,255,0.8)',
  whiteAlpha40: 'rgba(255,255,255,0.4)',
  whiteAlpha33: 'rgba(255,255,255,0.2)',
};

export type SlotName = 'outline' | 'labelsButtons' | 'circleIcons' | 'labelsText';

export interface PaletteState {
  primary: number;            // индекс пресета основной темы
  secondary: number;
  slots: Record<SlotName, number>;      // индекс пресета для слота
  custom: Record<SlotName, string | null>; // свой RGB ('' = выключен)
}

const DEFAULT_PALETTE: PaletteState = {
  primary: 0,
  secondary: 0,
  slots: { outline: 0, labelsButtons: 0, circleIcons: 0, labelsText: 0 },
  custom: { outline: null, labelsButtons: null, circleIcons: null, labelsText: null },
};

let state: PaletteState = loadPalette();
const listeners = new Set<() => void>();

function loadPalette(): PaletteState {
  const raw = getJSON<Partial<PaletteState>>(KEYS.PALETTE, {});
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

export function setPrimaryPalette(index: number) {
  commit({ ...state, primary: index, slots: { ...state.slots, labelsButtons: index, circleIcons: index } });
}

export function setSecondaryPalette(index: number) {
  commit({ ...state, secondary: index, slots: { ...state.slots, outline: index, labelsText: index } });
}

export function setSlotPalette(slot: SlotName, index: number) {
  commit({ ...state, slots: { ...state.slots, [slot]: index } });
}

export function setSlotCustom(slot: SlotName, rgb: string | null) {
  commit({ ...state, custom: { ...state.custom, [slot]: rgb } });
}

export function resetPalette() {
  commit({ ...DEFAULT_PALETTE });
}

/** Цвет слота: свой RGB, если задан, иначе цвет пресета. */
export function slotColor(slot: SlotName): string {
  const custom = state.custom[slot];
  if (custom) return custom;
  switch (slot) {
    case 'outline':
    case 'labelsText':
      return SECONDARY_COLORS[state.slots[slot]] ?? SECONDARY_COLORS[0];
    case 'labelsButtons':
      return PRIMARY_COLORS[state.slots[slot]] ?? PRIMARY_COLORS[0];
    case 'circleIcons':
      return PRIMARY_COLORS[state.slots[slot]] ?? PRIMARY_COLORS[0];
  }
}

/** Градиент для круга под иконкой. */
export function circleGradient(): { from: string; to: string } {
  const custom = state.custom.circleIcons;
  if (custom) return { from: custom, to: custom };
  const i = state.slots.circleIcons;
  return { from: GRADIENT_STARTS[i] ?? GRADIENT_STARTS[0], to: GRADIENT_ENDS[i] ?? GRADIENT_ENDS[0] };
}

/** Градиент верхней панели. */
export function topBarGradient(): { from: string; to: string } {
  const custom = state.custom.labelsButtons;
  if (custom) return { from: custom, to: custom };
  const i = state.slots.labelsButtons;
  return { from: GRADIENT_STARTS[i] ?? GRADIENT_STARTS[0], to: GRADIENT_ENDS[i] ?? GRADIENT_ENDS[0] };
}

/** Контрастный цвет текста на заливке (как ThemeManager.contrastOn). */
export function contrastOn(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length < 6) return '#000000';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // относительная яркость
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#000000' : '#FFFFFF';
}
