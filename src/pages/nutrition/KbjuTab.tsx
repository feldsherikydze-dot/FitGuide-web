// Вкладка «КБЖУ» (порт KbjuFragment + activity_kbju.xml).
// Калькулятор калорий, БЖУ, воды, идеального веса и ИМТ.

import { useCallback, useMemo, useState } from 'react';
import { useProfileStore } from '../../core/store';
import { getString, setString } from '../../core/storage';
import {
  calorieDelta, caloriesFor, fatsPerKg, goalLabel, GOALS_ALL, GOAL_LABELS, normalizeGoal,
  proteinPerKg,
} from '../../core/goals';
import { Field, Card, Hint, OutlineButton, PrimaryButton, SectionTitle, Toast, trimNum, parseInt10, parseNum } from '../progress/common';
import { MaskIcon, asset } from '../../components/ui';

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

export function KbjuTab() {
  const { profile } = useProfileStore();
  const [gender, setGender] = useState(profile?.gender || 'male');
  const [activity, setActivity] = useState(profile?.activityLevel || 'moderate');
  const [goal, setGoal] = useState(profile?.goal || 'mass');
  const [formula, setFormula] = useState('mifflin');
  const [macro, setMacro] = useState('balanced');
  const [age, setAge] = useState((profile?.age || 0) > 0 ? String(profile?.age || 0) : '');
  const [height, setHeight] = useState((profile?.heightCm || 0) > 0 ? String(profile?.heightCm || 0) : '');
  const [weight, setWeight] = useState((profile?.weightKg || 0) > 0 ? (profile?.weightKg || 0).toFixed(1) : '');
  const [desired, setDesired] = useState(getString('kbju_desired_weight', ''));
  const [bodyFat, setBodyFat] = useState('');

  const [calc, setCalc] = useState<{
    kcal: number; bmr: number; tdee: number; protein: number; fat: number; carbs: number;
    water: number; ideal: number; bmi: number; bmiCat: string; desiredText: string;
  } | null>(null);

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
      setToast('Заполните параметры для расчёта');
      return;
    }
    const needsLean = formula === 'katch' || formula === 'cunningham';
    if (needsLean && bf <= 0) {
      setToast('Укажите процент жира для выбранной формулы');
      return;
    }

    const act = ACTIVITIES.find(x => x.value === activity)!;
    const bmr = bmrFor(formula, gender, w, h, a, bf);
    const tdee = bmr * act.factor;
    const kcal = Math.max(0, caloriesFor(tdee, goal, gender));
    const m = MACROS.find(x => x.value === macro)!;
    const protein = Math.max(0, Math.round(kcal * m.p / 4));
    const fat = Math.max(0, Math.round(kcal * m.f / 9));
    const carbs = Math.max(0, Math.round(kcal * m.c / 4));
    const water = Math.round(w * 30);
    const ideal = Math.max(0, maleIdeal(gender, h));
    const bmi = w / Math.pow(h / 100, 2);

    let desiredText = '';
    if (desired.trim()) {
      const d = parseNum(desired);
      if (Number.isFinite(d)) {
        setString('kbju_desired_weight', desired);
        const diff = d - w;
        const trend = Math.abs(diff) < 0.1
          ? '— вы на цели!'
          : diff > 0 ? `+${diff.toFixed(1)} кг до цели` : `${diff.toFixed(1)} кг до цели`;
        desiredText = `Желаемый вес: ${d.toFixed(1)} кг · ${trend}`;
      }
    }

    setCalc({ kcal, bmr, tdee, protein, fat, carbs, water, ideal, bmi, bmiCat: bmiCategory(bmi), desiredText });
    setToast('');
  };

  const maleIdeal = (g: string, h: number) =>
    g === 'male' ? 50 + 0.91 * (h - 152.4) : 45.5 + 0.91 * (h - 152.4);

  const showToast = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 2500);
  };
  const [toast, setToast] = useState<string | null>('');

  return (
    <div className="pb-6 space-y-2">
      <Card className="mt-2">
        <SectionTitle>Параметры</SectionTitle>
        <Hint className="mt-0.5">Норма калорий, БЖУ и максимум в упражнении под вашу цель</Hint>

        <div className="mt-2 flex gap-1.5">
          {GENDERS.map(g => {
            const on = gender === g.value;
            return (
              <button key={g.value} onClick={() => setGender(g.value)}
                className="min-h-[32px] px-3 rounded-[8px] text-[13px]"
                style={{
                  background: on ? 'var(--p-labels)' : 'var(--color-surface-variant)',
                  border: `1px solid ${on ? 'var(--p-labels)' : 'var(--color-stroke)'}`,
                  color: on ? 'var(--p-on-labels)' : 'var(--color-text-main)',
                }}
              >
                {g.label}
              </button>
            );
          })}
        </div>

        <div className="mt-2 space-y-1.5">
          <Field value={age} onChange={setAge} placeholder="возраст, лет" inputMode="numeric" />
          <div className="flex gap-2">
            <Field value={height} onChange={setHeight} placeholder="рост, см" inputMode="numeric" className="flex-1" />
            <Field value={weight} onChange={setWeight} placeholder="вес, кг" inputMode="decimal" className="flex-1" />
          </div>
          <Field value={desired} onChange={setDesired} placeholder="К какому весу стремимся" inputMode="decimal" />
          <Field value={bodyFat} onChange={setBodyFat} placeholder="% жира" inputMode="decimal" />
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {ACTIVITIES.map(a => {
            const on = activity === a.value;
            return (
              <button key={a.value} onClick={() => setActivity(a.value)}
                className="min-h-[32px] px-3 rounded-[8px] text-[13px]"
                style={{
                  background: on ? 'var(--p-labels)' : 'var(--color-surface-variant)',
                  border: `1px solid ${on ? 'var(--p-labels)' : 'var(--color-stroke)'}`,
                  color: on ? 'var(--p-on-labels)' : 'var(--color-text-main)',
                }}
              >
                {a.label}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {GOALS_ALL.map(g => {
            const on = goal === g;
            return (
              <button key={g} onClick={() => setGoal(g)}
                className="min-h-[32px] px-3 rounded-[8px] text-[13px]"
                style={{
                  background: on ? 'var(--p-labels)' : 'var(--color-surface-variant)',
                  border: `1px solid ${on ? 'var(--p-labels)' : 'var(--color-stroke)'}`,
                  color: on ? 'var(--p-on-labels)' : 'var(--color-text-main)',
                }}
              >
                {GOAL_LABELS[g]}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {FORMULAS.map(f => {
            const on = formula === f.value;
            return (
              <button key={f.value} onClick={() => setFormula(f.value)}
                className="min-h-[32px] px-3 rounded-[8px] text-[13px]"
                style={{
                  background: on ? 'var(--p-labels)' : 'var(--color-surface-variant)',
                  border: `1px solid ${on ? 'var(--p-labels)' : 'var(--color-stroke)'}`,
                  color: on ? 'var(--p-on-labels)' : 'var(--color-text-main)',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {MACROS.map(m => {
            const on = macro === m.value;
            return (
              <button key={m.value} onClick={() => setMacro(m.value)}
                className="min-h-[32px] px-3 rounded-[8px] text-[13px]"
                style={{
                  background: on ? 'var(--p-labels)' : 'var(--color-surface-variant)',
                  border: `1px solid ${on ? 'var(--p-labels)' : 'var(--color-stroke)'}`,
                  color: on ? 'var(--p-on-labels)' : 'var(--color-text-main)',
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex gap-2">
          <OutlineButton onClick={fillFromProfile} className="flex-1">Заполнить из профиля</OutlineButton>
          <PrimaryButton onClick={calculate} className="flex-1">Рассчитать</PrimaryButton>
        </div>
      </Card>

      {calc && (
        <Card>
          <SectionTitle>Результат</SectionTitle>
          <Hint className="mt-0.5">ккал в сутки</Hint>
          <div className="mt-1 text-[40px] font-bold tabular-nums" style={{ color: 'var(--p-labels)' }}>
            {calc.kcal.toFixed(0)}
          </div>
          <div className="mt-1 grid grid-cols-3 gap-2 text-[14px]">
            <div className="flex flex-col">
              <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>{goalLabel(goal)}</span>
              <span style={{ color: 'var(--color-text-main)', fontWeight: 600 }}>{calc.protein} г</span>
            </div>
            <div className="flex flex-col">
              <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>Жиры</span>
              <span style={{ color: 'var(--color-text-main)', fontWeight: 600 }}>{calc.fat} г</span>
            </div>
            <div className="flex flex-col">
              <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>Углеводы</span>
              <span style={{ color: 'var(--color-text-main)', fontWeight: 600 }}>{calc.carbs} г</span>
            </div>
          </div>
          <div className="mt-2 space-y-1 text-[13px]">
            <div className="flex justify-between">
              <span style={{ color: 'var(--color-text-secondary)' }}>Базовый обмен (BMR)</span>
              <span style={{ color: 'var(--color-text-main)', fontWeight: 600 }}>{calc.bmr.toFixed(0)} ккал</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--color-text-secondary)' }}>С учётом активности (TDEE)</span>
              <span style={{ color: 'var(--color-text-main)', fontWeight: 600 }}>{calc.tdee.toFixed(0)} ккал</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--color-text-secondary)' }}>Вода</span>
              <span style={{ color: 'var(--color-text-main)', fontWeight: 600 }}>{calc.water} мл/день</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--color-text-secondary)' }}>Идеал. вес (Девин)</span>
              <span style={{ color: 'var(--color-text-main)', fontWeight: 600 }}>{calc.ideal.toFixed(1)} кг</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--color-text-secondary)' }}>ИМТ</span>
              <span style={{ color: 'var(--color-text-main)', fontWeight: 600 }}>
                {calc.bmi.toFixed(1)} · {calc.bmiCat}
              </span>
            </div>
          </div>
          {calc.desiredText && (
            <div className="mt-1.5 text-[13px]" style={{ color: 'var(--p-labels)' }}>
              {calc.desiredText}
            </div>
          )}
        </Card>
      )}

      <Toast text={toast} />
    </div>
  );
}
