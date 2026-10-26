// Вкладка «1ПМ» (порт OneRmFragment + activity_one_rm.xml).

import { useEffect, useMemo, useState } from 'react';
import { useCoachStore, useOneRmStore, usePrStore } from '../../core/store';
import { epley1RM } from '../../core/generator';
import { getString, setString } from '../../core/storage';
import {
  Card, Dialog, DialogAction, ExercisePicker, Field, Hint, OutlineButton, PrimaryButton,
  Toast, parseInt10, parseNum, trimNum,
} from './common';
import { MaskIcon, asset } from '../../components/ui';

function roundTo25(v: number): number {
  return Math.round(v / 2.5) * 2.5;
}

function workWeights(oneRm: number): string {
  return [90, 85, 80, 75, 70]
    .map(p => `${p}% ${trimNum(roundTo25(oneRm * p / 100))}`)
    .join(' · ');
}

export function OneRmTab() {
  const { sessions } = useCoachStore();
  const { oneRms, put, remove } = useOneRmStore();
  const { prs } = usePrStore();
  const [exercise, setExercise] = useState(() => getString('one_rm_exercise', ''));
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [picking, setPicking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmFor, setConfirmFor] = useState<string | null>(null);

  const showToast = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 2500);
  };

  const result = useMemo(() => {
    const w = parseNum(weight);
    const r = parseInt10(reps);
    return w > 0 && r > 0 ? epley1RM(w, r) : 0;
  }, [weight, reps]);

  const prefill = (name: string, force: boolean) => {
    if (!name) return;
    if (!force && weight.trim()) return;
    let best = 0;
    let bestWeight = 0;
    let bestReps = 0;
    const manual = prs
      .filter(p => p.name.toLowerCase() === name.toLowerCase())
      .map(p => ({ ...p, rm: epley1RM(p.weight, p.reps) }))
      .sort((a, b) => b.rm - a.rm)[0];
    if (manual) {
      best = manual.rm;
      bestWeight = manual.weight;
      bestReps = manual.reps;
    }
    for (const s of sessions) {
      for (const it of s.items) {
        if (it.exercise.toLowerCase() !== name.toLowerCase()) continue;
        const rm = epley1RM(it.weightKg, it.reps);
        if (rm > best) {
          best = rm;
          bestWeight = it.weightKg;
          bestReps = it.reps;
        }
      }
    }
    if (bestWeight > 0) {
      setWeight(trimNum(bestWeight));
      setReps(String(bestReps));
      return;
    }
    const saved = oneRms.find(r => r.n.toLowerCase() === name.toLowerCase());
    if (saved && saved.v > 0) {
      setWeight(trimNum(saved.v));
      setReps('1');
    }
  };

  useEffect(() => {
    if (exercise) prefill(exercise, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (name: string) => {
    setExercise(name);
    setString('one_rm_exercise', name);
    setPicking(false);
    prefill(name, true);
  };

  const save = () => {
    if (!exercise) {
      showToast('Сначала выберите упражнение');
      return;
    }
    const w = parseNum(weight);
    const r = parseInt10(reps);
    if (w <= 0 || r <= 0) {
      showToast('Введите рабочий вес и повторения');
      return;
    }
    const value = epley1RM(w, r);
    put(exercise, value);
    showToast(`Сохранено: ${exercise} — 1ПМ ${trimNum(value)} кг`);
  };

  return (
    <div className="pb-6">
      <Card className="mt-2">
        <div className="text-[16px] font-bold" style={{ color: 'var(--color-text-main)' }}>
          Калькулятор 1ПМ
        </div>
        <Hint className="mt-1">
          Выбери упражнение и посчитай максимум — сохранённый 1ПМ будет подсказывать рабочие веса на тренировке.
        </Hint>

        <OutlineButton className="mt-3" onClick={() => setPicking(true)}>
          {exercise || 'Выбрать упражнение'}
        </OutlineButton>

        <div className="mt-2.5 flex gap-2">
          <Field value={weight} onChange={setWeight} placeholder="Рабочий вес, кг" className="flex-1" />
          <Field value={reps} onChange={setReps} placeholder="Повторения (до 12)" inputMode="numeric" className="flex-1" />
        </div>

        {result > 0 && (
          <div className="mt-3 text-[20px] font-bold" style={{ color: 'var(--p-labels)' }}>
            1ПМ ≈ {trimNum(result)} кг
          </div>
        )}

        <Hint className="mt-1.5">
          Формула Эпли (оценка, не заменяет реальный максимум). Если упражнение есть в рекордах —
          лучший подход подставится сам.
        </Hint>

        <PrimaryButton className="mt-3" onClick={save}>Сохранить</PrimaryButton>
      </Card>

      <div className="mt-4 text-[14px] font-bold" style={{ color: 'var(--color-text-main)' }}>
        Сохранённые 1ПМ
      </div>

      {oneRms.length === 0 ? (
        <Hint className="mt-2">
          Пока ничего не сохранено. Посчитайте 1ПМ и нажмите «Сохранить» — здесь появятся рабочие веса
          по каждому упражнению.
        </Hint>
      ) : (
        <>
          <Hint className="mt-1.5">
            Тап по строке — подставить в калькулятор, мусорка справа (или долгое нажатие) — удалить.
          </Hint>
          <div className="mt-1">
            {oneRms.map(rm => (
              <div key={rm.n}>
                <div className="flex items-center py-2.5">
                  <button
                    className="flex-1 min-w-0 text-left"
                    onClick={() => {
                      setExercise(rm.n);
                      setString('one_rm_exercise', rm.n);
                      setReps('1');
                      setWeight(trimNum(rm.v));
                    }}
                    onContextMenu={e => { e.preventDefault(); setConfirmFor(rm.n); }}
                  >
                    <div className="text-[15px] font-bold truncate" style={{ color: 'var(--color-text-main)' }}>
                      {rm.n}
                    </div>
                    <div className="mt-0.5 text-[14px]" style={{ color: 'var(--p-labels)' }}>
                      1ПМ {trimNum(rm.v)} кг
                    </div>
                    <div className="mt-0.5 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
                      Рабочие: {workWeights(rm.v)}
                    </div>
                  </button>
                  <button
                    onClick={() => setConfirmFor(rm.n)}
                    aria-label="Удалить 1ПМ?"
                    className="w-[42px] h-[42px] ml-2 flex items-center justify-center rounded-full active:bg-black/5 flex-shrink-0"
                  >
                    <MaskIcon src={asset('icons/ic_delete.svg')} color="var(--color-text-secondary)" size={20} />
                  </button>
                </div>
                <div className="h-px" style={{ background: 'var(--color-outline)' }} />
              </div>
            ))}
          </div>
        </>
      )}

      {picking && (
        <ExercisePicker title="Упражнение для 1ПМ" onPick={choose} onClose={() => setPicking(false)} />
      )}

      {confirmFor && (
        <Dialog
          title="Удалить 1ПМ?"
          onClose={() => setConfirmFor(null)}
          actions={
            <>
              <DialogAction onClick={() => setConfirmFor(null)}>Отмена</DialogAction>
              <DialogAction strong onClick={() => { remove(confirmFor); setConfirmFor(null); }}>ОК</DialogAction>
            </>
          }
        >
          <p className="text-[14px]" style={{ color: 'var(--color-text-secondary)' }}>
            Удалить сохранённый 1ПМ для «{confirmFor}»?
          </p>
        </Dialog>
      )}

      <Toast text={toast} />
    </div>
  );
}
