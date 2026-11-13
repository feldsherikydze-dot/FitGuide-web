// FitGuide Web — знакомство тренера со спортсменом (порт CoachOnboardingActivity.java)
//
// Тренер ведёт беседу по одному вопросу: сначала подтягивает то, что уже есть в
// профиле, потом спрашивает то, чего не хватает для полноценной работы — место и
// оборудование, опыт, ограничения. В конце спрашивает про соревнования, предлагает
// категории под пол спортсмена и срок подготовки, после чего собирает программу
// первого блока и ставит её активной.
//
// Разметка повторяет activity_coach_onboarding.xml: шаг и прогресс, заголовок,
// подсказка, поле ввода/чипы, итог и нижние кнопки «Назад» / «Закрыть» / «Далее».

import { useMemo, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCoachStore, useProgramsStore, useProfileStore, useAssessmentStore } from '../core/store';
import { useExercises } from '../hooks/useExercises';
import { setJSON } from '../core/storage';
import { generateProgram, PERIOD_LINEAR } from '../core/generator';
import { GOALS, GOALS_ALL, GOAL_LABELS, normalizeGoal, recommendDays } from '../core/goals';
import { blockFor, compPhaseForDays, daysToComp } from '../core/seasonPlan';
import {
  compCatsForGender, compCatLabel, stageWeightKg, offseasonKg,
} from '../core/compCategory';
import { formatDate, plural } from '../core/coach';
import type { UserProfile } from '../data/types';
import { Toast } from './progress/common';

// шаги беседы
const S_NAME = 0;
const S_GENDER = 1;
const S_AGE = 2;
const S_HEIGHT = 3;
const S_WEIGHT = 4;
const S_GOAL = 5;
const S_LEVEL = 6;
const S_PLACE = 7;
const S_EQUIP = 8;
const S_DAYS = 9;
const S_TYPE = 10;
const S_LIMITS = 11;
const S_COMPETE = 12;
const S_CATEGORY = 13;
const S_TERM = 14;
const S_FINISH = 15;

const LEVELS = [
  { value: 'beginner', label: 'Новичок' },
  { value: 'intermediate', label: 'Средний' },
  { value: 'advanced', label: 'Продвинутый' },
];

const PLACES = [
  { value: 'gym', label: 'Зал' },
  { value: 'home', label: 'Дома' },
];

const TYPES = [
  { value: 'auto', label: 'На усмотрение тренера' },
  { value: 'fullbody', label: 'Фулбоди: всё тело за тренировку' },
  { value: 'split', label: 'Сплит: отдельные группы' },
  { value: 'circuit', label: 'Круговая: упражнения подряд' },
];

const EQUIPMENT = [
  { value: 'barbell', label: 'Штанга и грифы' },
  { value: 'dumbbell', label: 'Гантели и свободные веса' },
  { value: 'cable', label: 'Блоки и кроссовер' },
  { value: 'machine', label: 'Машинные тренажёры' },
  { value: 'smith', label: 'Смит' },
];

const LIMITS = [
  { value: 'lowback', label: 'Поясница' },
  { value: 'knee', label: 'Колени' },
  { value: 'shoulder', label: 'Плечи' },
  { value: 'wrist', label: 'Кисти' },
];

const DAY_OPTIONS = [3, 4, 5, 6];
const TERM_OPTIONS = [
  { value: 3, label: '3 месяца' },
  { value: 6, label: '6 месяцев' },
  { value: 12, label: '12 месяцев (год)' },
];

const ERR_FILL = 'Выбери вариант, пожалуйста';
const ERR_NAME = 'Напиши, как тебя зовут';
const ERR_AGE = 'Возраст от 12 до 90';
const ERR_HEIGHT = 'Рост от 120 до 230 см';
const ERR_WEIGHT = 'Вес от 30 до 250 кг';
const MULTI_HINT = 'Можно выбрать несколько или пропустить';

/** Одно число после запятой без хвостового «,0». */
function f1(v: number): string {
  if (!isFinite(v)) return '0';
  if (v === Math.round(v)) return String(Math.round(v));
  return v.toFixed(1).replace('.', ',');
}

/** Чип как ChipFactory: фон (B), обводка (A), текст (D); выбран — фон (C). */
function Chip({
  label, on, onClick,
}: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`fg-chip active:opacity-80${on ? ' fg-chip-on' : ''}`}
    >
      {label}
    </button>
  );
}

export function CoachOnboardingPage() {
  const navigate = useNavigate();
  const { profile, setProfile } = useProfileStore();
  const coach = useCoachStore();
  const { add, remove } = useProgramsStore();
  const assessments = useAssessmentStore(s => s.assessments);
  const { db } = useExercises();

  // ---------------------------------------------------------------- ответы
  const prefill = useMemo(() => {
    const p = profile;
    const level = p?.level || 'intermediate';
    const goal = p?.goal || GOALS.MASS;
    return {
      name: p?.name || '',
      gender: p?.gender || '',
      age: p?.age ? String(p.age) : '',
      height: p?.heightCm ? String(p.heightCm) : '',
      weight: p?.weightKg ? f1(p.weightKg) : '',
      goal,
      level,
      place: p?.place === 'home' ? 'home' : 'gym',
      equipment: new Set<string>(p?.equipment || []),
      days: Math.max(2, recommendDays(level, goal)),
      type: coach.programType || 'auto',
      restrictions: new Set<string>(coach.restrictions || []),
      category: coach.compCategory || '',
    };
    // префилл один раз, как prefillFromProfile() в Android
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [name, setName] = useState(prefill.name);
  const [gender, setGender] = useState(prefill.gender);
  const [age, setAge] = useState(prefill.age);
  const [height, setHeight] = useState(prefill.height);
  const [weight, setWeight] = useState(prefill.weight);
  const [goal, setGoal] = useState(prefill.goal);
  const [level, setLevel] = useState(prefill.level);
  const [place, setPlace] = useState(prefill.place);
  const [equipment, setEquipment] = useState<Set<string>>(prefill.equipment);
  const [days, setDays] = useState(prefill.days);
  const [type, setType] = useState(prefill.type);
  const [restrictions, setRestrictions] = useState<Set<string>>(prefill.restrictions);
  const [compete, setCompete] = useState(false);
  const [category, setCategory] = useState(prefill.category);
  const [termMonths, setTermMonths] = useState(12);

  const [step, setStep] = useState(S_NAME);
  const [history, setHistory] = useState<number[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  const showToast = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 3000);
  };

  // ---------------------------------------------------------------- шаги
  const visible = (s: number): boolean => {
    if (s === S_EQUIP) return place === 'gym';
    if (s === S_CATEGORY || s === S_TERM) return compete;
    return true;
  };

  const stepList = (): number[] => {
    const out: number[] = [];
    for (let s = S_NAME; s <= S_FINISH; s++) if (visible(s)) out.push(s);
    return out;
  };

  const nextStep = (from: number): number => {
    for (let s = from + 1; s <= S_FINISH; s++) if (visible(s)) return s;
    return -1;
  };

  const steps = stepList();
  const index = steps.indexOf(step);
  const total = steps.length;
  const progress = total <= 1 ? 100 : Math.floor((100 * index) / (total - 1));
  const isLast = nextStep(step) < 0;

  // ---------------------------------------------------------------- проверка
  const validate = (): boolean => {
    switch (step) {
      case S_NAME:
        if (!name.trim()) { showToast(ERR_NAME); return false; }
        return true;
      case S_AGE: {
        const raw = age.trim();
        if (!raw || !/^\d+$/.test(raw)) { showToast(ERR_FILL); return false; }
        const v = parseInt(raw, 10);
        if (v < 12 || v > 90) { showToast(ERR_AGE); return false; }
        return true;
      }
      case S_HEIGHT: {
        const raw = height.trim();
        if (!raw || !/^\d+$/.test(raw)) { showToast(ERR_FILL); return false; }
        const v = parseInt(raw, 10);
        if (v < 120 || v > 230) { showToast(ERR_HEIGHT); return false; }
        return true;
      }
      case S_WEIGHT: {
        const v = parseFloat(weight.trim().replace(',', '.'));
        if (!isFinite(v) || v < 30 || v > 250) { showToast(ERR_WEIGHT); return false; }
        return true;
      }
      case S_GENDER:
        if (!gender) { showToast(ERR_FILL); return false; }
        return true;
      case S_CATEGORY: {
        const cats = compCatsForGender(gender);
        if (!cats.some(c => c.key === defaultCategory())) { showToast(ERR_FILL); return false; }
        return true;
      }
      default:
        return true;
    }
  };

  const next = () => {
    if (!validate()) return;
    const nxt = nextStep(step);
    if (nxt < 0) {
      finishWizard();
      return;
    }
    setHistory(h => [...h, step]);
    setStep(nxt);
  };

  const back = () => {
    if (!history.length) {
      navigate('/coach');
      return;
    }
    setStep(history[history.length - 1]);
    setHistory(h => h.slice(0, -1));
  };

  // ---------------------------------------------------------------- итог
  const ageNum = parseInt(age, 10) || 0;
  const heightNum = parseInt(height, 10) || 0;
  const weightNum = parseFloat(weight.replace(',', '.')) || 0;

  const cats = compCatsForGender(gender);
  const defaultCategory = (): string => {
    if (category && cats.some(c => c.key === category)) return category;
    return cats[0]?.key ?? '';
  };

  const compDate = (): number => {
    const d = new Date();
    d.setMonth(d.getMonth() + Math.max(1, termMonths));
    return d.getTime();
  };

  const compDateMillis = compDate();
  const daysUntil = daysToComp(compDateMillis, Date.now()) ?? 0;

  const typeLabel = (): string => TYPES.find(t => t.value === type)?.label ?? TYPES[0].label;

  const labelsOf = (all: { value: string; label: string }[], picked: Set<string>): string =>
    all.filter(o => picked.has(o.value)).map(o => o.label).join(', ');

  const summaryText = (): string => {
    const lines: string[] = [];
    const genderLabel = gender === 'female' ? 'Женский' : 'Мужской';
    lines.push(`${name.trim()}, ${ageNum} лет — ${genderLabel}`);
    lines.push(`Цель: ${GOAL_LABELS[normalizeGoal(goal)] ?? ''}`);
    lines.push(`Место: ${place === 'home' ? 'Дома' : 'Зал'}`);
    if (place === 'gym' && equipment.size) {
      lines.push(`Оборудование: ${labelsOf(EQUIPMENT, equipment)}`);
    }
    lines.push(`Тренировок в неделю: ${days}`);
    lines.push(`Деление тренировок: ${typeLabel()}`);
    lines.push(`Ограничения: ${restrictions.size ? labelsOf(LIMITS, restrictions) : 'Не отмечено. Отметь, если что-то беспокоит — тренер уберёт рискованные упражнения из замен.'}`);
    if (compete) {
      lines.push(`Соревнования: ${compCatLabel(defaultCategory())}, подготовка ${termMonths} мес.`);
      lines.push(`Дата старта: ${formatDate(compDateMillis)}`);
      lines.push(`Ориентир сцены: ${f1(stageWeightKg(heightNum, defaultCategory()))} кг (межсезонье — ${f1(offseasonKg(heightNum, defaultCategory()))} кг)`);
    } else {
      lines.push(`Без соревнований — веду к цели «${GOAL_LABELS[normalizeGoal(goal)] ?? ''}»`);
    }
    const block = compete ? blockFor(compPhaseForDays(daysUntil), type) : null;
    if (block) {
      lines.push(`Первый блок: ${block.name} — ${block.weeks} нед.`);
    }
    return lines.join('\n');
  };

  // ---------------------------------------------------------------- финиш
  const finishWizard = () => {
    if (finished) return;
    setFinished(true);
    const cat = defaultCategory();
    const base: UserProfile = profile ?? {
      name: '', gender: '', age: 0, heightCm: 0, weightKg: 0,
      activityLevel: '', goal: '', trainStyle: '', bodyFatPercent: 0,
      workoutsPerWeek: 0, bio: '', country: '', city: '', level: '',
      equipment: [], place: '',
    };

    const nextProfile: UserProfile = {
      ...base,
      name: name.trim(),
      gender: gender === 'female' ? 'female' : 'male',
      age: ageNum,
      heightCm: heightNum,
      weightKg: weightNum,
      goal,
      level,
      workoutsPerWeek: days,
      equipment: place === 'gym' ? Array.from(equipment) : [],
      place,
      trainStyle: compete ? 'bb' : (base.trainStyle || 'any'),
    };
    if (!nextProfile.activityLevel || nextProfile.activityLevel === 'sedentary') {
      nextProfile.activityLevel = days >= 4 ? 'moderate' : 'light';
    }
    if (compete) {
      nextProfile.compCategory = cat;
      nextProfile.compDate = compDateMillis;
    }
    setProfile(nextProfile);
    setJSON('onboarding_done', true);

    const previousCoachProgram = coach.coachProgramId;
    const previousActive = coach.activeProgramId;

    coach.setRestrictions(Array.from(restrictions));
    coach.setProgramType(type);
    coach.setCoachPath('coach');

    let coachProgram: string | null = null;

    if (compete) {
      coach.setCompCategory(cat);
      coach.setCompDate(compDateMillis);
      coach.setProgramPhase('');
      coach.setCompPhase(compPhaseForDays(daysUntil));

      const phase = compPhaseForDays(daysUntil);
      const block = blockFor(phase, type);
      if (block && db) {
        const program = generateProgram({
          name: `${block.name} · ${formatDate(Date.now())}`,
          goal: block.goal,
          level,
          daysPerWeek: days || recommendDays(level, block.goal),
          weeks: block.weeks,
          place,
          style: block.style,
          periodType: block.period,
          type: block.type,
          equipment: place === 'home' ? undefined : Array.from(equipment),
          age: ageNum,
          female: gender === 'female',
        }, db);
        if (program.phases?.length) {
          add(program);
          coach.setPrevProgram(previousActive);
          coach.setActiveProgram(program.id);
          coach.setProgramPhase(phase);
          coachProgram = program.id;
        }
      }
    } else {
      coach.setCompDate(null);
      coach.setCompCategory('');
      coach.setCompPhase(null);
      if (db) {
        const program = generateProgram({
          name: `Межсезонье · база на массу · ${formatDate(Date.now())}`,
          goal,
          level,
          daysPerWeek: days,
          weeks: 8,
          place,
          style: 'any',
          periodType: PERIOD_LINEAR,
          type,
          equipment: place === 'home' ? undefined : Array.from(equipment),
          age: ageNum,
          female: gender === 'female',
        }, db);
        add(program);
        coach.setPrevProgram(previousActive);
        coach.setActiveProgram(program.id);
        coach.setProgramPhase('');
        coachProgram = program.id;
      }
    }

    // Программа тренера одна: прежнюю заменяем, чтобы не копились дубликаты.
    if (coachProgram && previousCoachProgram && previousCoachProgram !== coachProgram) {
      remove(previousCoachProgram);
    }
    if (coachProgram) coach.setCoachProgram(coachProgram);

    showToast('Готово! Программа собрана — начинаем подготовку.');
    const assessmentDone = assessments.length > 0;
    window.setTimeout(() => navigate(assessmentDone ? '/coach' : '/assessment', { replace: true }), 900);
  };

  // ---------------------------------------------------------------- ввод
  const single = (options: { value: string; label: string }[], value: string, onPick: (v: string) => void) => (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <Chip key={o.value} label={o.label} on={value === o.value} onClick={() => onPick(o.value)} />
      ))}
    </div>
  );

  const multi = (options: { value: string; label: string }[], picked: Set<string>, toggle: (v: string) => void) => (
    <div>
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <Chip key={o.value} label={o.label} on={picked.has(o.value)} onClick={() => toggle(o.value)} />
        ))}
      </div>
      <div className="mt-2 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
        {MULTI_HINT}
      </div>
    </div>
  );

  const toggle = (setter: Dispatch<SetStateAction<Set<string>>>, v: string) => {
    setter(prev => {
      const nextSet = new Set(prev);
      if (nextSet.has(v)) nextSet.delete(v);
      else nextSet.add(v);
      return nextSet;
    });
  };

  let titleText = '';
  let hintText = '';
  let input: ReactNode = null;

  switch (step) {
    case S_NAME:
      titleText = 'Как тебя зовут?';
      hintText = 'Так к тебе будет обращаться тренер.';
      input = (
        <input
          className="fg-input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Как к вам обращаться"
          autoCapitalize="words"
        />
      );
      break;
    case S_GENDER:
      titleText = 'Ты парень или девушка?';
      hintText = 'От этого зависят категории и расчёты.';
      input = single(
        [{ value: 'male', label: 'Мужской' }, { value: 'female', label: 'Женский' }],
        gender,
        v => setGender(v),
      );
      break;
    case S_AGE:
      titleText = 'Сколько тебе лет?';
      hintText = 'От возраста зависит объём и отдых на тренировке.';
      input = (
        <input
          className="fg-input"
          value={age}
          onChange={e => setAge(e.target.value)}
          placeholder="года"
          inputMode="numeric"
        />
      );
      break;
    case S_HEIGHT:
      titleText = 'Какой у тебя рост?';
      hintText = 'В сантиметрах — нужен для ориентира соревновательного веса.';
      input = (
        <input
          className="fg-input"
          value={height}
          onChange={e => setHeight(e.target.value)}
          placeholder="см"
          inputMode="numeric"
        />
      );
      break;
    case S_WEIGHT:
      titleText = 'Сколько ты весишь сейчас?';
      hintText = 'В килограммах — от этого считаю питание и нагрузку.';
      input = (
        <input
          className="fg-input"
          value={weight}
          onChange={e => setWeight(e.target.value)}
          placeholder="кг"
          inputMode="decimal"
        />
      );
      break;
    case S_GOAL:
      titleText = 'Какая цель сейчас?';
      hintText = 'Если готовимся к сцене, тренер сам поведёт цель по сезону.';
      input = single(
        GOALS_ALL.map(g => ({ value: g, label: GOAL_LABELS[g] })),
        goal,
        v => setGoal(v),
      );
      break;
    case S_LEVEL:
      titleText = 'Какой у тебя опыт тренировок?';
      hintText = 'Новичок — меньше объёма, продвинутый — больше.';
      input = single(LEVELS, level, v => setLevel(v));
      break;
    case S_PLACE:
      titleText = 'Где будешь тренироваться?';
      hintText = 'В зале или дома — от этого подберу упражнения.';
      input = single(PLACES, place, v => setPlace(v));
      break;
    case S_EQUIP:
      titleText = 'Что есть в зале?';
      hintText = 'Отметь доступное — подберу упражнения под инвентарь.';
      input = multi(EQUIPMENT, equipment, v => toggle(setEquipment, v));
      break;
    case S_DAYS:
      titleText = 'Сколько дней в неделю будешь тренироваться?';
      hintText = 'Лучше меньше, но стабильно: пропуски тренер учтёт.';
      input = single(
        DAY_OPTIONS.map(d => ({
          value: String(d),
          label: `${d} ${plural(d, 'день в неделю', 'дня в неделю', 'дней в неделю')}`,
        })),
        String(days),
        v => setDays(parseInt(v, 10)),
      );
      break;
    case S_TYPE:
      titleText = 'Как удобнее делить тренировки?';
      hintText = 'Не буду навязывать непривычную схему — соберу под тебя.';
      input = single(TYPES, type, v => setType(v));
      break;
    case S_LIMITS:
      titleText = 'Есть травмы или запреты?';
      hintText = 'Отмечу и заменю опасные движения.';
      input = multi(LIMITS, restrictions, v => toggle(setRestrictions, v));
      break;
    case S_COMPETE:
      titleText = 'Хочешь выступить на соревнованиях?';
      hintText = 'Если да — поведу до сцены: фазы, сушка, пик формы.';
      input = single(
        [{ value: '1', label: 'Да' }, { value: '0', label: 'Нет' }],
        compete ? '1' : '0',
        v => setCompete(v === '1'),
      );
      break;
    case S_CATEGORY:
      titleText = 'В какой категории выступишь?';
      hintText = `Ориентир сцены при твоём росте: около ${f1(stageWeightKg(heightNum, defaultCategory()))} кг. Это планка для подготовки, а не правило федерации.`;
      input = single(
        cats.map(c => ({ value: c.key, label: c.label })),
        defaultCategory(),
        v => setCategory(v),
      );
      break;
    case S_TERM:
      titleText = 'За какой срок готовиться?';
      hintText = 'Год — спокойное межсезонье, меньше — плотнее.';
      input = single(
        TERM_OPTIONS.map(t => ({ value: String(t.value), label: t.label })),
        String(termMonths),
        v => setTermMonths(parseInt(v, 10)),
      );
      break;
    case S_FINISH:
      titleText = 'Вот что я услышал';
      hintText = 'Проверь. Если всё верно — собираю первую программу и начинаем.';
      input = null;
      break;
    default:
      break;
  }

  return (
    <div className="min-h-screen w-full max-w-full" style={{ background: 'var(--color-bg)' }}>
      <div className="mx-auto w-full max-w-lg px-5 pt-5 pb-7">
        <div className="text-[12px] tracking-[0.06em]" style={{ color: 'var(--color-text-secondary)' }}>
          {`ЗНАКОМСТВО · ШАГ ${index + 1} ИЗ ${total}`}
        </div>

        <div
          className="mt-1.5 h-1 w-full rounded-full overflow-hidden"
          style={{ background: 'var(--color-stroke)' }}
        >
          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: 'var(--p-circle)' }} />
        </div>

        <h1 className="mt-[18px] text-[22px] font-bold leading-tight" style={{ color: 'var(--p-labels-text)' }}>
          {titleText}
        </h1>
        <p className="mt-2 text-[14px] leading-[1.35]" style={{ color: 'var(--color-text-secondary)' }}>
          {hintText}
        </p>

        <div className="mt-[18px]">{input}</div>

        {step === S_FINISH && (
          <div
            className="mt-1.5 text-[15px] leading-[1.5] whitespace-pre-line"
            style={{ color: 'var(--color-text-main)' }}
          >
            {summaryText()}
          </div>
        )}

        <div className="mt-[26px] flex items-center">
          <button
            type="button"
            onClick={back}
            className="fg-btn fg-btn-primary h-12 px-4"
            style={{ visibility: history.length ? 'visible' : 'hidden' }}
          >
            Назад
          </button>
          <div className="flex-1" />
          <button type="button" onClick={() => navigate('/coach')} className="fg-btn fg-btn-primary h-12 px-4">
            Закрыть
          </button>
        </div>

        <button type="button" onClick={next} className="fg-btn fg-btn-primary mt-3 w-full h-12 px-4">
          {isLast ? 'Создать программу' : 'Следующий шаг'}
        </button>
      </div>

      <Toast text={toast} />
    </div>
  );
}
