// FitGuide Web — карманный тренер (порт CoachActivity.java)
//
// Дневной цикл: план до тренировки и разбор после.
// До: готовность (сон/забитость/энергия) → полная или облегчённая нагрузка,
// разгрузка, какое по счёту занятие недели, с какими весами идти.
// Чекпоинт: если замеры устарели, тренер вместо тренировки требует новый замер.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  Zap, Dumbbell, Calendar, Target, TrendingUp, RotateCcw, ChevronRight, Clock,
  BookOpen, AlertTriangle, CheckCircle, Sun, Flame, Battery, Settings, Trophy, Info,
} from 'lucide-react';
import { useCoachStore, useProgramsStore, useProfileStore, useAssessmentStore, useOneRmStore } from '../core/store';
import { useExercises, useKnowledge } from '../hooks/useExercises';
import { dailyPlan, dayKey, suggestWeight, loadAdjust, readinessScore, plural, type DailyPlan } from '../core/coach';
import { checkpointDue, daysSinceAssessment, CHECKPOINT_DAYS } from '../core/checkpoint';
import { findTip, rotateTip } from '../core/knowledge';
import { COMP_PHASE_LABELS } from '../core/seasonPlan';
import { maxReps } from '../core/coach';

export function CoachPage() {
  const navigate = useNavigate();
  const coach = useCoachStore();
  const { programs, getById } = useProgramsStore();
  const { profile } = useProfileStore();
  const assessment = useAssessmentStore(s => s.assessments[0] ?? null);
  const oneRm = useOneRmStore();
  const { exercises, byName } = useExercises();
  const { ready: knowledgeReady } = useKnowledge();

  const now = Date.now();
  const program = coach.activeProgramId ? getById(coach.activeProgramId) : null;

  const due = checkpointDue(assessment, now);
  const days = daysSinceAssessment(assessment, now);

  const plan: DailyPlan = useMemo(() => dailyPlan({
    state: coach,
    program: program || null,
    checkin: coach.checkins[0] || null,
    now,
    checkpointDue: due,
    daysSinceAssessment: days,
  }), [coach, program, due, days, now]);

  const checkin = coach.checkins.find(c => c.day === dayKey(now)) || null;

  // Совет из базы знаний: под ситуацию, иначе по кругу.
  const tip = useMemo(() => {
    if (!knowledgeReady) return null;
    const keywords: string[] = [];
    if (checkin) {
      if (checkin.sleep <= 1) keywords.push('сон');
      if (checkin.sore <= 1) keywords.push('крепатур', 'восстанов');
      if (checkin.energy <= 1) keywords.push('энерг', 'отдых');
    }
    if (plan.deload) keywords.push('разгруз');
    if (due) keywords.push('замер');
    const found = findTip(keywords);
    return found || rotateTip(Math.floor(now / 86400000));
  }, [knowledgeReady, checkin, plan.deload, due, now]);

  // --- Оценка самочувствия ---
  const saveCheckin = (sleep: number, sore: number, energy: number) => {
    coach.saveCheckin({ day: dayKey(now), sleep, sore, energy });
  };

  // Шапка как в activity_coach.xml: назад + «Карманный тренер».
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

  if (!program) {
    // Стартовый выбор пути — renderChoice() в CoachActivity.
    return (
      <div className="max-w-2xl mx-auto pb-8 w-full max-w-full">
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
          <button onClick={() => navigate('/programs')} className="fg-btn fg-btn-primary w-full py-3">
            Своя программа
          </button>

          <div className="mt-5 text-[15px] font-bold" style={{ color: 'var(--color-text-main)' }}>
            Хочу тренироваться по программе тренера
          </div>
          <p className="text-[12px] mt-0.5 mb-2 leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
            Пройдём знакомство и подготовку к старту: соберу о тебе всё, что нужно, дам вводную тренировку
            для калибровки рабочих весов, а затем поведу по индивидуальной программе до пика формы.
          </p>
          <button onClick={() => navigate('/onboarding')} className="fg-btn fg-btn-primary w-full py-3">
            Знакомство и подготовка к старту
          </button>

          <button
            onClick={() => {
              if (!window.confirm('Тренер удалит тренировки, замеры, всю ленту и программу, сбросит собой ам. Начнём заново: неделя 1, замеры 1, программа — нет. Профиль, свои программы и лента тренировок останутся. Сбросить?')) return;
              coach.resetCoach();
            }}
            className="mt-6 text-[13px] underline underline-offset-4"
            style={{ color: 'var(--color-text-secondary)' }}>
            Сбросить прогресс тренера
          </button>
        </div>
      </div>
    );
  }

  const phase = program.phases.find(p => plan.week >= p.weekStart && plan.week <= p.weekEnd);
  const day = plan.nextDay;
  const score = readinessScore(checkin);

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-8 w-full max-w-full">
      {header}
      {/* --- План на сегодня --- */}
      <div className={clsx(
        'rounded-2xl p-5 text-[var(--p-on-circle)]',
        plan.kind === 'train' ? 'bg-gradient-to-br from-[var(--p-circle)] to-[var(--p-circle)]/80' :
        plan.kind === 'checkpoint' ? 'bg-gradient-to-br from-[var(--p-circle)] to-[var(--p-circle)]/80' :
        plan.kind === 'rest' ? 'bg-gradient-to-br from-[var(--p-circle)] to-[var(--p-circle)]/80' :
        'bg-gradient-to-br from-[var(--p-circle)] to-[var(--p-circle)]/80'
      )}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm opacity-80 mb-1">
              {new Date(now).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <h1 className="text-xl font-bold">{plan.title}</h1>
            {plan.loadLine && <p className="text-sm opacity-90 mt-1">{plan.loadLine}</p>}
            {plan.restLine && <p className="text-sm opacity-90 mt-1">{plan.restLine}</p>}
          </div>
          {plan.kind === 'train' && (
            <div className="text-right flex-shrink-0">
              <div className="text-3xl font-bold">{plan.doneThisWeek}/{plan.plannedThisWeek}</div>
              <div className="text-xs opacity-80">за неделю</div>
            </div>
          )}
        </div>

        {plan.kind === 'checkpoint' && (
          <button onClick={() => navigate('/assessment?checkpoint=1')}
            className="mt-4 w-full py-3 bg-[var(--p-labels)] text-[var(--p-labels-text)] border border-[var(--p-outline)] font-semibold rounded-xl hover:bg-black/5 transition-colors flex items-center justify-center gap-2">
            <RotateCcw className="w-5 h-5" />
            Пройти повторные замеры
          </button>
        )}
        {plan.kind === 'nocheckin' && (
          <div className="mt-4 bg-[var(--color-bg)]/50 rounded-xl p-4 text-sm">
            Отметьте самочувствие ниже — от него зависит нагрузка на сегодня.
          </div>
        )}
        {plan.kind === 'train' && plan.canStart && (
          <button onClick={() => navigate(`/workout?program=${program.id}&week=${plan.week}&day=${encodeURIComponent(plan.dayTitle)}`)}
            className="mt-4 w-full py-3 bg-[var(--p-labels)] text-[var(--p-labels-text)] border border-[var(--p-outline)] font-semibold rounded-xl hover:bg-black/5 transition-colors flex items-center justify-center gap-2">
            <Dumbbell className="w-5 h-5" />
            Начать тренировку
          </button>
        )}
      </div>

      {/* --- Отметка самочувствия --- */}
      <div className="bg-[var(--p-labels)] rounded-xl border border-[var(--p-outline)] p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[var(--p-labels-text)]">Самочувствие сегодня</h2>
          {checkin && (
            <span className={clsx(
              'px-3 py-1 rounded-full text-sm font-mono font-bold',
              score >= 7 ? 'bg-[var(--p-circle)] text-[var(--p-on-circle)] dark:bg-[var(--p-circle)] dark:text-[var(--p-on-circle)]' :
              score >= 5 ? 'bg-[var(--p-outline)]/20 text-[var(--p-outline)] dark:bg-[var(--p-outline)]/30 dark:text-[var(--p-outline)]' :
              'bg-warning/20 text-warning dark:bg-warning/30 dark:text-warning'
            )}>
              {score}/9
            </span>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {([
            { key: 'sleep' as const, label: 'Сон', icon: Sun, low: 'Плохо', high: 'Отлично' },
            { key: 'sore' as const, label: 'Забитость', icon: Flame, low: 'Сильная', high: 'Нет' },
            { key: 'energy' as const, label: 'Энергия', icon: Battery, low: 'Нет', high: 'Полна' },
          ]).map(({ key, label, icon: Icon, low, high }) => (
            <div key={key} className="p-3 bg-[var(--color-bg)] rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-[var(--color-text-secondary)]" />
                <span className="text-sm font-medium text-[var(--color-text-secondary)]">{label}</span>
              </div>
              <div className="flex gap-1.5">
                {[1, 2, 3].map(v => (
                  <button
                    key={v}
                    onClick={() => saveCheckin(
                      key === 'sleep' ? v : (checkin?.sleep ?? 2),
                      key === 'sore' ? v : (checkin?.sore ?? 2),
                      key === 'energy' ? v : (checkin?.energy ?? 2),
                    )}
                    className={clsx(
                      'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                      checkin?.[key] === v
                        ? 'bg-[var(--p-circle)] text-[var(--p-on-circle)]'
                        : 'bg-[var(--p-labels)] border border-[var(--p-outline)] text-[var(--color-text-secondary)] hover:border-[var(--p-outline)]'
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] mt-1">
                <span>{low}</span><span>{high}</span>
              </div>
            </div>
          ))}
        </div>

        {checkin && score <= 4 && (
          <p className="text-sm text-[var(--p-outline)] mt-3 flex items-start gap-1.5">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            Низкая готовность — веса снижены на 10%, подходов на 1 меньше.
          </p>
        )}
      </div>

      {/* --- Упражнения дня --- */}
      {plan.kind === 'train' && day && (
        <div className="bg-[var(--p-labels)] rounded-xl border border-[var(--p-outline)] overflow-hidden">
          <div className="bg-[var(--color-bg)] px-4 py-3 border-b border-[var(--p-outline)] flex items-center justify-between">
            <h2 className="font-semibold text-[var(--p-labels-text)]">
              {day.title} · {phase?.label}
            </h2>
            {plan.deload && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-[var(--p-outline)]/20 text-[var(--p-outline)]">
                Разгрузка
              </span>
            )}
          </div>

          <div className="divide-y divide-[var(--p-outline)]">
            {day.slots.map((slot, idx) => {
              const e1rm = oneRm.get(slot.exercise);
              const suggested = suggestWeight({
                sessions: coach.sessions,
                exercise: slot.exercise,
                goal: program.goal,
                repRange: slot.reps,
                e1rm,
              });
              const adjusted = loadAdjust(program, plan.week, suggested, score);
              const delta = adjusted - suggested;
              const maxR = maxReps(slot.reps);

              return (
                <div key={`${slot.exercise}-${idx}`} className="p-4 hover:bg-black/5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={clsx(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          slot.role === 'main' ? 'bg-[var(--p-circle)] text-[var(--p-on-circle)]' :
                          slot.role === 'secondary' ? 'bg-[var(--p-outline)]/20 text-[var(--p-outline)]' :
                          'bg-[var(--p-outline)]/20 text-[var(--p-outline)]'
                        )}>
                          {slot.role === 'main' ? 'Основное' : slot.role === 'secondary' ? 'Вспомогательное' : 'Изоляция'}
                        </span>
                      </div>
                      <h3 className="font-medium text-[var(--p-labels-text)] truncate">{slot.exercise}</h3>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--color-text-secondary)] mt-1">
                        <span>{slot.sets} × {slot.reps}</span>
                        <span>⏱ {slot.rest}</span>
                        {maxR > 0 && <span className="text-xs">до {maxR} повторов</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {adjusted > 0 ? (
                        <>
                          <div className="text-lg font-bold text-[var(--p-labels-text)]">{adjusted} кг</div>
                          {delta !== 0 && (
                            <div className="text-xs text-[var(--p-outline)]">
                              было {suggested} кг
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-sm text-[var(--color-text-secondary)]">вес не подсказан</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- Совет из базы знаний --- */}
      {tip && (
        <button
          onClick={() => navigate(`/knowledge/${tip.number}`)}
          className="w-full text-left bg-[var(--p-labels)] rounded-xl border border-[var(--p-outline)] p-4 hover:border-[var(--p-outline)] transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-[var(--p-circle)] text-[var(--p-on-circle)] rounded-lg flex-shrink-0">
              <Info className="w-5 h-5 text-[var(--p-outline)]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-[var(--color-text-secondary)] mb-1">Совет тренера · глава {tip.number}</div>
              <h3 className="font-semibold text-[var(--p-labels-text)] mb-1">{tip.title}</h3>
              <p className="text-sm text-[var(--color-text-secondary)] line-clamp-3">{tip.text}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-[var(--color-text-secondary)] flex-shrink-0" />
          </div>
        </button>
      )}

      {/* --- Состояние блока --- */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="bg-[var(--p-labels)] rounded-xl border border-[var(--p-outline)] p-4">
          <h3 className="font-semibold text-[var(--p-labels-text)] mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--p-labels-text)]" />
            Программа
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)]">{program.name}</p>
          <div className="flex flex-wrap gap-3 text-sm text-[var(--color-text-secondary)] mt-2">
            <span>Неделя {plan.week} / {program.weeks}</span>
            <span>Круг {plan.cycle}</span>
            {coach.compPhase && <span>Сезон: {COMP_PHASE_LABELS[coach.compPhase]}</span>}
          </div>
        </div>
        <div className="bg-[var(--p-labels)] rounded-xl border border-[var(--p-outline)] p-4">
          <h3 className="font-semibold text-[var(--p-labels-text)] mb-2 flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-[var(--p-labels-text)]" />
            Чекпоинт
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {assessment
              ? `Замеры ${days} ${plural(days, 'день', 'дня', 'дней')} назад. Следующий через ${Math.max(0, CHECKPOINT_DAYS - days)} ${plural(Math.max(0, CHECKPOINT_DAYS - days), 'день', 'дня', 'дней')}.`
              : 'Замеров ещё не было — тренер не может подобрать веса.'}
          </p>
          {assessment && (
            <button onClick={() => navigate('/assessment?checkpoint=1')}
              className="mt-2 text-sm text-[var(--p-labels-text)] hover:underline">
              Повторные замеры
            </button>
          )}
        </div>
      </div>

      {/* --- Быстрые переходы --- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { to: '/workout', icon: Dumbbell, title: 'Тренировка', desc: 'Начать или продолжить' },
          { to: '/programs', icon: BookOpen, title: 'Программы', desc: 'Создать или изменить' },
          { to: '/progress', icon: TrendingUp, title: 'Прогресс', desc: 'Графики и рекорды' },
          { to: '/knowledge', icon: Trophy, title: 'Знания', desc: 'База по тренировкам' },
        ].map(({ to, icon: Icon, title, desc }) => (
          <button key={to} onClick={() => navigate(to)}
            className="bg-[var(--p-labels)] rounded-xl border border-[var(--p-outline)] p-4 text-left hover:border-[var(--p-outline)] transition-colors">
            <div className="p-2 bg-[var(--p-circle)] text-[var(--p-on-circle)] rounded-lg w-fit mb-3">
              <Icon className="w-5 h-5 text-[var(--p-labels-text)]" />
            </div>
            <h3 className="font-semibold text-[var(--p-labels-text)] mb-1">{title}</h3>
            <p className="text-sm text-[var(--color-text-secondary)]">{desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
