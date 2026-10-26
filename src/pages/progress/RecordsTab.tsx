// Вкладка «Рекорды» (порт RecordsFragment + activity_records.xml).

import { useMemo, useRef, useState } from 'react';
import { useCoachStore, usePrStore } from '../../core/store';
import { epley1RM } from '../../core/generator';
import type { PrEntry } from '../../data/types';
import {
  Dialog, DialogAction, ExercisePicker, Field, Hint, PrimaryButton, Toast,
  formatFullDate, parseInt10, parseNum, trimNum,
} from './common';

interface RecordRow {
  exercise: string;
  totalTonnage: number;
  totalSets: number;
  best1rm: number;
  maxWeight: number;
  maxReps: number;
  bestDate: number;
  manual: boolean;
}

function buildRecords(
  sessions: ReturnType<typeof useCoachStore.getState>['sessions'],
  prs: PrEntry[],
  bestManual: (name: string) => PrEntry | null,
): RecordRow[] {
  const byName = new Map<string, RecordRow>();
  const ensure = (name: string) => {
    let r = byName.get(name);
    if (!r) {
      r = {
        exercise: name, totalTonnage: 0, totalSets: 0, best1rm: 0,
        maxWeight: 0, maxReps: 0, bestDate: 0, manual: false,
      };
      byName.set(name, r);
    }
    return r;
  };

  for (const s of sessions) {
    for (const it of s.items) {
      const r = ensure(it.exercise);
      r.totalTonnage += it.weightKg * it.reps * it.sets;
      r.totalSets += it.sets;
      const rm = epley1RM(it.weightKg, it.reps);
      if (rm > r.best1rm) {
        r.best1rm = rm;
        r.maxWeight = it.weightKg;
        r.maxReps = it.reps;
        r.bestDate = s.ts;
      }
    }
  }

  for (const p of prs) {
    const r = ensure(p.name);
    r.totalTonnage += p.weight * p.reps;
    r.totalSets += 1;
    const rm = epley1RM(p.weight, p.reps);
    if (rm > r.best1rm) {
      r.best1rm = rm;
      r.maxWeight = p.weight;
      r.maxReps = p.reps;
      r.bestDate = p.date;
    }
  }

  for (const r of byName.values()) r.manual = !!bestManual(r.exercise);

  return Array.from(byName.values()).sort((a, b) => b.best1rm - a.best1rm);
}

export function RecordsTab() {
  const { sessions } = useCoachStore();
  const { prs, add, remove, best } = usePrStore();
  const [toast, setToast] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [entryFor, setEntryFor] = useState<string | null>(null);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [confirmFor, setConfirmFor] = useState<string | null>(null);
  const longPress = useRef<{ timer: number; fired: boolean }>({ timer: 0, fired: false });

  const records = useMemo(() => buildRecords(sessions, prs, best), [sessions, prs, best]);

  const showToast = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 2500);
  };

  const pickExercise = (name: string) => {
    setPicking(false);
    setEntryFor(name);
    setWeight('');
    setReps('');
  };

  const save = () => {
    if (!entryFor) return;
    const w = parseNum(weight);
    const r = parseInt10(reps);
    if (w <= 0 || r <= 0) {
      showToast('Введите вес и повторы');
      return;
    }
    const before = records.find(x => x.exercise === entryFor)?.best1rm || 0;
    const after = epley1RM(w, r);
    add({ name: entryFor, weight: w, reps: r, date: Date.now() });
    setEntryFor(null);
    showToast(after > before + 0.05
      ? `Рекорд сохранён: ${entryFor} — ${trimNum(w)} кг × ${r}`
      : 'Записал, но лучший результат по упражнению выше — в рекордах он и остался.');
  };

  const startLongPress = (name: string, manual: boolean) => {
    if (!manual) return;
    longPress.current.fired = false;
    longPress.current.timer = window.setTimeout(() => {
      longPress.current.fired = true;
      setConfirmFor(name);
    }, 600);
  };

  const endLongPress = () => {
    if (longPress.current.timer) window.clearTimeout(longPress.current.timer);
  };

  return (
    <div className="pb-6">
      <PrimaryButton className="mt-2" onClick={() => setPicking(true)}>
        + ДОБАВИТЬ РЕКОРД
      </PrimaryButton>
      <Hint className="mt-2">
        Разовый подход можно записать без тренировки: выберите упражнение, укажите вес и повторы.
        Долгое нажатие на запись — удалить.
      </Hint>

      {records.length === 0 ? (
        <Hint className="mt-6 text-center text-[14px] whitespace-pre-line">
          {'Пока нет рекордов.\nЗавершите тренировку или добавьте рекорд вручную.'}
        </Hint>
      ) : (
        <div className="mt-4">
          {records.map(r => (
            <div
              key={r.exercise}
              className="select-none"
              onPointerDown={() => startLongPress(r.exercise, r.manual)}
              onPointerUp={endLongPress}
              onPointerLeave={endLongPress}
              onPointerCancel={endLongPress}
              onContextMenu={e => {
                if (r.manual) { e.preventDefault(); setConfirmFor(r.exercise); }
              }}
            >
              <div className="text-[16px] font-bold" style={{ color: 'var(--color-text-main)' }}>
                {r.exercise}
              </div>
              <div className="mt-1 text-[14px]" style={{ color: 'var(--p-labels)' }}>
                Лучший подход: {r.maxWeight.toFixed(1)} кг × {r.maxReps}
              </div>
              <div className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                Оценочный 1ПМ: {r.best1rm.toFixed(1)} кг
              </div>
              <div className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
                {formatFullDate(r.bestDate)} · подходов за всё время: {r.totalSets} · объём: {Math.round(r.totalTonnage)} кг
              </div>
              {r.manual && (
                <div className="text-[12px]" style={{ color: 'var(--color-accent, #C0392B)' }}>
                  добавлено вручную · долгое нажатие — удалить
                </div>
              )}
              <div className="my-3 h-px" style={{ background: 'var(--color-outline)' }} />
            </div>
          ))}
        </div>
      )}

      {picking && (
        <ExercisePicker title="Упражнение рекорда" onPick={pickExercise} onClose={() => setPicking(false)} />
      )}

      {entryFor && (
        <Dialog
          title={entryFor}
          onClose={() => setEntryFor(null)}
          actions={
            <>
              <DialogAction onClick={() => setEntryFor(null)}>Отмена</DialogAction>
              <DialogAction strong onClick={save}>Сохранить</DialogAction>
            </>
          }
        >
          <div className="space-y-2 pt-1">
            <Field value={weight} onChange={setWeight} placeholder="Вес, кг" />
            <Field value={reps} onChange={setReps} placeholder="Повторы" inputMode="numeric" />
          </div>
        </Dialog>
      )}

      {confirmFor && (
        <Dialog
          title="Удалить рекорд?"
          onClose={() => setConfirmFor(null)}
          actions={
            <>
              <DialogAction onClick={() => setConfirmFor(null)}>Отмена</DialogAction>
              <DialogAction strong onClick={() => { remove(confirmFor); setConfirmFor(null); }}>ОК</DialogAction>
            </>
          }
        >
          <p className="text-[14px]" style={{ color: 'var(--color-text-secondary)' }}>
            Удалить вручную добавленный рекорд «{confirmFor}»?
          </p>
        </Dialog>
      )}

      <Toast text={toast} />
    </div>
  );
}
