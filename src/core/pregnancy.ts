// FitGuide Web — ограничения программы при беременности (порт PregnancyPolicy.java)
//
// Это не медицинский протокол, а страховка: убираем то, что чаще всего не
// рекомендуют после первого триместра — скручивания и прямую нагрузку на
// живот, осевую нагрузку со штангой и прыжки. Остальное остаётся, объём
// снижается, финальное решение — за врачом.

interface Named {
  name?: string | null;
}

/** Можно ли оставить упражнение в программе при беременности. */
export function pregnancyAllows(ex: Named | null | undefined): boolean {
  if (!ex) return false;
  const n = (ex.name || '').toLowerCase();

  if (n.includes('прыж')) return false;
  if (n.includes('скручиван') || n.includes('подъем ног') || n.includes('подъём ног')
    || n.includes('велосипед') || n.includes('вакуум') || n.includes('твист')
    || n.includes('дровосек') || n.includes('наклон в сторону')) return false;

  // После первого триместра не рекомендуют лежать на спине: матка давит на
  // нижнюю полую вену. Жимы и разведения на горизонтальной скамье убираем,
  // наклонная скамья с приподнятым торсом остаётся.
  const supine = n.includes('лёжа') || n.includes('лежа')
    || ((n.includes('скамье') || n.includes('скамью')) && n.includes('горизонт'));
  if (supine && !n.includes('наклонн')
    && (n.includes('жим') || n.includes('развед') || n.includes('сведен')
      || n.includes('пуловер'))) return false;

  const barbell = n.includes('штанг') || n.includes('смита');
  if (barbell && (n.includes('присед') || n.includes('станов') || n.includes('тяга')
    || n.includes('жим стоя') || n.includes('выпад') || n.includes('на плеч'))) return false;

  return true;
}

/** Объём: на один подход меньше, но не ниже двух. */
export function pregnancyAdjustSets(sets: number): number {
  return Math.max(2, sets - 1);
}

/** Повторы: силовые 1–5 переводим в рабочие 8–10, без максимальных усилий. */
export function pregnancyAdjustReps(reps: string): string {
  const r = (reps || '').trim();
  if (r === '1–3' || r === '2–3' || r === '3–5' || r === '4–6') return '8–10';
  return reps;
}

/** Отдых: между подходами дольше обычного. */
export function pregnancyRestDelta(current: number): number {
  return current + 30;
}
