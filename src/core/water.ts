// FitGuide Web — счётчик воды на сегодня (порт WaterStore.java).
//
// Без истории и графиков: одна цифра и цель. Цель — 30 мл/кг веса
// (диапазон 30–40 мл/кг из базы знаний; нижняя граница честнее для
// малоподвижного дня). В полночь счётчик сам начинается с нуля: дата
// хранится рядом со значением.

import { getString, setString } from './storage';

const KEY_ML = 'water_ml';
const KEY_DATE = 'water_date';
const MIN_GOAL_ML = 1500;
const MAX_GOAL_ML = 4000;

function todayKey(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function getWaterToday(): number {
  if (getString(KEY_DATE, '') !== todayKey()) return 0;
  const value = parseInt(getString(KEY_ML, '0'), 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function addWater(ml: number): number {
  if (!Number.isFinite(ml) || ml <= 0) return getWaterToday();
  const value = getWaterToday() + Math.round(ml);
  setString(KEY_ML, String(value));
  setString(KEY_DATE, todayKey());
  return value;
}

export function getWaterGoal(weightKg: number): number {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return 2000;
  const goal = Math.round((weightKg * 30) / 50) * 50;
  return Math.max(MIN_GOAL_ML, Math.min(MAX_GOAL_ML, goal));
}

/** «0,25», «1,5», «2,15» — литры без хвостовых нулей. */
export function liters(ml: number): string {
  let s = (Math.max(0, ml) / 1000).toFixed(2);
  while (s.endsWith('0')) s = s.slice(0, -1);
  if (s.endsWith('.')) s = s.slice(0, -1);
  return s.replace('.', ',');
}
