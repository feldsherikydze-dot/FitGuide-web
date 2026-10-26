// Вкладка «Анализ» (порт AnalysisFragment + activity_analysis.xml).
//
// Чипы периода 7/30/90 дней, сводка, динамика по неделям, по упражнениям,
// советы, отклонения и кнопка выгрузки отчёта.

import { useEffect, useMemo, useState } from 'react';
import { useCoachStore } from '../../core/store';
import {
  buildReport, fmtDur, fmtKg, fmtNum, fmtTonnage, sessionDurationSec,
  sessionSets, sessionTonnage,
} from '../../core/workAnalysis';
import type { Session } from '../../data/types';
import {
  Card, Dialog, DialogAction, Field, Hint, OutlineButton, PrimaryButton,
  Toast, trimNum,
} from './common';

const PERIOD_DAYS = [7, 30, 90];

function formatRange(fromMs: number, toMs: number): string {
  return `Период: ${new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(fromMs))} — `
    + `${new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(toMs))}`;
}

function weekLabel(startMs: number): string {
  return `Неделя с ${new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(startMs))}`;
}

export function AnalysisTab() {
  const { sessions } = useCoachStore();
  const [periodDays, setPeriodDays] = useState(30);
  const [exporting, setExporting] = useState<string | null>(null);

  const now = Date.now();
  const fromMs = now - periodDays * 24 * 3600 * 1000;
  const toMs = now;

  const report = useMemo(() => buildReport(sessions || [], fromMs, toMs), [sessions, fromMs, toMs]);
  const empty = report.isEmpty();

  const sharePct = report.totalDurationSec > 0 ? Math.round(report.workSharePct) : 0;

  const saveReport = () => {
    if (empty) {
      setExporting('За период нет данных — отчёт будет пустым');
      window.setTimeout(() => setExporting(null), 2500);
      return;
    }
    const lines: string[] = [];
    lines.push('Анализ тренировок');
    lines.push(formatRange(fromMs, toMs));
    lines.push('');
    lines.push('== Сводка ==');
    lines.push(`Под нагрузкой: ${fmtDur(report.workedSec)}`);
    if (report.totalDurationSec > 0) {
      lines.push(`${sharePct} % от времени тренировок`);
    }
    lines.push(`Тренировок: ${report.workouts}`);
    lines.push(`Всего времени: ${fmtDur(report.totalDurationSec)}`);
    lines.push(`Подходов: ${report.sets}`);
    if (report.planPct > 0) {
      lines.push(`Отработка плана: ${Math.round(report.planPct)} %`);
    }
    if (report.tonnage > 0) {
      lines.push(`Тоннаж: ${fmtTonnage(report.tonnage)}`);
    }
    if (report.tips.length) {
      lines.push('');
      lines.push('== Что делать дальше ==');
      for (const t of report.tips) lines.push(`- ${t.title}: ${t.text}`);
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitguide_analysis_${periodDays}d.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExporting('Отчёт сохранён');
    window.setTimeout(() => setExporting(null), 2500);
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
                className="min-h-[32px] px-3 rounded-[8px] text-[13px] font-medium"
                style={{
                  background: on ? 'var(--p-labels)' : 'var(--color-surface-variant)',
                  border: `1px solid ${on ? 'var(--p-labels)' : 'var(--color-stroke)'}`,
                  color: on ? 'var(--p-on-labels)' : 'var(--color-text-main)',
                }}
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

      <Card>
        <div className="text-[15px] font-bold" style={{ color: 'var(--color-text-main)' }}>
          Сводка
        </div>
        <div className="mt-1 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
          Под нагрузкой
        </div>
        <div className="mt-0.5 text-[28px] font-bold" style={{ color: 'var(--p-labels)' }}>
          {fmtDur(report.workedSec)}
        </div>
        {report.totalDurationSec > 0 && (
          <div className="mt-0.5 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
            {sharePct} % от времени тренировок
          </div>
        )}
        <div className="mt-2 space-y-1">
          <div className="flex justify-between text-[14px]">
            <span style={{ color: 'var(--color-text-secondary)' }}>Тренировок</span>
            <span style={{ color: 'var(--color-text-main)', fontWeight: 600 }}>{report.workouts}</span>
          </div>
          <div className="flex justify-between text-[14px]">
            <span style={{ color: 'var(--color-text-secondary)' }}>Всего времени</span>
            <span style={{ color: 'var(--color-text-main)', fontWeight: 600 }}>{fmtDur(report.totalDurationSec)}</span>
          </div>
          <div className="flex justify-between text-[14px]">
            <span style={{ color: 'var(--color-text-secondary)' }}>Подходов</span>
            <span style={{ color: 'var(--color-text-main)', fontWeight: 600 }}>{report.sets}</span>
          </div>
          {report.planPct > 0 && (
            <div className="flex justify-between text-[14px]">
              <span style={{ color: 'var(--color-text-secondary)' }}>Отработка плана</span>
              <span style={{ color: 'var(--color-text-main)', fontWeight: 600 }}>{Math.round(report.planPct)} %</span>
            </div>
          )}
          {report.tonnage > 0 && (
            <div className="flex justify-between text-[14px]">
              <span style={{ color: 'var(--color-text-secondary)' }}>Тоннаж</span>
              <span style={{ color: 'var(--color-text-main)', fontWeight: 600 }}>{fmtTonnage(report.tonnage)}</span>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div className="text-[15px] font-bold" style={{ color: 'var(--color-text-main)' }}>
          Динамика по неделям
        </div>
        <div className="mt-1 space-y-2">
          {report.weeks.map((w, i) => {
            if (w.workouts === 0 && w.sets === 0) return null;
            const parts: string[] = [`под нагрузкой ${fmtDur(w.workedSec)}`];
            if (w.sets > 0) parts.push(`подходов ${w.sets}`);
            if (w.planPct > 0) parts.push(`план ${Math.round(w.planPct)} %`);
            return (
              <div
                key={i}
                className="flex justify-between text-[13px] leading-snug"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <span style={{ color: 'var(--color-text-main)', fontWeight: 600 }}>
                  {i === 0 ? 'Неделя с ' : ''}
                  {new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(w.startMs))}
                </span>
                <span>{parts.join(' · ')}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="text-[15px] font-bold" style={{ color: 'var(--color-text-main)' }}>
          По упражнениям
        </div>
        {report.sets === 0 && (
          <p className="mt-1 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
            Факты по подходам появятся после тренировок по времени под нагрузкой
          </p>
        )}
        <div className="mt-1 space-y-2">
          {[...report.byExercise.entries()].map(([name, st]) => (
            <div key={name}>
              <div className="text-[14px] font-bold truncate" style={{ color: 'var(--color-text-main)' }}>
                {st.exercise}
              </div>
              <div className="text-[13px] leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
                {`подходов ${st.sets}`}
                {st.avgSecPerSet > 0 && ` · среднее ${fmtDur(Math.round(st.avgSecPerSet))}`}
                {st.planPct > 0 && ` · ${Math.round(st.planPct)} % от плана`}
                {st.tempoSecPerRep > 0 && ` · ${fmtNum(st.tempoSecPerRep)} с на повтор`}
                {st.setsPerWeek > 0 && ` · ${fmtNum(st.setsPerWeek)} подх./нед.`}
              </div>
              {st.weightFirst > 0 && st.weightLast > 0 && (
                <div className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                  Вес: {trimNum(st.weightFirst)} кг → {trimNum(st.weightLast)} кг
                  {Math.abs(st.weightDeltaPct) < 0.5 ? ' (без изменений)'
                    : ` (${st.weightDeltaPct > 0 ? '+' : ''}${Math.round(st.weightDeltaPct)} %)`}
                </div>
              )}
              <div className="h-px" style={{ background: 'var(--color-outline)' }} />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="text-[15px] font-bold" style={{ color: 'var(--color-text-main)' }}>
          Что делать дальше
        </div>
        <div className="mt-1 space-y-1">
          {report.tips.map((t, i) => (
            <div key={i} className="text-[13px] leading-snug">
              <span className="font-bold" style={{ color: 'var(--color-text-main)' }}>{t.title}</span>: {t.text}
            </div>
          ))}
        </div>
      </Card>

      {report.flags.length > 0 && (
        <Card>
          <div className="text-[15px] font-bold" style={{ color: 'var(--color-text-main)' }}>
            Отклонения
          </div>
          <div className="mt-1 space-y-0.5">
            {report.flags.map((f, i) => (
              <div key={i} className="text-[13px] leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
                • {f.text}
              </div>
            ))}
          </div>
        </Card>
      )}

      <PrimaryButton className="mt-2 h-11" onClick={saveReport} disabled={empty}>
        Выгрузить отчёт
      </PrimaryButton>

      {exporting && (
        <Toast text={exporting} />
      )}
    </div>
  );
}
