// FitGuide Web — генератор программ (порт ProgramBuilderActivity + activity_program_builder.xml)
//
// Один в один с Android: имя, цель (мультивыбор), тип, уровень, дни, недели,
// направление, периодизация, оборудование и карточка «Как это устроено».

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { PageHeader } from '../components/ui';
import { useProgramsStore, useProfileStore } from '../core/store';
import { useExercises } from '../hooks/useExercises';
import {
  generateProgram, buildProgramName, PERIOD_LINEAR, PERIOD_NONE, PERIOD_WAVE,
  TYPE_AUTO, TYPE_CIRCUIT, TYPE_FULLBODY, TYPE_SPLIT,
} from '../core/generator';
import { GOALS_ALL, GOAL_LABELS, normalizeGoal } from '../core/goals';

const LEVELS = [
  { value: 'beginner', label: 'Новичок' },
  { value: 'intermediate', label: 'Средний' },
  { value: 'advanced', label: 'Продвинутый' },
];

const TYPES = [
  { value: TYPE_AUTO, label: 'Авто' },
  { value: TYPE_FULLBODY, label: 'Фулбоди (всё тело)' },
  { value: TYPE_SPLIT, label: 'Сплит' },
  { value: TYPE_CIRCUIT, label: 'Круговая' },
];

const PERIODS = [
  { value: PERIOD_NONE, label: 'Без периодизации' },
  { value: PERIOD_LINEAR, label: 'Линейная (объём → интенсивность → пик)' },
  { value: PERIOD_WAVE, label: 'Волнообразная (чередование)' },
];

const STYLES = [
  { value: 'any', label: 'Без разницы' },
  { value: 'bb', label: 'Бодибилдинг' },
  { value: 'pl', label: 'Пауэрлифтинг' },
];

const EQUIPMENT = [
  { value: 'barbell', label: 'Штанга и грифы' },
  { value: 'dumbbell', label: 'Гантели и свободные веса' },
  { value: 'cable', label: 'Блоки и кроссовер' },
  { value: 'smith', label: 'Смит' },
  { value: 'machine', label: 'Машинные тренажёры' },
];

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={clsx('fg-chip', on && 'fg-chip-on')}>
      {children}
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3.5 mb-1.5 text-[13px] font-bold" style={{ color: 'var(--color-text-secondary)' }}>
      {children}
    </div>
  );
}

export function ProgramGeneratorPage() {
  const navigate = useNavigate();
  const { add } = useProgramsStore();
  const { profile } = useProfileStore();
  const { db } = useExercises();

  const [goals, setGoals] = useState<string[]>(() => {
    const g = normalizeGoal(profile?.goal || 'mass');
    return g ? [g] : [];
  });
  const [name, setName] = useState(profile?.name ? `${profile.name} — программа` : '');
  const [level, setLevel] = useState(profile?.level || 'intermediate');
  const [days, setDays] = useState(profile?.workoutsPerWeek || 4);
  const [weeks, setWeeks] = useState(12);
  const [type, setType] = useState(TYPE_AUTO);
  const [style, setStyle] = useState(profile?.trainStyle || 'any');
  const [period, setPeriod] = useState<number>(PERIOD_LINEAR);
  const [equipment, setEquipment] = useState<string[]>(profile?.equipment || []);

  const toggleGoal = (g: string) =>
    setGoals(list => (list.includes(g) ? list.filter(x => x !== g) : [...list, g]));

  const toggleEquip = (e: string) =>
    setEquipment(list => (list.includes(e) ? list.filter(x => x !== e) : [...list, e]));

  const goal = useMemo(() => goals.join(',') || normalizeGoal(profile?.goal || 'mass'), [goals, profile]);

  const generate = () => {
    if (!db || goals.length === 0) return;
    const program = generateProgram({
      name: name.trim() || buildProgramName(type, days, goal),
      goal,
      level,
      daysPerWeek: days,
      weeks,
      place: profile?.place || 'gym',
      style,
      periodType: period,
      type,
      equipment,
      age: profile?.age,
      female: profile?.gender === 'female',
    }, db);
    add(program);
    navigate('/programs/mine');
  };

  return (
    <div className="max-w-2xl mx-auto pb-4 w-full">
      <PageHeader title="Новая программа" onBack={() => navigate(-1)} />
      <div className="px-3">
        <div className="p-5 rounded-[18px]" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-stroke)' }}>
          <div className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
            Индивидуальные планы по линейной периодизации
          </div>

          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Название программы"
            className="fg-input mt-3"
          />

          <Label>Цель</Label>
          <div className="flex flex-wrap gap-1.5">
            {GOALS_ALL.map(g => (
              <Chip key={g} on={goals.includes(g)} onClick={() => toggleGoal(g)}>
                {GOAL_LABELS[g]}
              </Chip>
            ))}
          </div>

          <Label>Тип программы</Label>
          <div className="flex flex-wrap gap-1.5">
            {TYPES.map(t => (
              <Chip key={t.value} on={type === t.value} onClick={() => setType(t.value)}>{t.label}</Chip>
            ))}
          </div>
          <p className="mt-1.5 text-[12px] leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
            Авто подбирает формат по профилю: фулбоди — новичкам и 2–3 дням в неделю, сплит — 4–6 дням.
            Круговая: короткий отдых, акцент на выносливость и состав тела.
          </p>

          <Label>Уровень подготовки</Label>
          <div className="flex flex-wrap gap-1.5">
            {LEVELS.map(l => (
              <Chip key={l.value} on={level === l.value} onClick={() => setLevel(l.value)}>{l.label}</Chip>
            ))}
          </div>

          <Label>Тренировок в неделю</Label>
          <div className="flex flex-wrap gap-1.5">
            {[3, 4, 5, 6].map(d => (
              <Chip key={d} on={days === d} onClick={() => setDays(d)}>{d} дней в неделю</Chip>
            ))}
          </div>

          <Label>Длительность</Label>
          <div className="flex flex-wrap gap-1.5">
            {[4, 6, 8, 12].map(w => (
              <Chip key={w} on={weeks === w} onClick={() => setWeeks(w)}>{w} нед.</Chip>
            ))}
          </div>

          <Label>Направление тренировок</Label>
          <div className="flex flex-wrap gap-1.5">
            {STYLES.map(s => (
              <Chip key={s.value} on={style === s.value} onClick={() => setStyle(s.value)}>{s.label}</Chip>
            ))}
          </div>

          <Label>Периодизация</Label>
          <div className="flex flex-wrap gap-1.5">
            {PERIODS.map(p => (
              <Chip key={p.value} on={period === p.value} onClick={() => setPeriod(p.value)}>{p.label}</Chip>
            ))}
          </div>

          <Label>Оборудование</Label>
          <div className="flex flex-wrap gap-1.5">
            {EQUIPMENT.map(eq => (
              <Chip key={eq.value} on={equipment.includes(eq.value)} onClick={() => toggleEquip(eq.value)}>
                {eq.label}
              </Chip>
            ))}
          </div>
          <p className="mt-1.5 text-[12px] leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
            Отметь, что есть в твоём зале. Ничего не выбрано — считаем, что есть всё.
          </p>

          <button
            onClick={generate}
            disabled={!db || goals.length === 0}
            className="mt-4 w-full h-[50px] rounded-[25px] text-[16px] font-bold disabled:opacity-50"
            style={{ background: 'var(--p-labels)', color: 'var(--p-on-labels)' }}
          >
            Сгенерировать программу
          </button>
        </div>

        <div className="mt-2 p-5 rounded-[18px]" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-stroke)' }}>
          <div className="text-[16px] font-bold" style={{ color: 'var(--color-text-main)' }}>Как это устроено</div>
          <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            Линейная периодизация: мезоцикл делится на фазы «накопление объёма → интенсификация → пик силы».
            Сначала растёт количество работы (объём), затем сила и интенсивность. Каждая фаза уточняет подходы,
            повторы и отдых. Прогрессия нагрузок чередуется с фазами объёма, чтобы мышцы успевали
            восстанавливаться и расти.
          </p>
        </div>
      </div>
    </div>
  );
}
