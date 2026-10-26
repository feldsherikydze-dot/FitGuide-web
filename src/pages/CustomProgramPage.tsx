// FitGuide Web — «Своя сборка» (порт CustomProgramActivity, режим редактора)
//
// Курсы → дни → упражнения: имя программы, дни, упражнения с подходами и повторами,
// сохранение в перечень тренировок. Визуально — activity_custom_program.xml.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, MaskIcon, asset } from '../components/ui';
import { useProgramsStore, useProfileStore } from '../core/store';
import { useExercises } from '../hooks/useExercises';
import type { Program } from '../data/types';

interface DayDraft {
  title: string;
  slots: { exercise: string; sets: number; reps: string; rest: string }[];
}

export function CustomProgramPage() {
  const navigate = useNavigate();
  const { add } = useProgramsStore();
  const { profile } = useProfileStore();
  const { db } = useExercises();

  const [name, setName] = useState('');
  const [days, setDays] = useState<DayDraft[]>([{ title: 'День 1', slots: [] }]);
  const [pickerFor, setPickerFor] = useState<number | null>(null);
  const [query, setQuery] = useState('');

  const names = useMemo(() => {
    if (!db) return [] as string[];
    const q = query.trim().toLowerCase();
    return db.exercises
      .map(e => e.name)
      .filter(n => !q || n.toLowerCase().includes(q))
      .slice(0, 80);
  }, [db, query]);

  const addExercise = (dayIdx: number, exercise: string) => {
    setDays(list => list.map((d, i) => i === dayIdx
      ? { ...d, slots: [...d.slots, { exercise, sets: 3, reps: '8–10', rest: '60–90 сек' }] }
      : d));
    setPickerFor(null);
    setQuery('');
  };

  const removeSlot = (dayIdx: number, slotIdx: number) =>
    setDays(list => list.map((d, i) => i === dayIdx
      ? { ...d, slots: d.slots.filter((_, j) => j !== slotIdx) }
      : d));

  const save = () => {
    const filled = days.filter(d => d.slots.length > 0);
    if (filled.length === 0) return;
    const program: Program = {
      id: crypto.randomUUID(),
      name: name.trim() || 'Моя программа',
      goal: profile?.goal || 'mass',
      level: profile?.level || 'intermediate',
      daysPerWeek: filled.length,
      weeks: 4,
      createdAt: Date.now(),
      phases: [{
        weekStart: 1,
        weekEnd: 4,
        label: 'Курс',
        scheme: '',
        deload: false,
        days: filled.map(d => ({
          title: d.title,
          slots: d.slots.map(s => ({
            exercise: s.exercise,
            group: '',
            reps: s.reps,
            rest: s.rest,
            sets: s.sets,
            startWeight: 0,
          })),
        })),
      }],
    };
    add(program);
    navigate('/programs/mine');
  };

  return (
    <div className="max-w-2xl mx-auto pb-4 w-full">
      <PageHeader title="Конструктор программы" onBack={() => navigate('/programs')} />
      <div className="-mt-1 mb-2 ml-4 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
        Курсы → дни → упражнения
      </div>

      <div className="px-4 space-y-3">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Название программы"
          className="fg-input"
        />

        {days.map((day, di) => (
          <div key={di} className="p-4 rounded-[18px]"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-stroke)' }}>
            <div className="flex items-center justify-between">
              <input
                value={day.title}
                onChange={e => setDays(list => list.map((d, i) => i === di ? { ...d, title: e.target.value } : d))}
                className="bg-transparent text-[16px] font-bold outline-none"
                style={{ color: 'var(--color-text-main)' }}
              />
              <span className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
                {day.slots.length} упр.
              </span>
            </div>

            {day.slots.map((slot, si) => (
              <div key={si} className="mt-3 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] truncate" style={{ color: 'var(--color-text-main)' }}>{slot.exercise}</div>
                  <div className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
                    {slot.sets}×{slot.reps} · {slot.rest}
                  </div>
                </div>
                <button onClick={() => removeSlot(di, si)} aria-label="Удалить упражнение"
                  className="w-9 h-9 flex items-center justify-center rounded-full active:bg-black/5">
                  <MaskIcon src={asset('icons/ic_close.svg')} color="var(--color-warning)" size={18} />
                </button>
              </div>
            ))}

            <button onClick={() => setPickerFor(di)}
              className="mt-3 h-10 px-4 rounded-[20px] text-[14px] font-semibold"
              style={{ border: '1px solid var(--color-outline)', color: 'var(--p-labels)' }}>
              + Добавить упражнение
            </button>
          </div>
        ))}

        <button
          onClick={() => setDays(list => [...list, { title: `День ${list.length + 1}`, slots: [] }])}
          className="w-full h-11 rounded-[22px] text-[14px] font-semibold"
          style={{ border: '1px solid var(--color-outline)', color: 'var(--p-labels)' }}
        >
          + Добавить день
        </button>

        <button
          onClick={save}
          disabled={!days.some(d => d.slots.length > 0)}
          className="w-full h-[52px] rounded-[26px] text-[16px] font-bold disabled:opacity-50"
          style={{ background: 'var(--p-labels)', color: 'var(--p-on-labels)' }}
        >
          Сохранить в перечень
        </button>
      </div>

      {pickerFor !== null && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setPickerFor(null)}>
          <div className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
            style={{ background: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b" style={{ borderColor: 'var(--color-stroke)' }}>
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Поиск упражнения…" className="fg-input" />
            </div>
            <div className="overflow-y-auto">
              {names.map(n => (
                <button key={n} onClick={() => addExercise(pickerFor, n)}
                  className="block w-full text-left px-4 py-3 text-[14px] active:bg-black/5"
                  style={{ color: 'var(--color-text-main)' }}>
                  {n}
                </button>
              ))}
              {names.length === 0 && (
                <div className="p-4 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                  Ничего не найдено
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
