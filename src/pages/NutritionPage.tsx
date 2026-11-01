// FitGuide Web — питание: КБЖУ + спортпит (порт KbjuFragment + SportPitFragment)

import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { Apple, Pill, ChevronDown, ChevronUp, Info, Target, Calculator } from 'lucide-react';
import { useProfileStore } from '../core/store';
import { GOALS, GOALS_ALL, GOAL_LABELS, GOAL_DESCRIPTIONS, caloriesFor, proteinPerKg, fatsPerKg, normalizeGoal } from '../core/goals';
import { additivesForProfile, type Additive } from '../core/additives';

const BUDGETS = [
  { value: 'econom', label: 'Эконом', desc: 'Бюджетно' },
  { value: 'medium', label: 'Средний', desc: 'Оптимально' },
  { value: 'premium', label: 'Премиум', desc: 'Топовые бренды' },
];

const LEVELS = [
  { value: 'beginner', label: 'Новичок' },
  { value: 'intermediate', label: 'Средний' },
  { value: 'advanced', label: 'Продвинутый' },
];

export function NutritionPage() {
  const { profile } = useProfileStore();

  const [goal, setGoal] = useState(normalizeGoal(profile?.goal || GOALS.MASS));
  const [level, setLevel] = useState(profile?.level || 'intermediate');
  const [budget, setBudget] = useState('medium');
  const [openAdditive, setOpenAdditive] = useState<string | null>(null);

  const weight = profile?.weightKg || 0;
  const age = profile?.age || 0;
  const gender = profile?.gender || 'male';

  const bmr = useMemo(() => {
    if (!age || !profile?.heightCm || !weight) return 0;
    const b = 10 * weight + 6.25 * profile.heightCm - 5 * age + (gender === 'male' ? 5 : -161);
    return Math.max(0, Math.round(b));
  }, [age, profile?.heightCm, weight, gender]);

  const factor = { sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725, athlete: 1.9 }[profile?.activityLevel || 'moderate'] || 1.2;
  const tdee = bmr ? Math.round(bmr * factor) : 0;
  const calories = caloriesFor(tdee, goal, gender);
  const protein = Math.round(weight * proteinPerKg(goal));
  const fats = Math.round(weight * fatsPerKg(goal));
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fats * 9) / 4));

  const additives: Additive[] = useMemo(
    () => additivesForProfile({ goal, level, budget, weightKg: weight, age, gender }),
    [goal, level, budget, weight, age, gender]
  );

  return (
    <div className="max-w-3xl mx-auto space-y-5 w-full max-w-full">
      <div>
        <h1 className="text-2xl font-bold text-[var(--p-labels-text)]">Питание</h1>
        <p className="text-[var(--color-text-secondary)] text-sm">Калории, макросы и спортпит под твою цель</p>
      </div>

      {/* КБЖУ */}
      <div className="bg-[var(--p-labels)] rounded-xl border border-[var(--p-outline)] p-5">
        <h2 className="font-semibold text-[var(--p-labels-text)] mb-4 flex items-center gap-2">
          <Apple className="w-5 h-5 text-[var(--p-labels-text)]" /> Калории и БЖУ
        </h2>

        {!profile ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            Заполни профиль — посчитаем калорийность под тебя.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Big label="Базовый обмен" value={bmr ? `${bmr}` : '—'} unit="ккал" />
              <Big label="С учётом активности" value={tdee ? `${tdee}` : '—'} unit="ккал" />
              <Big label="Норма" value={calories ? `${calories}` : '—'} unit="ккал" accent />
              <Big label="ИМТ" value={bmi(profile.heightCm, weight) || '—'} unit="" />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <Macro label="Белок" value={`${protein} г`} hint={`${proteinPerKg(goal)} г/кг`} color="bg-[#C0392B]" />
              <Macro label="Жиры" value={`${fats} г`} hint={`${fatsPerKg(goal)} г/кг`} color="bg-[#C0392B]" />
              <Macro label="Углеводы" value={`${carbs} г`} hint="остаток" color="bg-[#C0392B]" />
            </div>

            <div className="mt-4 h-2.5 bg-[var(--color-bg)] rounded-full overflow-hidden flex">
              {calories > 0 && (
                <>
                  <div className="bg-red-500" style={{ width: `${(protein * 4 / calories) * 100}%` }} />
                  <div className="bg-amber-500" style={{ width: `${(fats * 9 / calories) * 100}%` }} />
                  <div className="bg-blue-500" style={{ width: `${(carbs * 4 / calories) * 100}%` }} />
                </>
              )}
            </div>
            <div className="flex justify-between text-xs text-[var(--color-text-secondary)] mt-1">
              <span>Б {protein * 4} ккал</span>
              <span>Ж {fats * 9} ккал</span>
              <span>У {carbs * 4} ккал</span>
            </div>
          </>
        )}
      </div>

      {/* Цель */}
      <div className="bg-[var(--p-labels)] rounded-xl border border-[var(--p-outline)] p-5">
        <h2 className="font-semibold text-[var(--p-labels-text)] mb-3 flex items-center gap-2">
          <Target className="w-5 h-5 text-[var(--p-labels-text)]" /> Цель
        </h2>
        <div className="flex flex-wrap gap-2">
          {GOALS_ALL.map(g => (
            <button key={g} onClick={() => setGoal(g)}
              className={clsx('px-3 py-1.5 rounded-lg border text-sm transition-colors',
                goal === g
                  ? 'border-[var(--p-circle)] bg-[var(--p-circle)]/20 text-[var(--p-outline)]'
                  : 'border-[var(--p-outline)] text-[var(--color-text-secondary)] hover:border-[var(--p-outline)]')}>
              {GOAL_LABELS[g]}
            </button>
          ))}
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] mt-2">{GOAL_DESCRIPTIONS[goal]}</p>
      </div>

      {/* Спортпит */}
      <div className="bg-[var(--p-labels)] rounded-xl border border-[var(--p-outline)] p-5">
        <h2 className="font-semibold text-[var(--p-labels-text)] mb-1 flex items-center gap-2">
          <Pill className="w-5 h-5 text-[var(--p-labels-text)]" /> Спортпит
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          Подбор добавок под цель, уровень и бюджет
        </p>

        <div className="space-y-3 mb-5">
          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-1.5">Уровень</label>
            <div className="flex gap-2">
              {LEVELS.map(l => (
                <button key={l.value} onClick={() => setLevel(l.value)}
                  className={clsx('flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                    level === l.value ? 'bg-[var(--p-circle)] text-[#000000]' : 'bg-[var(--color-bg)] text-[var(--color-text-secondary)]')}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-1.5">Бюджет</label>
            <div className="flex gap-2">
              {BUDGETS.map(b => (
                <button key={b.value} onClick={() => setBudget(b.value)}
                  className={clsx('flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                    budget === b.value ? 'bg-[var(--p-circle)] text-[#000000]' : 'bg-[var(--color-bg)] text-[var(--color-text-secondary)]')}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {profile && (
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            Твой профиль: {weight} кг · {age} лет · {GOAL_LABELS[goal]} — {calories} ккал/сутки, белок ~{protein} г
          </p>
        )}

        <div className="space-y-3">
          {additives.map(a => (
            <div key={a.key} className="border border-[var(--p-outline)] rounded-xl overflow-hidden">
              <button onClick={() => setOpenAdditive(openAdditive === a.key ? null : a.key)}
                className="w-full p-4 text-left hover:bg-black/5 transition-colors flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-[var(--p-labels-text)]">{a.name}</h3>
                  <p className="text-sm text-[var(--p-labels-text)] font-medium">{a.dose}</p>
                </div>
                {openAdditive === a.key ? <ChevronUp className="w-5 h-5 text-[var(--color-text-secondary)] flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-[var(--color-text-secondary)] flex-shrink-0" />}
              </button>
              {openAdditive === a.key && (
                <div className="px-4 pb-4 border-t border-[var(--p-outline)]">
                  <p className="text-sm text-[var(--color-text-secondary)] py-3">{a.why}</p>
                  {a.products.length > 0 && (
                    <>
                      <h4 className="text-sm font-medium text-[var(--p-labels-text)] mb-2">Где взять</h4>
                      <div className="space-y-2">
                        {a.products.map(prod => (
                          <div key={prod.name} className="flex items-center justify-between gap-3 p-2.5 bg-[var(--color-bg)] rounded-lg">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-[var(--p-labels-text)] truncate">
                                {prod.name}
                                {prod.best && <span className="ml-1.5 px-1.5 py-0.5 bg-[var(--p-circle)]/20 text-[var(--p-outline)] rounded text-[10px]">топ</span>}
                              </div>
                              <div className="text-xs text-[var(--color-text-secondary)]">{prod.format}</div>
                            </div>
                            <div className="text-sm font-mono text-[var(--color-text-secondary)] flex-shrink-0">{prod.price}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="text-xs text-[var(--color-text-secondary)] mt-4 flex items-start gap-1.5">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          Это список возможных добавок, а не назначение. Перед приёмом любой добавки
          стоит сдать анализы и посоветоваться с врачом.
        </p>
      </div>
    </div>
  );
}

function bmi(heightCm: number, weightKg: number): string {
  if (!heightCm || !weightKg) return '';
  const h = heightCm / 100;
  return (weightKg / (h * h)).toFixed(1);
}

function Big({ label, value, unit, accent }: { label: string; value: string; unit: string; accent?: boolean }) {
  return (
    <div className="p-3 bg-[var(--color-bg)] rounded-lg text-center">
      <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
      <p className={clsx('text-2xl font-bold', accent ? 'text-[var(--p-labels-text)]' : 'text-[var(--p-labels-text)]')}>
        {value}
      </p>
      {unit && <p className="text-[10px] text-[var(--color-text-secondary)]">{unit}</p>}
    </div>
  );
}

function Macro({ label, value, hint, color }: { label: string; value: string; hint: string; color: string }) {
  return (
    <div className="p-3 bg-[var(--color-bg)] rounded-lg">
      <div className="flex items-center gap-1.5 mb-1">
        <div className={clsx('w-2 h-2 rounded-full', color)} />
        <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>
      </div>
      <p className="font-bold text-[var(--p-labels-text)]">{value}</p>
      <p className="text-[10px] text-[var(--color-text-secondary)]">{hint}</p>
    </div>
  );
}
