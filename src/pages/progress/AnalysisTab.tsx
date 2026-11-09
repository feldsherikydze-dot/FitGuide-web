// Вкладка «Анализ» (порт AnalysisFragment + activity_analysis.xml).
//
// Чипы периода 7/30/90 дней, сводка, динамика по неделям, по упражнениям,
// советы, отклонения и кнопка выгрузки отчёта. Арифметика — в core/workAnalysis.

import { useMemo, useState } from 'react';
import { useCoachStore } from '../../core/store';
import {
  buildReport, fmtDur, fmtNum, fmtTonnage,
} from '../../core/workAnalysis';
import {
  Card, Hint, PrimaryButton, Toast,
} from './common';

const PERIOD_DAYS = [7, 30, 90];

const dayFmt = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' });

function dayLabel(ms: number): string {
  return dayFmt.format(new Date(ms));
}

function formatRange(fromMs: number, toMs: number): string {
  return `Период: ${dayLabel(fromMs)} — ${dayLabel(toMs)}`;
}

/** Тоннаж как в Android: от тонны — в тоннах. */
function fmtKg(kg: number): string {
  return `${fmtNum(kg)} кг`;
}

/** Пульс и калории: только с часов, поэтому считаем по фактам подходов. */
function heartFacts(
  sessions: { ts: number; setFacts?: Array<{ hrAvg?: number; kcal?: number }> }[],
  fromMs: number,
  toMs: number,
): { hrAvg: number; kcalTotal: number } {
  let sum = 0;
  let n = 0;
  let kcal = 0;
  for (const s of sessions) {
    if (!s || s.ts < fromMs || s.ts > toMs) continue;
    for (const f of s.setFacts || []) {
      if (f && f.hrAvg && f.hrAvg > 0) {
        sum += f.hrAvg;
        n++;
      }
      if (f && f.kcal && f.kcal > 0) kcal += f.kcal;
    }
  }
  return { hrAvg: n > 0 ? sum / n : 0, kcalTotal: kcal };
}

export function AnalysisTab() {
  const { sessions } = useCoachStore();
  const [periodDays, setPeriodDays] = useState(30);
  const [toast, setToast] = useState<string | null>(null);

  const now = Date.now();
  const fromMs = now - periodDays * 24 * 3600 * 1000;
  const toMs = now;

  const report = useMemo(() => buildReport(sessions || [], fromMs, toMs), [sessions, fromMs, toMs]);
  const empty = report.isEmpty();

  const heart = useMemo(() => heartFacts(sessions || [], fromMs, toMs), [sessions, fromMs, toMs]);

  const sharePct = report.totalDurationSec > 0 ? Math.round(report.workSharePct) : 0;

  const showToast = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 3000);
  };

  /** Пары «показатель — значение»: один список и для экрана, и для файла. */
  const summaryRows = (): Array<[string, string]> => {
    const rows: Array<[string, string]> = [
      ['Тренировок', String(report.workouts)],
      ['Всего времени', fmtDur(report.totalDurationSec)],
      ['Подходов', String(report.sets)],
    ];
    if (report.planPct > 0) rows.push(['Отработка плана', `${Math.round(report.planPct)} %`]);
    if (report.tonnage > 0) rows.push(['Тоннаж', fmtTonnage(report.tonnage)]);
    if (heart.hrAvg > 0) {
      rows.push(['Средний пульс', `${Math.round(heart.hrAvg)} уд/мин`]);
      if (heart.kcalTotal > 0) rows.push(['Калории с часов', `${Math.round(heart.kcalTotal)} ккал`]);
    }
    return rows;
  };

  const weekBody = (w: { workedSec: number; sets: number; planPct: number }): string => {
    const parts = [`под нагрузкой ${fmtDur(w.workedSec)}`];
    if (w.sets > 0) parts.push(`подходов ${w.sets}`);
    if (w.planPct > 0) parts.push(`план ${Math.round(w.planPct)} %`);
    return parts.join(' · ');
  };

  const exerciseDetail = (st: {
    sets: number; avgSecPerSet: number; planPct: number;
    tempoSecPerRep: number; setsPerWeek: number;
  }): string => {
    const parts = [`подходов ${st.sets}`];
    if (st.avgSecPerSet > 0) parts.push(`среднее ${fmtDur(Math.round(st.avgSecPerSet))}`);
    if (st.planPct > 0) parts.push(`${Math.round(st.planPct)} % от плана`);
    if (st.tempoSecPerRep > 0) parts.push(`${fmtNum(st.tempoSecPerRep)} с на повтор`);
    if (st.setsPerWeek > 0) parts.push(`${fmtNum(st.setsPerWeek)} подх./нед.`);
    return parts.join(' · ');
  };

  const exerciseWeight = (st: { weightFirst: number; weightLast: number; weightDeltaPct: number }): string | null => {
    if (st.weightFirst <= 0 || st.weightLast <= 0) return null;
    const delta = Math.abs(st.weightDeltaPct) < 0.5
      ? 'без изменений'
      : `${st.weightDeltaPct > 0 ? '+' : ''}${Math.round(st.weightDeltaPct)} %`;
    return `Вес: ${fmtKg(st.weightFirst)} → ${fmtKg(st.weightLast)} (${delta})`;
  };

  const saveReport = () => {
    if (empty) {
      showToast('За период нет данных — отчёт будет пустым');
      return;
    }
    try {
      const lines: string[] = [];
      lines.push('Анализ тренировок');
      lines.push(formatRange(fromMs, toMs));
      lines.push('');
      lines.push('== Сводка ==');
      lines.push(`Под нагрузкой: ${fmtDur(report.workedSec)}`);
      if (report.totalDurationSec > 0) lines.push(`${sharePct} % от времени тренировок`);
      for (const [label, value] of summaryRows()) lines.push(`${label}: ${value}`);

      if (report.byExercise.size > 0) {
        lines.push('');
        lines.push('== По упражнениям ==');
        for (const st of report.byExercise.values()) {
          lines.push(`${st.exercise} — ${exerciseDetail(st)}`);
          const weight = exerciseWeight(st);
          if (weight) lines.push(weight);
        }
      }

      const weeks = report.weeks.filter(w => w.workouts > 0 || w.sets > 0);
      if (weeks.length > 0) {
        lines.push('');
        lines.push('== Динамика по неделям ==');
        for (const w of weeks) lines.push(`Неделя с ${dayLabel(w.startMs)} — ${weekBody(w)}`);
      }

      if (report.tips.length > 0) {
        lines.push('');
        lines.push('== Что делать дальше ==');
        for (const t of report.tips) lines.push(`- ${t.title}: ${t.text}`);
      }

      if (report.flags.length > 0) {
        lines.push('');
        lines.push('== Отклонения ==');
        for (const f of report.flags) lines.push(`- ${f.text}`);
      }

      const name = `fitguide_analysis_${periodDays}d.txt`;
      const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`Отчёт сохранён: ${name}`);
    } catch {
      showToast('Не удалось сохранить отчёт');
    }
  };

  return (
    <div className="pb-6 space-y-2">
      {/* Период */}
      <Card className="mt-2">
        <div className="text-[15px] font-bold" style={{ color: 'var(--color-text-main)' }}>
          Период
        </div>
        <div className="mt-1 flex gap-1.5">
          {PERIOD_DAYS.map(d => {
            const on = periodDays === d;
            return (
              <button
                key={d}
                onClick={() => setPeriodDays(d)}
                className={`fg-chip ${on ? 'fg-chip-on' : ''}`}
              >
                {d} дней
              </button>
            );
          })}
        </div>
      </Card>

      {empty && (
        <Hint className="px-8 py-12 text-center text-[15px]">
          Пока нет тренировок за период
        </Hint>
      )}

      {!empty && (
        <>
          <Card>
            <div className="text-[15px] font-bold" style={{ color: 'var(--color-text-main)' }}>
              Сводка
            </div>
            <div className="mt-2 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
              Под нагрузкой
            </div>
            <div className="mt-0.5 text-[28px] font-bold" style={{ color: 'var(--p-preset-primary)' }}>
              {fmtDur(report.workedSec)}
            </div>
            {report.totalDurationSec > 0 && (
              <div className="mt-0.5 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                {sharePct} % от времени тренировок
              </div>
            )}
            <div className="mt-2.5 space-y-1">
              {summaryRows().map(([label, value]) => (
                <div key={label} className="flex justify-between text-[14px]">
                  <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
                  <span style={{ color: 'var(--color-text-main)', fontWeight: 700 }}>{value}</span>
                </div>
              ))}
            </div>
          </Card>

          {report.weeks.some(w => w.workouts > 0 || w.sets > 0) && (
            <Card>
              <div className="text-[15px] font-bold" style={{ color: 'var(--color-text-main)' }}>
                Динамика по неделям
              </div>
              <div className="mt-2 space-y-2">
                {report.weeks.map((w, i) => {
                  if (w.workouts === 0 && w.sets === 0) return null;
                  return (
                    <div key={i}>
                      <div className="text-[14px] font-bold" style={{ color: 'var(--color-text-main)' }}>
                        Неделя с {dayLabel(w.startMs)}
                      </div>
                      <div className="text-[13px] leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
                        {weekBody(w)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <Card>
            <div className="text-[15px] font-bold" style={{ color: 'var(--color-text-main)' }}>
              По упражнениям
            </div>
            {report.sets === 0 && (
              <p className="mt-1.5 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                Факты по подходам появятся после тренировок по времени под нагрузкой
              </p>
            )}
            <div className="mt-2">
              {[...report.byExercise.values()].map((st, i) => (
                <div key={st.exercise}>
                  {i > 0 && <div className="h-px my-2.5" style={{ background: 'var(--color-outline)' }} />}
                  <div className="text-[14px] font-bold" style={{ color: 'var(--color-text-main)' }}>
                    {st.exercise}
                  </div>
                  <div className="text-[13px] leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
                    {exerciseDetail(st)}
                  </div>
                  {exerciseWeight(st) && (
                    <div className="text-[13px] leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
                      {exerciseWeight(st)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {report.tips.length > 0 && (
            <Card>
              <div className="text-[15px] font-bold" style={{ color: 'var(--color-text-main)' }}>
                Что делать дальше
              </div>
              <div className="mt-1.5 space-y-2">
                {report.tips.map((t, i) => (
                  <div key={i}>
                    <div className="text-[14px] font-bold" style={{ color: 'var(--color-text-main)' }}>{t.title}</div>
                    <div className="text-[13px] leading-snug" style={{ color: 'var(--color-text-secondary)' }}>{t.text}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {report.flags.length > 0 && (
            <Card>
              <div className="text-[15px] font-bold" style={{ color: 'var(--color-text-main)' }}>
                Отклонения
              </div>
              <div className="mt-1.5 space-y-1">
                {report.flags.map((f, i) => (
                  <div key={i} className="text-[13px] leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
                    • {f.text}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      <PrimaryButton className="mt-4 h-11" onClick={saveReport}>
        Выгрузить отчёт
      </PrimaryButton>

      {toast && <Toast text={toast} />}
    </div>
  );
}
