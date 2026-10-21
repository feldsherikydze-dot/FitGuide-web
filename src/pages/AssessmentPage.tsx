// FitGuide Web — Оценка / Онбординг (порт AssessmentActivity)

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check, X, AlertCircle, Info, Save, RotateCcw, Dumbbell, Target, TrendingUp } from 'lucide-react';
import { clsx } from 'clsx';
import { useCoachStore, useProfileStore, useProgramsStore } from '../core/store';
import { generateProgram, calculate1RM } from '../core/generator';
import { useExercises } from '../hooks/useExercises';
import type { Assessment, TestResult, Program, GeneratorInput } from '../data/types';

const STEPS = [
  { id: 'measure', label: 'Замеры', icon: Target },
  { id: 'skin', label: 'Складки', icon: Target },
  { id: 'move', label: 'Движения', icon: Dumbbell },
  { id: 'test', label: 'Силовые тесты', icon: Dumbbell },
  { id: 'amrap', label: 'AMRAP', icon: Target },
  { id: 'pain', label: 'Боль/ММК/Техника', icon: AlertCircle },
  { id: 'summary', label: 'Итог', icon: TrendingUp },
] as const;

type StepId = typeof STEPS[number]['id'];

interface AssessmentForm {
  // Measure
  weight: number;
  height: number;
  age: number;
  gender: 'male' | 'female';
  bodyFat: number;
  measurements: Record<string, number>;
  // Skinfolds
  skinfolds: Record<string, number>;
  // Movement
  movements: number[];
  // Test
  tests: TestResult[];
  // AMRAP
  amrap: number[];
  // Pain/MMC/Tech
  pain: number;
  mmc: number;
  tech: number;
}

const MOVEMENT_NAMES = [
  'Присед', 'Жим лёжа', 'Становая', 'Подтягивание',
  'Жим стоя', 'Выпад', 'Планка', 'Скручивание',
];

const TEST_EXERCISES = [
  { id: 'bench', name: 'Жим лёжа', reps: 5 },
  { id: 'squat', name: 'Присед со штангой', reps: 5 },
  { id: 'deadlift', name: 'Становая тяга', reps: 5 },
  { id: 'press', name: 'Жим стоя', reps: 5 },
  { id: 'pullup', name: 'Подтягивания', reps: 10 },
  { id: 'row', name: 'Тяга в наклоне', reps: 8 },
  { id: 'lunge', name: 'Выпады с гантелями', reps: 10 },
  { id: 'dip', name: 'Отжимания на брусьях', reps: 10 },
];

const SKINFOLD_SITES = [
  { key: 'triceps', label: 'Трицепс' },
  { key: 'biceps', label: 'Бицепс' },
  { key: 'subscapular', label: 'Подлопаточный' },
  { key: 'suprailiac', label: 'Надвздошный' },
  { key: 'abdominal', label: 'Живот' },
  { key: 'thigh', label: 'Бедро' },
  { key: 'calf', label: 'Икра' },
];

const MEASUREMENT_SITES = [
  { key: 'neck', label: 'Шея' },
  { key: 'shoulders', label: 'Плечи' },
  { key: 'chest', label: 'Грудь' },
  { key: 'waist', label: 'Талия' },
  { key: 'hips', label: 'Бёдра' },
  { key: 'arm_left', label: 'Левая рука' },
  { key: 'arm_right', label: 'Правая рука' },
  { key: 'thigh_left', label: 'Левое бедро' },
  { key: 'thigh_right', label: 'Правое бедро' },
  { key: 'calf_left', label: 'Левая икра' },
  { key: 'calf_right', label: 'Правая икра' },
];

export function AssessmentPage() {
  const navigate = useNavigate();
  const { profile, setProfile } = useProfileStore();
  const { add, save: savePrograms } = useProgramsStore();
  const { resetCoach, setActiveProgram, setCoachPath, setCoachProgram } = useCoachStore();
  const { db, loading: exercisesLoading } = useExercises();

  const [currentStep, setCurrentStep] = useState<StepId>('measure');
  const [stepHistory, setStepHistory] = useState<StepId[]>(['measure']);
  const [isCheckpoint, setIsCheckpoint] = useState(false);
  const [form, setForm] = useState<AssessmentForm>({
    weight: profile?.weight || 0,
    height: profile?.height || 0,
    age: profile?.birthDate ? Math.floor((Date.now() - new Date(profile.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 0,
    gender: profile?.gender || 'male',
    bodyFat: 0,
    measurements: {},
    skinfolds: {},
    movements: Array(8).fill(1),
    tests: TEST_EXERCISES.map(t => ({ exercise: t.name, weight: 0, reps: t.reps })),
    amrap: Array(8).fill(0),
    pain: 0,
    mmc: 3,
    tech: 3,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Prefill from profile
  useEffect(() => {
    if (profile) {
      setForm(f => ({ ...f, weight: profile.weight, height: profile.height, gender: profile.gender }));
    }
  }, [profile]);

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);
  const canGoBack = stepHistory.length > 1;
  const canGoNext = validateCurrentStep();

  const goBack = () => {
    if (canGoBack) {
      const prev = stepHistory[stepHistory.length - 2];
      setStepHistory(h => h.slice(0, -1));
      setCurrentStep(prev);
    }
  };

  const goNext = () => {
    if (!canGoNext) return;
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      const next = STEPS[nextIndex].id;
      setStepHistory(h => [...h, next]);
      setCurrentStep(next);
    }
  };

  const finish = async () => {
    if (!validateAll()) return;

    // Calculate e1RM for each test
    const e1rm: Record<string, number> = {};
    form.tests.forEach(t => {
      if (t.weight > 0 && t.reps > 0) {
        e1rm[t.exercise] = calculate1RM(t.weight, t.reps);
      }
    });

    // Create assessment record
    const assessment: Assessment = {
      id: crypto.randomUUID(),
      date: Date.now(),
      weight: form.weight,
      height: form.height,
      age: form.age,
      gender: form.gender,
      bodyFat: form.bodyFat || undefined,
      measurements: form.measurements,
      skinfolds: form.skinfolds,
      movements: form.movements,
      tests: form.tests,
      amrap: form.amrap,
      pain: form.pain,
      mmc: form.mmc,
      tech: form.tech,
      e1rm,
    };

    // Save assessment to coach store
    const coach = useCoachStore.getState();
    // TODO: save assessment to storage

    // Update profile
    setProfile({
      ...profile!,
      weight: form.weight,
      height: form.height,
      birthDate: new Date(Date.now() - form.age * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      gender: form.gender,
    });

    // Generate program if not checkpoint
    if (!isCheckpoint && db) {
      const genInput: GeneratorInput = {
        goals: ['hypertrophy'],
        level: 'beginner',
        direction: 'any',
        type: 'auto',
        daysPerWeek: 3,
        weeks: 12,
        periodization: 'linear',
        location: 'gym',
        age: form.age,
        gender: form.gender,
        equipment: ['barbell', 'dumbbell', 'cable', 'machine'],
      };

      const program = generateProgram(genInput, db);

      // Set start weights from e1RM
      program.phases.forEach(phase => {
        phase.days.forEach(day => {
          day.slots.forEach(slot => {
            const e1rmVal = e1rm[slot.exercise];
            if (e1rmVal && e1rmVal > 0) {
              slot.startWeight = Math.round(e1rmVal * 0.85 * 2) / 2;
            }
          });
        });
      });

      add(program);
      setActiveProgram(program.id);
      setCoachPath('coach');
      setCoachProgram(program.id);

      // Set initial weights in coach store
      useCoachStore.getState().resetCoach();
      // TODO: set initial weights from program
    }

    navigate('/coach');
  };

  function validateCurrentStep(): boolean {
    switch (currentStep) {
      case 'measure':
        return form.weight > 0 && form.height > 0 && form.age > 0;
      case 'skin':
        return true; // optional
      case 'move':
        return true;
      case 'test':
        return form.tests.some(t => t.weight > 0 && t.reps > 0);
      case 'amrap':
        return true;
      case 'pain':
        return form.pain >= 0 && form.pain <= 10 && form.mmc >= 1 && form.mmc <= 5 && form.tech >= 1 && form.tech <= 5;
      case 'summary':
        return true;
      default:
        return true;
    }
  }

  function validateAll(): boolean {
    return STEPS.every(s => {
      setCurrentStep(s.id);
      return validateCurrentStep();
    });
  }

  const updateField = useCallback((path: string, value: any) => {
    setForm(f => {
      const next = { ...f };
      const keys = path.split('.');
      let obj: any = next;
      for (let i = 0; i < keys.length - 1; i++) {
        obj[keys[i]] = { ...obj[keys[i]] };
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return next;
    });
    setErrors(e => ({ ...e, [path]: '' }));
  }, []);

  // Step components
  const renderStep = () => {
    switch (currentStep) {
      case 'measure':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Основные параметры</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                type="number" step="0.1" min="30" max="300"
                placeholder="Вес (кг)"
                value={form.weight}
                onChange={e => updateField('weight', parseFloat(e.target.value) || 0)}
                className="px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg"
              />
              <input
                type="number" step="1" min="100" max="250"
                placeholder="Рост (см)"
                value={form.height}
                onChange={e => updateField('height', parseInt(e.target.value) || 0)}
                className="px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg"
              />
              <input
                type="number" min="14" max="100"
                placeholder="Возраст"
                value={form.age}
                onChange={e => updateField('age', parseInt(e.target.value) || 0)}
                className="px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg"
              />
              <select
                value={form.gender}
                onChange={e => updateField('gender', e.target.value as 'male' | 'female')}
                className="px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg"
              >
                <option value="male">Мужской</option>
                <option value="female">Женский</option>
              </select>
            </div>

            <h3 className="text-lg font-semibold mt-6">Обхваты (см) — опционально</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {MEASUREMENT_SITES.map(site => (
                <div key={site.key} className="flex items-center gap-2">
                  <label className="w-24 text-sm text-slate-600 dark:text-slate-400">{site.label}</label>
                  <input
                    type="number" step="0.1" min="0" max="300"
                    value={form.measurements[site.key] || 0}
                    onChange={e => updateField(`measurements.${site.key}`, parseFloat(e.target.value) || 0)}
                    className="flex-1 px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-center"
                  />
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-dark-border">
              <h4 className="font-medium mb-2">Процент жира (опционально)</h4>
              <input
                type="number" step="0.1" min="3" max="50"
                placeholder="Например: 18.5"
                value={form.bodyFat}
                onChange={e => updateField('bodyFat', parseFloat(e.target.value) || 0)}
                className="w-32 px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-center"
              />
            </div>
          </div>
        );

      case 'skin':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Складки (мм) — для расчёта % жира</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Замеряй калипером в 3 приёма, вводи среднее</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {SKINFOLD_SITES.map(site => (
                <div key={site.key} className="flex items-center gap-2">
                  <label className="w-32 text-sm text-slate-600 dark:text-slate-400">{site.label}</label>
                  <input
                    type="number" step="0.1" min="0" max="80"
                    value={form.skinfolds[site.key] || 0}
                    onChange={e => updateField(`skinfolds.${site.key}`, parseFloat(e.target.value) || 0)}
                    className="flex-1 px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-center"
                  />
                </div>
              ))}
            </div>
          </div>
        );

      case 'move':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Тесты движений</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Оцени выполнение: 0 — не могу, 1 — с ошибками, 2 — чисто</p>
            <div className="space-y-3">
              {MOVEMENT_NAMES.map((name, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-dark-bg/50 rounded-lg">
                  <span className="font-medium">{name}</span>
                  <div className="flex gap-2">
                    {[0, 1, 2].map(v => (
                      <button
                        key={v}
                        onClick={() => updateField(`movements.${i}`, v)}
                        className={clsx(
                          'w-10 h-10 rounded-lg font-medium text-sm transition-colors',
                          form.movements[i] === v
                            ? (v === 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                               v === 1 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                               'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400')
                            : 'bg-white dark:bg-dark-bg border border-slate-200 dark:border-dark-border'
                        )}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'test':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Силовые тесты (5 повторений)</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Введи рабочий вес за 5 чистых повторений. Пусто = не тестировал.</p>
            <div className="space-y-3">
              {form.tests.map((test, i) => (
                <div key={i} className="grid gap-3 sm:grid-cols-3 items-center">
                  <label className="font-medium text-slate-900 dark:text-white">{test.exercise}</label>
                  <input
                    type="number" step="0.5" min="0" max="500"
                    placeholder="Вес (кг)"
                    value={test.weight}
                    onChange={e => updateField(`tests.${i}.weight`, parseFloat(e.target.value) || 0)}
                    className="px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-center"
                  />
                  <input
                    type="number" min="1" max="20"
                    placeholder="Повторы"
                    value={test.reps}
                    onChange={e => updateField(`tests.${i}.reps`, parseInt(e.target.value) || 0)}
                    className="px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-center"
                  />
                </div>
              ))}
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm">
              <strong>e1RM превью:</strong>
              {form.tests.map(t => {
                if (t.weight > 0 && t.reps > 0) {
                  const e1rm = calculate1RM(t.weight, t.reps);
                  return <div key={t.exercise} className="flex justify-between"><span>{t.exercise}</span><strong>{e1rm} кг</strong></div>;
                }
                return null;
              })}
            </div>
          </div>
        );

      case 'amrap':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">AMRAP (макс повторений с весом тела)</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Сколько раз можешь сделать за один подход</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {MOVEMENT_NAMES.map((name, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-dark-bg/50 rounded-lg">
                  <span>{name}</span>
                  <input
                    type="number" min="0" max="100"
                    value={form.amrap[i]}
                    onChange={e => updateField(`amrap.${i}`, parseInt(e.target.value) || 0)}
                    className="w-20 px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-center"
                  />
                </div>
              ))}
            </div>
          </div>
        );

      case 'pain':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold">Боль (0-10)</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">0 — нет боли, 10 — невыносимо</p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {Array.from({ length: 11 }, (_, i) => i).map(v => (
                  <button
                    key={v}
                    onClick={() => updateField('pain', v)}
                    className={clsx(
                      'w-10 h-10 rounded-lg flex-shrink-0 font-medium transition-colors',
                      form.pain === v
                        ? (v <= 2 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                           v <= 5 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                           'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400')
                        : 'bg-white dark:bg-dark-bg border border-slate-200 dark:border-dark-border'
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold">MMC (мышечно-умственная связь) 1-5</h3>
              <div className="flex gap-2">
                {[1,2,3,4,5].map(v => (
                  <button
                    key={v}
                    onClick={() => updateField('mmc', v)}
                    className={clsx(
                      'w-12 h-12 rounded-lg font-bold transition-colors',
                      form.mmc === v ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' : 'bg-white dark:bg-dark-bg border border-slate-200 dark:border-dark-border'
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold">Техника 1-5</h3>
              <div className="flex gap-2">
                {[1,2,3,4,5].map(v => (
                  <button
                    key={v}
                    onClick={() => updateField('tech', v)}
                    className={clsx(
                      'w-12 h-12 rounded-lg font-bold transition-colors',
                      form.tech === v ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' : 'bg-white dark:bg-dark-bg border border-slate-200 dark:border-dark-border'
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 'summary':
        const e1rmSummary = form.tests
          .filter(t => t.weight > 0 && t.reps > 0)
          .map(t => ({ exercise: t.exercise, e1rm: calculate1RM(t.weight, t.reps) }));

        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Результаты калибровки</h3>

            {e1rmSummary.length > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <h4 className="font-medium text-green-800 dark:text-green-300 mb-3">Расчётные e1RM:</h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  {e1rmSummary.map(r => (
                    <div key={r.exercise} className="flex justify-between p-2 bg-white dark:bg-dark-bg rounded">
                      <span>{r.exercise}</span>
                      <strong>{r.e1rm} кг</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">Что будет дальше:</h4>
              <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                <li>• Создастся индивидуальная программа на 12 недель</li>
                <li>• Стартовые веса = 85% от твоих e1RM</li>
                <li>• Тренер будет вести прогрессию и давать разгрузки</li>
                <li>• Каждые 28 дней — чекпоинт с повторными замерами</li>
              </ul>
            </div>

            <button
              onClick={finish}
              disabled={exercisesLoading}
              className="w-full py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50"
            >
              {isCheckpoint ? 'Сохранить чекпоинт' : 'Создать программу и начать'}
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Оценка физической подготовки</h1>
        {isCheckpoint && <span className="px-2 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded text-sm">Чекпоинт</span>}
      </div>

      {/* Progress steps */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-4">
        <div className="flex items-center justify-between">
          {STEPS.map((step, i) => (
            <div key={step.id} className="flex flex-col items-center relative">
              <div className={clsx(
                'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                i < currentStepIndex ? 'bg-primary-600 text-white' :
                i === currentStepIndex ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 ring-2 ring-primary-500' :
                'bg-slate-100 text-slate-400 dark:bg-dark-border dark:text-slate-500'
              )}>
                {i < currentStepIndex ? <Check className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 text-center w-20 truncate">{step.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-6">
        {renderStep()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={goBack}
          disabled={!canGoBack}
          className="px-4 py-2 border border-slate-200 dark:border-dark-border rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-border disabled:opacity-50 flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Назад
        </button>
        <button
          onClick={goNext}
          disabled={!canGoNext || currentStep === 'summary'}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
        >
          Далее
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}