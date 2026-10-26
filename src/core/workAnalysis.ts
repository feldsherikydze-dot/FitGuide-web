// FitGuide Web — анализ тренировок (порт WorkAnalysis.java)
//
// Считает по фактам подходов: время под нагрузкой, отработку плана, темп,
// рабочий вес, динамику по неделям, отклонения и советы. Экран только рисует.

import type { Session } from '../data/types';

export const TUT_FLOOR_SEC = 10;
export const TUT_CEIL_SEC = 60;
export const TUT_TOO_LONG_SEC = 90;
export const TEMPO_FAST_SEC = 1.5;

export interface ExStat {
  exercise: string;
  sets: number;
  workedSec: number;
  tonnage: number;
  avgSecPerSet: number;
  planPct: number;
  tempoSecPerRep: number;
  weightFirst: number;
  weightLast: number;
  weightDeltaPct: number;
  feelOk: number;
  feelEasy: number;
  feelHard: number;
  setsPerWeek: number;
  tooLongSets: number;
  tooShortSets: number;
  overPlanSets: number;
  days: number;
}

export interface Week {
  startMs: number;
  workouts: number;
  workedSec: number;
  sets: number;
  planPct: number;
  tonnage: number;
}

export interface Flag {
  exercise: string;
  code: string;
  text: string;
}

export interface Tip {
  title: string;
  text: string;
}

export interface Report {
  workouts: number;
  totalDurationSec: number;
  workedSec: number;
  workSharePct: number;
  sets: number;
  planPct: number;
  tonnage: number;
  byExercise: Map<string, ExStat>;
  weeks: Week[];
  flags: Flag[];
  tips: Tip[];
  isEmpty: () => boolean;
}

const DAY_MS = 24 * 3600 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** Длительность сессии: сохранённая или от первого до последнего факта. */
export function sessionDurationSec(s: Session): number {
  if (s.durationSec && s.durationSec > 0) return s.durationSec;
  const times = (s.setFacts || []).map(f => f.atMs || 0).filter(Boolean).sort((a, b) => a - b);
  if (times.length > 1) return Math.max(0, Math.round((times[times.length - 1] - times[0]) / 1000));
  return 0;
}

export function sessionTonnage(s: Session): number {
  return s.items.reduce((sum, it) => sum + (it.weightKg || 0) * (it.reps || 0) * (it.sets || 0), 0);
}

export function sessionSets(s: Session): number {
  return s.items.reduce((sum, it) => sum + (it.sets || 0), 0);
}

export function buildReport(sessions: Session[], fromMs: number, toMs: number): Report {
  const r: Report = {
    workouts: 0, totalDurationSec: 0, workedSec: 0, workSharePct: 0,
    sets: 0, planPct: 0, tonnage: 0,
    byExercise: new Map(), weeks: [], flags: [], tips: [],
    isEmpty: () => r.workouts === 0,
  };

  const inRange = sessions
    .filter(s => s && s.ts >= fromMs && s.ts <= toMs)
    .sort((a, b) => a.ts - b.ts);
  if (!inRange.length) return r;

  const spanMs = Math.max(1, toMs - fromMs);
  const weeksInPeriod = spanMs / WEEK_MS;
  const tonnage = new Map<string, number>();
  const planSum = new Map<string, { sum: number; n: number }>();
  const tempo = new Map<string, { sum: number; n: number }>();
  const days = new Map<string, number[]>();
  let planAll = 0;
  let planAllSets = 0;

  for (const s of inRange) {
    r.workouts++;
    r.totalDurationSec += sessionDurationSec(s);
    const sTonnage = sessionTonnage(s);
    r.tonnage += sTonnage;
    const w = weekFor(r.weeks, fromMs, s.ts);
    if (w) {
      w.workouts++;
      w.tonnage += sTonnage;
    }
    const dayKey = Math.max(0, Math.floor((s.ts - fromMs) / DAY_MS));

    const facts = s.setFacts && s.setFacts.length
      ? s.setFacts
      : s.items.flatMap(it => Array.from({ length: Math.max(0, it.sets || 0) }, () => ({
        exercise: it.exercise, feel: it.feel || 2, reps: it.reps, weightKg: it.weightKg,
        actualSec: 0, plannedSec: 0,
      })));

    for (const f of facts) {
      if (!f.exercise) continue;
      r.sets++;
      let st = r.byExercise.get(f.exercise);
      if (!st) {
        st = {
          exercise: f.exercise, sets: 0, workedSec: 0, tonnage: 0, avgSecPerSet: 0,
          planPct: 0, tempoSecPerRep: 0, weightFirst: 0, weightLast: 0, weightDeltaPct: 0,
          feelOk: 0, feelEasy: 0, feelHard: 0, setsPerWeek: 0,
          tooLongSets: 0, tooShortSets: 0, overPlanSets: 0, days: 0,
        };
        r.byExercise.set(f.exercise, st);
        tonnage.set(f.exercise, 0);
        planSum.set(f.exercise, { sum: 0, n: 0 });
        tempo.set(f.exercise, { sum: 0, n: 0 });
        days.set(f.exercise, []);
      }
      const actual = Math.max(0, f.actualSec || 0);
      const planned = Math.max(0, f.plannedSec || 0);
      const reps = Math.max(0, f.reps || 0);
      const weight = Math.max(0, f.weightKg || 0);
      st.sets++;
      st.workedSec += actual;
      r.workedSec += actual;
      st.tonnage += weight * reps;
      tonnage.set(f.exercise, (tonnage.get(f.exercise) || 0) + weight * reps);
      if (weight > 0 && st.weightFirst <= 0) st.weightFirst = weight;
      if (weight > 0) st.weightLast = weight;
      if (reps > 0 && actual > 0) {
        const t = tempo.get(f.exercise)!;
        t.sum += actual / reps;
        t.n++;
      }
      if (f.feel === 1) st.feelHard++;
      else if (f.feel === 2) st.feelOk++;
      else if (f.feel === 3) st.feelEasy++;
      if (planned > 0) {
        const pct = 100 * actual / planned;
        const ps = planSum.get(f.exercise)!;
        ps.sum += Math.round(pct);
        ps.n++;
        planAll += Math.round(pct);
        planAllSets++;
        if (pct >= 120) st.overPlanSets++;
      }
      if (actual > TUT_TOO_LONG_SEC) st.tooLongSets++;
      else if (actual > 0 && actual < TUT_FLOOR_SEC) st.tooShortSets++;
      const dl = days.get(f.exercise)!;
      if (dl[dl.length - 1] !== dayKey) dl.push(dayKey);
      if (w) {
        w.sets++;
        w.workedSec += actual;
        if (planned > 0) w.planPct += 100 * actual / planned;
      }
    }
  }

  if (planAllSets > 0) r.planPct = planAll / planAllSets;
  if (r.totalDurationSec > 0) r.workSharePct = 100 * r.workedSec / r.totalDurationSec;

  for (const [name, st] of r.byExercise) {
    st.tonnage = tonnage.get(name) || 0;
    st.avgSecPerSet = st.sets > 0 ? st.workedSec / st.sets : 0;
    const ps = planSum.get(name)!;
    st.planPct = ps.n > 0 ? ps.sum / ps.n : 0;
    const tm = tempo.get(name)!;
    st.tempoSecPerRep = tm.n > 0 ? tm.sum / tm.n : 0;
    st.days = (days.get(name) || []).length;
    st.setsPerWeek = weeksInPeriod > 0 ? st.sets / weeksInPeriod : st.sets;
    if (st.weightFirst > 0 && st.weightLast > 0) {
      st.weightDeltaPct = 100 * (st.weightLast - st.weightFirst) / st.weightFirst;
    }
  }

  for (const w of r.weeks) w.planPct = w.sets > 0 ? w.planPct / w.sets : 0;

  buildFlags(r);
  buildTips(r);
  return r;
}

function weekFor(weeks: Week[], fromMs: number, dateMs: number): Week | null {
  const off = dateMs - fromMs;
  if (off < 0) return null;
  const idx = Math.floor(off / WEEK_MS);
  while (weeks.length <= idx) {
    weeks.push({
      startMs: fromMs + weeks.length * WEEK_MS,
      workouts: 0, workedSec: 0, sets: 0, planPct: 0, tonnage: 0,
    });
  }
  return weeks[idx];
}

function buildFlags(r: Report) {
  for (const st of r.byExercise.values()) {
    if (st.tooLongSets > 0 && st.tooLongSets * 2 >= st.sets) {
      r.flags.push({
        exercise: st.exercise, code: 'long',
        text: `${st.exercise}: подход длиннее ${TUT_TOO_LONG_SEC} с (${st.tooLongSets} из ${st.sets}). `
          + 'Дальше времени — это уже усталость, а не стимул: снизь вес или сократи подход.',
      });
    }
    if (st.tooShortSets > 0 && st.tooShortSets * 2 >= st.sets && st.sets > 1) {
      r.flags.push({
        exercise: st.exercise, code: 'short',
        text: `${st.exercise}: подход короче ${TUT_FLOOR_SEC} с (${st.tooShortSets} из ${st.sets}) — `
          + 'под нагрузкой мало, добавь повторы или время.',
      });
    }
    if (st.tempoSecPerRep > 0 && st.tempoSecPerRep < TEMPO_FAST_SEC && st.weightLast > 0) {
      r.flags.push({
        exercise: st.exercise, code: 'fast',
        text: `${st.exercise}: ${round1(st.tempoSecPerRep)} с на повтор — слишком быстро, вес почти не чувствуется.`,
      });
    }
    if (st.overPlanSets > 0 && st.overPlanSets * 2 >= st.sets) {
      r.flags.push({
        exercise: st.exercise, code: 'over',
        text: `${st.exercise}: чаще всего отрабатывает время больше плана (${st.overPlanSets} из ${st.sets}). `
          + 'Либо закладывай больше времени, либо тяжелее работай под нагрузкой.',
      });
    }
    if (st.setsPerWeek > 0 && st.setsPerWeek < 6 && st.sets >= 3) {
      r.flags.push({
        exercise: st.exercise, code: 'under',
        text: `${st.exercise}: ${round1(st.setsPerWeek)} подходов в неделю — для роста массы обычно нужно `
          + '10–20 на мышцу, то есть чаще или в несколько подходов подряд.',
      });
    }
  }
}

function buildTips(r: Report) {
  if (r.isEmpty() || r.sets === 0) return;
  if (r.planPct >= 120) {
    r.tips.push({
      title: 'Время подхода закладывайте больше',
      text: `В среднем отрабатывается ${Math.round(r.planPct)}% от плана. Либо под нагрузкой не хватает `
        + 'интенсивности, либо план по времени занижен.',
    });
  } else if (r.planPct > 0 && r.planPct <= 80) {
    r.tips.push({
      title: 'План по времени занижен',
      text: `В среднем выходит только ${Math.round(r.planPct)}% от плана — это про недобор, а не про `
        + 'усталость. Либо подъём тяжелее, либо времени в плане больше, чем нужно.',
    });
  } else if (r.planPct > 0) {
    r.tips.push({
      title: 'План отрабатывается',
      text: `Среднее время подхода — ${Math.round(r.planPct)}% от плана, держите эту цифру и меняйте вес.`,
    });
  }

  for (const st of r.byExercise.values()) {
    const marks = st.feelOk + st.feelEasy + st.feelHard;
    if (marks >= 3) {
      if (st.feelEasy * 2 > marks) {
        r.tips.push({
          title: `${st.exercise}: можно тяжелее`,
          text: 'Чаще всего «легко». Следующий раз добавь 2,5 кг или на подход; сейчас рабочего веса не хватает.',
        });
      } else if (st.feelHard * 2 > marks) {
        r.tips.push({
          title: `${st.exercise}: нужно легче`,
          text: 'Чаще всего «тяжело». Снизь рабочий вес на 5% — так доработаешь нужные подходы, а не будешь бросать.',
        });
      } else if (st.feelOk * 2 > marks) {
        r.tips.push({
          title: `${st.exercise}: вес подобран`,
          text: 'Отметки «в самый раз» преобладают — это рабочая зона, вес менять пока незачем.',
        });
      }
    }
    if (st.avgSecPerSet > TUT_CEIL_SEC && st.sets >= 3) {
      r.tips.push({
        title: `${st.exercise}: подходы длинные`,
        text: `В среднем ${Math.round(st.avgSecPerSet)} с на подход. Добавь подход и убавь время — так будет `
          + 'и качественнее, и ближе к отказу.',
      });
    }
    if (st.tempoSecPerRep > 6 && st.sets >= 3) {
      r.tips.push({
        title: `${st.exercise}: слишком медленный темп`,
        text: `${round1(st.tempoSecPerRep)} с на повтор. Тяни быстрее, время на подход добьётся паузами внизу, `
          + 'а не замедлением вверху.',
      });
    }
    if (st.weightDeltaPct >= 5) {
      r.tips.push({
        title: `${st.exercise}: рабочий вес вырос`,
        text: `За период ${fmtWeight(st.weightFirst)} → ${fmtWeight(st.weightLast)} (${Math.round(st.weightDeltaPct)}%).`,
      });
    } else if (st.weightDeltaPct <= -5) {
      r.tips.push({
        title: `${st.exercise}: рабочий вес снизился`,
        text: `За период ${fmtWeight(st.weightFirst)} → ${fmtWeight(st.weightLast)} (${Math.round(st.weightDeltaPct)}%). `
          + 'Если это не замысел — вернись к прежнему и добавь подход.',
      });
    }
  }
  if (r.workSharePct > 0 && r.workSharePct < 30) {
    r.tips.push({
      title: 'Мало времени под нагрузкой',
      text: `Под нагрузкой прошло ${Math.round(r.workSharePct)}% тренировки. Отдых длиннее работы — `
        + 'попробуй сократить его до 60–90 секунд.',
    });
  }
}

function round1(v: number): string {
  return String(Math.round(v * 10) / 10);
}

function fmtWeight(kg: number): string {
  return `${Math.round(kg * 10) / 10} кг`;
}

// ---------------------------------------------------------------- формат

export function fmtDur(sec: number): string {
  if (sec <= 0) return '0 с';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return m > 0 ? `${h} ч ${m} мин` : `${h} ч`;
  if (m > 0) return `${m} мин`;
  return `${s} с`;
}


export function fmtNum(v: number): string {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export function fmtKg(kg: number): string {
  return `${fmtNum(kg)} кг`;
}

export function fmtTonnage(kg: number): string {
  return kg >= 1000 ? `${fmtNum(kg / 1000)} т` : `${fmtNum(kg)} кг`;
}
