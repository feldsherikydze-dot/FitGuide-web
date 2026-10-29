// FitGuide Web — профиль (порт ProfileActivity.java)
//
// Поля ровно как в Android: имя, пол, возраст, рост, вес, активность, цель,
// направление, % жира, тренировок в неделю, био, страна/город, уровень,
// оборудование зала, место тренировок.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  User, Target, Calendar, Camera, Edit2, Save, X, Trash2, AlertCircle,
  Dumbbell, MapPin, Flag, ChevronRight, Ruler, Scale, Zap,
} from 'lucide-react';
import { PageHeader } from '../components/ui';
import { useProfileStore, useCoachStore, useProgramsStore } from '../core/store';
import { GOALS, GOALS_ALL, GOAL_LABELS, GOAL_DESCRIPTIONS, recommendDays, recommendPerWeek, caloriesFor, proteinPerKg, fatsPerKg } from '../core/goals';
import { COMP_PHASE } from '../data/types';
import { COMP_PHASE_ORDER, COMP_PHASE_LABELS, stageWeightKg, offseasonWeightKg } from '../core/seasonPlan';
import type { UserProfile } from '../data/types';

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Сидячий', desc: 'Мало движения, офисная работа', factor: 1.2 },
  { value: 'light', label: 'Лёгкий', desc: 'Лёгкие тренировки 1–3 раза в неделю', factor: 1.375 },
  { value: 'moderate', label: 'Умеренный', desc: 'Тренировки 3–5 раз в неделю', factor: 1.55 },
  { value: 'high', label: 'Высокий', desc: 'Интенсивные тренировки 6–7 раз в неделю', factor: 1.725 },
  { value: 'athlete', label: 'Спортсмен', desc: 'Ежедневные тяжёлые тренировки + физическая работа', factor: 1.9 },
];

const LEVELS = [
  { value: 'beginner', label: 'Новичок', desc: '0–1 год регулярных тренировок' },
  { value: 'intermediate', label: 'Средний', desc: '1–3 года' },
  { value: 'advanced', label: 'Продвинутый', desc: '3+ года' },
];

const STYLES = [
  { value: 'any', label: 'Любое', desc: 'Базовые и изолирующие упражнения' },
  { value: 'bb', label: 'Бодибилдинг', desc: 'Всё, что растёт мышцы' },
  { value: 'pl', label: 'Пауэрлифтинг', desc: 'Только базовые многосуставные' },
];

const PLACES = [
  { value: 'gym', label: 'Зал', icon: Dumbbell, desc: 'Полное оборудование' },
  { value: 'home', label: 'Дом', icon: MapPin, desc: 'Гантели, резинки, турник' },
];

const EQUIPMENT = [
  { id: 'barbell', label: 'Штанга' },
  { id: 'dumbbell', label: 'Гантели' },
  { id: 'cable', label: 'Блоки' },
  { id: 'smith', label: 'Смит' },
  { id: 'machine', label: 'Тренажёры' },
];

const CATEGORIES = [
  { id: '60', label: 'До 60 кг' },
  { id: '70', label: 'До 70 кг' },
  { id: '80', label: 'До 80 кг' },
  { id: '90', label: 'До 90 кг' },
  { id: '100', label: 'До 100 кг' },
  { id: '110+', label: '110+ кг' },
];

const DEFAULT_PROFILE: UserProfile = {
  name: '', gender: 'male', age: 0, heightCm: 0, weightKg: 0,
  activityLevel: 'moderate', goal: GOALS.MASS, trainStyle: 'any',
  bodyFatPercent: 0, workoutsPerWeek: 0, bio: '', country: '', city: '',
  level: 'intermediate', equipment: [], place: 'gym',
};

export function ProfilePage() {
  const navigate = useNavigate();
  const { profile, setProfile, clearProfile } = useProfileStore();
  const coach = useCoachStore();
  const { programs, remove } = useProgramsStore();

  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<UserProfile>(profile || DEFAULT_PROFILE);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    if (profile) setForm(profile);
  }, [profile]);

  const set = <K extends keyof UserProfile>(k: K, v: UserProfile[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const bmr = computeBmr(form);
  const tdee = bmr ? Math.round(bmr * (ACTIVITY_LEVELS.find(a => a.value === form.activityLevel)?.factor || 1.2)) : 0;
  const calories = caloriesFor(tdee, form.goal, form.gender);
  const protein = Math.round(form.weightKg * proteinPerKg(form.goal));
  const fats = Math.round(form.weightKg * fatsPerKg(form.goal));
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fats * 9) / 4));

  const save = () => {
    setProfile(form);
    setEdit(false);
  };

  const doDelete = () => {
    if (!confirm('Удалить профиль и все данные? Действие необратимо.')) return;
    clearProfile();
    coach.resetCoach();
    programs.forEach(p => remove(p.id));
    setShowDelete(false);
    navigate('/');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5 w-full max-w-full">
      <PageHeader title="Профиль" onBack={() => navigate('/')} right={
        <div className="flex gap-1">
          {profile && !edit && (
            <button onClick={() => setEdit(true)}
              className="px-3 py-2 bg-slate-100 dark:bg-dark-border text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-dark-border/50 flex items-center gap-1.5">
              <Edit2 className="w-4 h-4" /> Изменить
            </button>
          )}
          {edit && (
            <>
              <button onClick={() => { setForm(profile || DEFAULT_PROFILE); setEdit(false); }}
                className="px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-border flex items-center gap-1.5">
                <X className="w-4 h-4" />
              </button>
              <button onClick={save} className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-1.5">
                <Save className="w-4 h-4" /> Сохранить
              </button>
            </>
          )}
        </div>
      } />

      {/* Основное */}
      <Section icon={User} title="Кто ты">
        <div className="space-y-3">
          {edit ? (
            <>
              <Input label="Имя" value={form.name} onChange={v => set('name', v)} placeholder="Как к тебе обращаться" />
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1.5">Пол</label>
                <div className="flex gap-2">
                  {[{ v: 'male', l: 'Мужской' }, { v: 'female', l: 'Женский' }].map(o => (
                    <button key={o.v} onClick={() => set('gender', o.v)}
                      className={clsx('flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                        form.gender === o.v ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-dark-border text-slate-600 dark:text-slate-400')}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Input label="Возраст" value={form.age} onChange={v => set('age', v)} type="number" />
                <Input label="Рост, см" value={form.heightCm} onChange={v => set('heightCm', v)} type="number" />
                <Input label="Вес, кг" value={form.weightKg} onChange={v => set('weightKg', v)} type="number" step="0.1" />
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Имя" value={profile?.name || '—'} />
              <Stat label="Возраст" value={profile?.age ? `${profile.age} лет` : '—'} />
              <Stat label="Рост" value={profile?.heightCm ? `${profile.heightCm} см` : '—'} />
              <Stat label="Вес" value={profile?.weightKg ? `${profile.weightKg} кг` : '—'} />
            </div>
          )}
        </div>
      </Section>

      {/* Цель */}
      <Section icon={Target} title="Цель">
        {edit ? (
          <div className="space-y-2">
            {GOALS_ALL.map(g => (
              <button key={g} onClick={() => set('goal', g)}
                className={clsx('w-full p-3 rounded-lg border text-left transition-colors',
                  form.goal === g ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' : 'border-slate-200 dark:border-dark-border hover:border-primary-300')}>
                <div className="font-medium text-slate-900 dark:text-white">{GOAL_LABELS[g]}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">{GOAL_DESCRIPTIONS[g]}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900 dark:text-white">{GOAL_LABELS[profile?.goal || GOALS.MASS]}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{GOAL_DESCRIPTIONS[profile?.goal || GOALS.MASS]}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </div>
        )}
      </Section>

      {/* Уровень и стиль */}
      <Section icon={Dumbbell} title="Уровень и направление">
        {edit ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1.5">Уровень</label>
              <div className="space-y-2">
                {LEVELS.map(l => (
                  <button key={l.value} onClick={() => set('level', l.value)}
                    className={clsx('w-full p-3 rounded-lg border text-left transition-colors',
                      form.level === l.value ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' : 'border-slate-200 dark:border-dark-border hover:border-primary-300')}>
                    <div className="font-medium text-slate-900 dark:text-white">{l.label}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">{l.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1.5">Направление</label>
              <div className="space-y-2">
                {STYLES.map(l => (
                  <button key={l.value} onClick={() => set('trainStyle', l.value)}
                    className={clsx('w-full p-3 rounded-lg border text-left transition-colors',
                      form.trainStyle === l.value ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' : 'border-slate-200 dark:border-dark-border hover:border-primary-300')}>
                    <div className="font-medium text-slate-900 dark:text-white">{l.label}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">{l.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1.5">
                Тренировок в неделю: {form.workoutsPerWeek || recommendDays(form.level, form.goal)} (рекомендуется)
              </label>
              <input
                type="number" min="0" max="7"
                value={form.workoutsPerWeek || recommendDays(form.level, form.goal)}
                onChange={e => set('workoutsPerWeek', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white text-center"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Уровень" value={LEVELS.find(l => l.value === profile?.level)?.label || '—'} />
            <Stat label="Направление" value={STYLES.find(s => s.value === profile?.trainStyle)?.label || '—'} />
            <Stat label="Дней в неделю" value={String(profile?.workoutsPerWeek || recommendDays(profile?.level || 'intermediate', profile?.goal || GOALS.MASS))} />
            <Stat label="Рекомендуется" value={`до ${recommendPerWeek(profile?.level || 'intermediate', profile?.goal || GOALS.MASS)}`} />
          </div>
        )}
      </Section>

      {/* Место и оборудование */}
      <Section icon={MapPin} title="Зал и оборудование">
        {edit ? (
          <div className="space-y-4">
            <div className="flex gap-3">
              {PLACES.map(p => (
                <button key={p.value} onClick={() => set('place', p.value)}
                  className={clsx('flex-1 p-3 rounded-lg border text-left transition-colors',
                    form.place === p.value ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' : 'border-slate-200 dark:border-dark-border hover:border-primary-300')}>
                  <p.icon className="w-5 h-5 text-primary-600 dark:text-primary-400 mb-1.5" />
                  <div className="font-medium text-slate-900 dark:text-white">{p.label}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{p.desc}</div>
                </button>
              ))}
            </div>
            {form.place === 'gym' && (
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1.5">Что есть в зале</label>
                <div className="flex flex-wrap gap-2">
                  {EQUIPMENT.map(e => (
                    <button key={e.id} onClick={() => set('equipment',
                      form.equipment.includes(e.id) ? form.equipment.filter(x => x !== e.id) : [...form.equipment, e.id])}
                      className={clsx('px-3 py-1.5 rounded-lg border text-sm transition-colors',
                        form.equipment.includes(e.id)
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'border-slate-200 dark:border-dark-border text-slate-600 dark:text-slate-400')}>
                      {e.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                  Пусто = доступно всё. Отмеченное ограничит подбор упражнений.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500 dark:text-slate-400">Место</span>
              <span className="font-medium text-slate-900 dark:text-white">
                {PLACES.find(p => p.value === profile?.place)?.label || 'Зал'}
              </span>
            </div>
            {profile?.place !== 'home' && (
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm text-slate-500 dark:text-slate-400">Оборудование</span>
                <div className="flex flex-wrap gap-1 justify-end">
                  {profile?.equipment?.length
                    ? profile.equipment.map(e => (
                        <span key={e} className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded text-xs">
                          {EQUIPMENT.find(x => x.id === e)?.label || e}
                        </span>
                      ))
                    : <span className="text-sm text-slate-400 dark:text-slate-500">всё</span>}
                </div>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* Калории */}
      <Section icon={Zap} title="Калории и макросы">
        {tdee > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <Stat label="BMR" value={`${bmr} ккал`} />
              <Stat label="TDEE" value={`${tdee} ккал`} />
              <Stat label="Цель" value={`${calories} ккал`} accent />
              <Stat label="ИМТ" value={bmi(form) || '—'} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Macro label="Белок" value={`${protein} г`} hint={`${proteinPerKg(form.goal)} г/кг`} />
              <Macro label="Жиры" value={`${fats} г`} hint={`${fatsPerKg(form.goal)} г/кг`} />
              <Macro label="Углеводы" value={`${carbs} г`} hint="остаток" />
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Заполни возраст, рост и вес — посчитаем калорийность.
          </p>
        )}
      </Section>

      {/* Сезон */}
      <Section icon={Flag} title="Соревновательный план">
        {edit ? (
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1.5">Фаза сезона</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {COMP_PHASE_ORDER.map(p => (
                  <button key={p} onClick={() => set('compDate', form.compDate || Date.now())}
                    onContextMenu={() => {}}
                    className={clsx('p-2.5 rounded-lg border text-sm transition-colors',
                      form.compDate ? 'border-slate-200 dark:border-dark-border' : 'border-slate-200 dark:border-dark-border')}>
                    {COMP_PHASE_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1.5">Категория (вес на сцене)</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(c => (
                  <button key={c.id} onClick={() => set('compCategory', c.id)}
                    className={clsx('px-3 py-1.5 rounded-lg border text-sm transition-colors',
                      form.compCategory === c.id
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'border-slate-200 dark:border-dark-border text-slate-600 dark:text-slate-400')}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1.5">Дата старта</label>
              <input
                type="date"
                value={form.compDate ? new Date(form.compDate).toISOString().split('T')[0] : ''}
                onChange={e => set('compDate', e.target.value ? new Date(e.target.value).getTime() : undefined)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white"
              />
            </div>
          </div>
        ) : profile?.compDate ? (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-slate-500 dark:text-slate-400">Дата старта</span>
              <span className="font-medium text-slate-900 dark:text-white">
                {new Date(profile.compDate).toLocaleDateString('ru-RU')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-500 dark:text-slate-400">Категория</span>
              <span className="font-medium text-slate-900 dark:text-white">
                {CATEGORIES.find(c => c.id === profile.compCategory)?.label || '—'}
              </span>
            </div>
            {profile.compCategory && (
              <>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Ориентир на сцене</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {stageWeightKg(profile.heightCm, profile.compCategory)} кг
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Ориентир межсезонья</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {offseasonWeightKg(profile.heightCm, profile.compCategory, profile.weightKg)} кг
                  </span>
                </div>
              </>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Не задан. Сезонный план нужен только тем, кто готовится к соревнованию.
          </p>
        )}
      </Section>

      {/* Прочее */}
      <Section icon={Calendar} title="Город и страна">
        {edit ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Страна" value={form.country} onChange={v => set('country', v)} />
            <Input label="Город" value={form.city} onChange={v => set('city', v)} />
          </div>
        ) : (
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {profile?.city || '—'}{profile?.city && profile?.country ? ', ' : ''}{profile?.country || ''}
            {!profile?.city && !profile?.country && 'Не задан'}
          </div>
        )}
      </Section>

      {/* Опасная зона */}
      {profile && (
        <div className="bg-white dark:bg-dark-card rounded-xl border border-red-200 dark:border-red-800 p-5">
          <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
            <Trash2 className="w-5 h-5" /> Опасная зона
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Удаление профиля стирает профиль, программы и всю историю тренировок.
          </p>
          <button onClick={() => setShowDelete(true)}
            className="px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
            Удалить профиль и данные
          </button>
        </div>
      )}

      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-dark-card rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Удалить всё?</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              Профиль, {programs.length} программ и вся история тренировок будут стёрты. Отменить нельзя.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDelete(false)}
                className="flex-1 py-2 border border-slate-200 dark:border-dark-border rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-border">
                Отмена
              </button>
              <button onClick={doDelete}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700">
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function computeBmr(p: UserProfile): number {
  if (!p.age || !p.heightCm || !p.weightKg) return 0;
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.gender === 'male' ? 5 : -161);
  return Math.max(0, Math.round(bmr));
}

function bmi(p: UserProfile): string {
  if (!p.heightCm || !p.weightKg) return '';
  const h = p.heightCm / 100;
  return (p.weightKg / (h * h)).toFixed(1);
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-5">
      <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <Icon className="w-5 h-5 text-primary-600" /> {title}
      </h2>
      {children}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="p-3 bg-slate-50 dark:bg-dark-bg/50 rounded-lg text-center">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={clsx('font-bold', accent ? 'text-primary-600 dark:text-primary-400' : 'text-slate-900 dark:text-white')}>{value}</p>
    </div>
  );
}

function Macro({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="p-3 bg-slate-50 dark:bg-dark-bg/50 rounded-lg text-center">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-[10px] text-slate-400 dark:text-slate-500">{hint}</p>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', step, placeholder }: {
  label: string; value: string | number; onChange: (v: any) => void;
  type?: string; step?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">{label}</label>
      <input
        type={type} step={step} placeholder={placeholder}
        value={value === 0 && type === 'number' ? '' : value}
        onChange={e => onChange(type === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value)}
        className="w-full px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white text-center"
      />
    </div>
  );
}
