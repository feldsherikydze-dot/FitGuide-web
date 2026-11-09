// Вкладка «Журнал» — история тренировок (порт JournalFragment + JournalAdapter).

import { useMemo, useState } from 'react';
import { useCoachStore, usePrStore } from '../../core/store';
import { epley1RM } from '../../core/generator';
import { fmtNum, sessionDurationSec, sessionSets, sessionTonnage } from '../../core/workAnalysis';
import { Card, Hint, Toast, formatDate } from './common';
import { MaskIcon, asset } from '../../components/ui';

function duration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s < 10 ? `${m}:0${s}` : `${m}:${s}`;
}

export function JournalTab() {
  const { sessions, removeSession } = useCoachStore();
  const { prs } = usePrStore();
  const [toast, setToast] = useState<string | null>(null);

  const list = useMemo(() => [...sessions].sort((a, b) => b.ts - a.ts), [sessions]);

  const stats = useMemo(() => {
    let tonnage = 0;
    let best = 0;
    let bestName = '';
    for (const s of list) {
      tonnage += sessionTonnage(s);
      for (const it of s.items) {
        if (it.weightKg > 0 && it.reps > 0) {
          const rm = epley1RM(it.weightKg, it.reps);
          if (rm > best) { best = rm; bestName = it.exercise; }
        }
      }
    }
    for (const p of prs) {
      const rm = epley1RM(p.weight, p.reps);
      if (rm > best) { best = rm; bestName = p.name; }
    }
    return { tonnage, best, bestName };
  }, [list, prs]);

  const remove = (id: string) => {
    removeSession(id);
    setToast('Программа удалена');
    window.setTimeout(() => setToast(null), 2000);
  };

  return (
    <div className="pb-6">
      <Card className="mt-2">
        <div className="text-[14px]" style={{ color: 'var(--color-text-main)' }}>
          Тренировок: {list.length}
        </div>
        <div className="mt-0.5 text-[14px]" style={{ color: 'var(--color-text-main)' }}>
          Общий объём: {Math.round(stats.tonnage)} кг
        </div>
        {stats.bestName && (
          <div className="mt-0.5 text-[14px]" style={{ color: 'var(--p-labels-text)' }}>
            Лучший 1ПМ: {stats.bestName} · {stats.best.toFixed(1)} кг
          </div>
        )}
      </Card>

      {list.length === 0 ? (
        <Hint className="px-8 py-12 text-center text-[15px] whitespace-pre-line">
          {'Нет записей.\nНачните тренировку, и она сохранится здесь.'}
        </Hint>
      ) : (
        <div className="mt-2">
          {list.map(s => {
            const totalSets = sessionSets(s);
            const tonnage = sessionTonnage(s);
            return (
              <div
                key={s.id}
                className="mb-2 rounded-[16px] p-4"
                style={{ background: 'var(--p-labels)', border: '1px solid var(--p-outline)' }}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-bold" style={{ color: 'var(--p-on-labels)' }}>
                      {formatDate(s.ts, true)}
                    </div>
                    <div className="mt-0.5 text-[13px]" style={{ color: 'var(--p-on-labels-soft)' }}>
                      {s.dayTitle || 'Тренировка'}
                    </div>
                  </div>
                  <button
                    onClick={() => remove(s.id)}
                    aria-label="Удалить"
                    className="w-10 h-10 -mt-1 -mr-1 flex items-center justify-center rounded-full active:bg-black/5 flex-shrink-0"
                  >
                    <MaskIcon src={asset('icons/ic_close.svg')} color="var(--p-on-labels-soft)" size={20} />
                  </button>
                </div>

                <div className="mt-2 text-[13px]" style={{ color: 'var(--p-on-labels-soft)' }}>
                  {s.items.length} упр., {totalSets} подх., объём {Math.round(tonnage)} кг, {duration(sessionDurationSec(s))}
                </div>

                <div className="mt-1 space-y-0.5">
                  {s.items.map((it, i) => {
                    // Факты по подходам: реальные повторы и отметки «отказ /
                    // в самый раз / легко» — тренер видит, где просели повторы.
                    const facts = (s.setFacts || []).filter(f => f.exercise === it.exercise);
                    const detail = facts
                      .filter(f => (f.reps || 0) > 0)
                      .map(f => {
                        const feel = f.feel === 1 ? 'отказ' : f.feel === 2 ? 'в самый раз' : f.feel === 3 ? 'легко' : '';
                        return feel ? `${f.reps} (${feel})` : String(f.reps);
                      })
                      .join(' · ');
                    return (
                      <div key={`${it.exercise}-${i}`}>
                        <div className="text-[13px]" style={{ color: 'var(--p-on-labels-soft)' }}>
                          {it.exercise}: {it.sets} × {it.reps}, {it.weightKg.toFixed(1)} кг
                        </div>
                        {detail && (
                          <div className="text-[12px]" style={{ color: 'var(--p-on-labels-soft)' }}>
                            Подходы: {detail}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Toast text={toast} />
    </div>
  );
}
