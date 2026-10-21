// FitGuide Web — чекпоинт тренера (порт Checkpoint.java)
//
// Тренер не может вести прогрессию вслепую: раз в 28 дней он не пускает
// на обычную тренировку, а требует повторные замеры и корректировку силы.
// Отличие от вводной калибровки одно: веса и повторы не вводятся с нуля,
// а подставляются из фактических тренировок по базовым движениям.

import type { Session, Assessment } from '../data/types';
import { movementOf, MOVEMENT_NAMES } from './assessment';

/** Через сколько дней после замеров тренер требует чекпоинт. */
export const CHECKPOINT_DAYS = 28;

/** Дней с последних замеров; −1 — замеров не было. */
export function daysSinceAssessment(a: Assessment | null, now: number): number {
  if (!a) return -1;
  const days = Math.floor((now - a.timestamp) / 86400000);
  return Math.max(0, days);
}

/** Пора повторный замер: замеры есть и им {@link CHECKPOINT_DAYS} дней или больше. */
export function checkpointDue(a: Assessment | null, now: number): boolean {
  return daysSinceAssessment(a, now) >= CHECKPOINT_DAYS;
}

/**
 * Фактические веса и повторы по 8 базовым движениям в порядке калибровки:
 * присед, жим лёжа, становая, жим стоя, тяга в наклоне, подтягивания,
 * жим ногами, ягодичный мост. Ноль — данных по движению нет.
 */
export function fillFromSessions(sessions: Session[], weights: number[], reps: number[]): void {
  if (!weights || !reps) return;
  const best = new Array(weights.length).fill(0);

  for (const s of sessions) {
    // Разгрузка и низкая готовность не показатель силы: такие веса в основу не берём.
    if (!s || s.adjusted) continue;
    for (const it of s.items) {
      if (!it || it.weightKg <= 0 || it.reps <= 0) continue;
      const idx = movementOf(it.exercise);
      if (idx < 0 || idx >= weights.length) continue;
      // Оценка по Эпли с потолком повторов: 20 повторов — это уже не сила.
      const score = it.weightKg * (1 + Math.min(it.reps, 12) / 30);
      if (score > best[idx]) {
        best[idx] = score;
        weights[idx] = it.weightKg;
        reps[idx] = it.reps;
      }
    }
  }
}

export { MOVEMENT_NAMES, movementOf };
