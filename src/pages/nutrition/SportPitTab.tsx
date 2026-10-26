// Вкладка «Спортпит» (порт SportPitFragment + activity_sportpit.xml).
// Подбор добавок под цель, уровень и бюджет.

import { useCallback, useMemo, useState } from 'react';
import { useProfileStore } from '../../core/store';
import { GOALS_ALL, GOAL_LABELS, normalizeGoal, goalLabel } from '../../core/goals';
import { additivesForProfile } from '../../core/additives';
import type { Additive } from '../../core/additives';
import { Card, Hint, SectionTitle, Toast } from '../progress/common';
import { MaskIcon, asset } from '../../components/ui';

const LEVELS = [
  { value: 'beginner', label: 'Новичок' },
  { value: 'intermediate', label: 'Средний' },
  { value: 'advanced', label: 'Продвинутый' },
];
const BUDGETS = [
  { value: 'econom', label: 'Экономный' },
  { value: 'medium', label: 'Средний' },
  { value: 'premium', label: 'Максимум' },
];

export function SportPitTab() {
  const { profile } = useProfileStore();
  const [goal, setGoal] = useState(profile?.goal || 'mass');
  const [level, setLevel] = useState(profile?.level || 'beginner');
  const [budget, setBudget] = useState('medium');
  const [toast, setToast] = useState<string | null>('');

  const showToast = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 2500);
  };

  const weight = profile?.weightKg || 0;
  const age = profile?.age || 0;
  const gender = profile?.gender || 'male';
  const ready = weight > 0 && age > 0;

  const adds = useMemo(() => additivesForProfile({
    goal, level, budget, weightKg: weight, age, gender,
  }), [goal, level, budget, weight, age, gender]);

  const proteinNeed = ready ? weight * 2.0 : 0;
  const kcalNeed = ready ? Math.round(weight * 25) : 0;

  const calculate = () => showToast(adds.length ? 'Подбор обновлён' : 'Выберите параметры для подбора');

  return (
    <div className="pb-6 space-y-2">
      <Card className="mt-2">
        <SectionTitle>Спортпит</SectionTitle>
        <Hint className="mt-0.5">Рекомендации основаны на научных данных. Начните с малого, следите за самочувствием.</Hint>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <div className="text-[12px] font-bold mb-1" style={{ color: 'var(--color-text-secondary)' }}>Цель</div>
          {GOALS_ALL.map(g => {
            const on = goal === g;
            return (
              <button key={g} onClick={() => setGoal(g)}
                className="min-h-[32px] px-3 rounded-[8px] text-[13px]"
                style={{
                  background: on ? 'var(--p-labels)' : 'var(--color-surface-variant)',
                  border: `1px solid ${on ? 'var(--p-labels)' : 'var(--color-stroke)'}`,
                  color: on ? 'var(--p-on-labels)' : 'var(--color-text-main)',
                }}
              >
                {GOAL_LABELS[g]}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <div className="text-[12px] font-bold mb-1" style={{ color: 'var(--color-text-secondary)' }}>Уровень подготовки</div>
          {LEVELS.map(l => {
            const on = level === l.value;
            return (
              <button key={l.value} onClick={() => setLevel(l.value)}
                className="min-h-[32px] px-3 rounded-[8px] text-[13px]"
                style={{
                  background: on ? 'var(--p-labels)' : 'var(--color-surface-variant)',
                  border: `1px solid ${on ? 'var(--p-labels)' : 'var(--color-stroke)'}`,
                  color: on ? 'var(--p-on-labels)' : 'var(--color-text-main)',
                }}
              >
                {l.label}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <div className="text-[12px] font-bold mb-1" style={{ color: 'var(--color-text-secondary)' }}>Бюджет</div>
          {BUDGETS.map(b => {
            const on = budget === b.value;
            return (
              <button key={b.value} onClick={() => setBudget(b.value)}
                className="min-h-[32px] px-3 rounded-[8px] text-[13px]"
                style={{
                  background: on ? 'var(--p-labels)' : 'var(--color-surface-variant)',
                  border: `1px solid ${on ? 'var(--p-labels)' : 'var(--color-stroke)'}`,
                  color: on ? 'var(--p-on-labels)' : 'var(--color-text-main)',
                }}
              >
                {b.label}
              </button>
            );
          })}
        </div>

        <div className="mt-2">
          <button onClick={calculate} className="w-full h-11 rounded-[22px] text-[14px] font-bold"
            style={{ background: 'var(--p-labels)', color: 'var(--p-on-labels)' }}>
            Подобрать добавки
          </button>
        </div>
      </Card>

      {!ready && (
        <Hint className="mt-2 px-3">
          Дозировки рассчитаны приблизительно — заполните профиль (вес, возраст, пол, цель), чтобы подобрать точнее.
        </Hint>
      )}

      {adds.length > 0 && (
        <>
          <div className="mt-2 text-[16px] font-bold" style={{ color: 'var(--color-text-main)' }}>
            Вам подойдут
          </div>
          {ready && (
            <p className="mt-0.5 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
              Ваш профиль: {weight.toFixed(0)} кг · {age} лет · {goalLabel(goal)} — {kcalNeed} ккал/сутки, белок ~{proteinNeed.toFixed(0)} г
            </p>
          )}
          <div className="mt-1 space-y-2">
            {adds.map((a: Additive) => (
              <div key={a.key}
                className="rounded-[16px] p-3 mb-1"
                style={{ background: 'var(--color-surface-variant)', border: '1px solid var(--color-outline)' }}
              >
                <div className="text-[15px] font-bold" style={{ color: 'var(--color-text-main)' }}>{a.name}</div>
                <div className="mt-0.5 text-[13px]" style={{ color: 'var(--p-labels)' }}>Дозировка: {a.dose}</div>
                <div className="mt-0.5 text-[13px] leading-snug" style={{ color: 'var(--color-text-secondary)' }}>{a.why}</div>
                {a.products.length > 0 && (
                  <div className="mt-1 text-[13px] font-bold" style={{ color: 'var(--p-labels)' }}>
                    Рекомендуемые варианты →
                  </div>
                )}
              </div>
            ))}
          </div>
          <Hint className="mt-2 text-[12px]">
            Перед приёмом добавок проконсультируйтесь с врачом. Не заменяйте полноценное питание добавками.
          </Hint>
        </>
      )}

      {adds.length === 0 && ready && (
        <Hint className="mt-2 px-3">Выберите параметры для подбора</Hint>
      )}

      <Toast text={toast} />
    </div>
  );
}
