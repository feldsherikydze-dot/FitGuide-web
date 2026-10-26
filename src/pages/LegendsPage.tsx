// FitGuide Web — «Программы легенд» (порт LegendProgramsActivity + item_legend_program.xml)
//
// Каталог чемпионских программ: карточка с автором, метаданными и описанием,
// кнопка добавления генерирует программу и кладёт в перечень тренировок.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/ui';
import { LEGEND_CATALOG, type LegendProgram } from '../core/legends';
import { useProgramsStore, useProfileStore } from '../core/store';
import { useExercises } from '../hooks/useExercises';
import { generateProgram, PERIOD_LINEAR, TYPE_AUTO } from '../core/generator';
import { GOAL_LABELS, normalizeGoal } from '../core/goals';

const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Новичок',
  intermediate: 'Средний',
  advanced: 'Продвинутый',
};

const AUDIENCE_LABELS: Record<string, string> = {
  male: 'Для мужчин',
  female: 'Для девушек',
  any: 'Для всех',
};

export function LegendsPage() {
  const navigate = useNavigate();
  const { add } = useProgramsStore();
  const { profile } = useProfileStore();
  const { db } = useExercises();
  const [toast, setToast] = useState<string | null>(null);

  const choose = (p: LegendProgram) => {
    if (!db) return;
    const program = generateProgram({
      name: p.name,
      goal: p.goal,
      level: p.level,
      daysPerWeek: p.days,
      weeks: p.weeks,
      place: profile?.place || 'gym',
      style: 'any',
      periodType: PERIOD_LINEAR,
      type: TYPE_AUTO,
      equipment: profile?.equipment || [],
      age: profile?.age,
      female: profile?.gender === 'female',
    }, db);
    add(program);
    setToast(`Программа «${p.name}» добавлена в перечень тренировок`);
    window.setTimeout(() => setToast(null), 2500);
  };

  return (
    <div className="max-w-2xl mx-auto pb-4 w-full">
      <PageHeader title="Программы легенд" onBack={() => navigate('/programs')} />
      <div className="-mt-1 mb-2 ml-4 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
        Классика бодибилдинга и персональные программы чемпионов
      </div>

      <div className="px-3">
        {LEGEND_CATALOG.map(p => (
          <div key={p.id} className="mb-2.5 p-4 rounded-[20px]"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-outline)' }}>
            <div className="text-[18px] font-bold" style={{ color: 'var(--p-labels)' }}>{p.name}</div>
            <div className="mt-0.5 text-[13px]" style={{ color: 'var(--p-labels)' }}>{p.author}</div>
            <div className="mt-1.5 text-[13px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              {AUDIENCE_LABELS[p.audience]} · {GOAL_LABELS[normalizeGoal(p.goal)]} · {LEVEL_LABELS[p.level]}
              <br />
              {p.days} тренировок в неделю · {p.weeks} нед.
            </div>
            <p className="mt-2 text-[14px] leading-relaxed" style={{ color: 'var(--color-text-main)' }}>
              {p.description}
            </p>
            <button
              onClick={() => choose(p)}
              className="mt-2.5 px-2 py-1.5 text-[15px] font-bold active:opacity-70"
              style={{ color: 'var(--p-labels)' }}
            >
              Добавить «{p.name}»
            </button>
          </div>
        ))}
      </div>

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 px-4 py-2 rounded-full text-[13px] font-medium text-white z-40"
          style={{ background: 'rgba(0,0,0,0.85)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
