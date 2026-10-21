// FitGuide Web — главная страница тренера

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Dumbbell, Calendar, Target, TrendingUp, RotateCcw, Plus, ChevronRight, Clock, Zap, BookOpen } from 'lucide-react';
import { clsx } from 'clsx';
import { useCoachStore, useProgramsStore, useProfileStore } from '../core/store';
import { useExercises } from '../hooks/useExercises';
import { getDailyPlan } from '../core/coach';
import type { Program } from '../data/types';

export function CoachPage() {
  const navigate = useNavigate();
  const { activeProgramId, coachPath, sessions, checkins } = useCoachStore();
  const { programs, getById } = useProgramsStore();
  const { profile } = useProfileStore();
  const { exercises } = useExercises();

  const [dailyPlan, setDailyPlan] = useState<ReturnType<typeof getDailyPlan> | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!activeProgramId) {
      setDailyPlan(null);
      setShowOnboarding(true);
      return;
    }

    const plan = getDailyPlan(
      useCoachStore.getState(),
      programs,
      checkins,
      exercises
    );
    setDailyPlan(plan);
    setShowOnboarding(false);
  }, [activeProgramId, programs, sessions, checkins, exercises]);

  const program = activeProgramId ? getById(activeProgramId) : null;

  if (showOnboarding || !program) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-gradient-to-br from-primary-600 to-primary-800 text-white rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Zap className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Добро пожаловать в FitGuide</h1>
              <p className="text-primary-100">Твой карманный тренер для силовых тренировок</p>
            </div>
          </div>
          <p className="text-primary-100 opacity-90 mb-6">
            Создай программу, начни тренировась и отслеживай прогресс. Всё работает офлайн.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate('/programs')}
              className="flex-1 min-w-[140px] px-6 py-3 bg-white text-primary-700 font-semibold rounded-xl hover:bg-primary-50 transition-colors"
            >
              Создать программу
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="flex-1 min-w-[140px] px-6 py-3 bg-white/20 text-white font-semibold rounded-xl hover:bg-white/30 transition-colors border border-white/30"
            >
              Настроить профиль
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Dumbbell, title: 'Генератор программ', desc: 'Фулбоди, сплиты, периодизация под цели' },
            { icon: Target, title: 'Карманный тренер', desc: 'Автопрогрессия весов, готовность, разгрузки' },
            { icon: TrendingUp, title: 'Прогресс', desc: 'Графики e1RM, объёма, тоннaжа за месяцы' },
            { icon: BookOpen, title: 'База упражнений', desc: '200+ упражнений с техникой и биомеханикой' },
            { icon: Clock, title: 'Таймер отдыха', desc: 'Умные таймеры с автозапуском между подходами' },
            { icon: RotateCcw, title: 'Чекпоинты', desc: 'Замеры каждые 4 недели с пересчётом программы' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white dark:bg-dark-card rounded-xl p-6 border border-slate-200 dark:border-dark-border hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
              <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-lg w-fit mb-4">
                <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1">{title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const today = new Date();
  const dayName = today.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  const renderExerciseSlots = () => {
    if (!dailyPlan) return null;
    const day = program.phases.find(p => dailyPlan.week >= p.weekStart && dailyPlan.week <= p.weekEnd)?.days.find(d => d.title === dailyPlan.dayTitle);
    if (!day) return null;

    return day.slots.map((slot, idx) => (
      <div key={`${day.title}-${idx}`} className="p-4 hover:bg-slate-50 dark:hover:bg-dark-border/50">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={clsx(
                'px-2 py-0.5 rounded text-xs font-medium',
                slot.role === 'main' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                slot.role === 'secondary' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              )}>
                {slot.role === 'main' ? 'Основное' : slot.role === 'secondary' ? 'Вспомогательное' : 'Изоляция'}
              </span>
              {slot.workSec && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  ⏱ {slot.workSec}с
                </span>
              )}
            </div>
            <h3 className="font-medium text-slate-900 dark:text-white truncate">{slot.exercise}</h3>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400 mt-1">
              <span>{slot.sets} × {slot.reps}</span>
              <span>⏱ {slot.rest}</span>
              {slot.startWeight && slot.startWeight > 0 && <span>🏋️ {slot.startWeight} кг</span>}
            </div>
          </div>
          {dailyPlan.suggestedWeights[slot.exercise] && (
            <div className="text-right flex-shrink-0">
              <div className="text-lg font-bold text-primary-600 dark:text-primary-400">
                {dailyPlan.suggestedWeights[slot.exercise].weight} кг
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {dailyPlan.suggestedWeights[slot.exercise].reps}
              </div>
            </div>
          )}
        </div>
      </div>
    ));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {dayName.charAt(0).toUpperCase() + dayName.slice(1)}
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            {program.name} · Неделя {dailyPlan?.week} из {program.weeks}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={clsx(
            'px-3 py-1 rounded-full text-xs font-medium',
            dailyPlan?.isDeload ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' :
            dailyPlan?.factor && dailyPlan.factor < 1 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
            'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
          )}>
            {dailyPlan?.isDeload ? '🔄 Разгрузочная неделя' :
             dailyPlan?.factor && dailyPlan.factor < 1 ? `⚡ Нагрузка ×${dailyPlan.factor}` :
             '✅ Нормальный режим'}
          </span>
        </div>
      </div>

      {dailyPlan && (
        <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary-600" />
              Готовность к тренировке
            </h2>
            <span className={clsx(
              'px-3 py-1 rounded-full text-sm font-mono font-bold',
              dailyPlan.readiness >= 7 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
              dailyPlan.readiness >= 5 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
              'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            )}>
              {dailyPlan.readiness}/9
            </span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-dark-border rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all duration-500',
                dailyPlan.readiness >= 7 ? 'bg-green-500' :
                dailyPlan.readiness >= 5 ? 'bg-blue-500' :
                'bg-red-500'
              )}
              style={{ width: `${(dailyPlan.readiness / 9) * 100}%` }}
            />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            {dailyPlan.readiness >= 7 ? 'Отличная готовность — можно работать на пределе' :
             dailyPlan.readiness >= 5 ? 'Нормальная готовность — тренируйся по плану' :
             'Низкая готовность — веса снижены, фокус на технике'}
          </p>
        </div>
      )}

      {dailyPlan?.dayTitle && (
        <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border overflow-hidden">
          <div className="bg-slate-50 dark:bg-dark-border/50 px-4 py-3 border-b border-slate-200 dark:border-dark-border flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white">{dailyPlan.dayTitle}</h2>
            {dailyPlan.session?.finishedAt ? (
              <span className="px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-sm font-medium">
                Завершено
              </span>
            ) : (
              <button
                onClick={() => navigate(`/workout?program=${program.id}&week=${dailyPlan.week}&day=${encodeURIComponent(dailyPlan.dayTitle)}`)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors flex items-center gap-2"
              >
                <Dumbbell className="w-4 h-4" />
                Начать тренировку
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-200 dark:divide-dark-border">
            {renderExerciseSlots()}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          onClick={() => navigate('/workout')}
          className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-4 text-left hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
        >
          <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg w-fit mb-3">
            <Dumbbell className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Тренировка</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Начать или продолжить</p>
        </button>
        <button
          onClick={() => navigate('/programs')}
          className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-4 text-left hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
        >
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg w-fit mb-3">
            <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Программы</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Создать или редактировать</p>
        </button>
        <button
          onClick={() => navigate('/progress')}
          className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-4 text-left hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
        >
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg w-fit mb-3">
            <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Прогресс</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Графики и рекорды</p>
        </button>
        <button
          onClick={() => navigate('/exercises')}
          className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-4 text-left hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
        >
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg w-fit mb-3">
            <Target className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Упражнения</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">База и замена</p>
        </button>
      </div>
    </div>
  );
}