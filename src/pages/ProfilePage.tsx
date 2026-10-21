// FitGuide Web — страница профиля

import { useState } from 'react';
import { User, Dumbbell, Target, Calendar, Settings, Camera, Edit2, Save, X, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { useProfileStore, useCoachStore, useProgramsStore } from '../core/store';
import type { UserProfile } from '../data/types';

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Сидячий', desc: 'Мало движения, офисная работа' },
  { value: 'light', label: 'Лёгкий', desc: 'Лёгкие тренировки 1-3 раза в неделю' },
  { value: 'moderate', label: 'Умеренный', desc: 'Тренировки 3-5 раз в неделю' },
  { value: 'active', label: 'Активный', desc: 'Интенсивные тренировки 6-7 раз в неделю' },
  { value: 'very_active', label: 'Очень активный', desc: 'Ежедневные тяжёлые тренировки + физическая работа' },
] as const;

const GOALS = [
  { value: 'maintain', label: 'Поддержать вес', desc: 'Каллорийность на уровне расхода' },
  { value: 'lose', label: 'Похудеть', desc: 'Дефицит 300-500 ккал' },
  { value: 'gain', label: 'Набрать массу', desc: 'Профицит 300-500 ккал' },
] as const;

export function ProfilePage() {
  const { profile, setProfile, clearProfile } = useProfileStore();
  const { resetCoach } = useCoachStore();
  const { programs, remove } = useProgramsStore();

  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<UserProfile>({
    name: '',
    gender: 'male',
    birthDate: '',
    height: 0,
    weight: 0,
    activityLevel: 'moderate',
    goal: 'maintain',
    equipment: [],
    location: 'gym',
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const handleEdit = () => {
    if (profile) {
      setFormData({ ...profile });
      setEditMode(true);
    }
  };

  const handleSave = () => {
    setProfile(formData);
    setEditMode(false);
  };

  const handleCancel = () => {
    if (profile) setFormData({ ...profile });
    setEditMode(false);
    setAvatarPreview(null);
  };

  const handleDeleteProfile = () => {
    if (confirm('Удалить профиль? Все данные будут потеряны.')) {
      clearProfile();
      resetCoach();
      programs.forEach(p => remove(p.id));
      setShowDeleteConfirm(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const calculateBMI = () => {
    if (!formData.height || !formData.weight) return null;
    const h = formData.height / 100;
    return (formData.weight / (h * h)).toFixed(1);
  };

  const calculateBMR = () => {
    if (!formData.height || !formData.weight || !formData.birthDate || !formData.gender) return null;
    const age = Math.floor((Date.now() - new Date(formData.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    const { weight, height, gender } = formData;
    const bmr = gender === 'male'
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161;
    return Math.round(bmr);
  };

  const activityMultipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };

  const tdee = calculateBMR() ? Math.round(calculateBMR()! * activityMultipliers[formData.activityLevel]) : null;
  const targetCalories = tdee ? (
    formData.goal === 'lose' ? tdee - 400 :
    formData.goal === 'gain' ? tdee + 400 :
    tdee
  ) : null;

  if (!profile && !editMode) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-gradient-to-br from-primary-600 to-primary-800 text-white rounded-2xl p-8 text-center">
          <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
            <User className="w-12 h-12" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Профиль не создан</h1>
          <p className="text-primary-100 mb-6">Заполни данные, чтобы тренер мог подбирать программы и каллорийность</p>
          <button
            onClick={() => setEditMode(true)}
            className="px-6 py-3 bg-white text-primary-700 font-semibold rounded-xl hover:bg-primary-50 transition-colors"
          >
            Создать профиль
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Профиль</h1>
          <p className="text-slate-500 dark:text-slate-400">Настройки твоего аккаунта и параметров</p>
        </div>
        {editMode ? (
          <div className="flex gap-2">
            <button onClick={handleCancel} className="px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-border">
              <X className="w-4 h-4 inline mr-1" />
              Отмена
            </button>
            <button onClick={handleSave} className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
              <Save className="w-4 h-4 inline mr-1" />
              Сохранить
            </button>
          </div>
        ) : (
          <button onClick={handleEdit} className="px-3 py-2 bg-slate-100 dark:bg-dark-border text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-dark-border/50 flex items-center gap-1">
            <Edit2 className="w-4 h-4" />
            Редактировать
          </button>
        )}
      </div>

      {/* Avatar & Basic Info */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative">
            <div className="w-32 h-32 rounded-full bg-slate-100 dark:bg-dark-border flex items-center justify-center overflow-hidden">
              {avatarPreview ? (
                <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
              ) : profile?.name ? (
                <span className="text-4xl font-bold text-primary-600 dark:text-primary-400">
                  {profile.name.charAt(0).toUpperCase()}
                </span>
              ) : (
                <User className="w-16 h-16 text-slate-400" />
              )}
            </div>
            {editMode && (
              <label className="absolute bottom-0 right-0 p-2 bg-primary-600 text-white rounded-full cursor-pointer hover:bg-primary-700">
                <Camera className="w-5 h-5" />
                <input type="file" accept="image/*" onChange={handleAvatarChange} className="sr-only" />
              </label>
            )}
          </div>
          <div className="flex-1 text-center sm:text-left space-y-3">
            {editMode ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                  placeholder="Имя"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white text-center text-xl font-semibold focus:ring-2 focus:ring-primary-500"
                />
                <select
                  value={formData.gender}
                  onChange={e => setFormData(f => ({ ...f, gender: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white text-center focus:ring-2 focus:ring-primary-500"
                >
                  <option value="male">Мужской</option>
                  <option value="female">Женский</option>
                </select>
                <input
                  type="date"
                  value={formData.birthDate}
                  onChange={e => setFormData(f => ({ ...f, birthDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white text-center focus:ring-2 focus:ring-primary-500"
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{profile?.name || 'Без имени'}</h2>
                <div className="flex items-center justify-center sm:justify-start gap-4 text-sm text-slate-500 dark:text-slate-400">
                  <span>{profile?.gender === 'male' ? '♂' : '♀'} {profile?.gender === 'male' ? 'Мужской' : 'Женский'}</span>
                  {profile?.birthDate && (
                    <span>
                      {new Date(profile.birthDate).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' })}
                      {(() => {
                        const age = Math.floor((Date.now() - new Date(profile.birthDate!).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
                        return ` (${age} лет)`;
                      })()}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Body Metrics */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-6">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-primary-600" />
          Антропометрия и каллорийность
        </h3>

        {editMode ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Рост (см)</label>
              <input
                type="number"
                min="100"
                max="250"
                value={formData.height}
                onChange={e => setFormData(f => ({ ...f, height: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Вес (кг)</label>
              <input
                type="number"
                min="30"
                max="300"
                step="0.1"
                value={formData.weight}
                onChange={e => setFormData(f => ({ ...f, weight: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-slate-50 dark:bg-dark-bg/50 rounded-lg p-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">Рост</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{profile?.height || 0} см</p>
            </div>
            <div className="bg-slate-50 dark:bg-dark-bg/50 rounded-lg p-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">Вес</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{profile?.weight || 0} кг</p>
            </div>
            <div className="bg-slate-50 dark:bg-dark-bg/50 rounded-lg p-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">ИМТ</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{calculateBMI() || '—'}</p>
            </div>
            <div className="bg-slate-50 dark:bg-dark-bg/50 rounded-lg p-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">BMR</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{calculateBMR() || '—'} ккал</p>
            </div>
          </div>
        )}

        {!editMode && tdee && (
          <div className="mt-4 p-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg">
            <h4 className="font-medium text-primary-800 dark:text-primary-300 mb-2">Рекомендуемая каллорийность</h4>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="text-center p-2 bg-white dark:bg-dark-bg rounded">
                <p className="text-sm text-slate-500 dark:text-slate-400">BMR (базовый)</p>
                <p className="font-bold text-slate-900 dark:text-white">{calculateBMR()} ккал</p>
              </div>
              <div className="text-center p-2 bg-white dark:bg-dark-bg rounded">
                <p className="text-sm text-slate-500 dark:text-slate-400">TDEE (с активностью)</p>
                <p className="font-bold text-slate-900 dark:text-white">{tdee} ккал</p>
              </div>
              <div className="text-center p-2 bg-primary-100 dark:bg-primary-900/30 rounded">
                <p className="text-sm text-primary-800 dark:text-primary-300">Цель: {GOALS.find(g => g.value === profile?.goal)?.label}</p>
                <p className="font-bold text-primary-700 dark:text-primary-400">{targetCalories} ккал</p>
              </div>
            </div>
          </div>
        )}

        {!editMode && (profile?.goal === 'lose' || profile?.goal === 'gain') && targetCalories && (
          <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <h4 className="font-medium text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              Макронутриенты (примерно)
            </h4>
            <div className="grid gap-2 sm:grid-cols-3 text-sm">
              <div className="p-2 bg-white dark:bg-dark-bg rounded">Белки: <span className="font-bold">{(targetCalories * 0.3 / 4).toFixed(0)}г</span></div>
              <div className="p-2 bg-white dark:bg-dark-bg rounded">Жиры: <span className="font-bold">{(targetCalories * 0.25 / 9).toFixed(0)}г</span></div>
              <div className="p-2 bg-white dark:bg-dark-bg rounded">Углеводы: <span className="font-bold">{(targetCalories * 0.45 / 4).toFixed(0)}г</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Activity & Goal */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-6">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Dumbbell className="w-5 h-5 text-primary-600" />
          Активность и цель
        </h3>

        {editMode ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Уровень активности</label>
              <div className="space-y-2">
                {ACTIVITY_LEVELS.map(level => (
                  <label key={level.value} className={clsx(
                    'p-3 rounded-lg border cursor-pointer transition-colors',
                    formData.activityLevel === level.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                      : 'border-slate-200 dark:border-dark-border hover:border-primary-300'
                  )}>
                    <input
                      type="radio"
                      name="activity"
                      value={level.value}
                      checked={formData.activityLevel === level.value}
                      onChange={e => setFormData(f => ({ ...f, activityLevel: e.target.value as any }))}
                      className="sr-only"
                    />
                    <div className="font-medium text-slate-900 dark:text-white">{level.label}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">{level.desc}</div>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Цель</label>
              <div className="space-y-2">
                {GOALS.map(goal => (
                  <label key={goal.value} className={clsx(
                    'p-3 rounded-lg border cursor-pointer transition-colors',
                    formData.goal === goal.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                      : 'border-slate-200 dark:border-dark-border hover:border-primary-300'
                  )}>
                    <input
                      type="radio"
                      name="goal"
                      value={goal.value}
                      checked={formData.goal === goal.value}
                      onChange={e => setFormData(f => ({ ...f, goal: e.target.value as any }))}
                      className="sr-only"
                    />
                    <div className="font-medium text-slate-900 dark:text-white">{goal.label}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">{goal.desc}</div>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Место тренировок</label>
              <div className="flex gap-4">
                {['gym', 'home'].map(loc => (
                  <label key={loc} className={clsx(
                    'flex-1 p-3 rounded-lg border cursor-pointer transition-colors text-center',
                    formData.location === loc
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                      : 'border-slate-200 dark:border-dark-border hover:border-primary-300'
                  )}>
                    <input
                      type="radio"
                      name="location"
                      value={loc}
                      checked={formData.location === loc}
                      onChange={e => setFormData(f => ({ ...f, location: e.target.value as any }))}
                      className="sr-only"
                    />
                    <div className="font-medium text-slate-900 dark:text-white">{loc === 'gym' ? '🏋️ Зал' : '🏠 Дом'}</div>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Доступное оборудование</label>
              <div className="flex flex-wrap gap-2">
                {['barbell', 'dumbbell', 'cable', 'smith', 'machine'].map(eq => (
                  <label key={eq} className={clsx(
                    'px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors',
                    formData.equipment?.includes(eq)
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'border-slate-200 dark:border-dark-border hover:border-primary-300'
                  )}>
                    <input
                      type="checkbox"
                      checked={formData.equipment?.includes(eq)}
                      onChange={e => setFormData(f => ({
                        ...f,
                        equipment: e.target.checked
                          ? [...(f.equipment || []), eq]
                          : (f.equipment || []).filter(x => x !== eq)
                      }))}
                      className="sr-only"
                    />
                    {eq.charAt(0).toUpperCase() + eq.slice(1)}
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-dark-bg/50 rounded-lg">
              <p className="text-sm text-slate-500 dark:text-slate-400">Уровень активности</p>
              <p className="font-medium text-slate-900 dark:text-white">
                {ACTIVITY_LEVELS.find(l => l.value === profile?.activityLevel)?.label}
              </p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-dark-bg/50 rounded-lg">
              <p className="text-sm text-slate-500 dark:text-slate-400">Цель</p>
              <p className="font-medium text-slate-900 dark:text-white">
                {GOALS.find(g => g.value === profile?.goal)?.label}
              </p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-dark-bg/50 rounded-lg">
              <p className="text-sm text-slate-500 dark:text-slate-400">Место тренировок</p>
              <p className="font-medium text-slate-900 dark:text-white">
                {profile?.location === 'gym' ? '🏋️ Зал' : '🏠 Дом'}
              </p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-dark-bg/50 rounded-lg">
              <p className="text-sm text-slate-500 dark:text-slate-400">Оборудование</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {profile?.equipment?.map(eq => (
                  <span key={eq} className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded text-xs">
                    {eq.charAt(0).toUpperCase() + eq.slice(1)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-6">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Dumbbell className="w-5 h-5 text-primary-600" />
          Статистика тренировок
        </h3>
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="text-center p-4 bg-slate-50 dark:bg-dark-bg/50 rounded-lg">
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{programs.length}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Программ</p>
          </div>
          <div className="text-center p-4 bg-slate-50 dark:bg-dark-bg/50 rounded-lg">
            <p className="text-3xl font-bold text-slate-900 dark:text-white">—</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Тренировок всего</p>
          </div>
          <div className="text-center p-4 bg-slate-50 dark:bg-dark-bg/50 rounded-lg">
            <p className="text-3xl font-bold text-slate-900 dark:text-white">—</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Недель подряд</p>
          </div>
          <div className="text-center p-4 bg-slate-50 dark:bg-dark-bg/50 rounded-lg">
            <p className="text-3xl font-bold text-slate-900 dark:text-white">—</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Рекордов</p>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-red-200 dark:border-red-800 p-6">
        <h3 className="font-semibold text-red-700 dark:text-red-400 mb-4 flex items-center gap-2">
          <Trash2 className="w-5 h-5" />
          Опасная зона
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Эти действия необратимы. Используй с осторожностью.
        </p>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setShowDeleteConfirm(true)} className="px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
            <Trash2 className="w-4 h-4 inline mr-1" />
            Удалить профиль и все данные
          </button>
        </div>
      </div>
    </div>
  );
}