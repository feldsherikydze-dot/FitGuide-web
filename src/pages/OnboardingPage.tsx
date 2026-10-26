// FitGuide Web — экран первого запуска (порт OnboardingActivity.java)
// Короткая анкета: имя, параметры, пол, активность, уровень, цель, направление,
// место, снаряжение, био, страна, город. Всё необязательно, есть «Пропустить».

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfileStore } from '../core/store';
import { getJSON, setJSON, KEYS } from '../core/storage';
import { usePaletteVars } from '../components/ui';
import { GOALS, GOALS_ALL, GOAL_LABELS } from '../core/goals';
import type { UserProfile } from '../data/types';
import { Field, Card, SectionTitle, Hint, PrimaryButton, OutlineButton, Toast } from './progress/common';

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Сидячий' },
  { value: 'light', label: 'Низкий' },
  { value: 'moderate', label: 'Умеренный' },
  { value: 'high', label: 'Высокий' },
  { value: 'athlete', label: 'Очень высокий' },
];

const LEVELS = [
  { value: 'beginner', label: 'Новичок' },
  { value: 'intermediate', label: 'Средний' },
  { value: 'advanced', label: 'Продвинутый' },
];

const STYLES = [
  { value: 'any', label: 'Любое' },
  { value: 'bb', label: 'Бодибилдинг' },
  { value: 'pl', label: 'Пауэрлифтинг' },
];

const EQUIPMENT = [
  { id: 'barbell', label: 'Штанга' },
  { id: 'dumbbell', label: 'Гантели' },
  { id: 'cable', label: 'Блоки' },
  { id: 'smith', label: 'Смит' },
  { id: 'machine', label: 'Тренажёры' },
];

const DEFAULT_PROFILE: UserProfile = {
  name: '', gender: '', age: 0, heightCm: 0, weightKg: 0,
  activityLevel: '', goal: GOALS.MASS, trainStyle: 'any',
  bodyFatPercent: 0, workoutsPerWeek: 0, bio: '', country: '', city: '',
  level: 'intermediate', equipment: [], place: '',
};

function ChipGroup({ options, value, onChange }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {options.map(o => {
        const on = value === o.value;
        return (
          <button key={o.value} onClick={() => onChange(on ? '' : o.value)}
            className="min-h-[32px] px-3 rounded-[8px] text-[13px]"
            style={{
              background: on ? 'var(--p-labels)' : 'var(--color-surface-variant)',
              border: `1px solid ${on ? 'var(--p-labels)' : 'var(--color-stroke)'}`,
              color: on ? 'var(--p-on-labels)' : 'var(--color-text-main)',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function OnboardingPage() {
  const navigate = useNavigate();
  usePaletteVars();

  const [form, setForm] = useState<UserProfile>({ ...DEFAULT_PROFILE });
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof UserProfile>(k: K, v: UserProfile[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const toggleEquip = (id: string) =>
    setForm(f => ({
      ...f,
      equipment: f.equipment.includes(id)
        ? f.equipment.filter(x => x !== id)
        : [...f.equipment, id],
    }));

  const hasNoSelection = () => {
    if (form.gender || form.activityLevel || form.level || form.goal || form.trainStyle || form.place) return false;
    const hasPersonal = form.name.trim() || form.age > 0 || form.heightCm > 0 || form.weightKg > 0;
    const hasDetails = form.bio.trim() || form.country.trim() || form.city.trim();
    return !hasPersonal && !hasDetails;
  };

  const showToast = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 3000);
  };

  const skip = () => {
    setJSON('onboarding_done', true);
    setJSON('profile_skipped', true);
    navigate('/', { replace: true });
  };

  const finish = () => {
    if (hasNoSelection()) {
      showToast('Заполните данные или сделайте выбор');
      return;
    }
    setSaving(true);
    const profile: UserProfile = {
      ...form,
      goal: form.goal || GOALS.MASS,
      level: form.level || 'intermediate',
      trainStyle: form.trainStyle || 'any',
      place: form.place || 'gym',
      equipment: form.equipment.length ? form.equipment : [],
    };
    // Сохраняем профиль через store
    import('../core/store').then(({ useProfileStore }) => {
      useProfileStore.getState().setProfile(profile);
      setJSON('onboarding_done', true);
      navigate('/', { replace: true });
    });
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-lg mx-auto w-full px-5 py-6 space-y-4 flex-1">
        {/* Заголовок */}
        <div>
          <h1 className="text-[28px] font-bold" style={{ color: 'var(--p-labels)' }}>Знакомство</h1>
          <p className="text-[15px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Заполните анкету — приветствие и расчёты станут личными.
          </p>
        </div>

        {/* Ваши данные */}
        <div>
          <h2 className="text-[17px] font-bold" style={{ color: 'var(--p-labels)' }}>Ваши данные</h2>
          <p className="text-[13px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Имя — для приветствия, параметры — для точных расчётов.
          </p>
          <div className="mt-2 space-y-2">
            <Field value={form.name} onChange={v => set('name', v)} placeholder="Имя" />
            <div className="flex gap-2">
              <Field value={form.age > 0 ? String(form.age) : ''} onChange={v => set('age', parseInt(v) || 0)} placeholder="Возраст" inputMode="numeric" className="flex-1" />
              <Field value={form.heightCm > 0 ? String(form.heightCm) : ''} onChange={v => set('heightCm', parseInt(v) || 0)} placeholder="Рост, см" inputMode="numeric" className="flex-1" />
              <Field value={form.weightKg > 0 ? String(form.weightKg) : ''} onChange={v => set('weightKg', parseFloat(v) || 0)} placeholder="Вес, кг" inputMode="decimal" className="flex-1" />
            </div>
          </div>
        </div>

        {/* Пол */}
        <div>
          <h3 className="text-[15px] font-bold" style={{ color: 'var(--color-text-main)' }}>Пол</h3>
          <ChipGroup
            options={[{ value: 'male', label: 'Мужской' }, { value: 'female', label: 'Женский' }]}
            value={form.gender}
            onChange={v => set('gender', v)}
          />
        </div>

        {/* Активность */}
        <div>
          <h3 className="text-[15px] font-bold" style={{ color: 'var(--color-text-main)' }}>Активность</h3>
          <ChipGroup options={ACTIVITY_LEVELS} value={form.activityLevel} onChange={v => set('activityLevel', v)} />
        </div>

        {/* Уровень */}
        <div>
          <h2 className="text-[17px] font-bold" style={{ color: 'var(--p-labels)' }}>Ваш уровень подготовки</h2>
          <p className="text-[13px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Разделяем упражнения под вашу подготовку.
          </p>
          <ChipGroup options={LEVELS} value={form.level} onChange={v => set('level', v)} />
        </div>

        {/* Цель */}
        <div>
          <h2 className="text-[17px] font-bold" style={{ color: 'var(--p-labels)' }}>Цель тренировок</h2>
          <p className="text-[13px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            От цели зависит калораж и структура программы.
          </p>
          <ChipGroup
            options={GOALS_ALL.map(g => ({ value: g, label: GOAL_LABELS[g] }))}
            value={form.goal}
            onChange={v => set('goal', v || GOALS.MASS)}
          />
        </div>

        {/* Направление */}
        <div>
          <h3 className="text-[15px] font-bold" style={{ color: 'var(--color-text-main)' }}>Направление</h3>
          <ChipGroup options={STYLES} value={form.trainStyle} onChange={v => set('trainStyle', v)} />
        </div>

        {/* Место */}
        <div>
          <h3 className="text-[15px] font-bold" style={{ color: 'var(--color-text-main)' }}>Место тренировок</h3>
          <ChipGroup
            options={[{ value: 'home', label: 'Дома' }, { value: 'gym', label: 'Зал' }]}
            value={form.place}
            onChange={v => set('place', v)}
          />
        </div>

        {/* Снаряжение */}
        <div>
          <h3 className="text-[15px] font-bold" style={{ color: 'var(--color-text-main)' }}>Снаряжение</h3>
          <p className="text-[13px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Подберём упражнения под ваше снаряжение.
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {EQUIPMENT.map(e => {
              const on = form.equipment.includes(e.id);
              return (
                <button key={e.id} onClick={() => toggleEquip(e.id)}
                  className="min-h-[32px] px-3 rounded-[8px] text-[13px]"
                  style={{
                    background: on ? 'var(--p-labels)' : 'var(--color-surface-variant)',
                    border: `1px solid ${on ? 'var(--p-labels)' : 'var(--color-stroke)'}`,
                    color: on ? 'var(--p-on-labels)' : 'var(--color-text-main)',
                  }}
                >
                  {e.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Детали */}
        <div>
          <h3 className="text-[15px] font-bold" style={{ color: 'var(--color-text-main)' }}>О себе</h3>
          <div className="mt-2 space-y-2">
            <Field value={form.bio} onChange={v => set('bio', v)} placeholder="Био" />
            <div className="flex gap-2">
              <Field value={form.country} onChange={v => set('country', v)} placeholder="Страна" className="flex-1" />
              <Field value={form.city} onChange={v => set('city', v)} placeholder="Город" className="flex-1" />
            </div>
          </div>
        </div>

        {/* Кнопки */}
        <div className="flex gap-3 pt-4">
          <OutlineButton onClick={skip} className="flex-1">Пропустить</OutlineButton>
          <PrimaryButton onClick={finish} disabled={saving} className="flex-1">
            {saving ? 'Сохранение…' : 'Готово'}
          </PrimaryButton>
        </div>
      </div>

      <Toast text={toast} />
    </div>
  );
}
