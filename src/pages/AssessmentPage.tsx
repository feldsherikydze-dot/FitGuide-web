// FitGuide Web — замеры и калибровка (порт AssessmentActivity.java)
//
// Тренер не может вести вслепую: сначала точка отсчёта (вес, объёмы, складки),
// проверка движений и калибровочная силовая (вес × повторы → e1RM и стартовые
// веса). Дальше — чекпоинты каждые 28 дней с динамикой.

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  ChevronLeft, ChevronRight, Check, X, AlertCircle, Info, Dumbbell, Target,
  TrendingUp, Ruler, HeartPulse, Save, RotateCcw, Sparkles,
} from 'lucide-react';
import { useProfileStore, useCoachStore, useProgramsStore, useAssessmentStore, useOneRmStore } from '../core/store';
import { useExercises } from '../hooks/useExercises';
import {
  epley, brzycki, safeE1rm, startWeight, fillBodyComp, fillStartWeights,
  movementOf, MOVEMENT_NAMES,
} from '../core/assessment';
import { fillFromSessions } from '../core/checkpoint';
import { generateProgram, buildProgramName, PERIOD_LINEAR } from '../core/generator';
import { GOALS, recommendDays } from '../core/goals';
import { MOV } from '../data/types';
import type { Assessment, Program } from '../data/types';

const STEPS = [
  { id: 'measure', label: 'Замеры', icon: Ruler },
  { id: 'skin', label: 'Складки', icon: Ruler },
  { id: 'move', label: 'Движения', icon: Target },
  { id: 'test', label: 'Силовые тесты', icon: Dumbbell },
  { id: 'amrap', label: 'AMRAP', icon: HeartPulse },
  { id: 'pain', label: 'Боль/ММК/Техника', icon: AlertCircle },
  { id: 'summary', label: 'Итог', icon: TrendingUp },
] as const;

type StepId = typeof STEPS[number]['id'];

/** Обхваты: ключ → подпись. */
const MEASURE_SITES = [
  { key: 'neckCm', label: 'Шея' },
  { key: 'chestCm', label: 'Грудь' },
  { key: 'waistCm', label: 'Талия' },
  { key: 'hipsCm', label: 'Бёдра' },
  { key: 'armCm', label: 'Бицепс' },
  { key: 'thighCm', label: 'Бедро' },
  { key: 'calfCm', label: 'Икра' },
] as const;

/** Складки (7 точек для мужчин, 3 — для женщин). */
const SKIN_SITES = [
  { key: 'skinfoldChest', label: 'Грудь', male: true },
  { key: 'skinfoldMidaxillary', label: 'Подмышечная', male: true },
  { key: 'skinfoldTriceps', label: 'Трицепс', male: true },
  { key: 'skinfoldSubscapular', label: 'Подлопаточная', male: true },
  { key: 'skinfoldAbdominal', label: 'Живот', male: true },
  { key: 'skinfoldSuprailiac', label: 'Надподвздошная', male: false },
  { key: 'skinfoldThigh', label: 'Бедро', male: false },
] as const;

/** Тестовые движения: название → индекс в калибровке. */
const TEST_MOVEMENTS: { label: string; idx: number; reps: number }[] = [
  { label: 'Присед', idx: MOV.SQUAT, reps: 5 },
  { label: 'Жим лёжа', idx: MOV.BENCH, reps: 5 },
  { label: 'Становая', idx: MOV.DEAD, reps: 5 },
  { label: 'Жим стоя', idx: MOV.OHP, reps: 5 },
  { label: 'Тяга в наклоне', idx: MOV.ROW, reps: 8 },
  { label: 'Подтягивания', idx: MOV.PULLUP, reps: 10 },
  { label: 'Жим ногами', idx: MOV.LEGPRESS, reps: 10 },
  { label: 'Ягодичный мост', idx: MOV.HIP, reps: 10 },
];

const AMRAP_MOVEMENTS = [
  'Присед с собственным весом',
  'Отжимания',
  'Выпады',
  'Планка (секунды)',
  'Скручивания',
  'Ягодичный мост',
  'Подъём на носки',
  '«Салон» — лодочка',
];

export function AssessmentPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const isCheckpoint = params.get('checkpoint') === '1';

  const { profile, setProfile } = useProfileStore();
  const coach = useCoachStore();
  const { add, programs, save: savePrograms } = useProgramsStore();
  const { addAssessment, current: lastAssessment } = useAssessmentStore();
  const oneRm = useOneRmStore();
  const { db } = useExercises();

  const [step, setStep] = useState<StepId>('measure');
  const [history, setHistory] = useState<StepId[]>(['measure']);

  const [form, setForm] = useState(() => ({
    weightKg: profile?.weightKg || 0,
    heightCm: profile?.heightCm || 0,
    age: profile?.age || 0,
    female: profile?.gender === 'female',
    neckCm: 0, chestCm: 0, waistCm: 0, hipsCm: 0, armCm: 0, thighCm: 0, calfCm: 0,
    skinfoldChest: 0, skinfoldMidaxillary: 0, skinfoldTriceps: 0, skinfoldSubscapular: 0,
    skinfoldAbdominal: 0, skinfoldSuprailiac: 0, skinfoldThigh: 0,
    testWeights: Array(8).fill(0) as number[],
    testReps: Array(8).fill(5) as number[],
    movementScores: Array(8).fill(1) as number[],
    amrap: Array(8).fill(0) as number[],
    pain: 0, mmc: 3, tech: 3,
  }));

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  // Чекпоинт: веса и повторы подставляются из фактических тренировок.
  useEffect(() => {
    if (!isCheckpoint) return;
    const weights = Array(8).fill(0);
    const reps = Array(8).fill(5);
    fillFromSessions(coach.sessions, weights, reps);
    setForm(f => ({
      ...f,
      testWeights: weights.map((w, i) => (w > 0 ? w : f.testWeights[i])),
      testReps: reps.map((r, i) => (r > 0 ? r : f.testReps[i])),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCheckpoint]);

  // e1RM по каждому тесту
  const e1rms = useMemo(() =>
    form.testWeights.map((w, i) => (w > 0 && form.testReps[i] > 0 ? safeE1rm(w, form.testReps[i]) : 0)),
    [form.testWeights, form.testReps]);

  const bodyComp = useMemo(() => {
    const a = makeAssessment(form, e1rms);
    fillBodyComp(a, form.age, form.female);
    return a;
  }, [form, e1rms]);

  const canNext = useMemo(() => {
    switch (step) {
      case 'measure': return form.weightKg > 0 && form.heightCm > 0 && form.age > 0;
      case 'test': return e1rms.some(v => v > 0);
      case 'summary': return true;
      default: return true;
    }
  }, [step, form, e1rms]);

  const goNext = () => {
    if (!canNext) return;
    const i = STEPS.findIndex(s => s.id === step);
    if (i < STEPS.length - 1) {
      const next = STEPS[i + 1].id;
      setHistory(h => [...h, next]);
      setStep(next);
    }
  };

  const goBack = () => {
    if (history.length > 1) {
      const prev = history[history.length - 2];
      setHistory(h => h.slice(0, -1));
      setStep(prev);
    }
  };

  const finish = () => {
    const a = makeAssessment(form, e1rms);
    fillBodyComp(a, form.age, form.female);
    fillStartWeights(a);
    a.timestamp = Date.now();
    addAssessment(a);

    // 1ПМ — в хранилище рекордов
    const rms: Record<string, number> = {};
    TEST_MOVEMENTS.forEach((m, i) => { if (e1rms[i] > 0) rms[m.label] = e1rms[i]; });
    oneRm.putAll(rms);

    // Профиль
    setProfile({
      ...(profile || {
        name: '', gender: 'male', activityLevel: 'moderate', goal: GOALS.MASS,
        trainStyle: 'any', bodyFatPercent: 0, workoutsPerWeek: 0, bio: '', country: '', city: '',
        level: 'intermediate', equipment: [], place: 'gym',
      }),
      gender: form.female ? 'female' : 'male',
      age: form.age,
      heightCm: form.heightCm,
      weightKg: form.weightKg,
      bodyFatPercent: a.bodyFatPct,
    });

    // Чекпоинт — программу не пересобираем, только обновляем замеры
    if (isCheckpoint) {
      coach.clearProgramUpdated();
      navigate('/coach');
      return;
    }

    // Первая программа — по цели и уровню
    if (db) {
      const goal = profile?.goal || GOALS.MASS;
      const level = profile?.level || 'intermediate';
      const days = profile?.workoutsPerWeek || recommendDays(level, goal);
      const program = generateProgram({
        name: buildProgramName('auto', days, goal),
        goal,
        level,
        daysPerWeek: days,
        weeks: 12,
        place: profile?.place || 'gym',
        style: profile?.trainStyle || 'any',
        periodType: PERIOD_LINEAR,
        type: 'auto',
        equipment: profile?.equipment,
        age: form.age,
        female: form.female,
      }, db);

      // Стартовые веса — из калибровки: 85% e1RM по базовым движениям
      applyStartWeights(program, e1rms);

      add(program);
      coach.setActiveProgram(program.id);
      coach.setCoachPath('coach');
      coach.setCoachProgram(program.id);
    }

    navigate('/coach');
  };

  const stepIndex = STEPS.findIndex(s => s.id === step);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {isCheckpoint ? 'Повторные замеры' : 'Замеры и калибровка'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {isCheckpoint
              ? 'Веса подставлены из тренировок — поправь под сегодняшнее состояние'
              : 'Точка отсчёта: тренер подберёт стартовые веса под твою силу'}
          </p>
        </div>
        {isCheckpoint && (
          <span className="px-2 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 rounded text-sm">
            Чекпоинт
          </span>
        )}
      </div>

      {/* Шаги */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-4">
        <div className="flex items-center justify-between gap-1">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => { if (i <= stepIndex) { setStep(s.id); } }}
              className="flex flex-col items-center gap-1 flex-1 min-w-0"
              disabled={i > stepIndex}
            >
              <div className={clsx(
                'w-9 h-9 rounded-full flex items-center justify-center transition-all',
                i < stepIndex ? 'bg-primary-600 text-white' :
                i === stepIndex ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 ring-2 ring-primary-500' :
                'bg-slate-100 text-slate-400 dark:bg-dark-border dark:text-slate-500'
              )}>
                {i < stepIndex ? <Check className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
              </div>
              <span className={clsx(
                'text-[10px] text-center leading-tight',
                i === stepIndex ? 'text-primary-600 dark:text-primary-400 font-medium' : 'text-slate-400 dark:text-slate-500'
              )}>
                {s.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Содержимое шага */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-5">
        {step === 'measure' && (
          <div className="space-y-5">
            <h2 className="font-semibold text-slate-900 dark:text-white">Основные параметры</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Вес, кг" value={form.weightKg} step="0.1" onChange={v => set('weightKg', v)} />
              <Field label="Рост, см" value={form.heightCm} step="1" onChange={v => set('heightCm', v)} />
              <Field label="Возраст" value={form.age} step="1" onChange={v => set('age', v)} />
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Пол</label>
                <div className="flex gap-2">
                  {[{ v: false, l: 'Мужской' }, { v: true, l: 'Женский' }].map(o => (
                    <button key={o.l} onClick={() => set('female', o.v)}
                      className={clsx('flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                        form.female === o.v ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-dark-border text-slate-600 dark:text-slate-400')}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-slate-900 dark:text-white mb-2">Обхваты, см</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {MEASURE_SITES.map(s => (
                  <Field key={s.key} label={s.label} value={form[s.key]} step="0.5"
                    onChange={v => set(s.key, v)} />
                ))}
              </div>
            </div>

            {bodyComp.bodyFatPct > 0 && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
                <Info className="w-4 h-4 inline mr-1 text-blue-600" />
                Расчётный % жира: <strong>{bodyComp.bodyFatPct}%</strong>
                {bodyComp.leanMassKg > 0 && <> · сухая масса <strong>{bodyComp.leanMassKg} кг</strong></>}
                {bodyComp.ffmi > 0 && <> · FFMI <strong>{bodyComp.ffmi}</strong></>}
              </div>
            )}
          </div>
        )}

        {step === 'skin' && (
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">Складки, мм</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Калипером, 3 замера — вносим среднее. 7 точек для мужчин, 3 для женщин.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {SKIN_SITES.map(s => {
                const disabled = s.male && form.female;
                return (
                  <div key={s.key} className={clsx('flex items-center gap-2', disabled && 'opacity-40')}>
                    <label className="w-32 text-sm text-slate-600 dark:text-slate-400 flex-shrink-0">{s.label}</label>
                    <input
                      type="number" step="0.1" min="0" max="80" disabled={disabled}
                      value={form[s.key]}
                      onChange={e => set(s.key, parseFloat(e.target.value) || 0)}
                      className="flex-1 px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white text-center"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === 'move' && (
          <div className="space-y-3">
            <h2 className="font-semibold text-slate-900 dark:text-white">Проверка движений</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              0 — не могу, 1 — с ошибками, 2 — чисто
            </p>
            {MOVEMENT_NAMES.map((name, i) => (
              <div key={name} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-dark-bg/50 rounded-lg">
                <span className="font-medium text-slate-900 dark:text-white">{name}</span>
                <div className="flex gap-2">
                  {[0, 1, 2].map(v => (
                    <button key={v} onClick={() => {
                      const arr = [...form.movementScores];
                      arr[i] = v;
                      set('movementScores', arr);
                    }}
                      className={clsx('w-10 h-10 rounded-lg font-medium text-sm transition-colors',
                        form.movementScores[i] === v
                          ? (v === 0 ? 'bg-red-500 text-white' : v === 1 ? 'bg-amber-500 text-white' : 'bg-green-500 text-white')
                          : 'bg-white dark:bg-dark-bg border border-slate-200 dark:border-dark-border text-slate-500')}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 'test' && (
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">Силовые тесты</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Рабочий вес и число повторов. Пусто — не тестировал.
              </p>
            </div>
            <div className="space-y-2">
              {TEST_MOVEMENTS.map((m, i) => (
                <div key={m.idx} className="grid grid-cols-[1fr_90px_70px] gap-2 items-center">
                  <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{m.label}</span>
                  <input
                    type="number" step="0.5" min="0" max="500" placeholder="кг"
                    value={form.testWeights[i] || ''}
                    onChange={e => { const a = [...form.testWeights]; a[i] = parseFloat(e.target.value) || 0; set('testWeights', a); }}
                    className="px-2 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white text-center"
                  />
                  <input
                    type="number" min="1" max="20"
                    value={form.testReps[i]}
                    onChange={e => { const a = [...form.testReps]; a[i] = parseInt(e.target.value) || 0; set('testReps', a); }}
                    className="px-2 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white text-center"
                  />
                </div>
              ))}
            </div>
            {e1rms.some(v => v > 0) && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <h3 className="font-medium text-green-800 dark:text-green-300 mb-2">Расчётный 1ПМ</h3>
                <div className="grid gap-1 sm:grid-cols-2">
                  {TEST_MOVEMENTS.map((m, i) => e1rms[i] > 0 && (
                    <div key={m.idx} className="flex justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">{m.label}</span>
                      <strong className="text-slate-900 dark:text-white">{Math.round(e1rms[i])} кг</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'amrap' && (
          <div className="space-y-3">
            <h2 className="font-semibold text-slate-900 dark:text-white">AMRAP</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Сколько раз за один подход с собственным весом</p>
            {AMRAP_MOVEMENTS.map((name, i) => (
              <div key={name} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-dark-bg/50 rounded-lg gap-3">
                <span className="text-sm text-slate-700 dark:text-slate-300">{name}</span>
                <input
                  type="number" min="0" max="200"
                  value={form.amrap[i] || ''}
                  onChange={e => { const a = [...form.amrap]; a[i] = parseInt(e.target.value) || 0; set('amrap', a); }}
                  className="w-20 px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white text-center"
                />
              </div>
            ))}
          </div>
        )}

        {step === 'pain' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">Боль, 0–10</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">0 — нет боли, 10 — невыносимо</p>
              <div className="flex gap-1.5 flex-wrap">
                {Array.from({ length: 11 }, (_, i) => i).map(v => (
                  <button key={v} onClick={() => set('pain', v)}
                    className={clsx('w-10 h-10 rounded-lg font-medium transition-colors',
                      form.pain === v
                        ? (v <= 2 ? 'bg-green-500 text-white' : v <= 5 ? 'bg-amber-500 text-white' : 'bg-red-500 text-white')
                        : 'bg-slate-100 dark:bg-dark-border text-slate-500')}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white mb-2">Мышечно-умственная связь, 1–5</h2>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(v => (
                  <button key={v} onClick={() => set('mmc', v)}
                    className={clsx('w-12 h-12 rounded-lg font-bold transition-colors',
                      form.mmc === v ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-dark-border text-slate-500')}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white mb-2">Техника, 1–5</h2>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(v => (
                  <button key={v} onClick={() => set('tech', v)}
                    className={clsx('w-12 h-12 rounded-lg font-bold transition-colors',
                      form.tech === v ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-dark-border text-slate-500')}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 'summary' && (
          <div className="space-y-4">
            <h2 className="font-semibold text-slate-900 dark:text-white">Итог калибровки</h2>

            {bodyComp.bodyFatPct > 0 && (
              <div className="grid grid-cols-3 gap-2">
                <Stat label="% жира" value={`${bodyComp.bodyFatPct}%`} />
                <Stat label="Сухая масса" value={`${bodyComp.leanMassKg} кг`} />
                <Stat label="FFMI" value={`${bodyComp.ffmi}`} />
              </div>
            )}

            {e1rms.some(v => v > 0) && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <h3 className="font-medium text-green-800 dark:text-green-300 mb-2">Стартовые веса (85% 1ПМ)</h3>
                <div className="grid gap-1 sm:grid-cols-2">
                  {TEST_MOVEMENTS.map((m, i) => e1rms[i] > 0 && (
                    <div key={m.idx} className="flex justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">{m.label}</span>
                      <strong className="text-slate-900 dark:text-white">{startWeight(e1rms[i])} кг</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isCheckpoint && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  Что будет дальше
                </h3>
                <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                  <li>• Соберётся программа на 12 недель с периодизацией</li>
                  <li>• Стартовые веса = 85% от твоих 1ПМ</li>
                  <li>• Тренер будет вести прогрессию и давать разгрузки</li>
                  <li>• Каждые 28 дней — чекпоинт с повторными замерами</li>
                </ul>
              </div>
            )}

            <button onClick={finish}
              className="w-full py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors">
              {isCheckpoint ? 'Сохранить чекпоинт' : 'Сохранить и начать тренироваться'}
            </button>
          </div>
        )}
      </div>

      {/* Навигация */}
      <div className="flex items-center justify-between">
        <button onClick={goBack} disabled={history.length <= 1}
          className="px-4 py-2 border border-slate-200 dark:border-dark-border rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-border disabled:opacity-50 flex items-center gap-2">
          <ChevronLeft className="w-4 h-4" /> Назад
        </button>
        <button onClick={goNext} disabled={!canNext || step === 'summary'}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2">
          Далее <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, step, onChange }: { label: string; value: number; step: string; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">{label}</label>
      <input
        type="number" step={step} min="0"
        value={value || ''}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white text-center"
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-slate-50 dark:bg-dark-bg/50 rounded-lg text-center">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

/** Собирает объект Assessment из формы. */
function makeAssessment(form: any, e1rms: number[]): Assessment {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    weightKg: form.weightKg,
    heightCm: form.heightCm,
    age: form.age,
    female: form.female,
    bodyFatPct: 0,
    leanMassKg: 0,
    ffmi: 0,
    neckCm: form.neckCm, chestCm: form.chestCm, waistCm: form.waistCm,
    hipsCm: form.hipsCm, armCm: form.armCm, thighCm: form.thighCm, calfCm: form.calfCm,
    skinfoldChest: form.skinfoldChest, skinfoldMidaxillary: form.skinfoldMidaxillary,
    skinfoldTriceps: form.skinfoldTriceps, skinfoldSubscapular: form.skinfoldSubscapular,
    skinfoldAbdominal: form.skinfoldAbdominal, skinfoldSuprailiac: form.skinfoldSuprailiac,
    skinfoldThigh: form.skinfoldThigh,
    e1rmSquat: e1rms[0], e1rmBench: e1rms[1], e1rmDeadlift: e1rms[2], e1rmOHP: e1rms[3],
    e1rmRow: e1rms[4], e1rmPullup: e0(e1rms[5]), e1rmLegPress: e1rms[6], e1rmHipThrust: e1rms[7],
    startSquat: 0, startBench: 0, startDeadlift: 0, startOHP: 0,
    startRow: 0, startLegPress: 0, startHipThrust: 0,
    movementScores: form.movementScores,
    testWeights: form.testWeights,
    testReps: form.testReps,
    amrap: form.amrap,
    pain: form.pain,
    mmc: form.mmc,
    tech: form.tech,
  };
}

function e0(v: number) { return v; }

/**
 * Расставляет стартовые веса по слотам программы:
 * упражнение узнаётся по базовому движению (movementOf).
 */
function applyStartWeights(program: Program, e1rms: number[]): void {
  const byMovement: Record<number, number> = {
    [MOV.SQUAT]: e1rms[0], [MOV.BENCH]: e1rms[1], [MOV.DEAD]: e1rms[2], [MOV.OHP]: e1rms[3],
    [MOV.ROW]: e1rms[4], [MOV.PULLUP]: e1rms[5], [MOV.LEGPRESS]: e1rms[6], [MOV.HIP]: e1rms[7],
  };

  for (const phase of program.phases) {
    for (const day of phase.days) {
      for (const slot of day.slots) {
        const idx = movementOf(slot.exercise);
        if (idx < 0) continue;
        const e1rm = byMovement[idx];
        if (!e1rm || e1rm <= 0) continue;
        slot.startWeight = startWeight(e1rm);
      }
    }
  }
}
