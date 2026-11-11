// FitGuide Web — анализ тренировок (порт WorkAnalysis.java)
//
// Считает по фактам подходов: время под нагрузкой, отработку плана, темп,
// рабочий вес, динамику по неделям, отклонения и советы. Экран только рисует.

import type { Session } from '../data/types';

export const TUT_FLOOR_SEC = 10;
export const TUT_CEIL_SEC = 60;
export const TUT_TOO_LONG_SEC = 90;
export const TEMPO_FAST_SEC = 1.5;

/**
 * Вид упражнения — от него зависит, что вообще имеет смысл считать.
 * Динамика: повторы, темп, вес. Статика (планка, вакуум, удержания):
 * только время подхода. Шаги: повторы-шаги, но не «темп на повтор».
 */
export type ExKind = 'dynamic' | 'static' | 'steps';

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
  /** План и факт по повторам: суммы по подходам, где были оба числа. */
  repsPlan: number;
  repsDone: number;
  repsSets: number;
  /** Подходов в неделю — по неделям, где упражнение реально тренировалось. */
  setsPerWeek: number;
  /** Подходов за тренировку: понятнее, чем «0.9 подх./нед.» для разового упражнения. */
  setsPerSession: number;
  /** Вид упражнения: динамика / статика / шаги. */
  kind: ExKind;
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

/** Объём одной мышечной группы за период. */
export interface MuscleStat {
  group: string;
  sets: number;
  /** Подходов в неделю — по неделям, где группа реально тренировалась. */
  setsPerWeek: number;
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
  /** Объём по мышечным группам: именно он сравнивается с 10–20 подходами. */
  byMuscle: Map<string, MuscleStat>;
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
  // Факты по подходам важнее плана: 4×10, а по факту 10/10/9/8 — это другой
  // объём. Для старых записей без фактов работает план.
  const withFacts = new Set<string>();
  let total = 0;
  for (const f of s.setFacts || []) {
    if (!f.exercise) continue;
    total += (f.weightKg || 0) * Math.max(0, f.reps || 0);
    withFacts.add(f.exercise);
  }
  for (const it of s.items) {
    if (withFacts.has(it.exercise)) continue;
    total += (it.weightKg || 0) * (it.reps || 0) * (it.sets || 0);
  }
  return total;
}

export function sessionSets(s: Session): number {
  return s.items.reduce((sum, it) => sum + (it.sets || 0), 0);
}

export function buildReport(
  sessions: Session[],
  fromMs: number,
  toMs: number,
  groupOf?: (exercise: string) => string | null,
  kindOf?: (exercise: string) => ExKind | null,
): Report {
  const r: Report = {
    workouts: 0, totalDurationSec: 0, workedSec: 0, workSharePct: 0,
    sets: 0, planPct: 0, tonnage: 0,
    byExercise: new Map(), byMuscle: new Map(), weeks: [], flags: [], tips: [],
    isEmpty: () => r.workouts === 0,
  };

  const inRange = sessions
    .filter(s => s && s.ts >= fromMs && s.ts <= toMs)
    .sort((a, b) => a.ts - b.ts);
  if (!inRange.length) return r;

  const tonnage = new Map<string, number>();
  const planSum = new Map<string, { sum: number; n: number }>();
  const tempo = new Map<string, { sum: number; n: number }>();
  const days = new Map<string, number[]>();
  // Недели, в которые упражнение/группа реально тренировались: делим объём
  // на них, а не на длину периода — иначе отпуск или болезнь «размывают»
  // недельный объём и анализ ругается на недобор.
  const exWeeks = new Map<string, Set<number>>();
  const muscleWeeks = new Map<string, Set<number>>();
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
    const weekIdx = Math.floor((s.ts - fromMs) / WEEK_MS);

    const facts = s.setFacts && s.setFacts.length
      ? s.setFacts
      : s.items.flatMap(it => Array.from({ length: Math.max(0, it.sets || 0) }, () => ({
        exercise: it.exercise, feel: it.feel || 2, reps: it.reps, weightKg: it.weightKg,
        actualSec: 0, plannedSec: 0,
      })));

    const plannedReps = new Map<string, number>();
    for (const it of s.items) {
      if (it.reps > 0) plannedReps.set(it.exercise, it.reps);
    }

    for (const f of facts) {
      if (!f.exercise) continue;
      r.sets++;
      let st = r.byExercise.get(f.exercise);
      if (!st) {
        st = {
          exercise: f.exercise, sets: 0, workedSec: 0, tonnage: 0, avgSecPerSet: 0,
          planPct: 0, tempoSecPerRep: 0, weightFirst: 0, weightLast: 0, weightDeltaPct: 0,
          feelOk: 0, feelEasy: 0, feelHard: 0, setsPerWeek: 0, setsPerSession: 0,
          repsPlan: 0, repsDone: 0, repsSets: 0,
          kind: (kindOf ? kindOf(f.exercise) : null) || 'dynamic',
          tooLongSets: 0, tooShortSets: 0, overPlanSets: 0, days: 0,
        };
        r.byExercise.set(f.exercise, st);
        tonnage.set(f.exercise, 0);
        planSum.set(f.exercise, { sum: 0, n: 0 });
        tempo.set(f.exercise, { sum: 0, n: 0 });
        days.set(f.exercise, []);
        exWeeks.set(f.exercise, new Set());
      }
      const actual = Math.max(0, f.actualSec || 0);
      const planned = Math.max(0, f.plannedSec || 0);
      const reps = Math.max(0, f.reps || 0);
      const weight = Math.max(0, f.weightKg || 0);
      st.sets++;
      exWeeks.get(f.exercise)?.add(weekIdx);
      const group = groupOf ? groupOf(f.exercise) : null;
      if (group) {
        let ms = r.byMuscle.get(group);
        if (!ms) {
          ms = { group, sets: 0, setsPerWeek: 0 };
          r.byMuscle.set(group, ms);
          muscleWeeks.set(group, new Set());
        }
        ms.sets++;
        muscleWeeks.get(group)?.add(weekIdx);
      }
      st.workedSec += actual;
      r.workedSec += actual;
      st.tonnage += weight * reps;
      tonnage.set(f.exercise, (tonnage.get(f.exercise) || 0) + weight * reps);
      if (weight > 0 && st.weightFirst <= 0) st.weightFirst = weight;
      if (weight > 0) st.weightLast = weight;
      if (reps > 0 && actual > 0 && st.kind === 'dynamic') {
        const t = tempo.get(f.exercise)!;
        t.sum += actual / reps;
        t.n++;
      }
      if (f.feel === 1) st.feelHard++;
      else if (f.feel === 2) st.feelOk++;
      else if (f.feel === 3) st.feelEasy++;
      // План повторов на упражнение: 4×10 → 10. Просевшие повторы
      // (10/10/9/8) — сигнал тренеру снизить вес, а не жать до отказа.
      const plannedRep = plannedReps.get(f.exercise) || 0;
      if (st.kind === 'dynamic' && plannedRep > 0 && reps > 0) {
        st.repsPlan += plannedRep;
        st.repsDone += reps;
        st.repsSets++;
      }
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
    const ew = exWeeks.get(name)?.size || 0;
    st.setsPerWeek = ew > 0 ? st.sets / ew : st.sets;
    st.setsPerSession = st.days > 0 ? st.sets / st.days : st.sets;
    if (st.weightFirst > 0 && st.weightLast > 0) {
      st.weightDeltaPct = 100 * (st.weightLast - st.weightFirst) / st.weightFirst;
    }
  }

  for (const m of r.byMuscle.values()) {
    const mw = muscleWeeks.get(m.group)?.size || 0;
    m.setsPerWeek = mw > 0 ? m.sets / mw : m.sets;
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
      const advice = st.kind === 'static'
        ? 'для статики это уже выносливость, а не стимул: сократи удержание или разбей на части.'
        : st.kind === 'steps'
          ? 'сократи подход или разбей на части.'
          : 'дальше времени — это уже усталость, а не стимул: снизь вес или сократи подход.';
      r.flags.push({
        exercise: st.exercise, code: 'long',
        text: `${st.exercise}: подход длиннее ${TUT_TOO_LONG_SEC} с (${st.tooLongSets} из ${st.sets}). `
          + advice,
      });
    }
    if (st.tooShortSets > 0 && st.tooShortSets * 2 >= st.sets && st.sets > 1) {
      const advice = st.kind === 'static'
        ? 'под нагрузкой мало, добавь время удержания.'
        : st.kind === 'steps'
          ? 'под нагрузкой мало, добавь шаги.'
          : 'под нагрузкой мало, добавь повторы или время.';
      r.flags.push({
        exercise: st.exercise, code: 'short',
        text: `${st.exercise}: подход короче ${TUT_FLOOR_SEC} с (${st.tooShortSets} из ${st.sets}) — `
          + advice,
      });
    }
    if (st.kind === 'dynamic' && st.tempoSecPerRep > 0 && st.tempoSecPerRep < TEMPO_FAST_SEC) {
      const advice = st.weightLast > 0
        ? 'слишком быстро, вес почти не чувствуется.'
        : 'слишком быстро — работает инерция, а не мышца.';
      r.flags.push({
        exercise: st.exercise, code: 'fast',
        text: `${st.exercise}: ${round1(st.tempoSecPerRep)} с на повтор — ${advice}`,
      });
    }
    if (st.overPlanSets > 0 && st.overPlanSets * 2 >= st.sets) {
      const advice = st.kind === 'static'
        ? 'закладывай больше времени на удержание.'
        : 'либо закладывай больше времени, либо тяжелее работай под нагрузкой.';
      r.flags.push({
        exercise: st.exercise, code: 'over',
        text: `${st.exercise}: чаще всего отрабатывает время больше плана (${st.overPlanSets} из ${st.sets}). `
          + advice,
      });
    }
  }
  // Объём — по мышечной группе, а не по упражнению: 4 упражнения на грудь
  // по 4 подхода дают 16 подходов в неделю, и это норма, даже если у каждого
  // упражнения «всего» 4. Считаем только группы, где набралось хотя бы 3 подхода.
  for (const m of r.byMuscle.values()) {
    if (m.sets >= 3 && m.setsPerWeek < 10) {
      r.flags.push({
        exercise: m.group, code: 'under',
        text: `${m.group}: ${round1(m.setsPerWeek)} ${setsWord(m.setsPerWeek)} в неделю — `
          + 'для роста массы обычно нужно 10–20 на мышцу. Добавь упражнение или подход.',
      });
    }
  }
}

/** «1 подход / 3 подхода / 5 подходов» — иначе «3 подходов» режет глаз. */
function setsWord(v: number): string {
  const n = Math.round(v * 10) / 10;
  if (Math.abs(n - Math.round(n)) > 0.001) return 'подхода';
  const abs = Math.abs(Math.round(n)) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return 'подходов';
  if (last === 1) return 'подход';
  if (last >= 2 && last <= 4) return 'подхода';
  return 'подходов';
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
      title: 'План по времени завышен',
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
      const hasWeight = st.weightLast > 0;
      if (st.kind === 'static') {
        if (st.feelEasy * 2 > marks) {
          r.tips.push({
            title: `${st.exercise}: удерживай дольше`,
            text: 'Чаще всего «легко». Добавь 10–15 секунд к удержанию — статика растёт от времени под нагрузкой.',
          });
        } else if (st.feelHard * 2 > marks) {
          r.tips.push({
            title: `${st.exercise}: удержание длинное`,
            text: 'Чаще всего «до отказа». Сократи удержание на 10–15 секунд или разбей подход на части — так техника не развалится.',
          });
        } else if (st.feelOk * 2 > marks) {
          r.tips.push({
            title: `${st.exercise}: удержание подобрано`,
            text: 'Чаще всего «предотказ» — рабочая зона, время менять пока незачем.',
          });
        }
      } else if (st.kind === 'steps') {
        if (st.feelEasy * 2 > marks) {
          r.tips.push({
            title: `${st.exercise}: добавь шагов`,
            text: 'Чаще всего «легко». Добавь 5–10 шагов на сторону или усложни резинку.',
          });
        } else if (st.feelHard * 2 > marks) {
          r.tips.push({
            title: `${st.exercise}: шагов многовато`,
            text: 'Чаще всего «до отказа». Уменьши шаги на подход или возьми резинку легче.',
          });
        } else if (st.feelOk * 2 > marks) {
          r.tips.push({
            title: `${st.exercise}: нагрузка подобрана`,
            text: 'Чаще всего «предотказ» — рабочая зона, менять пока незачем.',
          });
        }
      } else if (st.feelEasy * 2 > marks) {
        r.tips.push({
          title: hasWeight ? `${st.exercise}: можно тяжелее` : `${st.exercise}: можно сложнее`,
          text: hasWeight
            ? 'Чаще всего «легко». Следующий раз добавь 2,5 кг или на подход; сейчас рабочего веса не хватает.'
            : 'Чаще всего «легко». Добавь повторы или усложни вариант — своего веса уже не хватает.',
        });
      } else if (st.feelHard * 2 > marks) {
        r.tips.push({
          title: hasWeight ? `${st.exercise}: нужно легче` : `${st.exercise}: нужно проще`,
          text: hasWeight
            ? 'Чаще всего «до отказа». Снизь рабочий вес на 5% — так доработаешь нужные подходы и оставишь 1–2 повтора в запасе, а не будешь бросать.'
            : 'Чаще всего «до отказа». Уменьши повторы или возьми более простой вариант — 1–2 повтора в запасе должны оставаться.',
        });
      } else if (st.feelOk * 2 > marks) {
        r.tips.push({
          title: `${st.exercise}: вес подобран`,
          text: 'Чаще всего «предотказ» — это рабочая зона, вес менять пока незачем.',
        });
      }
    }
    // Повторы просели — только если это заметно (ниже 90% плана). 9,4 из 10
    // и 7,3 из 8 — обычная усталость к последнему подходу, а не повод снижать
    // вес. И если вес за период вырос, снижать его тем более нельзя: сначала
    // закрепляем новый вес, пока повторы не вернутся к плану.
    if (st.kind === 'dynamic' && st.repsSets >= 3 && st.repsPlan > 0
      && st.repsDone * 100 < st.repsPlan * 90) {
      const planAvg = st.repsPlan / st.repsSets;
      const doneAvg = st.repsDone / st.repsSets;
      if (st.weightDeltaPct >= 5) {
        r.tips.push({
          title: `${st.exercise}: повторы просели на фоне роста веса`,
          text: `План ${round1(planAvg)} повторов, по факту ${round1(doneAvg)}. Вес за период вырос `
            + `на ${Math.round(st.weightDeltaPct)}% — это ожидаемо. Закрепи вес на 1–2 недели, `
            + 'пока повторы не вернутся к плану.',
        });
      } else {
        r.tips.push({
          title: `${st.exercise}: повторы просели`,
          text: `План ${round1(planAvg)} повторов, по факту ${round1(doneAvg)}. Снизь вес на 2,5–5%, `
            + 'чтобы делать 1–2 повтора в запасе, а не до отказа.',
        });
      }
    }
    if (st.kind === 'dynamic' && st.avgSecPerSet > TUT_CEIL_SEC && st.sets >= 3) {
      r.tips.push({
        title: `${st.exercise}: подходы длинные`,
        text: `В среднем ${Math.round(st.avgSecPerSet)} с на подход. Добавь подход и убавь время — так будет `
          + 'и качественнее, и ближе к отказу.',
      });
    }
    if (st.kind === 'dynamic' && st.tempoSecPerRep > 6 && st.sets >= 3) {
      r.tips.push({
        title: `${st.exercise}: слишком медленный темп`,
        text: `${round1(st.tempoSecPerRep)} с на повтор. Сократи паузы между повторами и не замедляй `
          + 'движение специально: время подхода должно давать напряжение, а не растянутый темп.',
      });
    }
    if (st.weightLast > 0 && st.weightDeltaPct >= 5) {
      r.tips.push({
        title: `${st.exercise}: рабочий вес вырос`,
        text: `За период ${fmtWeight(st.weightFirst)} → ${fmtWeight(st.weightLast)} (${Math.round(st.weightDeltaPct)}%).`,
      });
    } else if (st.weightLast > 0 && st.weightDeltaPct <= -5) {
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
