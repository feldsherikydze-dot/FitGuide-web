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
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Питание</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Калории, макросы и спортпит под твою цель</p>
      </div>

      {/* КБЖУ */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-5">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Apple className="w-5 h-5 text-primary-600" /> Калории и БЖУ
        </h2>

        {!profile ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
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
              <Macro label="Белок" value={`${protein} г`} hint={`${proteinPerKg(goal)} г/кг`} color="bg-red-500" />
              <Macro label="Жиры" value={`${fats} г`} hint={`${fatsPerKg(goal)} г/кг`} color="bg-amber-500" />
              <Macro label="Углеводы" value={`${carbs} г`} hint="остаток" color="bg-blue-500" />
            </div>

            <div className="mt-4 h-2.5 bg-slate-200 dark:bg-dark-border rounded-full overflow-hidden flex">
              {calories > 0 && (
                <>
                  <div className="bg-red-500" style={{ width: `${(protein * 4 / calories) * 100}%` }} />
                  <div className="bg-amber-500" style={{ width: `${(fats * 9 / calories) * 100}%` }} />
                  <div className="bg-blue-500" style={{ width: `${(carbs * 4 / calories) * 100}%` }} />
                </>
              )}
            </div>
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
              <span>Б {protein * 4} ккал</span>
              <span>Ж {fats * 9} ккал</span>
              <span>У {carbs * 4} ккал</span>
            </div>
          </>
        )}
      </div>

      {/* Цель */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-5">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <Target className="w-5 h-5 text-primary-600" /> Цель
        </h2>
        <div className="flex flex-wrap gap-2">
          {GOALS_ALL.map(g => (
            <button key={g} onClick={() => setGoal(g)}
              className={clsx('px-3 py-1.5 rounded-lg border text-sm transition-colors',
                goal === g
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'border-slate-200 dark:border-dark-border text-slate-600 dark:text-slate-400 hover:border-primary-300')}>
              {GOAL_LABELS[g]}
            </button>
          ))}
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{GOAL_DESCRIPTIONS[goal]}</p>
      </div>

      {/* Спортпит */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-5">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
          <Pill className="w-5 h-5 text-primary-600" /> Спортпит
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Подбор добавок под цель, уровень и бюджет
        </p>

        <div className="space-y-3 mb-5">
          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1.5">Уровень</label>
            <div className="flex gap-2">
              {LEVELS.map(l => (
                <button key={l.value} onClick={() => setLevel(l.value)}
                  className={clsx('flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                    level === l.value ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-dark-border text-slate-600 dark:text-slate-400')}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1.5">Бюджет</label>
            <div className="flex gap-2">
              {BUDGETS.map(b => (
                <button key={b.value} onClick={() => setBudget(b.value)}
                  className={clsx('flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                    budget === b.value ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-dark-border text-slate-600 dark:text-slate-400')}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {profile && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Твой профиль: {weight} кг · {age} лет · {GOAL_LABELS[goal]} — {calories} ккал/сутки, белок ~{protein} г
          </p>
        )}

        <div className="space-y-3">
          {additives.map(a => (
            <div key={a.key} className="border border-slate-200 dark:border-dark-border rounded-xl overflow-hidden">
              <button onClick={() => setOpenAdditive(openAdditive === a.key ? null : a.key)}
                className="w-full p-4 text-left hover:bg-slate-50 dark:hover:bg-dark-border/50 transition-colors flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900 dark:text-white">{a.name}</h3>
                  <p className="text-sm text-primary-600 dark:text-primary-400 font-medium">{a.dose}</p>
                </div>
                {openAdditive === a.key ? <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />}
              </button>
              {openAdditive === a.key && (
                <div className="px-4 pb-4 border-t border-slate-200 dark:border-dark-border">
                  <p className="text-sm text-slate-600 dark:text-slate-400 py-3">{a.why}</p>
                  {a.products.length > 0 && (
                    <>
                      <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">Где взять</h4>
                      <div className="space-y-2">
                        {a.products.map(prod => (
                          <div key={prod.name} className="flex items-center justify-between gap-3 p-2.5 bg-slate-50 dark:bg-dark-bg/50 rounded-lg">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                {prod.name}
                                {prod.best && <span className="ml-1.5 px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-[10px]">топ</span>}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">{prod.format}</div>
                            </div>
                            <div className="text-sm font-mono text-slate-600 dark:text-slate-400 flex-shrink-0">{prod.price}</div>
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

        <p className="text-xs text-slate-400 dark:text-slate-500 mt-4 flex items-start gap-1.5">
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
    <div className="p-3 bg-slate-50 dark:bg-dark-bg/50 rounded-lg text-center">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={clsx('text-2xl font-bold', accent ? 'text-primary-600 dark:text-primary-400' : 'text-slate-900 dark:text-white')}>
        {value}
      </p>
      {unit && <p className="text-[10px] text-slate-400 dark:text-slate-500">{unit}</p>}
    </div>
  );
}

function Macro({ label, value, hint, color }: { label: string; value: string; hint: string; color: string }) {
  return (
    <div className="p-3 bg-slate-50 dark:bg-dark-bg/50 rounded-lg">
      <div className="flex items-center gap-1.5 mb-1">
        <div className={clsx('w-2 h-2 rounded-full', color)} />
        <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <p className="font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-[10px] text-slate-400 dark:text-slate-500">{hint}</p>
    </div>
  );
}
