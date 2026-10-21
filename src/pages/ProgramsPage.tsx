// FitGuide Web — программы (порт ProgramHubActivity + ProgramDetailActivity)
//
// Генератор: цели, уровень, направление, тип, дни/недели, периодизация, место.
// Деталь: разбор плана (PlanAdvisor) — объём по мышцам и подсказки.

import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  Plus, Trash2, Copy, Play, Dumbbell, Zap, ChevronRight, AlertTriangle,
  CheckCircle, Lightbulb, Layers, Settings2, X, Pencil,
} from 'lucide-react';
import { useProgramsStore, useCoachStore, useProfileStore } from '../core/store';
import { useExercises, usePicker } from '../hooks/useExercises';
import { generateProgram, buildProgramName, PERIOD_LINEAR, PERIOD_NONE, PERIOD_WAVE, TYPE_AUTO, TYPE_CIRCUIT, TYPE_FULLBODY, TYPE_SPLIT } from '../core/generator';
import { analyzePhase } from '../core/planAdvisor';
import { GOALS, GOALS_ALL, GOAL_LABELS, GOAL_DESCRIPTIONS, normalizeGoal, recommendDays } from '../core/goals';
import { currentWeek, phaseForWeek } from '../core/coach';
import type { Program } from '../data/types';

const TYPE_OPTIONS = [
  { value: TYPE_AUTO, label: 'Авто', desc: 'Система сама выберет сплит' },
  { value: TYPE_FULLBODY, label: 'Фулбоди', desc: 'Все тело за тренировку, 2–3 раза в неделю' },
  { value: TYPE_SPLIT, label: 'Сплит', desc: 'Разделение по группам мышц' },
  { value: TYPE_CIRCUIT, label: 'Круговая', desc: 'Минимальный отдых, кардионагрузка' },
];

const PERIOD_OPTIONS = [
  { value: PERIOD_NONE, label: 'Без периодизации', desc: 'Одинаковая нагрузка все недели' },
  { value: PERIOD_LINEAR, label: 'Линейная', desc: 'Накопление → Интенсификация → Пик → Разгрузка' },
  { value: PERIOD_WAVE, label: 'Волновая (DUP)', desc: 'Чередование объёма и интенсивности' },
];

export function ProgramsPage() {
  const navigate = useNavigate();
  const { programs, add, remove } = useProgramsStore();
  const { profile } = useProfileStore();
  const { db } = useExercises();

  const [showGen, setShowGen] = useState(false);
  const [form, setForm] = useState({
    goal: normalizeGoal(profile?.goal || GOALS.MASS),
    level: profile?.level || 'intermediate',
    style: profile?.trainStyle || 'any',
    type: TYPE_AUTO,
    daysPerWeek: profile?.workoutsPerWeek || 3,
    weeks: 12,
    period: PERIOD_LINEAR,
    place: profile?.place || 'gym',
    equipment: profile?.equipment || [],
  });

  const generate = () => {
    if (!db) return;
    const program = generateProgram({
      name: buildProgramName(form.type, form.daysPerWeek, form.goal),
      goal: form.goal,
      level: form.level,
      daysPerWeek: form.daysPerWeek,
      weeks: form.weeks,
      place: form.place,
      style: form.style,
      periodType: form.period,
      type: form.type,
      equipment: form.equipment,
      age: profile?.age,
      female: profile?.gender === 'female',
    }, db);
    add(program);
    setShowGen(false);
    navigate(`/programs/${program.id}`);
  };

  const duplicate = (p: Program) => {
    add({ ...p, id: crypto.randomUUID(), name: p.name + ' (копия)', createdAt: Date.now() });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Программы</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {programs.length} сохранено
          </p>
        </div>
        <button onClick={() => setShowGen(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Новая программа
        </button>
      </div>

      {showGen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-dark-card rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-dark-card border-b border-slate-200 dark:border-dark-border p-4 rounded-t-2xl flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Генератор программ</h2>
              <button onClick={() => setShowGen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-dark-border rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <Field label="Цель">
                <div className="flex flex-wrap gap-2">
                  {GOALS_ALL.map(g => (
                    <button key={g} onClick={() => setForm(f => ({ ...f, goal: g }))}
                      className={clsx('px-3 py-1.5 rounded-lg border text-sm transition-colors',
                        form.goal === g
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'border-slate-200 dark:border-dark-border text-slate-600 dark:text-slate-400')}>
                      {GOAL_LABELS[g]}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">{GOAL_DESCRIPTIONS[form.goal]}</p>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Уровень">
                  <select value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
                    className={inputCls}>
                    <option value="beginner">Новичок (0–1 год)</option>
                    <option value="intermediate">Средний (1–3 года)</option>
                    <option value="advanced">Продвинутый (3+ года)</option>
                  </select>
                </Field>
                <Field label="Направление">
                  <select value={form.style} onChange={e => setForm(f => ({ ...f, style: e.target.value }))}
                    className={inputCls}>
                    <option value="any">Любое</option>
                    <option value="bb">Бодибилдинг</option>
                    <option value="pl">Пауэрлифтинг</option>
                  </select>
                </Field>
              </div>

              <Field label="Тип программы">
                <div className="grid gap-2 sm:grid-cols-2">
                  {TYPE_OPTIONS.map(t => (
                    <button key={t.value} onClick={() => setForm(f => ({ ...f, type: t.value }))}
                      className={clsx('p-3 rounded-lg border text-left transition-colors',
                        form.type === t.value
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                          : 'border-slate-200 dark:border-dark-border hover:border-primary-300')}>
                      <div className="font-medium text-slate-900 dark:text-white">{t.label}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </Field>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Дней в неделю">
                  <select value={form.daysPerWeek}
                    onChange={e => setForm(f => ({ ...f, daysPerWeek: parseInt(e.target.value) }))}
                    className={inputCls}>
                    {[2, 3, 4, 5, 6].map(d => <option key={d} value={d}>{d} дня</option>)}
                  </select>
                </Field>
                <Field label="Недель">
                  <input type="number" min="4" max="24" value={form.weeks}
                    onChange={e => setForm(f => ({ ...f, weeks: parseInt(e.target.value) || 12 }))}
                    className={inputCls + ' text-center'} />
                </Field>
                <Field label="Периодизация">
                  <select value={form.period} onChange={e => setForm(f => ({ ...f, period: parseInt(e.target.value) }))}
                    className={inputCls}>
                    {PERIOD_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Место тренировок">
                <div className="flex gap-3">
                  {[{ v: 'gym', l: 'Зал', d: 'Полное оборудование' }, { v: 'home', l: 'Дом', d: 'Минимальный инвентарь' }].map(p => (
                    <button key={p.v} onClick={() => setForm(f => ({ ...f, place: p.v }))}
                      className={clsx('flex-1 p-3 rounded-lg border text-left transition-colors',
                        form.place === p.v
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                          : 'border-slate-200 dark:border-dark-border hover:border-primary-300')}>
                      <div className="font-medium text-slate-900 dark:text-white">{p.l}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{p.d}</div>
                    </button>
                  ))}
                </div>
              </Field>

              {form.place === 'gym' && (
                <Field label="Оборудование зала (пусто = всё)">
                  <div className="flex flex-wrap gap-2">
                    {['barbell', 'dumbbell', 'cable', 'smith', 'machine'].map(eq => (
                      <button key={eq} onClick={() => setForm(f => ({
                        ...f, equipment: f.equipment.includes(eq)
                          ? f.equipment.filter(x => x !== eq) : [...f.equipment, eq]
                      }))}
                        className={clsx('px-3 py-1.5 rounded-lg border text-sm transition-colors',
                          form.equipment.includes(eq)
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                            : 'border-slate-200 dark:border-dark-border text-slate-600 dark:text-slate-400')}>
                        {eq.charAt(0).toUpperCase() + eq.slice(1)}
                      </button>
                    ))}
                  </div>
                </Field>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-dark-border">
                <button onClick={() => setShowGen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-dark-border rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-border">
                  Отмена
                </button>
                <button onClick={generate} disabled={!db}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center gap-1.5">
                  <Zap className="w-4 h-4" /> Сгенерировать
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {programs.length === 0 && !showGen ? (
        <div className="text-center py-12 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border">
          <Dumbbell className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Программ пока нет</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6">Сгенерируй первую под свою цель</p>
          <button onClick={() => setShowGen(true)}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Создать
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {programs.map(p => (
            <div key={p.id} className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border overflow-hidden hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900 dark:text-white truncate">{p.name}</h3>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mt-1">
                      <span>{p.daysPerWeek} дн/нед</span><span>·</span>
                      <span>{p.weeks} нед</span><span>·</span>
                      <span>{p.phases.length} фаз</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => navigate(`/programs/${p.id}`)}
                      className="p-2 text-primary-600 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-lg" title="Открыть">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button onClick={() => duplicate(p)}
                      className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-dark-border rounded-lg" title="Дублировать">
                      <Copy className="w-4 h-4" />
                    </button>
                    <button onClick={() => { if (confirm('Удалить программу?')) remove(p.id); }}
                      className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg" title="Удалить">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-3">
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">
                    {GOAL_LABELS[normalizeGoal(p.goal)] || p.goal}
                  </span>
                  {p.template && (
                    <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded text-xs">
                      {p.template}
                    </span>
                  )}
                  {p.phases.some(ph => ph.deload) && (
                    <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded text-xs">Разгрузка</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- деталь программы

export function ProgramDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getById, update } = useProgramsStore();
  const coach = useCoachStore();
  const picker = usePicker();
  const { byName, groupNameById } = useExercises();

  const program = id ? getById(id) : undefined;
  const [week, setWeek] = useState(1);

  const report = useMemo(() => {
    if (!program) return null;
    const phase = phaseForWeek(program, week);
    return analyzePhase(phase, {
      picker,
      groupNameById: groupNameById(),
      byName: byName(),
    });
  }, [program, week, picker, groupNameById, byName]);

  if (!program) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Программа не найдена</h2>
        <button onClick={() => navigate('/programs')} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          К списку
        </button>
      </div>
    );
  }

  const phase = phaseForWeek(program, week);

  const setActive = () => {
    coach.setActiveProgram(program.id);
    coach.setCoachProgram(program.id);
    navigate('/coach');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button onClick={() => navigate('/programs')} className="text-sm text-slate-500 dark:text-slate-400 hover:underline mb-1">
            ← Программы
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white truncate">{program.name}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {program.daysPerWeek} дн/нед · {program.weeks} нед · {GOAL_LABELS[normalizeGoal(program.goal)] || program.goal}
          </p>
        </div>
        <button onClick={setActive}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 flex items-center gap-2 flex-shrink-0">
          <Play className="w-4 h-4" /> Сделать активной
        </button>
      </div>

      {/* Недели */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary-600" /> Фазы
          </h2>
        </div>
        <div className="space-y-2">
          {program.phases.map((ph, i) => (
            <button key={i} onClick={() => setWeek(ph.weekStart)}
              className={clsx('w-full p-3 rounded-lg border text-left transition-colors',
                week >= ph.weekStart && week <= ph.weekEnd
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                  : 'border-slate-200 dark:border-dark-border hover:border-primary-300')}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-900 dark:text-white">{ph.label}</span>
                <span className="text-sm text-slate-500 dark:text-slate-400">Недели {ph.weekStart}–{ph.weekEnd}</span>
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{ph.scheme}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Дни фазы */}
      {phase && (
        <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-border/50">
            <h2 className="font-semibold text-slate-900 dark:text-white">{phase.label} · недели {phase.weekStart}–{phase.weekEnd}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{phase.scheme}</p>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-dark-border">
            {phase.days.map(day => (
              <div key={day.title} className="p-4">
                <h3 className="font-medium text-slate-900 dark:text-white mb-2">{day.title}</h3>
                <div className="space-y-1.5">
                  {day.slots.map((slot, i) => (
                    <div key={i} className="flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0 flex items-center gap-2">
                        <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0',
                          slot.role === 'main' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          slot.role === 'secondary' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400')}>
                          {slot.role === 'main' ? 'осн' : slot.role === 'secondary' ? 'всп' : 'изо'}
                        </span>
                        <span className="text-slate-700 dark:text-slate-300 truncate">{slot.exercise}</span>
                      </div>
                      <span className="text-slate-500 dark:text-slate-400 flex-shrink-0 font-mono text-xs">
                        {slot.sets}×{slot.reps} · {slot.rest}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Анализ плана */}
      {report && !report.empty && (
        <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-5">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
            {report.ok
              ? <CheckCircle className="w-5 h-5 text-green-500" />
              : <AlertTriangle className="w-5 h-5 text-amber-500" />}
            Анализ плана
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Всего {report.totalSets} подходов в фазе
          </p>

          {report.regionVolume.length > 0 && (
            <>
              <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-2">Объём по регионам</h3>
              <div className="space-y-1.5 mb-4">
                {report.regionVolume.map(([name, v]) => {
                  const max = Math.max(...report.regionVolume.map(x => x[1]));
                  return (
                    <div key={name} className="flex items-center gap-3">
                      <span className="w-28 text-sm text-slate-600 dark:text-slate-400 flex-shrink-0 truncate">{name}</span>
                      <div className="flex-1 h-4 bg-slate-100 dark:bg-dark-border rounded overflow-hidden">
                        <div className="h-full bg-primary-500 rounded" style={{ width: `${(v / max) * 100}%` }} />
                      </div>
                      <span className="w-8 text-right text-sm font-mono text-slate-600 dark:text-slate-400">{v}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {report.muscleVolume.length > 0 && (
            <>
              <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-2">Объём по мышцам</h3>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {report.muscleVolume.map(([name, v]) => (
                  <span key={name} className="px-2 py-1 bg-slate-100 dark:bg-dark-border text-slate-600 dark:text-slate-400 rounded text-xs">
                    {name}: {v}
                  </span>
                ))}
              </div>
            </>
          )}

          {report.tips.length > 0 && (
            <>
              <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-amber-500" /> Подсказки
              </h3>
              <ul className="space-y-1.5">
                {report.tips.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <span className="text-amber-500 flex-shrink-0">•</span>
                    {t}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
