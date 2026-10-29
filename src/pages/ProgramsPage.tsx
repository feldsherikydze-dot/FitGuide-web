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
import {
  slotColor, contrastOn, withAlpha,
} from '../core/palette';
import { PageHeader } from '../components/ui';
import { useProgramsStore, useCoachStore, useProfileStore } from '../core/store';
import { useExercises, usePicker } from '../hooks/useExercises';
import { generateProgram, buildProgramName, PERIOD_LINEAR, PERIOD_NONE, PERIOD_WAVE, TYPE_AUTO, TYPE_CIRCUIT, TYPE_FULLBODY, TYPE_SPLIT } from '../core/generator';
import { analyzePhase } from '../core/planAdvisor';
import { GOALS, GOALS_ALL, GOAL_LABELS, GOAL_DESCRIPTIONS, normalizeGoal, recommendDays } from '../core/goals';
import { currentWeek, phaseForWeek } from '../core/coach';
import type { Program, Phase, Day, Slot } from '../data/types';
import {
  Card, Dialog, DialogAction, ExercisePicker, Hint, PrimaryButton,
  ConfirmDialog, Toast,
} from './progress/common';

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
    <div className="max-w-4xl mx-auto space-y-5 w-full max-w-full">
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

const inputCls = 'w-full px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white';

// ---------------------------------------------------------------- деталь программы

export function ProgramDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getById, update } = useProgramsStore();
  const coach = useCoachStore();
  const picker = usePicker();
  const { byName, groupNameById } = useExercises();

  const program = id ? getById(id) : undefined;
  const [selectedPhase, setSelectedPhase] = useState(0);
  const [editMode, setEditMode] = useState(false);

  const [renamingProgram, setRenamingProgram] = useState(false);
  const [programName, setProgramName] = useState('');
  const [renamingDay, setRenamingDay] = useState<{ day: Day; title: string } | null>(null);
  const [editingSlot, setEditingSlot] = useState<{
    day: Day; slot: Slot;
    sets: string; reps: string; rest: string; restEx: string;
    weight: string; workSec: string; workOn: boolean;
  } | null>(null);
  const [replacing, setReplacing] = useState<{ day: Day; slot: Slot } | null>(null);
  const [deleting, setDeleting] = useState<{ day: Day; slot: Slot } | null>(null);
  const [addingTo, setAddingTo] = useState<Day | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 2500);
  };

  const outline = slotColor('outline');
  const labels = slotColor('labelsButtons');
  const circle = slotColor('circleIcons');
  const labelsText = slotColor('labelsText');

  const blend = (a: string, b: string, t: number): string => {
    const hex = (h: string) => h.replace('#', '');
    const ra = parseInt(hex(a).slice(0, 2), 16);
    const ga = parseInt(hex(a).slice(2, 4), 16);
    const ba = parseInt(hex(a).slice(4, 6), 16);
    const rb = parseInt(hex(b).slice(0, 2), 16);
    const gb = parseInt(hex(b).slice(2, 4), 16);
    const bb = parseInt(hex(b).slice(4, 6), 16);
    const r = Math.round(ra + (rb - ra) * t);
    const g = Math.round(ga + (gb - ga) * t);
    const bb2 = Math.round(ba + (bb - ba) * t);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bb2.toString(16).padStart(2, '0')}`;
  };

  const roleBadge = (role: Slot['role'] | undefined) => {
    const label = role === 'main' ? 'осн' : role === 'secondary' ? 'всп' : role === 'isolation' ? 'изо' : null;
    if (!label) return null;
    const bg = blend(labels, circle, 0.35);
    return (
      <span className="flex-shrink-0" style={{
        background: bg, color: contrastOn(bg), fontSize: '10px', fontWeight: 700,
        borderRadius: '6px', padding: '1px 5px', lineHeight: 1,
      }}>{label}</span>
    );
  };

  if (!program) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12 w-full max-w-full">
        <h2 className="text-xl font-semibold mb-4" style={{ color: labelsText }}>
          Программа не найдена
        </h2>
        <button onClick={() => navigate('/programs')}
          className="fg-btn-primary px-4 py-2 rounded-lg text-sm font-medium">
          К списку
        </button>
      </div>
    );
  }

  const phase = program.phases[selectedPhase];
  const week = phase ? phase.weekStart : 1;

  const report = useMemo(() => {
    if (!program || !phase) return null;
    return analyzePhase(phase, {
      picker,
      groupNameById: groupNameById(),
      byName: byName(),
    });
  }, [program, phase, picker, groupNameById, byName]);

  const setActive = () => {
    coach.setActiveProgram(program.id);
    coach.setCoachProgram(program.id);
    navigate('/coach');
  };

  const saveProgram = (next: Program) => {
    update(next);
  };

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const toggleEdit = () => setEditMode(!editMode);

  const startWorkout = (day: Day) => {
    if (day.slots.length === 0) {
      showToast('В этом дне пока нет упражнений.');
      return;
    }
    coach.setActiveProgram(program.id);
    coach.setCoachProgram(program.id);
    navigate(`/workout?program=${encodeURIComponent(program.id)}&week=${week}&day=${encodeURIComponent(day.title)}`);
  };

  /* ---------- переименование программы ---------- */
  const openRenameProgram = () => {
    setProgramName(program.name);
    setRenamingProgram(true);
  };
  const applyRenameProgram = () => {
    const name = programName.trim();
    if (!name || name === program.name) {
      setRenamingProgram(false);
      return;
    }
    saveProgram({ ...program, name });
    setRenamingProgram(false);
  };

  /* ---------- переименование дня ---------- */
  const openRenameDay = (day: Day) => {
    setRenamingDay({ day, title: day.title });
  };
  const applyRenameDay = () => {
    if (!renamingDay) return;
    const title = renamingDay.title.trim();
    if (!title) return;
    saveProgram({
      ...program,
      phases: program.phases.map(ph => {
        if (ph !== phase) return ph;
        return {
          ...ph,
          days: ph.days.map(d => d === renamingDay.day ? { ...d, title } : d),
        };
      }),
    });
    setRenamingDay(null);
  };

  /* ---------- правка подхода ---------- */
  const openEditSlot = (day: Day, slot: Slot) => {
    setEditingSlot({
      day, slot,
      sets: String(slot.sets > 0 ? slot.sets : 3),
      reps: slot.reps, rest: slot.rest, restEx: slot.restEx || '',
      weight: (slot.startWeight ?? 0) > 0 ? String(slot.startWeight) : '',
      workSec: (slot.workSec ?? 0) > 0 ? String(slot.workSec) : '40',
      workOn: (slot.workSec ?? 0) > 0,
    });
  };
  const applyEditSlot = () => {
    if (!editingSlot) return;
    const { day, slot, sets, reps, rest, restEx, weight, workSec, workOn } = editingSlot;
    const next: Slot = {
      ...slot,
      sets: Math.max(1, Math.min(20, parseInt(sets, 10) || 3)),
      reps: reps.trim() || slot.reps,
      rest: rest.trim() || slot.rest,
      restEx: restEx.trim() || undefined,
      startWeight: parseFloat(weight.replace(',', '.')) || 0,
      workSec: workOn ? Math.max(1, Math.min(600, parseInt(workSec, 10) || 40)) : 0,
    };
    saveProgram({
      ...program,
      phases: program.phases.map(ph => {
        if (ph !== phase) return ph;
        return {
          ...ph,
          days: ph.days.map(d => d === day
            ? { ...d, slots: d.slots.map(s => s === slot ? next : s) }
            : d),
        };
      }),
    });
    setEditingSlot(null);
  };

  /* ---------- замена упражнения ---------- */
  const openReplace = (day: Day, slot: Slot) => {
    setReplacing({ day, slot });
  };
  const applyReplace = (exercise: string) => {
    if (!replacing) return;
    const { day, slot } = replacing;
    saveProgram({
      ...program,
      phases: program.phases.map(ph => {
        if (ph !== phase) return ph;
        return {
          ...ph,
          days: ph.days.map(d => d === day
            ? { ...d, slots: d.slots.map(s => s === slot ? { ...s, exercise } : s) }
            : d),
        };
      }),
    });
    setReplacing(null);
  };

  /* ---------- удаление подхода ---------- */
  const openDelete = (day: Day, slot: Slot) => {
    setDeleting({ day, slot });
  };
  const applyDelete = () => {
    if (!deleting) return;
    const { day, slot } = deleting;
    saveProgram({
      ...program,
      phases: program.phases.map(ph => {
        if (ph !== phase) return ph;
        return {
          ...ph,
          days: ph.days.map(d => d === day
            ? { ...d, slots: d.slots.filter(s => s !== slot) }
            : d),
        };
      }),
    });
    setDeleting(null);
  };

  /* ---------- перемещение подхода ---------- */
  const moveSlot = (day: Day, slot: Slot, dir: -1 | 1) => {
    const idx = day.slots.indexOf(slot);
    const to = idx + dir;
    if (idx < 0 || to < 0 || to >= day.slots.length) return;
    const nextSlots = [...day.slots];
    nextSlots.splice(idx, 1);
    nextSlots.splice(to, 0, slot);
    saveProgram({
      ...program,
      phases: program.phases.map(ph => {
        if (ph !== phase) return ph;
        return { ...ph, days: ph.days.map(d => d === day ? { ...d, slots: nextSlots } : d) };
      }),
    });
  };

  /* ---------- добавление упражнения ---------- */
  const openAdd = (day: Day) => {
    setAddingTo(day);
  };
  const applyAdd = (exercise: string) => {
    if (!addingTo) return;
    const sets = phase ? parseInt(String((phase.scheme.match(/^(\d+)/) || [0, 3])[1]), 10) || 3 : 3;
    const next: Slot = {
      exercise,
      group: '',
      reps: '10–12',
      rest: '60–90 сек',
      sets,
      role: 'secondary',
    };
    saveProgram({
      ...program,
      phases: program.phases.map(ph => {
        if (ph !== phase) return ph;
        return {
          ...ph,
          days: ph.days.map(d => d === addingTo
            ? { ...d, slots: [...d.slots, next] }
            : d),
        };
      }),
    });
    setAddingTo(null);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg)' }}>
      <PageHeader
        title={program.name}
        onBack={() => navigate('/programs')}
        right={
          <>
            <button
              onClick={setActive}
              className="fg-btn-primary px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 flex-shrink-0"
            >
              <Play className="w-4 h-4" /> Тренер
            </button>
            <button
              onClick={toggleEdit}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium flex-shrink-0"
              style={{ border: `1px solid ${outline}`, color: labelsText }}
            >
              <Pencil className="w-4 h-4" /> {editMode ? 'Готово' : 'Редактировать'}
            </button>
          </>
        }
      />

      <div className="max-w-4xl mx-auto space-y-4 px-4 pb-30 w-full max-w-full">
        <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {GOAL_LABELS[normalizeGoal(program.goal)] || program.goal} · {program.level}
          · {program.daysPerWeek} дн/нед · {program.weeks} нед
        </div>
        <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Дата создания: {formatDate(program.createdAt)}
        </div>

        {/* Тренировочный план */}
        <div style={{ color: labelsText, fontWeight: 700, fontSize: '15px', marginBottom: '8px' }}>
          Тренировочный план
        </div>

        {/* Карточка «Фазы» — как в вебе: выбираешь фазу, ниже только её дни */}
        <div style={{ background: 'var(--p-labels)', border: `1px solid ${outline}`, borderRadius: '18px', padding: '16px' }}>
          <div style={{ color: labelsText, fontWeight: 700, fontSize: '15px', marginBottom: '8px' }}>
            Фазы
          </div>
          <div className="space-y-2">
            {program.phases.map((ph, i) => {
              const sel = i === selectedPhase;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedPhase(i)}
                  className="w-full text-left p-3 rounded-[14px] transition-colors focus:outline-none"
                  style={{
                    background: sel ? withAlpha(circle, 0.33) : 'transparent',
                    border: `1px solid ${sel ? circle : withAlpha(outline, 0.99)}`,
                    color: '#1B1E20',
                  }}
                >
                  <div className="font-semibold">{ph.label}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                    Недели {ph.weekStart}–{ph.weekEnd} · {ph.scheme}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Карточка выбранной фазы: заголовок, схема, анализ, дни */}
        {phase && (
          <div style={{ background: 'var(--p-labels)', border: `1px solid ${outline}`, borderRadius: '18px', padding: '16px', marginTop: '8px' }}>
            <div style={{ color: labelsText, fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>
              {phase.label}
            </div>
            <div className="text-sm" style={{ color: 'var(--color-text-secondary)', marginBottom: '10px' }}>
              {phase.scheme}
            </div>

            {report && !report.empty && (
              <div className="mt-4">
                <div style={{ color: labelsText, fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
                  {report.ok ? 'План сбалансирован — можно тренироваться.' : 'Как улучшить план'}
                </div>
                {report.regionVolume.length > 0 && (
                  <div className="mt-4">
                    <div style={{ color: labelsText, fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
                      Объём по регионам
                    </div>
                    <div className="space-y-3">
                      {report.regionVolume.map(([name, v]) => {
                        const max = Math.max(1, ...report.regionVolume.map(x => x[1]));
                        return (
                          <div key={name} className="flex items-center gap-3">
                            <span className="w-28 text-sm flex-shrink-0 truncate" style={{ color: 'var(--color-text-secondary)' }}>
                              {name}
                            </span>
                            <div className="flex-1 h-3 rounded overflow-hidden" style={{ background: withAlpha(outline, 0.26) }}>
                              <div className="h-full rounded" style={{ background: circle, width: `${Math.max(1, (v / max) * 100)}%` }} />
                            </div>
                            <span className="w-8 text-right text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                              {v}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {report.muscleVolume.length > 0 && (
                  <div className="mt-4">
                    <div style={{ color: labelsText, fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
                      Объём по мышцам
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {report.muscleVolume.map(([name, v]) => (
                        <span key={name} className="px-2 py-1 rounded text-[11px] font-medium border flex-shrink-0" style={{
                          background: withAlpha(circle, 0.22),
                          borderColor: withAlpha(outline, 0.66),
                          color: '#1B1E20',
                        }}>
                          {name}: {v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-4">
                  <div style={{ color: labelsText, fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
                    Как улучшить план
                  </div>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: '13px', lineHeight: 1.5 }}>
                    {report.ok
                      ? 'План сбалансирован — можно тренироваться.'
                      : report.tips.map((t, i) => (
                          <div key={i} style={{ marginBottom: '2px' }}>• {t}</div>
                        ))}
                  </div>
                </div>
              </div>
            )}

            {/* Дни фазы */}
            {phase.days.map((day) => (
              <div key={day.title} className="mt-5">
                <div style={{ borderTop: `1px solid ${withAlpha(outline, 0.44)}`, paddingTop: '10px' }} />
                <div
                  onClick={() => (editMode ? openRenameDay(day) : startWorkout(day))}
                  className="flex items-center justify-between cursor-pointer"
                  role="button"
                  tabIndex={0}
                >
                  <div style={{ fontWeight: 700, fontSize: '15px', color: '#1B1E20' }}>
                    {day.title}
                  </div>
                  <div style={{ color: editMode ? labelsText : labels, fontSize: '13px', fontWeight: 600 }}>
                    {editMode ? 'Переименовать' : 'Начать тренировку'}
                  </div>
                </div>
                <div className="mt-2 space-y-2">
                  {day.slots.map((slot, si) => (
                    <div key={si} className="pt-3 pb-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex items-center gap-2">
                          {roleBadge(slot.role)}
                          <span className="text-sm truncate block" style={{ color: '#1B1E20' }}>
                            {slot.exercise}
                          </span>
                        </div>
                        <span className="text-[12px] font-mono flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
                          {slot.sets} × повторений — {slot.reps} · отдых: {slot.rest}
                        </span>
                      </div>
                      <div className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                        {(slot.group && slot.group !== slot.exercise ? slot.group + ' · ' : '')}
                        {(slot.startWeight ?? 0) > 0 ? `вес ${slot.startWeight} кг · ` : ''}
                        {(slot.workSec ?? 0) > 0 ? `${slot.workSec} сек подхода · ` : ''}
                      </div>
                      {editMode && (
                        <div className="flex items-center gap-2 mt-2 pt-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); moveSlot(day, slot, -1); }}
                            disabled={si === 0}
                            className="text-xs px-2"
                            style={{ color: si === 0 ? 'var(--color-text-secondary)' : labelsText }}
                          >
                            ▲
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); moveSlot(day, slot, +1); }}
                            disabled={si === day.slots.length - 1}
                            className="text-xs px-2"
                            style={{ color: si === day.slots.length - 1 ? 'var(--color-text-secondary)' : labelsText }}
                          >
                            ▼
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); openEditSlot(day, slot); }}
                            className="text-[12px] underline underline-offset-2"
                            style={{ color: labelsText }}
                          >
                            Изменить
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); openReplace(day, slot); }}
                            className="text-[12px] underline underline-offset-2"
                            style={{ color: labelsText }}
                          >
                            Заменить
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); openDelete(day, slot); }}
                            className="text-[12px] underline underline-offset-2"
                            style={{ color: 'var(--color-text-secondary)' }}
                          >
                            Удалить
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {editMode && (
                    <div
                      onClick={(e) => { e.stopPropagation(); openAdd(day); }}
                      className="cursor-pointer mt-3"
                      style={{ color: labelsText, fontWeight: 700, fontSize: '13px', padding: '6px 8px' }}
                    >
                      + Добавить упражнение
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Диалог переименования программы */}
      {renamingProgram && (
        <Dialog title="Название программы" onClose={() => setRenamingProgram(false)}
          actions={
            <>
              <DialogAction onClick={() => setRenamingProgram(false)}>Отмена</DialogAction>
              <DialogAction strong onClick={applyRenameProgram}>Сохранить</DialogAction>
            </>
          }>
          <Field label="Название программы">
            <input className="fg-input" value={programName} onChange={e => setProgramName(e.target.value)} />
          </Field>
        </Dialog>
      )}

      {/* Диалог переименования дня */}
      {renamingDay && (
        <Dialog title="Название дня" onClose={() => setRenamingDay(null)}
          actions={
            <>
              <DialogAction onClick={() => setRenamingDay(null)}>Отмена</DialogAction>
              <DialogAction strong onClick={applyRenameDay}>Сохранить</DialogAction>
            </>
          }>
          <Field label="Название дня">
            <input className="fg-input" value={renamingDay.title} onChange={e => setRenamingDay({ ...renamingDay, title: e.target.value })} />
          </Field>
        </Dialog>
      )}

      {/* Диалог правки подхода (подходы/повторы/отдых/вес/время) */}
      {editingSlot && (
        <Dialog title={editingSlot.slot.exercise} onClose={() => setEditingSlot(null)}
          actions={
            <>
              <DialogAction onClick={() => setEditingSlot(null)}>Отмена</DialogAction>
              <DialogAction strong onClick={applyEditSlot}>Сохранить</DialogAction>
            </>
          }>
          <div className="space-y-3 pt-1">
            <div>
              <div className="text-[11px] mb-1" style={{ color: 'var(--color-text-secondary)' }}>Подходы</div>
              <Field label="Подходы">
                <input className="fg-input" value={editingSlot.sets} onChange={e => setEditingSlot(s => s ? { ...s, sets: e.target.value } : null)} placeholder="3" />
              </Field>
            </div>
            <div>
              <div className="text-[11px] mb-1" style={{ color: 'var(--color-text-secondary)' }}>Повторы</div>
              <Field label="Повторы">
                <input className="fg-input" value={editingSlot.reps} onChange={e => setEditingSlot(s => s ? { ...s, reps: e.target.value } : null)} placeholder="10–12" />
              </Field>
            </div>
            <div>
              <div className="text-[11px] mb-1" style={{ color: 'var(--color-text-secondary)' }}>Отдых между подходами</div>
              <Field label="Отдых между подходами">
                <input className="fg-input" value={editingSlot.rest} onChange={e => setEditingSlot(s => s ? { ...s, rest: e.target.value } : null)} placeholder="60–90 сек" />
              </Field>
            </div>
            <div>
              <div className="text-[11px] mb-1" style={{ color: 'var(--color-text-secondary)' }}>Отдых между упражнениями</div>
              <Field label="Отдых между упражнениями">
                <input className="fg-input" value={editingSlot.restEx} onChange={e => setEditingSlot(s => s ? { ...s, restEx: e.target.value } : null)} placeholder="—" />
              </Field>
            </div>
            <div>
              <div className="text-[11px] mb-1" style={{ color: 'var(--color-text-secondary)' }}>Стартовый вес, кг</div>
              <Field label="Стартовый вес, кг">
                <input className="fg-input" value={editingSlot.weight} onChange={e => setEditingSlot(s => s ? { ...s, weight: e.target.value } : null)} placeholder="Не задан" />
              </Field>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editingSlot.workOn}
                onChange={() => setEditingSlot(s => s ? { ...s, workOn: !s.workOn } : null)}
                className="w-4 h-4 rounded"
                style={{ accentColor: labelsText }}
              />
              <span className="text-[13px] font-medium" style={{ color: '#1B1E20' }}>Считать время подхода</span>
            </div>
            {editingSlot.workOn && (
              <div>
                <Field label="Секунд на подход">
                  <input className="fg-input" value={editingSlot.workSec} onChange={e => setEditingSlot(s => s ? { ...s, workSec: e.target.value } : null)} placeholder="40" />
                </Field>
              </div>
            )}
          </div>
        </Dialog>
      )}

      {/* Диалог замены упражнения */}
      {replacing && (
        <Dialog title="Заменить упражнение" onClose={() => setReplacing(null)}
          actions={
            <>
              <DialogAction onClick={() => setReplacing(null)}>Отмена</DialogAction>
            </>
          }>
          <ExercisePicker title="Заменить упражнение" initialQuery={replacing.slot.exercise}
            onPick={applyReplace} onClose={() => setReplacing(null)} />
        </Dialog>
      )}

      {/* Диалог удаления подхода */}
      {deleting && (
        <ConfirmDialog title="Удалить упражнение?"
          message="Упражнение будет убрано из этого дня. Изменение сохранится сразу."
          onConfirm={applyDelete}
          onClose={() => setDeleting(null)}
        />
      )}

      {/* Пикер добавления упражнения */}
      {addingTo && (
        <ExercisePicker title="+ Добавить упражнение" onPick={applyAdd}
          onClose={() => setAddingTo(null)} />
      )}

      <Toast text={toast} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
