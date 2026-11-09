// FitGuide Web — замеры и калибровка (порт AssessmentActivity.java)
//
// Тренер не может вести вслепую: сначала точка отсчёта (вес, объёмы, складки),
// проверка движений и калибровочная силовая (вес × повторы → e1RM и стартовые
// веса). Дальше — чекпоинты каждые 28 дней с динамикой.
//
// Разметка повторяет activity_assessment.xml: шапка (aStep/aBar/aTitle/aHint),
// поля прямо на фоне (aInput), итог — один текстовый блок (aSummary) и нижние
// кнопки aBack / aSkip / aNext.

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { clsx } from 'clsx';
import { useProfileStore, useCoachStore, useProgramsStore, useAssessmentStore, useOneRmStore } from '../core/store';
import { useExercises } from '../hooks/useExercises';
import { safeE1rm, startWeight, fillBodyComp, fillStartWeights, movementOf } from '../core/assessment';
import { fillFromSessions } from '../core/checkpoint';
import { generateProgram, buildProgramName, PERIOD_LINEAR } from '../core/generator';
import { GOALS, recommendDays } from '../core/goals';
import { MOV } from '../data/types';
import type { Assessment, Program } from '../data/types';
import { slotColor, contrastOn, withAlpha } from '../core/palette';
import { Toast, trimNum } from './progress/common';

const STEPS = [
  { id: 'measure', label: 'Замеры' },
  { id: 'skin', label: 'Складки' },
  { id: 'move', label: 'Движения' },
  { id: 'test', label: 'Силовые тесты' },
  { id: 'amrap', label: 'AMRAP' },
  { id: 'pain', label: 'Боль/ММК/Техника' },
  { id: 'summary', label: 'Итог' },
] as const;

type StepId = typeof STEPS[number]['id'];

/** Обхваты: ключ → подпись и подсказка (assess_f_* / assess_h_*). */
const MEASURE_SITES = [
  { key: 'neckCm', label: 'Шея, см', hint: 'Чуть выше основания шеи, чуть ниже кадыка' },
  { key: 'shouldersCm', label: 'Плечевой пояс, см', hint: 'Через середину дельт, верх груди и вдоль лопаток' },
  { key: 'chestCm', label: 'Грудь, см', hint: 'Самая широкая часть, на 1–3 см выше сосков, на спокойном выдохе' },
  { key: 'waistCm', label: 'Талия/Живот, см', hint: 'Самое узкое место или уровень пупка, живот напряжён' },
  { key: 'abdomenCm', label: 'Живот (широкая часть), см', hint: 'Чуть выше или ниже пупка, захватывая бока' },
  { key: 'hipsCm', label: 'Бёдра (ягодицы), см', hint: 'Самая широкая часть ягодиц, ноги вместе, лента горизонтально' },
  { key: 'thighCm', label: 'Бедро, см', hint: 'Чуть ниже ягодичной складки, опора на измеряемую ногу' },
  { key: 'calfCm', label: 'Голень, см', hint: 'Самая широкая часть, сидя с напряжением мышц' },
  { key: 'ankleCm', label: 'Лодыжка, см', hint: 'Сидя' },
  { key: 'armCm', label: 'Рука (бицепс), см', hint: 'Между плечом и локтем; рука расслаблена или напряжена' },
  { key: 'forearmCm', label: 'Предплечье, см', hint: 'Самая широкая часть' },
  { key: 'scapulaCm', label: 'Лопатки, см', hint: 'Ширина спины через лопатки' },
] as const;

/** Движения (assess_v_*). */
const MOVE_LABELS = [
  'Присед',
  'Наклон/тяга',
  'Выпады',
  'Жим/отжимания',
  'Жим вверх',
  'Тяга к себе',
  'Подтягивания',
  'Переноска веса',
] as const;

/** Тестовые движения: подпись и индекс в калибровке (assess_t_*). */
const TEST_MOVEMENTS: { label: string; idx: number }[] = [
  { label: 'Присед со штангой', idx: MOV.SQUAT },
  { label: 'Жим лёжа со штангой', idx: MOV.BENCH },
  { label: 'Становая тяга со штангой', idx: MOV.DEAD },
  { label: 'Жим штанги стоя', idx: MOV.OHP },
  { label: 'Тяга штанги в наклоне', idx: MOV.ROW },
  { label: 'Подтягивания с добавкой', idx: MOV.PULLUP },
  { label: 'Жим ногами в тренажёре', idx: MOV.LEGPRESS },
  { label: 'Ягодичный мост со штангой', idx: MOV.HIP },
];

/** AMRAP: подписи assess_a_*. */
const AMRAP_LABELS = [
  'Присед со штангой: повторов',
  'Жим лёжа со штангой: повторов',
  'Тяга штанги в наклоне: повторов',
  'Жим штанги стоя: повторов',
] as const;

const ERR_NUMBERS = 'Проверь числа: вес 30–250 кг, рост 120–230 см, объёмы 20–250 см';

export function AssessmentPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const isCheckpoint = params.get('checkpoint') === '1';

  const { profile, setProfile } = useProfileStore();
  const coach = useCoachStore();
  const { add, programs, save: savePrograms } = useProgramsStore();
  // assessments[0] — последний сохранённый замер. Геттер current у стора
  // теряется при гидратации persist, поэтому берём список напрямую.
  const { addAssessment, assessments } = useAssessmentStore();
  const lastAssessment = assessments.length ? assessments[0] : null;
  const oneRm = useOneRmStore();
  const { db } = useExercises();

  const [step, setStep] = useState<StepId>('measure');
  const [history, setHistory] = useState<StepId[]>(['measure']);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 2500);
  };

  const [form, setForm] = useState(() => ({
    weightKg: lastAssessment?.weightKg || profile?.weightKg || 0,
    heightCm: lastAssessment?.heightCm || profile?.heightCm || 0,
    age: profile?.age || 30,
    female: profile?.gender === 'female',
    neckCm: lastAssessment?.neckCm || 0,
    shouldersCm: lastAssessment?.shouldersCm || 0,
    chestCm: lastAssessment?.chestCm || 0,
    waistCm: lastAssessment?.waistCm || 0,
    abdomenCm: lastAssessment?.abdomenCm || 0,
    hipsCm: lastAssessment?.hipsCm || 0,
    armCm: lastAssessment?.armCm || 0,
    thighCm: lastAssessment?.thighCm || 0,
    calfCm: lastAssessment?.calfCm || 0,
    ankleCm: lastAssessment?.ankleCm || 0,
    forearmCm: lastAssessment?.forearmCm || 0,
    scapulaCm: lastAssessment?.scapulaCm || 0,
    // Три складки как в Android: муж. грудь/живот/бедро, жен. трицепс/бок/бедро.
    sk1: 0, sk2: 0, sk3: 0,
    testWeights: Array(8).fill(0) as number[],
    testReps: Array(8).fill(0) as number[],
    movementScores: Array(8).fill(2) as number[],
    amrap: Array(4).fill(0) as number[],
    pain: 0, mmc: 3, tech: 3,
  }));

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  // Повторный замер: веса и повторы подставляются из фактических тренировок.
  // Вводная на старте работает по пустым полям — тренировок ещё нет.
  useEffect(() => {
    const weights = Array(8).fill(0);
    const reps = Array(8).fill(0);
    fillFromSessions(coach.sessions, weights, reps);
    if (!weights.some(w => w > 0)) return;
    setForm(f => ({
      ...f,
      testWeights: weights.map((w, i) => (w > 0 ? w : f.testWeights[i])),
      testReps: reps.map((r, i) => (r > 0 ? r : f.testReps[i])),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Повторы: пустое поле при введённом весе = 8, как в capture(M_TEST).
  const repsOf = (i: number) => {
    const r = form.testReps[i];
    if (r > 0) return r;
    return form.testWeights[i] > 0 ? 8 : 0;
  };

  // e1RM по каждому тесту
  const e1rms = useMemo(() =>
    form.testWeights.map((w, i) => (w > 0 && repsOf(i) > 0 ? safeE1rm(w, repsOf(i)) : 0)),
    [form.testWeights, form.testReps]);

  const bodyComp = useMemo(() => {
    const a = makeAssessment(form, e1rms);
    fillBodyComp(a, form.age, form.female);
    return a;
  }, [form, e1rms]);

  // Android пускает «Дальше» даже с пустыми полями (capture проверяет только явный мусор).
  const goNext = () => {
    if (step === 'measure' && !validNumbers()) return;
    const i = STEPS.findIndex(s => s.id === step);
    if (i < STEPS.length - 1) {
      const next = STEPS[i + 1].id;
      setHistory(h => [...h, next]);
      setStep(next);
    }
  };

  /** capture(M_MEASURE): ругаемся только на явный мусор в заполненных полях. */
  const validNumbers = () => {
    const bad = (form.weightKg !== 0 && (form.weightKg < 30 || form.weightKg > 250))
      || (form.heightCm !== 0 && (form.heightCm < 120 || form.heightCm > 230))
      || MEASURE_SITES.some(s => {
        const v = form[s.key];
        return v !== 0 && (v < 20 || v > 250);
      });
    if (bad) showToast(ERR_NUMBERS);
    return !bad;
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

    // Профиль: как finishAll() в Android — вес и % жира в границах 5–60.
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
      bodyFatPercent: a.bodyFatPct >= 5 && a.bodyFatPct <= 60 ? a.bodyFatPct : (profile?.bodyFatPercent || 0),
    });

    // Чекпоинт — программу не пересобираем, только обновляем замеры
    if (isCheckpoint) {
      coach.clearProgramUpdated();
      finishNavigate();
      return;
    }

    // Программа тренера уже собрана на знакомстве — только расставляем стартовые веса.
    const active = coach.activeProgramId
      ? programs.find(p => p.id === coach.activeProgramId) ?? null
      : null;
    if (active) {
      applyStartWeights(active, e1rms);
      savePrograms(programs.map(p => (p.id === active.id ? active : p)));
      coach.setCoachPath('coach');
    } else if (db) {
      // Первая программа — по цели и уровню
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

    finishNavigate();
  };

  /** Тост «Замеры сохранены» + переход — как Toast + finish() в Android. */
  const finishNavigate = () => {
    setToast('Замеры сохранены — тренер видит твоё тело');
    window.setTimeout(() => navigate('/coach'), 1100);
  };

  const stepIndex = STEPS.findIndex(s => s.id === step);

  // Заголовки и подсказки шагов — из strings.xml (assess_*_q / assess_*_h).
  const stepText: Record<StepId, { title: string; hint: string }> = {
    measure: {
      title: 'Замеры тела',
      hint: 'Встань на весы утром натощак, измерь лентой объёмы. Это точка отсчёта — без неё прогресс не увидеть.',
    },
    skin: {
      title: 'Складки (по желанию)',
      hint: 'Если есть калипер — три точки: грудь, живот, бедро (муж.), трицепс, бок, бедро (жен.). Нет — тренер оценит жир по ленте.',
    },
    move: {
      title: 'Как двигаешься',
      hint: 'Оцени честно каждое движение: 3 — чисто, 2 — терпимо, 1 — криво, 0 — болит/не могу. По нулям тренер заменит упражнения.',
    },
    test: {
      title: isCheckpoint ? 'Корректировка силы' : 'Вводная тренировка: сила',
      hint: isCheckpoint
        ? 'Разомнись 5–10 минут. Веса и повторы тренер подставил из твоих тренировок — поправь, если сегодня чувствуешь иначе. Подход на 6–10 повторов почти до отказа (в запасе 1–2 повтора). Пустое поле — движение пропускаем.'
        : 'Разомнись 5–10 минут. На каждое движение: подход на 6–10 повторов почти до отказа (осталось 1–2 повтора). Запиши вес и повторы — тренер посчитает максимумы и стартовые веса. Пустое поле — пропускаем движение.',
    },
    amrap: {
      title: 'Выносливость: максимум повторов',
      hint: 'Возьми 60–70 процентов от рабочих весов выше и сделай максимум чистых повторов (оставь 1 в запасе). Это покажет работоспособность.',
    },
    pain: {
      title: 'Самочувствие и техника',
      hint: 'Последний штрих — боли, контроль мышц и уверенность в технике.',
    },
    summary: {
      title: 'Вот что увидел тренер',
      hint: 'Проверь итог. Тренер уже посчитал жир, сухую массу и стартовые веса.',
    },
  };

  const summaryText = buildSummary(bodyComp, e1rms, lastAssessment);

  return (
    <div className="max-w-2xl mx-auto w-full max-w-full">
      {/* Шапка шага — aStep + aBar + aTitle + aHint из activity_assessment.xml */}
      <div className="px-5 pt-5">
        <div className="text-[12px] tracking-[0.06em]" style={{ color: 'var(--color-text-secondary)' }}>
          Шаг {stepIndex + 1} из {STEPS.length}
        </div>
        <div className="mt-1.5 h-1 w-full rounded-full overflow-hidden" style={{ background: 'var(--color-stroke)' }}>
          <div className="h-full rounded-full transition-all"
            style={{ width: `${(stepIndex / (STEPS.length - 1)) * 100}%`, background: 'var(--p-circle)' }} />
        </div>
        <h1 className="mt-[18px] text-[22px] font-bold leading-tight" style={{ color: 'var(--p-labels-text)' }}>
          {stepText[step].title}
        </h1>
        <p className="mt-2 text-[14px] leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
          {stepText[step].hint}
        </p>
      </div>

      {/* Содержимое шага — aInput; в Android без карточки, прямо на фоне */}
      <div className="px-5 pt-[18px]">
        {step === 'measure' && (
          <div>
            <MeasureField label="Вес, кг" value={form.weightKg} step="0.1" onChange={v => set('weightKg', v)} />
            <MeasureField label="Рост, см" value={form.heightCm} step="1" onChange={v => set('heightCm', v)} />
            {MEASURE_SITES.map(s => (
              <MeasureField key={s.key} label={s.label} hint={s.hint} value={form[s.key]} step="0.5"
                onChange={v => set(s.key, v)} />
            ))}
          </div>
        )}

        {step === 'skin' && (
          <div>
            <MeasureField label="Складка 1, мм" value={form.sk1} step="0.1" onChange={v => set('sk1', v)} />
            <MeasureField label="Складка 2, мм" value={form.sk2} step="0.1" onChange={v => set('sk2', v)} />
            <MeasureField label="Складка 3, мм" value={form.sk3} step="0.1" onChange={v => set('sk3', v)} />
          </div>
        )}

        {step === 'move' && (
          <div>
            {MOVE_LABELS.map((label, i) => (
              <div key={label} className="mt-2">
                <div className="text-[14px]" style={{ color: 'var(--color-text-main)' }}>{label}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[0, 1, 2, 3].map(v => (
                    <Chip key={v} on={form.movementScores[i] === v} onClick={() => {
                      const arr = [...form.movementScores];
                      arr[i] = v;
                      set('movementScores', arr);
                    }}>{v}</Chip>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 'test' && (
          <div>
            {TEST_MOVEMENTS.map((m, i) => (
              <div key={m.idx}>
                <div className="mt-1 text-[13px]" style={{ color: 'var(--color-text-main)' }}>{m.label}</div>
                <div className="mt-1 mb-2 flex gap-1.5">
                  <MeasureInput value={form.testWeights[i]} step="0.5" placeholder="кг"
                    onChange={v => { const a = [...form.testWeights]; a[i] = v; set('testWeights', a); }} />
                  <MeasureInput value={form.testReps[i]} step="1" placeholder="повт."
                    onChange={v => { const a = [...form.testReps]; a[i] = Math.round(v); set('testReps', a); }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 'amrap' && (
          <div>
            {AMRAP_LABELS.map((label, i) => (
              <div key={label}>
                <div className="text-[13px]" style={{ color: 'var(--color-text-main)' }}>{label}</div>
                <div className="mt-1 mb-2">
                  <MeasureInput value={form.amrap[i]} step="1" placeholder=""
                    onChange={v => { const a = [...form.amrap]; a[i] = Math.round(v); set('amrap', a); }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 'pain' && (
          <div>
            <div className="mt-3 text-[13px]" style={{ color: 'var(--color-text-main)' }}>
              Боли в суставах (0 — нет, 10 — сильные)
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {Array.from({ length: 11 }, (_, i) => i).map(v => (
                <Chip key={v} on={form.pain === v} onClick={() => set('pain', v)}>{v}</Chip>
              ))}
            </div>

            <div className="mt-3 text-[13px]" style={{ color: 'var(--color-text-main)' }}>Контроль мышц 1–5</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map(v => (
                <Chip key={v} on={form.mmc === v} onClick={() => set('mmc', v)}>{v}</Chip>
              ))}
            </div>

            <div className="mt-3 text-[13px]" style={{ color: 'var(--color-text-main)' }}>Уверенность в технике 1–5</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map(v => (
                <Chip key={v} on={form.tech === v} onClick={() => set('tech', v)}>{v}</Chip>
              ))}
            </div>
          </div>
        )}

        {step === 'summary' && (
          <pre className="mt-1.5 whitespace-pre-wrap font-sans text-[15px] leading-[23px]"
            style={{ color: 'var(--color-text-main)' }}>{summaryText}</pre>
        )}
      </div>

      {/* Нижние кнопки — aBack / aSkip / aNext из activity_assessment.xml */}
      <div className="px-5 mt-[26px] pb-8">
        <div className="flex items-center">
          <button
            onClick={goBack}
            className={clsx('h-12 px-2 text-[14px] font-bold uppercase tracking-[0.089em]',
              history.length <= 1 && 'invisible')}
            style={{ color: 'var(--p-labels-text)' }}>
            Назад
          </button>
          <div className="flex-1" />
          {step !== 'summary' && (
            <button onClick={() => navigate('/coach')}
              className="h-12 px-2 text-[14px] font-bold uppercase tracking-[0.089em]"
              style={{ color: 'var(--p-labels-text)' }}>
              Закрыть
            </button>
          )}
        </div>
        <button
          onClick={step === 'summary' ? finish : goNext}
          className="mt-3 w-full min-h-12 rounded-[4px] text-[14px] font-bold uppercase tracking-[0.089em]"
          style={{ background: 'var(--p-labels)', border: '1px solid var(--p-outline)', color: 'var(--p-labels-text)' }}>
          {step === 'summary' ? 'Сохранить и к тренеру' : 'Дальше'}
        </button>
      </div>

      <Toast text={toast} />
    </div>
  );
}

/** Поле замера как в Android: подпись слева, поле справа, подсказка снизу (11sp). */
function MeasureField({ label, hint, value, step, onChange }: {
  label: string; hint?: string; value: number; step: string; onChange: (v: number) => void;
}) {
  return (
    <div className="mt-2">
      <div className="flex items-center gap-1.5">
        <label className="flex-1 text-[13px] leading-tight" style={{ color: 'var(--color-text-main)' }}>{label}</label>
        <div className="w-[45%]">
          <MeasureInput value={value} step={step} placeholder="" onChange={onChange} />
        </div>
      </div>
      {hint && (
        <div className="mt-0.5 text-[11px] leading-snug" style={{ color: 'var(--color-text-secondary)' }}>{hint}</div>
      )}
    </div>
  );
}

/** bg_edit + paintField: заливка (B), обводка (A) 1.5dp, радиус 14dp, текст (textMain). */
function MeasureInput({ value, step, placeholder, onChange }: {
  value: number; step: string; placeholder: string; onChange: (v: number) => void;
}) {
  const labels = slotColor('labelsButtons');
  const outline = slotColor('outline');
  return (
    <input
      type="number" step={step} min="0" inputMode="decimal"
      value={value || ''}
      placeholder={placeholder}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      className="w-full px-3 py-2 rounded-[14px] text-[14px] outline-none"
      style={{
        background: labels,
        border: `1.5px solid ${withAlpha(outline, 0.8)}`,
        color: 'var(--color-text-main)',
      }}
      onFocus={e => { e.currentTarget.style.borderColor = outline; }}
      onBlur={e => { e.currentTarget.style.borderColor = withAlpha(outline, 0.8); }}
    />
  );
}

/** ChipFactory: фон (B) / выбранный (C), обводка (A), текст — авто-контраст. */
function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  const outline = slotColor('outline');
  const circle = slotColor('circleIcons');
  const labels = slotColor('labelsButtons');
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-8 px-3 rounded-full text-[14px] leading-none active:opacity-80"
      style={{
        background: on ? circle : labels,
        border: `1px solid ${outline}`,
        color: on ? contrastOn(circle) : contrastOn(labels),
      }}>
      {children}
    </button>
  );
}

/** Собирает объект Assessment из формы. */
function makeAssessment(form: any, e1rms: number[]): Assessment {
  const reps = (i: number) => {
    if (form.testReps[i] > 0) return form.testReps[i];
    return form.testWeights[i] > 0 ? 8 : 0;
  };
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
    neckCm: form.neckCm, shouldersCm: form.shouldersCm, chestCm: form.chestCm,
    waistCm: form.waistCm, abdomenCm: form.abdomenCm,
    hipsCm: form.hipsCm, armCm: form.armCm, thighCm: form.thighCm, calfCm: form.calfCm,
    ankleCm: form.ankleCm, forearmCm: form.forearmCm, scapulaCm: form.scapulaCm,
    // Складки: 1-2-3 как в capture(M_SKIN) — у женщин другой набор точек.
    skinfoldChest: form.female ? 0 : form.sk1,
    skinfoldAbdominal: form.female ? 0 : form.sk2,
    skinfoldThigh: form.sk3,
    skinfoldTriceps: form.female ? form.sk1 : 0,
    skinfoldSuprailiac: form.female ? form.sk2 : 0,
    skinfoldMidaxillary: 0,
    skinfoldSubscapular: 0,
    e1rmSquat: e1rms[0], e1rmBench: e1rms[1], e1rmDeadlift: e1rms[2], e1rmOHP: e1rms[3],
    e1rmRow: e1rms[4], e1rmPullup: e1rms[5], e1rmLegPress: e1rms[6], e1rmHipThrust: e1rms[7],
    startSquat: 0, startBench: 0, startDeadlift: 0, startOHP: 0,
    startRow: 0, startLegPress: 0, startHipThrust: 0,
    movementScores: form.movementScores,
    testWeights: form.testWeights,
    testReps: form.testWeights.map((_: number, i: number) => reps(i)),
    amrap: form.amrap,
    pain: form.pain,
    mmc: form.mmc,
    tech: form.tech,
  };
}

/** Итог — ровно текст summary() из AssessmentActivity.java. */
function buildSummary(a: Assessment, e1rms: number[], prev: Assessment | null): string {
  const lines: string[] = [];
  lines.push(`Вес ${trimNum(a.weightKg)} кг · талия ${trimNum(a.waistCm)} см`);
  if (a.bodyFatPct > 0) {
    lines.push(`Жир ${trimNum(a.bodyFatPct)}% · сухая масса ${trimNum(a.leanMassKg)} кг · FFMI ${trimNum(a.ffmi)}`);
  }

  const avg = a.movementScores.reduce((s, v) => s + v, 0) / 8;
  const total = e1rms[0] + e1rms[1] + e1rms[2] + e1rms[3] + e1rms[4];
  const rel = total / Math.max(1, a.weightKg);
  const hasStrength = e1rms[0] > 0 || e1rms[1] > 0 || e1rms[2] > 0;
  let level = 'Новичок';
  if (hasStrength) {
    if (rel >= 4.5 && avg >= 2.5) level = 'Продвинутый';
    else if (rel >= 3.0 && avg >= 2.0) level = 'Средний';
  }
  lines.push(`Движения: ${trimNum(avg)}/3 · уровень ${level}`);

  if (hasStrength) {
    lines.push(`Максимумы: присед ${trimNum(e1rms[0])}, жим ${trimNum(e1rms[1])}, тяга ${trimNum(e1rms[2])}`);
    lines.push(`Стартовые веса: присед ${trimNum(startWeight(e1rms[0]))}, жим ${trimNum(startWeight(e1rms[1]))}, тяга ${trimNum(startWeight(e1rms[2]))}`);
  } else {
    lines.push('Силовой тест пропущен — тренер начнёт с лёгких весов.');
  }

  lines.push('');
  if (!prev) {
    lines.push('Предыдущих замеров нет — это базовая точка.');
    return lines.join('\n');
  }

  const cmp: string[] = [];
  const d = (cur: number, old: number) => cur - old;
  const fmt1 = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`;
  const fmt0 = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v)}`;
  const dWeight = d(a.weightKg, prev.weightKg);
  const dWaist = d(a.waistCm, prev.waistCm);
  const dChest = d(a.chestCm, prev.chestCm);
  const dThigh = d(a.thighCm, prev.thighCm);
  const dArm = d(a.armCm, prev.armCm);
  const dFat = d(a.bodyFatPct, prev.bodyFatPct);
  const dSquat = d(e1rms[0], prev.e1rmSquat);
  const dBench = d(e1rms[1], prev.e1rmBench);
  const dDead = d(e1rms[2], prev.e1rmDeadlift);

  cmp.push('Динамика с прошлого чекпоинта:');
  if (Math.abs(dWeight) > 0.05) cmp.push(`Вес: ${fmt1(dWeight)} кг`);
  if (Math.abs(dWaist) > 0.05) cmp.push(`Талия: ${fmt1(dWaist)} см`);
  if (Math.abs(dChest) > 0.05) cmp.push(`Грудь: ${fmt1(dChest)} см`);
  if (Math.abs(dThigh) > 0.05) cmp.push(`Бедро: ${fmt1(dThigh)} см`);
  if (Math.abs(dArm) > 0.05) cmp.push(`Плечо: ${fmt1(dArm)} см`);
  if (Math.abs(dFat) > 0.05) cmp.push(`Жир: ${fmt1(dFat)}%`);
  if (Math.abs(dSquat) > 0.4) cmp.push(`e1RM присед: ${fmt0(dSquat)} кг`);
  if (Math.abs(dBench) > 0.4) cmp.push(`e1RM жим: ${fmt0(dBench)} кг`);
  if (Math.abs(dDead) > 0.4) cmp.push(`e1RM тяга: ${fmt0(dDead)} кг`);

  lines.push(...cmp);
  return lines.join('\n');
}

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
