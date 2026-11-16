// FitGuide Web — «Программы легенд» (порт LegendProgramsActivity + item_legend_program.xml)
//
// Каталог чемпионских программ: карточка с автором, метаданными и описанием,
// кнопка добавления генерирует программу и кладёт в перечень тренировок.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/ui';
import { LEGEND_CATALOG, type LegendProgram } from '../core/legends';
import { buildLegendProgram, hasLegendPlan } from '../core/legendPlans';
import { useProgramsStore, useProfileStore } from '../core/store';
import { useExercises } from '../hooks/useExercises';
import { generateProgram, PERIOD_LINEAR, TYPE_AUTO } from '../core/generator';
import { GOAL_LABELS, normalizeGoal } from '../core/goals';
import { plural } from '../core/coach';

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
  const hasGender = !!profile?.gender;
  const [mineOnly, setMineOnly] = useState(hasGender);
  const catalog = mineOnly && hasGender
    ? LEGEND_CATALOG.filter(p => !p.audience || p.audience === 'any' || p.audience === profile?.gender)
    : LEGEND_CATALOG;

  const choose = (p: LegendProgram) => {
    // Сначала настоящий план легенды; генератор — только если плана нет.
    const planned = buildLegendProgram(p, db);
    if (planned) {
      add(planned);
      setToast(`Программа «${p.name}» добавлена в перечень тренировок`);
      window.setTimeout(() => setToast(null), 2500);
      return;
    }
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
      emphasis: profile?.trainingEmphasis,
    }, db);
    add(program);
    setToast(`Программа «${p.name}» добавлена в перечень тренировок`);
    window.setTimeout(() => setToast(null), 2500);
  };

  return (
    <div className="max-w-2xl mx-auto pb-4 w-full max-w-full">
      <PageHeader title="Программы легенд" subtitle="Классика бодибилдинга и персональные программы чемпионов"
        onBack={() => navigate('/programs')} />

      <div className="px-3">
        <div className="flex gap-1.5 mb-2.5">
          {([
            { key: true, label: 'Для меня' },
            { key: false, label: 'Все' },
          ] as const).map(f => {
            const active = mineOnly === f.key;
            return (
              <button
                key={String(f.key)}
                disabled={f.key && !hasGender}
                onClick={() => setMineOnly(f.key)}
                className="px-3 py-1.5 rounded-lg text-[13px] font-medium disabled:opacity-40"
                style={{
                  background: active ? 'var(--p-circle)' : 'var(--p-labels)',
                  color: active ? '#fff' : 'var(--color-text-main)',
                  border: '1px solid var(--p-outline)',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        {catalog.map(p => (
          <div key={p.id} className="mb-2.5 p-4 rounded-[20px]"
            style={{ background: 'var(--p-labels)', border: '1px solid var(--p-outline)' }}>
            <div className="text-[18px] font-bold" style={{ color: 'var(--color-text-main)' }}>{p.name}</div>
            <div className="mt-0.5 text-[13px]" style={{ color: 'var(--p-labels-text)' }}>{p.author}</div>
            {hasLegendPlan(p.id) && (
              <div className="mt-1.5 inline-block px-2 py-0.5 rounded text-[11px] font-bold"
                style={{ color: 'var(--p-labels-text)', border: '1px solid var(--p-outline)' }}>
                План зафиксирован
              </div>
            )}
            <div className="mt-1.5 text-[13px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              {AUDIENCE_LABELS[p.audience]} · {GOAL_LABELS[normalizeGoal(p.goal)]} · {LEVEL_LABELS[p.level]}
              <br />
              {p.days} {plural(p.days, 'тренировка', 'тренировки', 'тренировок')} в неделю · {p.weeks} нед.
            </div>
            <p className="mt-2 text-[14px] leading-relaxed" style={{ color: 'var(--color-text-main)' }}>
              {p.description}
            </p>
            <button
              onClick={() => choose(p)}
              className="mt-2.5 px-2 py-1.5 text-[15px] font-bold active:opacity-70"
              style={{ color: 'var(--p-labels-text)' }}
            >
              Добавить «{p.name}»
            </button>
          </div>
        ))}
      </div>

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 px-4 py-2 rounded-full text-[13px] font-medium text-white z-40"
          style={{ background: 'var(--p-labels)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
