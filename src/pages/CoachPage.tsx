// FitGuide Web — карманный тренер (порт CoachActivity.java)
//
// Экран по состояниям, как в Android:
//  - путь не выбран и программы нет — приветствие и выбор;
//  - «своя программа» — ведём по выбранной программе;
//  - «программа тренера» — знакомство → вводная → индивидуальная программа.
// Все секции повторяют renderOwn()/renderCoach() из CoachActivity.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAssessmentStore, useBodyLogStore, useCoachStore, useOneRmStore, useProfileStore, useProgramsStore } from '../core/store';
import { useExercises, useKnowledge, usePicker } from '../hooks/useExercises';
import {
  adherePercent, avgSleep, conflictsWithLimits, currentWeekIndex, currentWeekStart,
  cycleNumber, dailyPlan, dayKey, dropWeight, e1rmSeries, estimateOneRepMax, lastReps, lastWeight,
  maxReps, missedStreak, missedWeeks, nextDay, nextDayIndex, progressStalled, readinessScore,
  sessionCount, sessionsThisWeek, suggestWeight, tonnage, tonnageInWeekIndex, topExercises,
  weekSetsByGroup, weeksOnPlan, weeksSinceStart, type DailyPlan,
} from '../core/coach';
import { CHECKPOINT_DAYS, checkpointDue, daysSinceAssessment } from '../core/checkpoint';
import { findTip, rotateTip } from '../core/knowledge';
import { blockFor, COMP_PHASE_LABELS, compPhaseForDays, daysToComp, shouldRotate } from '../core/seasonPlan';
import { compCatLabel, offseasonKg, stageWeightKg } from '../core/compCategory';
import { dailyCalories, goalLabel, proteinPerKg, recommendDays } from '../core/goals';
import { generateProgram } from '../core/generator';
import { analyzePhase } from '../core/planAdvisor';
import { getJSON, getString, setString, KEYS } from '../core/storage';
import type { Day as MenuDay } from '../core/nutrition';
import type { Phase, Session } from '../data/types';

const WEEKDAYS_RU = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function f1(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',');
}

function fw(v: number): string {
  return Number.isInteger(v) ? String(Math.round(v)) : v.toFixed(1).replace('.', ',');
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Ограничения по здоровью — ключи и подписи, как CoachStore.LIMIT_*. */
const LIMIT_KEYS = [
  { key: 'lowback', label: 'Поясница' },
  { key: 'knee', label: 'Колени' },
  { key: 'shoulder', label: 'Плечи' },
  { key: 'wrist', label: 'Кисти' },
];

/** Запасные советы coach_tip_1..8 — если база знаний недоступна (addTip). */
const TIPS_FALLBACK = [
  'Сон 7–9 часов — главный фактор роста. Старайся ложиться в одно время.',
  'Белок 1,6–2,2 г на кг массы — фундамент. Добавляй к каждому приёму пищи.',
  'Вода и соль важны для силы: 30–40 мл на кг в день, и больше в жару.',
  'После тяжёлых тренировок полезны лёгкие ноги: 10–15 минут ходьбы.',
  'Мягкая растяжка и самомассаж после тренировки снижают крепатуру.',
  'Дневник точнее советов: записывай вес и повторы сразу после подхода.',
  'Не задерживай дыхание — выдох на усилии держит давление.',
  'Устал — не значит закончил. Держи технику и не гонись за весом.',
];

function Section({ title }: { title: string }) {
  return (
    <div className="mt-[18px] text-[15px] font-bold" style={{ color: 'var(--color-text-main)' }}>
      {title}
    </div>
  );
}

function Line({
  children, bold, secondary, accent, size = 13,
}: {
  children: React.ReactNode; bold?: boolean; secondary?: boolean; accent?: boolean; size?: number;
}) {
  return (
    <div
      className="mt-[3px] leading-snug"
      style={{
        color: accent ? 'var(--p-circle)' : secondary ? 'var(--color-text-secondary)' : 'var(--color-text-main)',
        fontSize: size,
        fontWeight: bold ? 700 : 400,
      }}
    >
      {children}
    </div>
  );
}

function Btn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full mt-2 rounded-xl border font-semibold text-[14px] px-4 py-3 active:opacity-80"
      style={{ background: 'var(--p-labels)', borderColor: 'var(--p-outline)', color: 'var(--p-labels-text)' }}
    >
      {children}
    </button>
  );
}

function Modal({ title, children, onClose }: { title?: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-6" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl p-5 max-h-[85vh] overflow-y-auto"
        style={{ background: 'var(--p-labels)', border: '1px solid var(--p-outline)' }}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <h3 className="text-[18px] font-bold mb-2" style={{ color: 'var(--p-labels-text)' }}>{title}</h3>
        )}
        {children}
      </div>
    </div>
  );
}

function ChoiceChips<T extends number | string>({
  options, value, onChange,
}: {
  options: { v: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button
          key={String(o.v)}
          onClick={() => onChange(o.v)}
          className="px-3 py-1.5 rounded-full text-[13px] font-medium border"
          style={value === o.v
            ? { background: 'var(--p-circle)', borderColor: 'var(--p-circle)', color: 'var(--p-on-circle)' }
            : { background: 'var(--p-labels)', borderColor: 'var(--p-outline)', color: 'var(--p-labels-text)' }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function CoachPage() {
  const navigate = useNavigate();
  const coach = useCoachStore();
  const { getById, programs: allPrograms, add: addProgram } = useProgramsStore();
  const { profile, setProfile } = useProfileStore();
  const assessments = useAssessmentStore(s => s.assessments);
  const assessment = assessments[0] ?? null;
  const oneRm = useOneRmStore();
  const bodyLogs = useBodyLogStore(s => s.logs);
  const addBodyLog = useBodyLogStore(s => s.addLog);
  const { byName, groupNameById, db } = useExercises();
  const { ready: knowledgeReady } = useKnowledge();
  const picker = usePicker();

  const now = Date.now();
  const program = coach.activeProgramId ? getById(coach.activeProgramId) : null;
  const exMap = useMemo(() => byName(), [byName]);
  const groupNames = useMemo(() => groupNameById(), [groupNameById]);

  const due = checkpointDue(assessment, now);
  const days = daysSinceAssessment(assessment, now);

  // Сезон: фаза считается по дате старта, как CoachStore.compPhase в Android.
  const seasonPhase = coach.compDate ? compPhaseForDays(daysToComp(coach.compDate, now) ?? 0) : null;
  const weeksSince = weeksSinceStart(program ?? null, coach.activeSince, now);

  // Фаза сменилась или блок отработан — тренер собирает новый блок и ставит его активным,
  // прежний остаётся в истории (SeasonPlan.syncIfNeeded).
  useEffect(() => {
    if (coach.coachPath !== 'coach' || !seasonPhase || !db) return;
    if (!shouldRotate({
      compPhase: seasonPhase,
      activeProgram: program ?? null,
      builtFor: coach.programPhase,
      weeksSinceStart: weeksSince,
    })) return;
    const block = blockFor(seasonPhase, coach.programType);
    if (!block) return;
    const level = profile?.level || 'beginner';
    const place = profile?.place || 'gym';
    const perWeek = profile && profile.workoutsPerWeek > 0
      ? profile.workoutsPerWeek
      : recommendDays(level, block.goal);
    const generated = generateProgram({
      name: `${block.name} · ${fmtDate(now)}`,
      goal: block.goal,
      level,
      daysPerWeek: perWeek,
      weeks: block.weeks,
      place,
      style: block.style,
      periodType: block.period,
      type: block.type,
      equipment: place === 'home' ? undefined : profile?.equipment,
      age: profile?.age,
      female: profile?.gender === 'female',
    }, db);
    if (!generated.phases?.length) return;
    addProgram(generated);
    coach.setPrevProgram(coach.activeProgramId);
    coach.setActiveProgram(generated.id);
    coach.setProgramPhase(seasonPhase);
    coach.markProgramUpdated(`Новый блок подготовки: ${generated.name}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coach.coachPath, seasonPhase, db, program?.id, weeksSince]);

  const plan: DailyPlan = useMemo(() => dailyPlan({
    state: coach,
    program: program || null,
    checkin: coach.checkins[0] || null,
    now,
    checkpointDue: due,
    daysSinceAssessment: days,
  }), [coach, program, due, days, now]);

  const checkin = coach.checkins.find(c => c.day === dayKey(now)) || null;
  const score = readinessScore(checkin);

  // Тело: вес для профиля и «Записать вес».
  const logsAsc = [...bodyLogs].sort((a, b) => a.date - b.date);
  const curWeight = logsAsc.length ? logsAsc[logsAsc.length - 1].weightKg : (profile?.weightKg || 0);

  // Профиль.
  const profileFacts: string[] = [];
  if (profile) {
    if (profile.gender) profileFacts.push(profile.gender === 'male' ? 'Мужской' : 'Женский');
    if (profile.age > 0) profileFacts.push(`${profile.age} лет`);
    if (profile.heightCm > 0) profileFacts.push(`${profile.heightCm} см`);
    if (curWeight > 0) profileFacts.push(`${fw(curWeight)} кг`);
  }
  const profileFacts2: string[] = [];
  if (profile) {
    if (profile.level) profileFacts2.push(`Уровень: ${profile.level === 'beginner' ? 'Новичок' : profile.level === 'advanced' ? 'Продвинутый' : 'Средний'}`);
    if (profile.activityLevel) {
      const act: Record<string, string> = { sedentary: 'Сидячий', light: 'Низкий', moderate: 'Умеренный', high: 'Высокий', athlete: 'Очень высокий' };
      profileFacts2.push(`Активность: ${act[profile.activityLevel] || profile.activityLevel}`);
    }
    if (profile.workoutsPerWeek > 0) profileFacts2.push(`${profile.workoutsPerWeek} тренировок/нед`);
    if (profile.bodyFatPercent > 0) profileFacts2.push(`Жир: ${f1(profile.bodyFatPercent)}%`);
  }
  const bmi = profile && profile.heightCm > 0 && curWeight > 0
    ? curWeight / Math.pow(profile.heightCm / 100, 2)
    : 0;

  // Профиль спортсмена — Android addProfile(): карточка над содержимым обоих путей.
  const profileSection = (() => {
    const any = !!profile && (!!profile.name || profile.weightKg > 0 || profile.heightCm > 0
      || profile.age > 0 || !!profile.gender);
    if (!any) {
      return (
        <>
          <Section title="Профиль спортсмена" />
          <Line secondary>
            Профиль не заполнен. Заполните возраст, рост, вес и цель — тренер построит нагрузку и питание под вас.
          </Line>
          <Btn onClick={() => navigate('/profile')}>Открыть профиль</Btn>
        </>
      );
    }
    const p = profile!;
    const styleLabel = p.trainStyle === 'bb' ? 'Бодибилдинг' : p.trainStyle === 'pl' ? 'Пауэрлифтинг' : 'Без разницы';
    return (
      <>
        <Section title="Профиль спортсмена" />
        {p.name ? <Line bold size={16}>{p.name}</Line> : null}
        {profileFacts.length > 0 ? <Line secondary>{profileFacts.join(' · ')}</Line> : null}
        {p.goal ? <Line>Цель: {goalLabel(p.goal)}</Line> : null}
        {p.trainStyle && p.trainStyle !== 'any' ? <Line secondary>Направление: {styleLabel}</Line> : null}
        {profileFacts2.length > 0 ? <Line secondary>{profileFacts2.join(' · ')}</Line> : null}
        {bmi > 0 ? <Line secondary size={12}>ИМТ: {bmi.toFixed(1).replace('.', ',')}</Line> : null}
        {p.bio ? <Line secondary size={12}>{p.bio}</Line> : null}
      </>
    );
  })();

  const [readinessOpen, setReadinessOpen] = useState(false);
  const [pick, setPick] = useState({ sleep: 2, sore: 2, energy: 2 });
  const [weightOpen, setWeightOpen] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [updatedOpen, setUpdatedOpen] = useState(false);
  const [toast, setToast] = useState('');
  // Выбор «своей» программы (chooseOwn в CoachActivity) и выбор времени напоминания.
  const [ownPick, setOwnPick] = useState(false);
  const [remPick, setRemPick] = useState(false);

  const [remOn, setRemOn] = useState(() => getString('coach_reminder_on', '') === '1');
  const [remTime, setRemTime] = useState(() => getString('coach_reminder_time', '18:00') || '18:00');

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(''), 2500);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Напоминание: пока приложение открыто, раз в 30 секунд сверяем время.
  useEffect(() => {
    if (!remOn) return;
    const id = window.setInterval(() => {
      const d = new Date();
      const hhmm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
      if (hhmm !== remTime) return;
      if (getString('coach_reminder_last', '') === d.toDateString()) return;
      setString('coach_reminder_last', d.toDateString());
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('FitGuide', { body: 'Пора на тренировку.' });
      } else {
        setToast('Пора на тренировку.');
      }
    }, 30000);
    return () => window.clearInterval(id);
  }, [remOn, remTime]);

  const header = (
    <div className="flex items-center px-2 py-1 w-full">
      <button onClick={() => navigate('/')} className="w-12 h-12 flex items-center justify-center rounded-full active:bg-black/5"
        aria-label="Назад">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--p-labels-text)" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
      </button>
      <div className="ml-1 text-[20px] font-bold" style={{ color: 'var(--p-labels-text)' }}>Карманный тренер</div>
    </div>
  );

  const saveCheckin = () => {
    coach.saveCheckin({ day: dayKey(now), ...pick });
    setReadinessOpen(false);
  };

  const openReadiness = () => {
    setPick({
      sleep: checkin?.sleep ?? 2,
      sore: checkin?.sore ?? 2,
      energy: checkin?.energy ?? 2,
    });
    setReadinessOpen(true);
  };

  /** Выбор «своей» программы: из «Моих программ» либо предложение создать (chooseOwn). */
  const chooseOwn = () => setOwnPick(true);

  const pickOwn = (id: string, name: string) => {
    coach.setCoachPath('own');
    coach.setActiveProgram(id);
    setOwnPick(false);
    setToast(`Беру в работу: ${name}`);
  };

  // Диалог выбора своей программы (coach_own_empty / coach_own_choose).
  const ownChooser = ownPick && (
    allPrograms.length === 0 ? (
      <Modal title="Своя программа" onClose={() => setOwnPick(false)}>
        <p className="text-[14px] leading-snug" style={{ color: 'var(--color-text-main)' }}>
          Сохранённых программ нет. Создай свою программу в Моих программах — и я сразу возьму её в работу.
        </p>
        <div className="flex gap-2 mt-4">
          <button onClick={() => setOwnPick(false)}
            className="flex-1 rounded-xl border font-semibold py-3"
            style={{ borderColor: 'var(--p-outline)', color: 'var(--p-labels-text)' }}>Назад</button>
          <button onClick={() => { setOwnPick(false); navigate('/programs'); }}
            className="flex-1 rounded-xl border font-semibold py-3"
            style={{ background: 'var(--p-circle)', borderColor: 'var(--p-circle)', color: 'var(--p-on-circle)' }}>
            Создать программу
          </button>
        </div>
      </Modal>
    ) : (
      <Modal title="Выбери программу" onClose={() => setOwnPick(false)}>
        <div className="space-y-2">
          {allPrograms.map(p => (
            <button
              key={p.id}
              onClick={() => pickOwn(p.id, p.name)}
              className="w-full text-left rounded-xl border px-4 py-3 text-[14px] font-medium active:opacity-80"
              style={{ background: 'var(--p-labels)', borderColor: 'var(--p-outline)', color: 'var(--p-labels-text)' }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </Modal>
    )
  );

  const advice = score <= 4
    ? 'Готовность низкая: рабочие веса снижены на 10%, держи повторы. Сегодня — техника и восстановление.'
    : score >= 7
      ? 'Готовность хорошая: работай по плану. Если всё закроешь — тренер поднимет вес.'
      : 'Готовность средняя: работай по плану, без форсажа. Вес не поднимай — сначала добей повторы.';

  const sleepLabel = (v: number) => (v <= 1 ? 'Плохо' : v >= 3 ? 'Отлично' : 'Норма');
  const soreLabel = (v: number) => (v <= 1 ? 'Сильная' : v >= 3 ? 'Нет' : 'Средняя');
  const energyLabel = (v: number) => (v <= 1 ? 'Нет' : v >= 3 ? 'Полна' : 'Есть');

  // ---------------------------------------------------------------- выбор пути

  if (!program && coach.coachPath !== 'coach') {
    return (
      <div className="max-w-2xl mx-auto pb-8 w-full">
        {header}
        <div className="px-4">
          <h1 className="text-[18px] font-bold mb-1" style={{ color: 'var(--p-circle)' }}>
            Привет! Я твой карманный тренер
          </h1>
          <p className="text-[14px] leading-relaxed" style={{ color: 'var(--color-text-main)' }}>
            Я буду вести тебя от первого шага до сцены: подберу нагрузку по самочувствию, посчитаю рабочие веса,
            разберу каждую тренировку и буду следить за формой. Сначала выбери, как предпочитаешь тренироваться.
          </p>

          <div className="mt-5 mb-2 text-[15px] font-bold" style={{ color: 'var(--color-text-main)' }}>
            Как предпочитаешь тренироваться?
          </div>

          <div className="text-[15px] font-bold" style={{ color: 'var(--color-text-main)' }}>По своей программе</div>
          <p className="text-[12px] mt-0.5 mb-2 leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
            У тебя уже есть программа — я подберу её из твоих программ и поведу по ней: с периодизацией или без,
            как ты сам настроил. Буду корректировать веса и разбирать каждый день.
          </p>
          <Btn onClick={chooseOwn}>Своя программа</Btn>

          <div className="mt-5 text-[15px] font-bold" style={{ color: 'var(--color-text-main)' }}>
            Хочу тренироваться по программе тренера
          </div>
          <p className="text-[12px] mt-0.5 mb-2 leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
            Пройдём знакомство и подготовку к старту: соберу о тебе всё, что нужно, дам вводную тренировку
            для калибровки рабочих весов, а затем поведу по индивидуальной программе до пика формы.
          </p>
          <Btn onClick={() => navigate('/coach/onboarding')}>Знакомство и подготовка к старту</Btn>

          <button
            onClick={() => {
              if (!window.confirm('Тренер забудет проведённые тренировки, замеры, план сезона и программу, которую собрал сам. Начнёт путь заново: день 1, неделя 1, прогрессия с нуля. Профиль, свои программы и записи дневника сохранятся. Сбросить?')) return;
              coach.resetCoach();
              setToast('Память тренера очищена. Начинаем заново!');
            }}
            className="mt-6 text-[13px] underline underline-offset-4"
            style={{ color: 'var(--color-text-secondary)' }}>
            Сбросить прогресс тренера
          </button>
        </div>
        {toast && (
          <div className="fixed left-1/2 -translate-x-1/2 bottom-24 px-4 py-2 rounded-full text-[13px] font-medium z-40"
            style={{ background: 'var(--p-labels)', color: 'var(--p-labels-text)' }}>{toast}</div>
        )}
        {ownChooser}
      </div>
    );
  }

  // Программа тренера есть, но активной программы нет — как в Android: своя или знакомство.
  if (!program) {
    return (
      <div className="max-w-2xl mx-auto pb-8 w-full">
        {header}
        <div className="px-4">
          {profileSection}
          <Line secondary>Нет активной программы. Выберите программу тренировок.</Line>
          {coach.coachPath === 'own' ? (
            <Btn onClick={chooseOwn}>Своя программа</Btn>
          ) : (
            <Btn onClick={() => navigate('/coach/onboarding')}>Знакомство и подготовка к старту</Btn>
          )}
        </div>
        {toast && (
          <div className="fixed left-1/2 -translate-x-1/2 bottom-24 px-4 py-2 rounded-full text-[13px] font-medium z-40"
            style={{ background: 'var(--p-labels)', color: 'var(--p-labels-text)' }}>{toast}</div>
        )}
        {ownChooser}
      </div>
    );
  }

  // ---------------------------------------------------------------- общие данные

  const week = plan.week;
  const cycle = cycleNumber(program, coach.activeSince, now);
  const phase: Phase | null = program.phases.find(p => week >= p.weekStart && week <= p.weekEnd) || null;
  const history = coach.sessions.filter(s => s.programId === program.id);
  const lastSession: Session | null = history[0] ?? null;
  const plannedPerWeek = program.daysPerWeek > 0
    ? program.daysPerWeek
    : (phase ? phase.days.length : (profile?.workoutsPerWeek || 0));
  const doneThisWeek = sessionsThisWeek(coach.sessions, program.id, coach.activeSince, now);
  const weekStart = currentWeekStart(coach.activeSince, now);
  const stalled = progressStalled(coach.sessions, program.id);
  const deload = plan.deload;
  const next = phase ? nextDay(coach.sessions, program, phase) : null;
  const nextIdx = phase ? nextDayIndex(coach.sessions, program, phase) : -1;

  const draft = coach.sessions.find(s => s.programId === program.id && s.durationSec == null);
  const hasDraft = !!draft;

  const startWorkout = (resume: boolean) => {
    if (!phase || !next) return;
    if (!resume && draft) coach.removeSession(draft.id);
    navigate(`/workout?program=${program.id}&week=${week}&day=${encodeURIComponent(next.title)}`);
  };

  const lastRecords = (() => {
    if (!lastSession) return [] as string[];
    const prev1rm: Record<string, number> = {};
    const prevWeight: Record<string, number> = {};
    for (const s of history) {
      if (s === lastSession) continue;
      for (const it of s.items) {
        const r = estimateOneRepMax(it.weightKg, it.reps);
        if (prev1rm[it.exercise] == null || r > prev1rm[it.exercise]) prev1rm[it.exercise] = r;
        if (prevWeight[it.exercise] == null || it.weightKg > prevWeight[it.exercise]) prevWeight[it.exercise] = it.weightKg;
      }
    }
    const out: string[] = [];
    for (const it of lastSession.items) {
      if (it.weightKg <= 0) continue;
      const r = estimateOneRepMax(it.weightKg, it.reps);
      const best = prev1rm[it.exercise];
      if (best == null || r > best + 0.01) {
        out.push(`Рекорд: ${it.exercise} — ${fw(it.weightKg)} кг × ${it.reps} (1ПМ ${fw(r)} кг)`);
      } else {
        const w = prevWeight[it.exercise];
        if (w == null || it.weightKg > w) out.push(`Рекорд: ${it.exercise} — ${fw(it.weightKg)} кг`);
      }
    }
    return out;
  })();

  // Разбор прошлой тренировки.
  const debrief = (() => {
    if (!lastSession || !lastSession.items.length) return null;
    let planned = 0;
    let done = 0;
    let full = 0;
    const shortEx: string[] = [];
    const repsNotes: string[] = [];
    for (const it of lastSession.items) {
      planned += Math.max(it.targetSets, 0);
      done += Math.max(it.sets, 0);
      if (it.targetSets > 0 && it.sets >= it.targetSets) full++;
      else if (it.targetSets > 0) shortEx.push(it.exercise);
      // Фактические повторы по подходам: 10/10/9/8 — видно, где просело.
      const vals = (it.setReps || []).filter(r => r > 0);
      if (vals.length > 0) {
        const min = Math.min(...vals);
        const fail = (it.setFeels || []).includes(1);
        if (it.reps > 0 && min < it.reps) {
          repsNotes.push(`${it.exercise}: ${vals.join('/')} из ${it.reps} — снижу вес.`);
        } else if (fail) {
          repsNotes.push(`${it.exercise}: подход до отказа — снижу вес.`);
        }
      }
    }
    return { planned, done, full, total: lastSession.items.length, shortEx, repsNotes };
  })();

  // Итог недели.
  const weekSummary = (() => {
    let n = 0;
    let ton = 0;
    const dayTitles: string[] = [];
    for (const s of history) {
      if (s.ts < weekStart) continue;
      n++;
      ton += tonnage(s);
      if (s.dayTitle && !dayTitles.includes(s.dayTitle)) dayTitles.push(s.dayTitle);
    }
    return { n, ton, dayTitles };
  })();

  // График объёма по неделям.
  const chart = (() => {
    const cur = currentWeekIndex(coach.activeSince, now);
    const n = Math.max(1, Math.min(8, cur + 1));
    const vals: number[] = [];
    const labels: string[] = [];
    for (let i = 0; i < n; i++) {
      const w = cur - (n - 1) + i;
      vals.push(tonnageInWeekIndex(coach.sessions, program.id, coach.activeSince, w));
      labels.push(String(w + 1));
    }
    return { vals, labels };
  })();

  // Объём по мышечным группам.
  const actualVolume = weekSetsByGroup(
    coach.sessions, program.id, coach.activeSince,
    (name) => {
      const ex = exMap.get(name);
      return ex ? (groupNames[ex.muscleGroup] || ex.muscleGroup) : null;
    },
    now,
  );
  const planVolume = Object.keys(actualVolume).length === 0
    ? analyzePhase(phase, { picker, groupNameById: groupNames, byName: exMap })
    : null;

  // Сила.
  const top = topExercises(coach.sessions, program.id, 3);
  const strength = top
    .map(ex => ({ ex, series: e1rmSeries(coach.sessions, ex, program.id) }))
    .filter(x => x.series.length > 0);

  // Тело.

  // Питание: дневник и меню.
  const diary = getJSON<{ day: string; kcal: number; protein: number }[]>(KEYS.DIARY_ENTRIES, []) || [];
  const eatenToday = diary.filter(e => e.day === todayKey());
  const eatenKcal = eatenToday.reduce((s, e) => s + (e.kcal || 0), 0);
  const eatenProtein = eatenToday.reduce((s, e) => s + (e.protein || 0), 0);
  const byDay = new Map<string, { kcal: number; protein: number }>();
  for (const e of diary) {
    const cur = byDay.get(e.day) || { kcal: 0, protein: 0 };
    cur.kcal += e.kcal || 0;
    cur.protein += e.protein || 0;
    byDay.set(e.day, cur);
  }
  const weekDiary = [...byDay.entries()].slice(-7);
  const avgKcal = weekDiary.length ? Math.round(weekDiary.reduce((s, [, v]) => s + v.kcal, 0) / weekDiary.length) : 0;
  const avgProtein = weekDiary.length ? weekDiary.reduce((s, [, v]) => s + v.protein, 0) / weekDiary.length : 0;

  const menu = getJSON<MenuDay[]>(KEYS.KITCHEN_MENU, []) || [];
  const weekday = WEEKDAYS_RU[new Date().getDay()];
  const todayMenu = menu.find(d => (d.name || '').trim().toLowerCase() === weekday) || null;
  const menuKcal = todayMenu ? todayMenu.meals.reduce((s, m) => s + m.dishes.reduce((x, d) => x + d.kcal, 0), 0) : 0;
  const menuProtein = todayMenu ? todayMenu.meals.reduce((s, m) => s + m.dishes.reduce((x, d) => x + d.p, 0), 0) : 0;

  const kcalTarget = dailyCalories(profile);
  const proteinTarget = profile && profile.weightKg > 0 ? profile.weightKg * proteinPerKg(profile.goal) : 0;
  const desiredWeight = parseFloat(getString('kbju_desired_weight', '').replace(',', '.'));

  const avgSleepVal = avgSleep(coach.checkins, 7);

  // Сезон.
  const compDays = daysToComp(coach.compDate, now);
  const compWeeks = compDays != null ? Math.max(0, Math.ceil(compDays / 7)) : 0;
  const cutWeeks = (() => {
    if (!profile || profile.weightKg <= 0 || profile.heightCm <= 0) return 0;
    const stage = coach.compCategory
      ? stageWeightKg(profile.heightCm, coach.compCategory)
      : profile.heightCm - 96.5;
    const perWeek = profile.weightKg * 0.005;
    if (stage <= 0 || perWeek <= 0 || profile.weightKg <= stage) return 0;
    return Math.ceil((profile.weightKg - stage) / perWeek);
  })();

  const limits = coach.restrictions || [];
  const toggleLimit = (key: string) => {
    coach.setRestrictions(limits.includes(key) ? limits.filter(x => x !== key) : [...limits, key]);
  };

  const saveWeight = () => {
    const w = parseFloat(weightInput.replace(',', '.'));
    if (!(w > 0 && w < 500)) return;
    addBodyLog({ id: String(Date.now()), date: Date.now(), weightKg: w });
    if (profile) setProfile({ ...profile, weightKg: w });
    setWeightOpen(false);
    setToast('Вес записан.');
  };

  const slotRepsFor = (exercise: string): string | null => {
    if (!phase) return null;
    for (const d of phase.days) for (const s of d.slots) if (s.exercise === exercise) return s.reps;
    return null;
  };
  const slotStartWeightFor = (exercise: string): number => {
    if (!phase) return 0;
    for (const d of phase.days) for (const s of d.slots) if (s.exercise === exercise) return s.startWeight || 0;
    return 0;
  };

  // ---------------------------------------------------------------- общие секции

  const progUpdated = coach.programUpdated && (
    <button
      onClick={() => setUpdatedOpen(true)}
      className="w-full mt-2 rounded-2xl p-3.5 text-left border"
      style={{ background: 'var(--p-labels)', borderColor: 'var(--p-outline)' }}
    >
      <Line bold accent size={15}>Программа обновлена</Line>
      <Line secondary>Тренер поправил программу. Нажми — покажу, что изменил.</Line>
    </button>
  );

  const readinessSection = (
    <>
      <Section title="Готовность сегодня" />
      {!checkin ? (
        <Line secondary>Отметь самочувствие — тренер даст совет на тренировку и подберёт нагрузку.</Line>
      ) : (
        <>
          <Line bold accent size={14}>
            Сон: {sleepLabel(checkin.sleep)} · Забитость: {soreLabel(checkin.sore)} · Энергия: {energyLabel(checkin.energy)}
          </Line>
          <Line>{advice}</Line>
          {score <= 4 && (
            <>
              <Line secondary size={12}>На тренировке веса и подходы снижены.</Line>
              <Line secondary size={12}>Готовность низкая: подходов на тренировке на один меньше.</Line>
            </>
          )}
          {checkin.sore <= 1 && (
            <Line secondary size={12}>Мышцы сильно забиты — разомнись дольше, работай плавно, без рекордов.</Line>
          )}
        </>
      )}
      <Btn onClick={openReadiness}>{checkin ? 'Изменить' : 'Отметить самочувствие'}</Btn>
    </>
  );

  const startBlock = (() => {
    if (plan.kind === 'nocheckin') return null;
    return (
      <>
        <Section title="План на сегодня" />
        {hasDraft && <Line secondary>Тренировка не закончена. Продолжим с того же места — или начнём заново.</Line>}

        {plan.kind === 'checkpoint' ? (
          <>
            <Line bold accent size={15}>{plan.title}</Line>
            {plan.restLine && <Line secondary>{plan.restLine}</Line>}
            <Btn onClick={() => navigate('/assessment?checkpoint=1')}>Пройти замеры и корректировку</Btn>
            <Line secondary size={12}>
              Минут пять: объёмы, тест силы и самочувствие. Веса подставлю из твоих тренировок — только поправь.
            </Line>
            {hasDraft && next && <Btn onClick={() => startWorkout(true)}>Продолжить тренировку</Btn>}
          </>
        ) : plan.kind === 'rest' ? (
          <>
            <Line bold accent size={15}>{plan.title}</Line>
            {plan.restLine && <Line secondary>{plan.restLine}</Line>}
            {next && (
              <>
                <Btn onClick={() => startWorkout(hasDraft)}>{hasDraft ? 'Продолжить тренировку' : 'Тренироваться сверх плана'}</Btn>
                <Line secondary size={12}>Если есть силы — тренер зачтёт дополнительную тренировку и учтёт её в объёме.</Line>
              </>
            )}
          </>
        ) : (
          <>
            {plan.canStart && next && (
              <>
                <Btn onClick={() => startWorkout(hasDraft)}>{hasDraft ? 'Продолжить тренировку' : 'Начать тренировку'}</Btn>
                {hasDraft && <Btn onClick={() => startWorkout(false)}>Начать заново</Btn>}
              </>
            )}
            {phase && next && nextIdx >= 0 && (
              <Line secondary>День {nextIdx + 1} из {phase.days.length}</Line>
            )}
            {cycle > 1 && nextIdx === 0 && (
              <Line secondary size={12}>Новый круг — вес и повторы тренер подберёт сам</Line>
            )}
            <Line bold accent size={15}>{plan.title}</Line>
            {deload && <Line secondary size={12}>Разгрузка: веса −20 %, подходов меньше на один.</Line>}
            {plan.loadLine && <Line secondary>{plan.loadLine}</Line>}
          </>
        )}
      </>
    );
  })();

  const watchSection = (
    <>
      <Section title="Часы и датчики" />
      <Line secondary>Часы не подключены.</Line>
      <Btn onClick={() => navigate('/settings')}>Настроить часы</Btn>
    </>
  );

  const reminderSection = (
    <>
      <Section title="Напоминание о тренировке" />
      <Line>{remOn ? `Каждый день в ${remTime}` : 'Выключено — тренер не напомнит.'}</Line>
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => setRemPick(true)}
          className="flex-1 rounded-xl border font-semibold text-[14px] px-3 py-3"
          style={{ background: 'var(--p-labels)', borderColor: 'var(--p-outline)', color: 'var(--p-labels-text)' }}
        >
          Время
        </button>
        <button
          onClick={async () => {
            const nextOn = !remOn;
            if (nextOn && 'Notification' in window && Notification.permission === 'default') {
              try { await Notification.requestPermission(); } catch { /* ignore */ }
            }
            setRemOn(nextOn);
            setString('coach_reminder_on', nextOn ? '1' : '');
          }}
          className="flex-[2] rounded-xl border font-semibold text-[14px] px-3 py-3"
          style={{ background: 'var(--p-labels)', borderColor: 'var(--p-outline)', color: 'var(--p-labels-text)' }}
        >
          {remOn ? 'Выключить' : 'Включить напоминание'}
        </button>
      </div>
    </>
  );

  const resetBtn = (
    <button
      onClick={() => {
        if (!window.confirm('Тренер забудет проведённые тренировки, замеры, план сезона и программу, которую собрал сам. Начнёт путь заново: день 1, неделя 1, прогрессия с нуля. Профиль, свои программы и записи дневника сохранятся. Сбросить?')) return;
        coach.resetCoach();
        setToast('Память тренера очищена. Начинаем заново!');
      }}
      className="w-full mt-6 rounded-xl border font-semibold text-[14px] px-4 py-3"
      style={{ background: 'var(--p-labels)', borderColor: 'var(--p-outline)', color: 'var(--p-labels-text)' }}
    >
      Сбросить прогресс тренера
    </button>
  );

  // ---------------------------------------------------------------- путь «своя программа»

  if (coach.coachPath === 'own') {
    return (
      <div className="max-w-2xl mx-auto pb-10 w-full">
        {header}
        <div className="px-4">
          {profileSection}
          <Line bold size={18}>{program.name}</Line>
          {phase && <Line secondary>Фаза: {phase.label} · недели {phase.weekStart}–{phase.weekEnd}</Line>}
          <Line bold size={15}>Неделя {week} из {program.weeks}</Line>
          <Line secondary>
            {plannedPerWeek > 0 && doneThisWeek > plannedPerWeek
              ? `На этой неделе: ${doneThisWeek} (план ${plannedPerWeek}) — идёшь с опережением!`
              : plannedPerWeek > 0
                ? `На этой неделе: ${doneThisWeek} из ${plannedPerWeek} тренировок`
                : `На этой неделе: ${doneThisWeek}`}
          </Line>

          {progUpdated}
          <Btn onClick={() => navigate('/programs/mine')}>Программа тренировки</Btn>
          <Btn onClick={() => { setWeightInput(curWeight > 0 ? fw(curWeight) : ''); setWeightOpen(true); }}>Записать вес</Btn>
          {readinessSection}
          {startBlock}
          <Btn onClick={chooseOwn}>Выбрать другую программу</Btn>
          {watchSection}
          {reminderSection}
          {resetBtn}
        </div>
        {dialogs()}
        {ownChooser}
      </div>
    );
  }

  // ---------------------------------------------------------------- путь тренера

  // Знакомство пройдено, но вводной ещё нет.
  if (!assessment) {
    return (
      <div className="max-w-2xl mx-auto pb-10 w-full">
        {header}
        <div className="px-4">
          {profileSection}
          <Line bold size={18}>{program.name}</Line>
          <Section title="Вводная тренировка" />
          <Line>
            Программа готова, но сначала — калибровка. Пройди вводную: замеры, качество движений и силовой тест
            на базовых. По ней я посчитаю твои максимумы и стартовые веса. Знаешь свои рабочие веса — просто впиши их,
            этого достаточно.
          </Line>
          <Btn onClick={() => navigate('/assessment')}>Пройти вводную тренировку</Btn>
          {progUpdated}
          <Btn onClick={() => navigate('/programs/mine')}>Программа тренировки</Btn>
          {watchSection}
          {reminderSection}
          {resetBtn}
        </div>
        {dialogs()}
      </div>
    );
  }

  // Калибровка пройдена, тренировок ещё нет.
  if (!lastSession) {
    return (
      <div className="max-w-2xl mx-auto pb-10 w-full">
        {header}
        <div className="px-4">
          {profileSection}
          <Line bold size={18}>{program.name}</Line>
          <Section title="Индивидуальная программа готова" />
          <Line>
            Всё готово. Отмечай самочувствие перед каждой тренировкой — я подберу нагрузку. Дальше веди со мной:
            после каждого дня я разберу работу и подготовлю следующий.
          </Line>
          {progUpdated}
          <Btn onClick={() => navigate('/programs/mine')}>Программа тренировки</Btn>
          <Btn onClick={() => { setWeightInput(curWeight > 0 ? fw(curWeight) : ''); setWeightOpen(true); }}>Записать вес</Btn>
          {readinessSection}

          <Section title="Замеры и форма" />
          <Line secondary>
            Последние замеры: {fmtDate(assessment.timestamp)}. Вес {fw(assessment.weightKg)} кг, талия {fw(assessment.waistCm)} см,
            жир {assessment.bodyFatPct > 0 ? fw(assessment.bodyFatPct) : '—'}%.
          </Line>
          <Line secondary>
            {days >= CHECKPOINT_DAYS
              ? `Замерам ${days} дн. — пора чекпоинт, иначе тренер ведёт вслепую.`
              : 'Замеры свежие — тренер видит динамику тела.'}
          </Line>
          <Btn onClick={() => navigate('/assessment?checkpoint=1')}>Замеры и чекпоинт</Btn>

          {phase && next && (
            <Btn onClick={() => startWorkout(false)}>Начать индивидуальную программу</Btn>
          )}
          {watchSection}
          {reminderSection}
          {resetBtn}
        </div>
        {dialogs()}
      </div>
    );
  }

  // ---------------------------------------------------------------- полный экран тренера

  return (
    <div className="max-w-2xl mx-auto pb-10 w-full">
      {header}
      <div className="px-4">
        {profileSection}
        <Line bold size={18}>{program.name}</Line>
        {phase && <Line secondary>Фаза: {phase.label} · недели {phase.weekStart}–{phase.weekEnd}</Line>}
        <Line bold size={15}>
          {cycle > 1 ? `Неделя ${week} из ${program.weeks} · круг ${cycle}` : `Неделя ${week} из ${program.weeks}`}
        </Line>

        <Line secondary>
          {lastSession ? `Последняя тренировка: ${fmtDate(lastSession.ts)}` : 'Ещё не тренировались по этой программе'}
        </Line>
        <Line secondary>
          {plannedPerWeek > 0 && doneThisWeek > plannedPerWeek
            ? `На этой неделе: ${doneThisWeek} (план ${plannedPerWeek}) — идёшь с опережением!`
            : plannedPerWeek > 0
              ? `На этой неделе: ${doneThisWeek} из ${plannedPerWeek} тренировок`
              : `На этой неделе: ${doneThisWeek}`}
        </Line>
        {cycle > 1 && (
          <Line secondary>
            Программа пройдена — веду по кругу: недели и фазы те же, разгрузка по плану, веса продолжают расти.
          </Line>
        )}
        {deload ? (
          <Line bold accent>Разгрузочная неделя: веса и объём снижены автоматически.</Line>
        ) : stalled ? (
          <Line bold accent>
            Тренер советует разгрузку: прогресс встал. На этой неделе снизь вес и объём — восстановись и вернёшься сильнее.
          </Line>
        ) : null}

        {progUpdated}
        <Btn onClick={() => navigate('/programs/mine')}>Программа тренировки</Btn>
        <Btn onClick={() => { setWeightInput(curWeight > 0 ? fw(curWeight) : ''); setWeightOpen(true); }}>Записать вес</Btn>
        {readinessSection}
        {startBlock}

        <Section title="Ограничения по здоровью" />
        {limits.length === 0 ? (
          <Line secondary>Не отмечено. Отметь, если что-то беспокоит — тренер уберёт рискованные упражнения из замен.</Line>
        ) : (
          <Line secondary>Учитываю: {limits.map(k => LIMIT_KEYS.find(x => x.key === k)?.label || k).join(', ')}</Line>
        )}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {LIMIT_KEYS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => toggleLimit(key)}
              className="px-3 py-1.5 rounded-full text-[13px] font-medium border"
              style={limits.includes(key)
                ? { background: 'var(--p-circle)', borderColor: 'var(--p-circle)', color: 'var(--p-on-circle)' }
                : { background: 'var(--p-labels)', borderColor: 'var(--p-outline)', color: 'var(--p-labels-text)' }}
            >
              {label}
            </button>
          ))}
        </div>
        <Line secondary size={12}>
          Упражнения под ограничение не предлагаются в заменах и помечаются в прогрессе. Это не медицинская
          рекомендация — при боли обратитесь к врачу.
        </Line>

        <Section title="Замеры и форма" />
        <Line secondary>
          Последние замеры: {fmtDate(assessment.timestamp)}. Вес {fw(assessment.weightKg)} кг, талия {fw(assessment.waistCm)} см,
          жир {assessment.bodyFatPct > 0 ? fw(assessment.bodyFatPct) : '—'}%.
        </Line>
        <Line secondary>
          {days >= CHECKPOINT_DAYS
            ? `Замерам ${days} дн. — пора чекпоинт, иначе тренер ведёт вслепую.`
            : 'Замеры свежие — тренер видит динамику тела.'}
        </Line>
        <Btn onClick={() => navigate('/assessment?checkpoint=1')}>Замеры и чекпоинт</Btn>

        <Section title="Тренер записал" />
        <Line secondary>Тренировок под контролем: {sessionCount(coach.sessions, program.id)}</Line>
        {lastSession && (
          <>
            <Line secondary>Прошлая: {lastSession.dayTitle || '-'} · {fmtDate(lastSession.ts)}</Line>
            <Line bold accent size={20}>Общий объём: {fw(tonnage(lastSession))} кг</Line>
            {lastRecords.length === 0
              ? <Line bold accent size={14}>Новых рекордов нет — но работа сделана. Так держать!</Line>
              : lastRecords.map((r, i) => <Line key={i} bold accent size={14}>{r}</Line>)}
          </>
        )}

        {debrief && (
          <>
            <Section title="Разбор прошлой тренировки" />
            <Line>
              Подходы: {debrief.done} из {debrief.planned} ({debrief.planned > 0 ? Math.round(debrief.done * 100 / debrief.planned) : 0}%)
            </Line>
            <Line secondary>Закрыто упражнений: {debrief.full} из {debrief.total}</Line>
            {debrief.shortEx.length > 0 ? (
              <>
                <Line secondary>
                  Недобрал: {debrief.shortEx.slice(0, 3).join(', ')}{debrief.shortEx.length > 3 ? ' и др.' : ''}
                </Line>
                <Line>В следующий раз добей эти упражнения с теми же весами — вес поднимем, когда всё закроется.</Line>
              </>
            ) : (
              <Line>Всё закрыто — вес поднимем на следующей тренировке.</Line>
            )}
            {debrief.repsNotes.slice(0, 3).map((note, i) => (
              <Line key={i} secondary>{note}</Line>
            ))}
          </>
        )}

        <Section title="Итог недели" />
        {weekSummary.n === 0 ? (
          <Line secondary>На этой неделе ещё не тренировались.</Line>
        ) : (
          <>
            <Line>
              Тренировок: {weekSummary.n} из {plannedPerWeek} · объём за неделю: {fw(weekSummary.ton)} кг
            </Line>
            {weekSummary.dayTitles.length > 0 && <Line secondary>Дни: {weekSummary.dayTitles.join(', ')}</Line>}
            {plannedPerWeek > 0 && weekSummary.n >= plannedPerWeek
              ? <Line>План недели выполнен. Отдыхай — прогресс идёт во время восстановления.</Line>
              : plannedPerWeek > 0
                ? <Line>Осталось тренировок на этой неделе: {plannedPerWeek - weekSummary.n}</Line>
                : null}
          </>
        )}

        {chart.vals.some(v => v > 0) && (
          <>
            <Section title="Объём по неделям, кг" />
            <div className="mt-2 flex items-end gap-1 h-24">
              {chart.vals.map((v, i) => {
                const max = Math.max(...chart.vals, 1);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t"
                      style={{ height: `${Math.max(2, (v / max) * 80)}px`, background: i === chart.vals.length - 1 ? 'var(--p-circle)' : 'var(--p-outline)' }} />
                    <span className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>{chart.labels[i]}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {plannedPerWeek > 0 && currentWeekIndex(coach.activeSince, now) > 0 && (
          <>
            <Line secondary>Постоянство за 4 недели: {adherePercent(coach.sessions, program.id, coach.activeSince, plannedPerWeek, now)}%</Line>
            <Line secondary>
              {weeksOnPlan(coach.sessions, program.id, coach.activeSince, plannedPerWeek, now) > 0
                ? `Недель подряд по плану: ${weeksOnPlan(coach.sessions, program.id, coach.activeSince, plannedPerWeek, now)}`
                : 'Пока ни одной полной недели — начнём сегодня.'}
            </Line>
          </>
        )}

        <Section title="Объём по мышечным группам" />
        {Object.keys(actualVolume).length > 0 ? (
          <>
            {Object.entries(actualVolume).map(([g, v]) => (
              <Line key={g} secondary>
                {g} — {v} подходов · {v < 10 ? 'мало' : v > 20 ? 'много' : 'норма'}
              </Line>
            ))}
            <Line secondary size={12}>Ориентир: 10–20 рабочих подходов на большие группы в неделю, 6–12 — на малые.</Line>
          </>
        ) : planVolume && !planVolume.empty && planVolume.regionVolume.length > 0 ? (
          <>
            <Line>Объём по плану недели: {planVolume.totalSets} подходов</Line>
            {planVolume.regionVolume.map(([g, v]) => <Line key={g} secondary>{g} — {v} подходов</Line>)}
            {!planVolume.ok && planVolume.tips.length > 0
              ? <Line bold accent>{planVolume.tips[0]}</Line>
              : <Line secondary size={12}>План сбалансирован: ключевые группы под нагрузкой.</Line>}
            <Line secondary size={12}>Факт по группам появится после тренировок этой недели — считаю по журналу.</Line>
          </>
        ) : (
          <Line secondary size={12}>Факт по группам появится после тренировок этой недели — считаю по журналу.</Line>
        )}

        <Section title="План недели" />
        <Line>
          {history.length === 0
            ? 'Начни первую тренировку — дальше тренер поведёт по плану недели.'
            : plannedPerWeek > 0 && doneThisWeek > plannedPerWeek
              ? `Ты опережаешь план (${doneThisWeek} из ${plannedPerWeek}). Не добавляй лишних тренировок — мышцам нужно восстановление.`
              : phase && week >= phase.weekEnd
                ? 'Последняя неделя фазы: разгрузка — веса и объём снижены автоматически.'
                : missedWeeks(coach.sessions, program.id, coach.activeSince, now) > 0
                  ? `Пропущено недель: ${missedWeeks(coach.sessions, program.id, coach.activeSince, now)}. Не гонись за пропущенным — продолжай с того же места, вес сохранится.`
                  : `Идёшь по плану: осталось ${plannedPerWeek > 0 ? Math.max(0, plannedPerWeek - doneThisWeek) : 0} тренировок на этой неделе.`}
        </Line>

        <Section title="Питание и сон" />
        {!(profile && profile.weightKg > 0 && kcalTarget > 0) ? (
          <Line secondary>Заполни профиль (вес, рост, цель) — тренер подставит калории и белок.</Line>
        ) : (
          <>
            <Line>Норма: {Math.round(kcalTarget)} ккал/сутки (по цели из профиля)</Line>
            <Line secondary>Белок: {Math.round(proteinTarget)} г/сутки</Line>
          </>
        )}
        {profile && curWeight > 0 && Number.isFinite(desiredWeight) && desiredWeight > 0 && (
          <Line secondary>
            Цель по весу: {fw(desiredWeight)} кг (
            {Math.abs(desiredWeight - curWeight) < 0.1
              ? 'вы на цели'
              : `${desiredWeight > curWeight ? '+' : '−'}${fw(Math.abs(desiredWeight - curWeight))} кг`})
          </Line>
        )}
        {profile && profile.weightKg > 0 && kcalTarget > 0 && (
          eatenToday.length === 0 ? (
            <Line secondary>Отмечай съеденное в дневнике питания — тогда скажу, чего не хватает.</Line>
          ) : (
            <>
              <Line>
                Съедено сегодня: {eatenKcal} из {Math.round(kcalTarget)} ккал · белок {f1(eatenProtein)} из {f1(proteinTarget)} г
              </Line>
              {proteinTarget - eatenProtein >= 20 ? (
                <Line secondary>Белка не хватает ≈ {f1(proteinTarget - eatenProtein)} г: творог, яйца, рыба или порция протеина.</Line>
              ) : eatenKcal - kcalTarget > 200 ? (
                <Line secondary>Калорий перебор ≈ {eatenKcal - Math.round(kcalTarget)} — убери перекусы или добавь активности.</Line>
              ) : (
                <Line secondary>По питанию в норме — так и держи.</Line>
              )}
              {weekDiary.length >= 2 && (
                <Line secondary size={12}>
                  Средний факт за 7 дней: {avgKcal} ккал · белок {f1(avgProtein)} г ({weekDiary.length} дн.)
                </Line>
              )}
            </>
          )
        )}
        {todayMenu ? (
          <Line secondary>Меню на сегодня: {menuKcal} ккал · белок {Math.round(menuProtein)} г</Line>
        ) : (
          <Line secondary>Меню на сегодня не собрано — собери в «Кухне», и покажу рацион с расчётом.</Line>
        )}
        {avgSleepVal > 0 && (
          <Line secondary>Средний сон за неделю: {f1(avgSleepVal)} из 3 — сон напрямую влияет на силу.</Line>
        )}
        <Line secondary size={12}>Калории и БЖУ считает «КБЖУ», меню — «Кухня», добавки — «Спортпит».</Line>

        <Section title="Прогрессия весов" />
        {(() => {
          const seen: string[] = [];
          if (phase) for (const d of phase.days) for (const s of d.slots) {
            if (s.exercise && !seen.includes(s.exercise)) seen.push(s.exercise);
          }
          return seen.map(ex => {
            if (coach.banned.includes(ex)) {
              return <Line key={ex} secondary>{ex} · исключено</Line>;
            }
            if (conflictsWithLimits(ex, limits)) {
              return <Line key={ex} secondary>{ex} · под ограничение — замени</Line>;
            }
            const last = lastWeight(coach.sessions, ex);
            const repsRange = slotRepsFor(ex);
            const missed = missedStreak(coach.sessions, ex);
            const mass = program.goal === 'mass';
            let text: string;
            if (last <= 0) {
              const seeded = slotStartWeightFor(ex);
              text = seeded > 0
                ? `${ex} · старт ${fw(seeded)} кг — из вводной тренировки`
                : `${ex} · первый подход — выберите рабочий вес`;
            } else if (missed >= 3) {
              text = `${ex} · три стопора подряд — сброс −10%: вес ${fw(dropWeight(coach.sessions, ex))} кг`;
            } else if (!lastSession?.items.some(it => it.exercise === ex && it.sets >= it.targetSets)) {
              text = `${ex} · повтори ${fw(last)} кг — подходы ещё не добиты`;
            } else {
              const nextW = suggestWeight({ sessions: coach.sessions, exercise: ex, goal: program.goal, repRange: repsRange });
              const maxR = maxReps(repsRange);
              const lr = lastReps(coach.sessions, ex);
              if (mass && maxR > 0 && lr > 0 && lr < maxR) {
                text = `${ex} · вес ${fw(last)} кг, повторы доведи до ${maxR} (потом +2,5 кг)`;
              } else if (nextW > last) {
                text = `${ex} · было ${fw(last)} кг → план ${fw(nextW)} кг`;
              } else {
                text = `${ex} · повтори ${fw(last)} кг — подходы ещё не добиты`;
              }
            }
            return <Line key={ex} secondary>{text}</Line>;
          });
        })()}

        {(strength.length > 0 || oneRm.oneRms.length > 0) && (
          <>
            <Section title="Сила (оценка 1ПМ)" />
            {strength.map(({ ex, series }) => (
              <Line key={ex} secondary>
                {series.length === 1
                  ? `${ex}: 1ПМ ≈ ${fw(series[0])} кг`
                  : `${ex}: 1ПМ ${fw(series[0])} → ${fw(series[series.length - 1])} кг`}
              </Line>
            ))}
            {stalled && <Line bold accent>Прогресс встал: 4 тренировки без рекордов — сделай разгрузочную неделю.</Line>}
            {oneRm.oneRms.length > 0 && (
              <>
                <Line secondary size={12}>Сохранённые 1ПМ (рабочие веса — в разделе «1ПМ»)</Line>
                {oneRm.oneRms.map(rm => <Line key={rm.n} secondary>• {rm.n} — 1ПМ {fw(rm.v)} кг</Line>)}
              </>
            )}
          </>
        )}

        <Section title="Тело" />
        {logsAsc.length === 0 ? (
          <Line secondary>Пока нет замеров. Запиши вес — тренер учтёт его в питании и прогрессе.</Line>
        ) : (
          <>
            <Line>Текущий вес: {fw(logsAsc[logsAsc.length - 1].weightKg)} кг</Line>
            {logsAsc.length > 1 && Math.abs(logsAsc[logsAsc.length - 1].weightKg - logsAsc[0].weightKg) >= 0.1 && (
              <Line secondary>
                {logsAsc[logsAsc.length - 1].weightKg >= logsAsc[0].weightKg ? 'С начала наблюдений: +' : 'С начала наблюдений: −'}
                {fw(Math.abs(logsAsc[logsAsc.length - 1].weightKg - logsAsc[0].weightKg))} кг
              </Line>
            )}
            <WeightSpark values={logsAsc.map(l => l.weightKg)} />
          </>
        )}

        <Section title="История тренировок" />
        {(() => {
          const lines = history.filter(s => s.ts !== lastSession.ts).slice(0, 8);
          if (lines.length === 0) {
            return <Line secondary>{history.length === 0
              ? 'Тренировок пока нет. Начните первую — тренер начнёт вести прогресс и веса.'
              : 'Здесь появятся прошлые тренировки после следующей.'}</Line>;
          }
          return lines.map(s => (
            <Line key={s.id} secondary>
              {fmtDate(s.ts)} · {s.dayTitle || '-'} · тоннаж {fw(tonnage(s))} кг
            </Line>
          ));
        })()}

        <Section title="Совет тренера" />
        {(() => {
          if (!knowledgeReady) return <Line secondary>Совет загружается…</Line>;
          const keywords: string[] = [];
          if (checkin) {
            if (checkin.sleep <= 1) keywords.push('сон');
            if (checkin.sore <= 1) keywords.push('крепатур', 'восстанов');
            if (checkin.energy <= 1) keywords.push('энерг', 'отдых');
          }
          if (deload) keywords.push('разгруз');
          if (due) keywords.push('замер');
          if (limits.length) keywords.push('профилакт');
          const tip = findTip(keywords) || rotateTip(Math.floor(now / 86400000));
          if (tip) {
            return (
              <>
                <Line bold size={14}>{tip.title}</Line>
                <Line secondary>{tip.text}</Line>
              </>
            );
          }
          // База знаний не поднялась — лучше старый текст, чем пустой раздел (addTip).
          const day = Math.floor((now - new Date(new Date(now).getFullYear(), 0, 0).getTime()) / 86400000);
          return <Line>{TIPS_FALLBACK[Math.abs(day) % TIPS_FALLBACK.length]}</Line>;
        })()}

        {watchSection}

        <Section title="Подготовка к старту" />
        {!coach.compPhase ? (
          <>
            <Line secondary>
              Соревнований пока нет. Тренер может провести тебя от межсезонья до сцены — с фазами, сушкой и пиком формы.
            </Line>
            <Btn onClick={() => navigate('/coach/onboarding')}>Настроить подготовку к сцене</Btn>
          </>
        ) : (
          <>
            {coach.compDate && (
              <Line bold accent size={15}>
                Старт {fmtDate(coach.compDate)} · через {compDays ?? 0} дн ({compWeeks} нед)
              </Line>
            )}
            <Line>Фаза: {COMP_PHASE_LABELS[coach.compPhase] || coach.compPhase}</Line>
            {coach.compCategory && (
              <>
                <Line secondary>Категория: {compCatLabel(coach.compCategory)}</Line>
                {profile && profile.heightCm > 0 && stageWeightKg(profile.heightCm, coach.compCategory) > 0 && (
                  <Line secondary>
                    Ориентир сцены: {fw(stageWeightKg(profile.heightCm, coach.compCategory))} кг ·
                    межсезонье {fw(offseasonKg(profile.heightCm, coach.compCategory))} кг
                  </Line>
                )}
              </>
            )}
            {coach.compPhase === 'cut' && (
              <>
                <Line secondary>
                  {cutWeeks <= 0 ? 'Вес уже у ориентира — держим форму и сухость' : `До сцены: ${cutWeeks} нед. сушки по 0,5 % массы в неделю`}
                </Line>
                <Line secondary>На сушке: белок {f1(proteinPerKg('cut'))} г/кг, дефицит 400 ккал, силовые не бросаем</Line>
              </>
            )}
            {(coach.compPhase === 'peak' || coach.compPhase === 'day') && (
              <Line secondary>Пик: меньше объёма, выше интенсивность, полный отдых и сон</Line>
            )}
            {coach.prevProgramId && (
              <Btn onClick={() => {
                coach.setActiveProgram(coach.prevProgramId);
                coach.setPrevProgram(null);
                setToast('Вернул прежний блок');
              }}>Вернуть прежний блок</Btn>
            )}
            <Btn onClick={() => navigate('/coach/onboarding')}>Настроить подготовку к сцене</Btn>
          </>
        )}

        {reminderSection}
        {resetBtn}
      </div>

      {dialogs()}
    </div>
  );

  // ---------------------------------------------------------------- диалоги (в конце — общие)

  function dialogs() {
    return (
      <>
        {readinessOpen && (
          <Modal title="Как самочувствие сегодня?" onClose={() => setReadinessOpen(false)}>
            <div className="space-y-4">
              <div>
                <Line secondary>Сон</Line>
                <ChoiceChips
                  options={[{ v: 1, label: 'Плохо' }, { v: 2, label: 'Норма' }, { v: 3, label: 'Отлично' }]}
                  value={pick.sleep}
                  onChange={v => setPick(p => ({ ...p, sleep: v }))}
                />
              </div>
              <div>
                <Line secondary>Забитость мышц</Line>
                <ChoiceChips
                  options={[{ v: 1, label: 'Сильная' }, { v: 2, label: 'Средняя' }, { v: 3, label: 'Нет' }]}
                  value={pick.sore}
                  onChange={v => setPick(p => ({ ...p, sore: v }))}
                />
              </div>
              <div>
                <Line secondary>Энергия</Line>
                <ChoiceChips
                  options={[{ v: 1, label: 'Нет' }, { v: 2, label: 'Есть' }, { v: 3, label: 'Полна' }]}
                  value={pick.energy}
                  onChange={v => setPick(p => ({ ...p, energy: v }))}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setReadinessOpen(false)}
                className="flex-1 rounded-xl border font-semibold py-3"
                style={{ borderColor: 'var(--p-outline)', color: 'var(--p-labels-text)' }}>Отмена</button>
              <button onClick={saveCheckin}
                className="flex-1 rounded-xl border font-semibold py-3"
                style={{ background: 'var(--p-circle)', borderColor: 'var(--p-circle)', color: 'var(--p-on-circle)' }}>Сохранить</button>
            </div>
          </Modal>
        )}

        {weightOpen && (
          <Modal title="Записать вес" onClose={() => setWeightOpen(false)}>
            <input
              value={weightInput}
              onChange={e => setWeightInput(e.target.value)}
              inputMode="decimal"
              placeholder="вес, кг"
              className="w-full px-3 py-3 rounded-xl border text-[15px]"
              style={{ background: 'var(--p-labels)', borderColor: 'var(--p-outline)', color: 'var(--p-labels-text)' }}
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setWeightOpen(false)}
                className="flex-1 rounded-xl border font-semibold py-3"
                style={{ borderColor: 'var(--p-outline)', color: 'var(--p-labels-text)' }}>Отмена</button>
              <button onClick={saveWeight}
                className="flex-1 rounded-xl border font-semibold py-3"
                style={{ background: 'var(--p-circle)', borderColor: 'var(--p-circle)', color: 'var(--p-on-circle)' }}>Сохранить</button>
            </div>
          </Modal>
        )}

        {remPick && (
          <Modal title="Время" onClose={() => setRemPick(false)}>
            <input
              type="time"
              value={remTime}
              onChange={e => { setRemTime(e.target.value); setString('coach_reminder_time', e.target.value); }}
              className="w-full px-3 py-3 rounded-xl border text-[15px]"
              style={{ background: 'var(--p-labels)', borderColor: 'var(--p-outline)', color: 'var(--p-labels-text)' }}
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setRemPick(false)}
                className="flex-1 rounded-xl border font-semibold py-3"
                style={{ borderColor: 'var(--p-outline)', color: 'var(--p-labels-text)' }}>Отмена</button>
              <button onClick={() => setRemPick(false)}
                className="flex-1 rounded-xl border font-semibold py-3"
                style={{ background: 'var(--p-circle)', borderColor: 'var(--p-circle)', color: 'var(--p-on-circle)' }}>ОК</button>
            </div>
          </Modal>
        )}

        {updatedOpen && (
          <Modal title="Программа обновлена" onClose={() => setUpdatedOpen(false)}>
            <p className="text-[14px] leading-snug" style={{ color: 'var(--color-text-main)' }}>
              {coach.programUpdatedNote || 'Сменился блок подготовки — программа пересобрана, план обновлён. Посмотри, при необходимости отредактируй и сохрани.'}
            </p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { coach.clearProgramUpdated(); setUpdatedOpen(false); }}
                className="flex-1 rounded-xl border font-semibold py-3"
                style={{ borderColor: 'var(--p-outline)', color: 'var(--p-labels-text)' }}>Понятно</button>
              <button
                onClick={() => { coach.clearProgramUpdated(); setUpdatedOpen(false); navigate('/programs/mine'); }}
                className="flex-1 rounded-xl border font-semibold py-3"
                style={{ background: 'var(--p-circle)', borderColor: 'var(--p-circle)', color: 'var(--p-on-circle)' }}>Программа тренировки</button>
            </div>
          </Modal>
        )}

        {toast && (
          <div className="fixed left-1/2 -translate-x-1/2 bottom-24 px-4 py-2 rounded-full text-[13px] font-medium z-40"
            style={{ background: 'var(--p-labels)', color: 'var(--p-labels-text)', border: '1px solid var(--p-outline)' }}>
            {toast}
          </div>
        )}
      </>
    );
  }
}

/** Мини-график веса: полилиния без осей, как WeightChartView. */
function WeightSpark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(0.1, max - min);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * 100;
    const y = 30 - ((v - min) / span) * 26 - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 100 30" className="w-full h-[70px] mt-2" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="var(--p-circle)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
