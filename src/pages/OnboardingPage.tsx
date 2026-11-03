// FitGuide Web — экран первого запуска (порт OnboardingActivity.java / activity_onboarding.xml)
// Порядок блоков как в Android 1.18: данные, пол, активность, уровень, цель,
// направление, снаряжение (место), о себе, страна/город, «Пропустить»/«Готово».

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfileStore } from '../core/store';
import { setJSON } from '../core/storage';
import { usePaletteVars } from '../components/ui';
import { GOALS, GOALS_ALL, GOAL_LABELS } from '../core/goals';
import type { UserProfile } from '../data/types';
import { Field, Toast } from './progress/common';

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
  { value: 'any', label: 'Без разницы' },
  { value: 'bb', label: 'Бодибилдинг' },
  { value: 'pl', label: 'Пауэрлифтинг' },
];

const PLACES = [
  { value: 'home', label: 'Дома' },
  { value: 'gym', label: 'Зал' },
];

const DEFAULT_PROFILE: UserProfile = {
  name: '', gender: '', age: 0, heightCm: 0, weightKg: 0,
  activityLevel: '', goal: '', trainStyle: '',
  bodyFatPercent: 0, workoutsPerWeek: 0, bio: '', country: '', city: '',
  level: '', equipment: [], place: '',
};

/** Заголовок раздела: 17sp bold, цвет (D) — как ?attr/appTextHeader. 
 *  Описание под заголовком: 13sp, серый — как @color/textSecondary. */
function SectionHeader({ title, desc, first }: { title: string; desc?: string; first?: boolean }) {
  return (
    <>
      <h2
        className={first ? 'text-[17px] font-bold mt-6' : 'text-[17px] font-bold mt-7'}
        style={{ color: 'var(--p-labels-text)' }}
      >
        {title}
      </h2>
      {desc && (
        <p className="text-[13px] mt-1 leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
          {desc}
        </p>
      )}
    </>
  );
}

/** Чипы как ChipFactory: фон (B), обводка (A), текст (D); выбран — фон (C). */
function ChipGroup({ options, value, onChange }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 mt-2.5">
      {options.map(o => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(on ? '' : o.value)}
            className="min-h-[32px] px-3.5 rounded-full text-[14px] active:opacity-80"
            style={{
              background: on ? 'var(--p-circle)' : 'var(--p-labels)',
              border: '1px solid var(--p-outline)',
              color: on ? 'var(--p-on-circle)' : 'var(--p-labels-text)',
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
  const { profile, setProfile } = useProfileStore();
  usePaletteVars();

  const [form, setForm] = useState<UserProfile>(() => ({ ...DEFAULT_PROFILE, ...(profile ?? {}) }));
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof UserProfile>(k: K, v: UserProfile[K]) =>
    setForm(f => ({ ...f, [k]: v }));

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
    const next: UserProfile = {
      ...form,
      goal: form.goal || GOALS.MASS,
      level: form.level || 'intermediate',
      trainStyle: form.trainStyle || 'any',
      place: form.place || 'gym',
    };
    setProfile(next);
    setJSON('onboarding_done', true);
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen w-full max-w-full" style={{ background: 'var(--color-bg)' }}>
      <div className="mx-auto w-full max-w-lg px-5 pt-6 pb-6">
        <h1 className="text-[28px] font-bold leading-tight" style={{ color: 'var(--p-labels-text)' }}>
          Знакомство
        </h1>
        <p className="text-[15px] mt-2 leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
          Заполните анкету — приветствие и расчёты станут личными.
        </p>

        {/* Ваши данные */}
        <SectionHeader
          first
          title="Ваши данные"
          desc="Имя — для приветствия, параметры — для точных расчётов."
        />
        <div className="mt-2.5 space-y-2.5">
          <Field
            value={form.name}
            onChange={v => set('name', v)}
            placeholder="Как к вам обращаться"
            inputMode="text"
          />
          <div className="flex gap-2.5">
            <Field
              label="Возраст"
              value={form.age > 0 ? String(form.age) : ''}
              onChange={v => set('age', parseInt(v) || 0)}
              placeholder="года"
              inputMode="numeric"
              className="flex-1"
            />
            <Field
              label="Рост"
              value={form.heightCm > 0 ? String(form.heightCm) : ''}
              onChange={v => set('heightCm', parseInt(v) || 0)}
              placeholder="см"
              inputMode="numeric"
              className="flex-1"
            />
            <Field
              label="Вес"
              value={form.weightKg > 0 ? String(form.weightKg) : ''}
              onChange={v => set('weightKg', parseFloat(v) || 0)}
              placeholder="кг"
              inputMode="decimal"
              className="flex-1"
            />
          </div>
        </div>

        {/* Пол */}
        <SectionHeader title="Пол" />
        <ChipGroup
          options={[{ value: 'male', label: 'Мужской' }, { value: 'female', label: 'Женский' }]}
          value={form.gender}
          onChange={v => set('gender', v)}
        />

        {/* Активность */}
        <SectionHeader title="Уровень активности" />
        <ChipGroup
          options={ACTIVITY_LEVELS}
          value={form.activityLevel}
          onChange={v => set('activityLevel', v)}
        />

        {/* Уровень */}
        <SectionHeader
          title="Ваш уровень подготовки"
          desc="Разделяем упражнения под вашу подготовку."
        />
        <ChipGroup options={LEVELS} value={form.level} onChange={v => set('level', v)} />

        {/* Цель */}
        <SectionHeader
          title="Цель тренировок"
          desc="От цели зависит калораж и структура программы."
        />
        <ChipGroup
          options={GOALS_ALL.map(g => ({ value: g, label: GOAL_LABELS[g] }))}
          value={form.goal}
          onChange={v => set('goal', v)}
        />

        {/* Направление */}
        <SectionHeader title="Направление тренировок" />
        <ChipGroup options={STYLES} value={form.trainStyle} onChange={v => set('trainStyle', v)} />

        {/* Снаряжение: в Android 1.18 здесь только «Дома»/«Зал» */}
        <SectionHeader title="Снаряжение" desc="Подберём упражнения под ваше снаряжение." />
        <ChipGroup options={PLACES} value={form.place} onChange={v => set('place', v)} />

        {/* О себе */}
        <SectionHeader
          title="О себе"
          desc="Коротко расскажите о себе, своём опыте и целях — тренер учтёт это в рекомендациях."
        />
        <div className="mt-2.5">
          <Field
            value={form.bio}
            onChange={v => set('bio', v)}
            placeholder="Например: тренируюсь 2 года, хочу подтянуть форму и выносливость…"
            inputMode="text"
            multiline
          />
        </div>

        {/* Страна и город */}
        <div className="flex gap-2.5 mt-6">
          <Field
            label="Страна"
            value={form.country}
            onChange={v => set('country', v)}
            placeholder="Россия"
            inputMode="text"
            className="flex-1"
          />
          <Field
            label="Город"
            value={form.city}
            onChange={v => set('city', v)}
            placeholder="Красноярск"
            inputMode="text"
            className="flex-1"
          />
        </div>

        {/* Кнопки: обе — кнопки-ярлыки (фон B, обводка A, текст D), как tintOne в Android */}
        <div className="flex items-center justify-between mt-8">
          <button
            type="button"
            onClick={skip}
            className="h-11 px-5 rounded-[8px] text-[14px] font-bold uppercase active:opacity-90"
            style={{
              background: 'var(--p-labels)',
              border: '1px solid var(--p-outline)',
              color: 'var(--p-labels-text)',
            }}
          >
            Пропустить
          </button>
          <button
            type="button"
            onClick={finish}
            disabled={saving}
            className="h-11 px-5 rounded-[8px] text-[14px] font-bold uppercase active:opacity-90 disabled:opacity-50"
            style={{
              background: 'var(--p-labels)',
              border: '1px solid var(--p-outline)',
              color: 'var(--p-labels-text)',
            }}
          >
            {saving ? 'Сохранение…' : 'Готово'}
          </button>
        </div>
      </div>

      <Toast text={toast} />
    </div>
  );
}
