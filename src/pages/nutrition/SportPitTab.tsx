// Вкладка «Спортпит» (порт SportPitFragment + activity_sportpit.xml).
// Подбор добавок под цель, уровень и бюджет. Форма плоская (без карточки-обёртки),
// результат появляется только после нажатия «Подобрать добавки» — как в Android.

import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfileStore } from '../../core/store';
import { getString } from '../../core/storage';
import { dailyCalories, GOALS_ALL, GOAL_LABELS, goalLabel, normalizeGoal, proteinPerKg } from '../../core/goals';
import { additivesForProfile } from '../../core/additives';
import type { Additive } from '../../core/additives';
import { Toast } from '../progress/common';

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
  const navigate = useNavigate();
  const { profile } = useProfileStore();
  const [goal, setGoal] = useState(() => (profile?.goal ? normalizeGoal(profile.goal) : 'maintain'));
  const [level, setLevel] = useState(() => getString('user_level', '') || 'beginner');
  const [budget, setBudget] = useState('medium');
  const [adds, setAdds] = useState<Additive[] | null>(null);
  const [toast, setToast] = useState<string | null>('');

  const showToast = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 2500);
  };

  const weight = profile?.weightKg || 0;
  const age = profile?.age || 0;
  const complete = !!profile && age > 0 && (profile.heightCm || 0) > 0 && weight > 0 && !!profile.gender;

  const calculate = useCallback(() => {
    const list = additivesForProfile({
      goal, level, budget,
      weightKg: weight, age, gender: profile?.gender || 'male',
    });
    if (list.length === 0) {
      showToast('Выберите параметры для подбора');
      return;
    }
    setAdds(list);
  }, [goal, level, budget, weight, age, profile?.gender]);

  const openDetail = (a: Additive) => {
    navigate(`/sportpit/${encodeURIComponent(a.key)}?goal=${goal}&level=${level}&budget=${budget}`);
  };

  return (
    <div className="pb-6 px-2">
      <div className="mt-2 text-[13px] leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
        Рекомендации основаны на научных данных. Начните с малого, следите за самочувствием.
      </div>

      <div className="mt-4 text-[14px] font-bold" style={{ color: 'var(--color-text-secondary)' }}>
        Цель
      </div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {GOALS_ALL.map(g => (
          <button
            key={g}
            onClick={() => setGoal(g)}
            className={`fg-chip ${goal === g ? 'fg-chip-on' : ''}`}
          >
            {GOAL_LABELS[g]}
          </button>
        ))}
      </div>

      <div className="mt-3 text-[14px] font-bold" style={{ color: 'var(--color-text-secondary)' }}>
        Уровень подготовки
      </div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {LEVELS.map(l => (
          <button
            key={l.value}
            onClick={() => setLevel(l.value)}
            className={`fg-chip ${level === l.value ? 'fg-chip-on' : ''}`}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="mt-3 text-[14px] font-bold" style={{ color: 'var(--color-text-secondary)' }}>
        Бюджет
      </div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {BUDGETS.map(b => (
          <button
            key={b.value}
            onClick={() => setBudget(b.value)}
            className={`fg-chip ${budget === b.value ? 'fg-chip-on' : ''}`}
          >
            {b.label}
          </button>
        ))}
      </div>

      <button
        onClick={calculate}
        className="fg-btn fg-btn-primary w-full mt-5"
        style={{ height: 50, borderRadius: 25, fontSize: 16 }}
      >
        Подобрать добавки
      </button>

      {adds && adds.length > 0 && (
        <div className="mt-4">
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            {complete
              ? `Ваш профиль: ${weight.toFixed(0)} кг · ${age} лет · ${goalLabel(goal)} — `
                + `${dailyCalories(profile).toFixed(0)} ккал/сутки, белок ~${(weight * proteinPerKg(goal)).toFixed(0)} г`
              : 'Дозировки рассчитаны приблизительно — заполните профиль (вес, возраст, пол, цель), чтобы подобрать точнее.'}
          </p>

          <div className="mt-[18px] text-[16px] font-bold" style={{ color: 'var(--color-text-main)' }}>
            Вам подойдут
          </div>

          {adds.map(a => (
            <button
              key={a.key}
              onClick={() => openDetail(a)}
              className="fg-banner-grad block w-full text-left mt-2.5 px-4 py-[14px]"
            >
              <div className="text-[15px] font-bold" style={{ color: 'var(--color-text-main)' }}>
                {a.name}
              </div>
              <div className="pt-1 text-[13px]" style={{ color: 'var(--p-labels)' }}>
                Дозировка: {a.dose}
              </div>
              <div className="pt-1.5 text-[13px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                {a.why}
              </div>
              {a.products.length > 0 && (
                <div className="pt-1.5 text-[13px] font-bold" style={{ color: 'var(--p-labels)' }}>
                  Рекомендуемые варианты →
                </div>
              )}
            </button>
          ))}

          <p className="mt-[18px] text-[12px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            Перед приёмом добавок проконсультируйтесь с врачом. Не заменяйте полноценное питание добавками.
          </p>
        </div>
      )}

      <Toast text={toast} />
    </div>
  );
}
