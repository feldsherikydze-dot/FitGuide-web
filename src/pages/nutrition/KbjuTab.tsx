// Вкладка «КБЖУ» — порт KbjuFragment + activity_kbju.xml.
//
// Порядок как в разметке Android:
//   Пол → Возраст/Рост/Вес в один ряд → Желаемый вес → Уровень активности →
//   Цель питания → Формула расчёта → Распределение БЖУ → Процент жира →
//   «Заполнить из профиля» (44dp, outlined) → «Рассчитать» (50dp, primary).
// Результат: плашка bg_result с 42sp калориями, три колонки БЖУ 24sp,
// строки ИМТ/BMR/TDEE/Вода/Идеал/Желаемый вес и блок «Расчёт на целевой вес».

import { useCallback, useState } from 'react';
import { useProfileStore } from '../../core/store';
import { getString, setString } from '../../core/storage';
import {
  caloriesFor, goalLabel, GOALS_ALL, GOAL_LABELS, normalizeGoal,
} from '../../core/goals';
import { Field, Toast, parseInt10, parseNum } from '../progress/common';

const GENDERS = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
];
const ACTIVITIES = [
  { value: 'sedentary', label: 'Сидячий', factor: 1.2 },
  { value: 'light', label: 'Низкий', factor: 1.375 },
  { value: 'moderate', label: 'Умеренный', factor: 1.55 },
  { value: 'high', label: 'Высокий', factor: 1.725 },
  { value: 'athlete', label: 'Очень высокий', factor: 1.9 },
];
const FORMULAS = [
  { value: 'mifflin', label: 'Миффлин' },
  { value: 'harris', label: 'Харрис-Бенедикт' },
  { value: 'katch', label: 'Катч-МакАрдл' },
  { value: 'cunningham', label: 'Каннингем' },
  { value: 'who', label: 'ВОЗ (по весу)' },
];
const MACROS = [
  { value: 'balanced', label: 'Сбалансированное (30/30/40)', p: 0.30, f: 0.30, c: 0.40 },
  { value: 'lowcarb', label: 'Низкоуглеводное (40/35/25)', p: 0.40, f: 0.35, c: 0.25 },
  { value: 'highpro', label: 'Высокобелковое (40/30/30)', p: 0.40, f: 0.30, c: 0.30 },
  { value: 'keto', label: 'Кето (25/50/25)', p: 0.25, f: 0.50, c: 0.25 },
];

/** Формулы BMR — точь-в-точь KbjuFragment.bmrFor. */
function bmrFor(formula: string, gender: string, w: number, h: number, a: number, bodyFat: number): number {
  const male = gender === 'male';
  let result = 0;
  switch (formula) {
    case 'harris':
      result = male
        ? 88.362 + 13.397 * w + 4.799 * h - 5.677 * a
        : 447.593 + 9.247 * w + 3.098 * h - 4.330 * a;
      break;
    case 'katch': {
      const lbm = w * (1 - bodyFat / 100);
      result = 370 + 21.6 * lbm;
      break;
    }
    case 'cunningham': {
      const lbm = w * (1 - bodyFat / 100);
      result = 500 + 22 * lbm;
      break;
    }
    case 'who':
      if (male) {
        result = a < 30 ? 15.057 * w + 692.2 : a <= 60 ? 11.6 * w + 879 : 13.5 * w + 487;
      } else {
        result = a < 30 ? 14.818 * w + 486.6 : a <= 60 ? 8.126 * w + 845.6 : 9.082 * w + 658.5;
      }
      break;
    case 'mifflin':
    default:
      result = 10 * w + 6.25 * h - 5 * a + (male ? 5 : -161);
      break;
  }
  return Math.max(result, 0);
}

function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return 'Дефицит';
  if (bmi < 25) return 'Норма';
  if (bmi < 30) return 'Избыток';
  return 'Ожирение';
}

/** Идеальный вес по Девину. */
function idealWeight(gender: string, height: number): number {
  return gender === 'male'
    ? 50 + 0.91 * (height - 152.4)
    : 45.5 + 0.91 * (height - 152.4);
}

const f1 = (n: number) => n.toFixed(1);
const f0 = (n: number) => n.toFixed(0);

/** Карточка как MaterialCardView после tintTree: фон (B), обводка (A), радиус 18dp, отступы 20dp. */
function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mx-2 my-2 rounded-[18px] p-5"
      style={{ background: 'var(--p-labels)', border: '1px solid var(--p-outline)' }}
    >
      {children}
    </div>
  );
}

/** Подпись группы — 13sp bold textSecondary. */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3.5 text-[13px] font-bold" style={{ color: 'var(--color-text-secondary)' }}>
      {children}
    </div>
  );
}

export function KbjuTab() {
  const { profile } = useProfileStore();
  const [gender, setGender] = useState(profile?.gender || 'male');
  const [activity, setActivity] = useState(profile?.activityLevel || 'moderate');
  const [goal, setGoal] = useState(profile?.goal ? normalizeGoal(profile.goal) : 'mass');
  const [formula, setFormula] = useState('mifflin');
  const [macro, setMacro] = useState('balanced');
  const [age, setAge] = useState((profile?.age || 0) > 0 ? String(profile?.age || 0) : '');
  const [height, setHeight] = useState((profile?.heightCm || 0) > 0 ? String(profile?.heightCm || 0) : '');
  const [weight, setWeight] = useState((profile?.weightKg || 0) > 0 ? (profile?.weightKg || 0).toFixed(1) : '');
  const [desired, setDesired] = useState(getString('kbju_desired_weight', ''));
  const [bodyFat, setBodyFat] = useState('');
  const [toast, setToast] = useState<string | null>('');

  const [calc, setCalc] = useState<{
    kcal: number; protein: number; fat: number; carbs: number;
    bmi: string; bmr: string; tdee: string; water: string; ideal: string;
    desiredText: string;
    target: { kcal: number; protein: number; fat: number; carbs: number; bmi: string; water: string } | null;
  } | null>(null);

  const showToast = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 2500);
  };

  const fillFromProfile = useCallback(() => {
    if (!profile) return;
    if (profile.age > 0) setAge(String(profile.age));
    if (profile.heightCm > 0) setHeight(String(profile.heightCm));
    if (profile.weightKg > 0) setWeight(profile.weightKg.toFixed(1));
    if (profile.gender) setGender(profile.gender);
    if (profile.activityLevel) setActivity(profile.activityLevel);
    if (profile.goal) setGoal(normalizeGoal(profile.goal));
  }, [profile]);

  const calculate = () => {
    const a = parseInt10(age);
    const h = parseInt10(height);
    const w = parseNum(weight);
    const bf = parseNum(bodyFat);

    if (a <= 0 || h <= 0 || w <= 0 || !gender || !activity || !goal) {
      showToast('Заполните параметры для расчёта');
      return;
    }
    const needsLean = formula === 'katch' || formula === 'cunningham';
    if (needsLean && bf <= 0) {
      showToast('Укажите процент жира для выбранной формулы');
      return;
    }

    const act = ACTIVITIES.find(x => x.value === activity)!;
    const m = MACROS.find(x => x.value === macro)!;
    const bmr = bmrFor(formula, gender, w, h, a, bf);
    const tdee = bmr * act.factor;
    const kcal = Math.max(0, caloriesFor(tdee, goal, gender));
    const protein = Math.max(0, Math.round(kcal * m.p / 4));
    const fat = Math.max(0, Math.round(kcal * m.f / 9));
    const carbs = Math.max(0, Math.round(kcal * m.c / 4));
    const bmi = w / Math.pow(h / 100, 2);

    // Желаемый вес: сохраняем и сравниваем с текущим.
    const desiredStr = desired.trim();
    let desiredText = '';
    let desiredValue = 0;
    if (desiredStr) {
      setString('kbju_desired_weight', desiredStr);
      desiredValue = parseNum(desiredStr);
      if (Number.isFinite(desiredValue)) {
        const diff = desiredValue - w;
        const trend = Math.abs(diff) < 0.1
          ? '— вы на цели!'
          : diff > 0 ? `+${f1(diff)} кг до цели` : `${f1(diff)} кг до цели`;
        desiredText = `Желаемый вес: ${f1(desiredValue)} кг · ${trend}`;
      }
    } else {
      setString('kbju_desired_weight', '');
    }

    // Расчёт под целевой вес — блок появляется, только если цель отличается от текущего веса.
    let target = null;
    if (desiredValue > 0 && Math.abs(desiredValue - w) >= 0.1) {
      const tBmr = bmrFor(formula, gender, desiredValue, h, a, bf);
      const tTdee = tBmr * act.factor;
      const tCal = Math.max(0, caloriesFor(tTdee, goal, gender));
      const tBmi = desiredValue / Math.pow(h / 100, 2);
      target = {
        kcal: tCal,
        protein: Math.max(0, Math.round(tCal * m.p / 4)),
        fat: Math.max(0, Math.round(tCal * m.f / 9)),
        carbs: Math.max(0, Math.round(tCal * m.c / 4)),
        bmi: `ИМТ: ${f1(tBmi)} · ${bmiCategory(tBmi)}`,
        water: `Вода: ${f0(desiredValue * 30)} мл/день`,
      };
    }

    setCalc({
      kcal, protein, fat, carbs,
      bmi: `ИМТ: ${f1(bmi)} · ${bmiCategory(bmi)}`,
      bmr: `Базовый обмен (BMR): ${f0(bmr)} ккал`,
      tdee: `С учётом активности (TDEE): ${f0(tdee)} ккал`,
      water: `Вода: ${f0(w * 30)} мл/день`,
      ideal: `Идеал. вес (Девин): ${f1(Math.max(idealWeight(gender, h), 0))} кг`,
      desiredText,
      target,
    });
    setToast('');
  };

  const chip = (active: boolean) => `fg-chip ${active ? 'fg-chip-on' : ''}`;
  const secondary = { color: 'var(--color-text-secondary)' } as const;

  return (
    <div className="pb-4">
      <SettingsCard>
        <div className="text-[16px] font-bold" style={{ color: 'var(--color-text-main)' }}>Параметры</div>
        <div className="mt-1 text-[13px]" style={secondary}>
          Норма калорий, БЖУ и максимум в упражнении под вашу цель
        </div>

        <Label>Пол</Label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {GENDERS.map(g => (
            <button key={g.value} onClick={() => setGender(g.value)} className={chip(gender === g.value)}>
              {g.label}
            </button>
          ))}
        </div>

        <div className="mt-3.5 flex gap-2.5">
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold" style={secondary}>Возраст</div>
            <Field className="mt-1.5" value={age} onChange={setAge} placeholder="возраст, лет" inputMode="numeric" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold" style={secondary}>Рост</div>
            <Field className="mt-1.5" value={height} onChange={setHeight} placeholder="рост, см" inputMode="numeric" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold" style={secondary}>Вес</div>
            <Field className="mt-1.5" value={weight} onChange={setWeight} placeholder="вес, кг" inputMode="decimal" />
          </div>
        </div>

        <Label>Желаемый вес, кг</Label>
        <Field className="mt-1.5" value={desired} onChange={setDesired} placeholder="К какому весу стремимся" inputMode="decimal" />

        <Label>Уровень активности</Label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {ACTIVITIES.map(a => (
            <button key={a.value} onClick={() => setActivity(a.value)} className={chip(activity === a.value)}>
              {a.label}
            </button>
          ))}
        </div>

        <Label>Цель питания</Label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {GOALS_ALL.map(g => (
            <button key={g} onClick={() => setGoal(g)} className={chip(goal === g)}>
              {GOAL_LABELS[g]}
            </button>
          ))}
        </div>

        <Label>Формула расчёта</Label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {FORMULAS.map(f => (
            <button key={f.value} onClick={() => setFormula(f.value)} className={chip(formula === f.value)}>
              {f.label}
            </button>
          ))}
        </div>

        <Label>Распределение БЖУ (% калорий)</Label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {MACROS.map(m => (
            <button key={m.value} onClick={() => setMacro(m.value)} className={chip(macro === m.value)}>
              {m.label}
            </button>
          ))}
        </div>

        <Label>Процент жира, % (для Катча и Каннингема)</Label>
        <Field className="mt-1.5" value={bodyFat} onChange={setBodyFat} placeholder="% жира" inputMode="decimal" />
        <div className="mt-1 text-[11px] leading-snug" style={secondary}>
          Необязательно. Без него используются формулы без массы тела.
        </div>

        <button
          onClick={fillFromProfile}
          className="fg-btn fg-btn-primary w-full mt-4"
          style={{ height: 44, borderRadius: 22 }}
        >
          Заполнить из профиля
        </button>
        <button
          onClick={calculate}
          className="fg-btn fg-btn-primary w-full mt-2.5"
          style={{ height: 50, borderRadius: 25, fontSize: 16 }}
        >
          Рассчитать
        </button>
      </SettingsCard>

      {calc && (
        <SettingsCard>
          <div className="text-[16px] font-bold" style={{ color: 'var(--color-text-main)' }}>Результат</div>

          <div
            className="mt-3.5 flex flex-col items-center rounded-[16px] pb-3.5"
            style={{ background: 'var(--p-preset-tint)' }}
          >
            <div
              className="pt-[18px] text-[42px] font-bold leading-none tabular-nums"
              style={{ color: 'var(--p-preset-primary)' }}
            >
              {f0(calc.kcal)}
            </div>
            <div className="mt-1 text-[13px]" style={secondary}>ккал в сутки</div>
          </div>

          <div className="mt-4 flex">
            {[
              { v: calc.protein, l: 'Белки' },
              { v: calc.fat, l: 'Жиры' },
              { v: calc.carbs, l: 'Углеводы' },
            ].map(col => (
              <div key={col.l} className="flex-1 flex flex-col items-center">
                <span className="text-[24px] font-bold leading-tight" style={{ color: 'var(--color-text-main)' }}>
                  {col.v}
                </span>
                <span className="text-[12px]" style={secondary}>{col.l}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-1 text-[13px]" style={secondary}>
            <div>{calc.bmi}</div>
            <div>{calc.bmr}</div>
            <div>{calc.tdee}</div>
            <div>{calc.water}</div>
            <div>{calc.ideal}</div>
            {calc.desiredText && <div>{calc.desiredText}</div>}
          </div>

          {calc.target && (
            <div className="mt-3.5">
              <div className="text-[14px] font-bold" style={{ color: 'var(--color-text-main)' }}>
                Расчёт на целевой вес
              </div>

              <div
                className="mt-2.5 flex flex-col items-center rounded-[16px] pb-3"
                style={{ background: 'var(--p-preset-tint)' }}
              >
                <div
                  className="pt-4 text-[34px] font-bold leading-none tabular-nums"
                  style={{ color: 'var(--p-preset-primary)' }}
                >
                  {f0(calc.target.kcal)}
                </div>
                <div className="mt-1 text-[13px]" style={secondary}>ккал в сутки</div>
              </div>

              <div className="mt-3 flex">
                {[
                  { v: calc.target.protein, l: 'Белки' },
                  { v: calc.target.fat, l: 'Жиры' },
                  { v: calc.target.carbs, l: 'Углеводы' },
                ].map(col => (
                  <div key={col.l} className="flex-1 flex flex-col items-center">
                    <span className="text-[20px] font-bold leading-tight" style={{ color: 'var(--color-text-main)' }}>
                      {col.v}
                    </span>
                    <span className="text-[12px]" style={secondary}>{col.l}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 space-y-1 text-[13px]" style={secondary}>
                <div>{calc.target.bmi}</div>
                <div>{calc.target.water}</div>
              </div>
            </div>
          )}
        </SettingsCard>
      )}

      <Toast text={toast} />
    </div>
  );
}
