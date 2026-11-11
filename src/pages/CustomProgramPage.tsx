// «Своя сборка» — порт CustomProgramActivity (режим редактора).
//
// Структура 1:1 с Android: поле имени, галочка «Периодизация», карточки блоков
// (курс/блок с целью и неделями), дни с заголовком-переименованием, строки
// упражнений с ▲▼ и «−», кнопки «+ День» / «+ Упражнение» / «+ Блок».
// Все кнопки — MaterialButton после tintOne: фон (B), обводка (A), текст (D).

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type React from 'react';
import { useProfileStore, useProgramsStore } from '../core/store';
import { GOALS, normalizeGoal } from '../core/goals';
import type { Program } from '../data/types';
import {
  Dialog, DialogAction, ConfirmDialog, Toast,
  parseInt10, parseNum, trimNum,
} from './progress/common';
import { ExercisePickerScreen } from '../components/ExercisePickerScreen';
import { PageHeader } from '../components/ui';

const REPS_OPTIONS = ['3–5', '5–8', '8–10', '10–12', '12–15', '15–20', '20–25'];
const REST_OPTIONS = ['45–60 сек', '60–90 сек', '90–120 сек', '2–3 мин'];
const DEFAULT_WORK_SEC = 40;
const MIN_SETS = 1;
const MAX_SETS = 6;
const MIN_WEEKS = 1;
const MAX_WEEKS = 12;

const GOAL_ORDER = [GOALS.MASS, GOALS.LOSE, GOALS.STRENGTH, GOALS.CUT, GOALS.ENDURANCE, GOALS.RECOMP];
const GOAL_LABELS_RU: Record<string, string> = {
  [GOALS.MASS]: 'Масса',
  [GOALS.LOSE]: 'Похудение',
  [GOALS.STRENGTH]: 'Сила',
  [GOALS.CUT]: 'Рельеф',
  [GOALS.ENDURANCE]: 'Выносливость',
  [GOALS.RECOMP]: 'Рекомпозиция',
};

function defaultSets(goal: string): number {
  const g = normalizeGoal(goal);
  if (g === GOALS.STRENGTH) return 5;
  if (g === GOALS.CUT || g === GOALS.LOSE || g === GOALS.ENDURANCE) return 3;
  return 4;
}

function defaultReps(goal: string): string {
  const g = normalizeGoal(goal);
  if (g === GOALS.STRENGTH) return '3–5';
  if (g === GOALS.CUT || g === GOALS.LOSE || g === GOALS.ENDURANCE) return '12–15';
  return '8–12';
}

function defaultRest(goal: string): string {
  const g = normalizeGoal(goal);
  if (g === GOALS.STRENGTH) return '60–90 сек';
  if (g === GOALS.CUT || g === GOALS.LOSE || g === GOALS.ENDURANCE) return '45–60 сек';
  return '90–120 сек';
}

interface SlotDraft {
  exercise: string;
  reps: string;
  rest: string;
  restEx: string;
  sets: number;
  startWeight: number;
  workSec: number;
}

interface DayDraft {
  title: string;
  slots: SlotDraft[];
}

interface BlockDraft {
  goal: string;
  weeks: number;
  days: DayDraft[];
}

function emptySlot(exercise: string): SlotDraft {
  return { exercise, reps: '8–12', rest: '60–90 сек', restEx: '2–3 мин', sets: 3, startWeight: 0, workSec: 0 };
}

function emptyDay(title: string): DayDraft {
  return { title, slots: [] };
}

function emptyBlock(dayTitle: string): BlockDraft {
  return { goal: GOALS.MASS, weeks: 4, days: [emptyDay(dayTitle)] };
}

interface SlotEdit {
  bi: number; di: number; si: number;
  sets: string; reps: string; rest: string; restEx: string;
  weight: string; workSec: string; workOn: boolean;
}

// --- кнопки как MaterialButton после tintOne -----------------------------

const BTN = {
  background: 'var(--p-labels)',
  border: '1px solid var(--p-outline)',
  color: 'var(--p-labels-text)',
} as const;

function AddButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full min-h-[44px] my-1.5 rounded-[26px] px-4 text-[14px] font-bold uppercase tracking-[0.089em] active:opacity-80"
      style={BTN}
    >
      {children}
    </button>
  );
}

function MiniBtn({ children, onClick, disabled, size = 24, radius = 12, fontSize = 7 }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean;
  size?: number; radius?: number; fontSize?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center font-bold flex-shrink-0 active:opacity-80"
      style={{ ...BTN, width: size, height: size, borderRadius: radius, fontSize, opacity: disabled ? 0.35 : 1 }}
    >
      {children}
    </button>
  );
}

/** Карточка редактора — createCard(): colorSurface, обводка outline, радиус 12. */
const CARD: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-outline)',
  borderRadius: 12,
};

export function CustomProgramPage() {
  const navigate = useNavigate();
  const { add } = useProgramsStore();
  const { profile } = useProfileStore();
  const [name, setName] = useState('');
  const [periodized, setPeriodized] = useState(false);
  const [blocks, setBlocks] = useState<BlockDraft[]>(() => [emptyBlock('Тренировка 1')]);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmKind, setConfirmKind] = useState<'block' | 'day' | 'slot' | null>(null);
  const [confirmIdx, setConfirmIdx] = useState<{ bi: number; di?: number; si?: number } | null>(null);
  const [pickFor, setPickFor] = useState<{ bi: number; di: number } | null>(null);
  const [slotEdit, setSlotEdit] = useState<SlotEdit | null>(null);
  const [renameFor, setRenameFor] = useState<{ bi: number; di: number } | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [goalFor, setGoalFor] = useState<number | null>(null);
  const [weeksFor, setWeeksFor] = useState<number | null>(null);
  const [optionPick, setOptionPick] = useState<{ field: 'reps' | 'rest' | 'restEx'; options: string[]; value: string } | null>(null);

  const showToast = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 2500);
  };

  const getBlock = (bi: number) => blocks[bi];
  const getDay = (bi: number, di: number) => blocks[bi]?.days[di];
  const getSlot = (bi: number, di: number, si: number) => blocks[bi]?.days[di]?.slots[si];

  const addBlock = () => {
    const n = blocks.reduce((s, b) => s + b.days.length, 0) + 1;
    setBlocks(list => [...list, emptyBlock(`Тренировка ${n}`)]);
  };
  const removeBlock = (bi: number) => setBlocks(list => {
    const next = list.filter((_, i) => i !== bi);
    return next.length ? next : [emptyBlock('Тренировка 1')];
  });
  const setBlockGoal = (bi: number, goal: string) => setBlocks(list =>
    list.map((b, i) => i === bi ? { ...b, goal } : b));
  const setBlockWeeks = (bi: number, weeks: number) => {
    const v = Math.max(MIN_WEEKS, Math.min(MAX_WEEKS, weeks));
    setBlocks(list => list.map((b, i) => i === bi ? { ...b, weeks: v } : b));
  };

  const addDay = (bi: number) => {
    const n = blocks.reduce((s, b) => s + b.days.length, 0) + 1;
    setBlocks(list => list.map((b, i) => i === bi
      ? { ...b, days: [...b.days, emptyDay(`Тренировка ${n}`)] } : b));
  };
  const removeDay = (bi: number, di: number) => setBlocks(list => list.map((b, i) => i === bi
    ? { ...b, days: b.days.filter((_, d) => d !== di) } : b));
  const renameDay = (bi: number, di: number, title: string) => setBlocks(list => list.map((b, i) => i === bi
    ? { ...b, days: b.days.map((d, d2) => d2 === di ? { ...d, title } : d) } : b));

  const addSlots = (bi: number, di: number, exercises: string[]) => {
    setBlocks(list => list.map((b, i) => i === bi
      ? { ...b, days: b.days.map((d, d2) => d2 === di
        ? { ...d, slots: [...d.slots, ...exercises.map(emptySlot)] } : d) }
      : b));
    setPickFor(null);
  };
  const removeSlot = (bi: number, di: number, si: number) => setBlocks(list => list.map((b, i) => i === bi
    ? { ...b, days: b.days.map((d, d2) => d2 === di
      ? { ...d, slots: d.slots.filter((_, s) => s !== si) } : d) }
    : b));
  const moveSlot = (bi: number, di: number, si: number, dir: -1 | 1) => {
    const day = getDay(bi, di);
    if (!day || si + dir < 0 || si + dir >= day.slots.length) return;
    setBlocks(list => list.map((b, i) => i === bi
      ? { ...b, days: b.days.map((d, d2) => d2 === di
        ? { ...d, slots: moveArrayItem(d.slots, si, si + dir) } : d) }
      : b));
  };

  function moveArrayItem<T>(arr: T[], from: number, to: number): T[] {
    const res = [...arr];
    const item = res[from];
    res.splice(from, 1);
    res.splice(to, 0, item);
    return res;
  }

  const openSlotEdit = (bi: number, di: number, si: number) => {
    const s = getSlot(bi, di, si);
    if (!s) return;
    setSlotEdit({
      bi, di, si,
      sets: String(s.sets), reps: s.reps, rest: s.rest, restEx: s.restEx,
      weight: s.startWeight > 0 ? trimNum(s.startWeight) : '',
      workSec: s.workSec > 0 ? String(s.workSec) : String(DEFAULT_WORK_SEC),
      workOn: s.workSec > 0,
    });
  };

  const applySlotEdit = () => {
    if (!slotEdit) return;
    const { bi, di, si, sets, reps, rest, restEx, weight, workSec, workOn } = slotEdit;
    setBlocks(list => list.map((b, i) => i === bi
      ? { ...b, days: b.days.map((d, d2) => d2 === di
        ? { ...d, slots: d.slots.map((s2, s3) => s3 === si
          ? { ...s2, sets: Math.max(MIN_SETS, Math.min(MAX_SETS, parseInt10(sets))), reps, rest, restEx,
            startWeight: parseNum(weight) || 0,
            workSec: workOn ? Math.max(1, Math.min(600, parseInt10(workSec))) : 0 }
          : s2) } : d) } : b));
    setSlotEdit(null);
  };

  const save = () => {
    const trimmed = name.trim() || 'Своя сборка';
    const pGoal = normalizeGoal(profile?.goal || GOALS.MASS);
    const pLevel = profile?.level || 'intermediate';

    let weekCursor = 1;
    const phases: Program['phases'] = blocks.map(b => {
      const sets = defaultSets(b.goal);
      const reps = defaultReps(b.goal);
      const rest = defaultRest(b.goal);
      const phase: Program['phases'][number] = {
        deload: false,
        weekStart: weekCursor,
        weekEnd: weekCursor + b.weeks - 1,
        label: periodized ? (GOAL_LABELS_RU[b.goal] || 'Масса') : 'Курс',
        scheme: `${sets} подхода × ${reps} повторений · отдых ${rest}`,
        days: b.days.map(d => ({
          title: d.title,
          slots: d.slots.map(s => ({
            exercise: s.exercise, group: '', reps: s.reps || reps,
            rest: s.rest || rest, restEx: s.restEx,
            sets: s.sets > 0 ? s.sets : sets,
            startWeight: s.startWeight, workSec: s.workSec > 0 ? s.workSec : 0,
          })),
        })),
      };
      weekCursor = phase.weekEnd + 1;
      return phase;
    });

    const totalWeeks = blocks.reduce((s, b) => s + b.weeks, 0);
    const maxDays = Math.max(1, ...blocks.map(b => b.days.length));

    const program: Program = {
      id: crypto.randomUUID(), name: trimmed, goal: pGoal, level: pLevel,
      daysPerWeek: maxDays, weeks: Math.max(1, totalWeeks), createdAt: Date.now(), phases,
    };
    add(program);
    showToast('Комплекс сохранён в перечень тренировок');
    navigate('/programs/mine');
  };

  // ---------- строки ----------

  const exerciseLine = (n: number, s: SlotDraft) => {
    const weightPart = s.startWeight > 0 ? ` · старт ${trimNum(s.startWeight)} кг` : '';
    const workPart = s.workSec > 0 ? ` · ${s.workSec} с` : '';
    return `${n}. ${s.exercise} — ${s.sets > 0 ? s.sets : 3}×${s.reps || '8–12'} · отдых ${s.rest || '60–90 сек'}${weightPart}${workPart}`;
  };

  const renderSlotRow = (bi: number, di: number, si: number, s: SlotDraft) => {
    const day = getDay(bi, di);
    return (
      <div key={si} className="flex items-center gap-1 py-1 pl-2 pr-1">
        <MiniBtn disabled={si === 0} onClick={() => moveSlot(bi, di, si, -1)}>▲</MiniBtn>
        <button type="button" onClick={() => openSlotEdit(bi, di, si)}
          className="flex-1 min-w-0 text-left text-[13px] px-1 py-1"
          style={{ color: 'var(--color-text-main)' }}>
          {exerciseLine(si + 1, s)}
        </button>
        <MiniBtn disabled={si === (day?.slots.length || 1) - 1} onClick={() => moveSlot(bi, di, si, 1)}>▼</MiniBtn>
        <MiniBtn size={28} radius={14} fontSize={14}
          onClick={() => { setConfirmKind('slot'); setConfirmIdx({ bi, di, si }); }}>−</MiniBtn>
      </div>
    );
  };

  const renderDay = (bi: number, di: number, d: DayDraft) => (
    <div key={di} className="px-3 py-2.5">
      <div className="p-3" style={CARD}>
        <button type="button" onClick={() => { setRenameFor({ bi, di }); setRenameTitle(d.title); }}
          className="block w-full text-left text-[14px] font-bold"
          style={{ color: 'var(--color-text-main)' }}>
          {d.title}
        </button>
        {d.slots.map((s, si) => renderSlotRow(bi, di, si, s))}
        <AddButton onClick={() => setPickFor({ bi, di })}>+ Упражнение</AddButton>
        <MiniBtn size={28} radius={14} fontSize={14}
          onClick={() => { setConfirmKind('day'); setConfirmIdx({ bi, di }); }}>−</MiniBtn>
      </div>
    </div>
  );

  const renderBlock = (bi: number, b: BlockDraft) => (
    <div key={bi} className="my-2 p-3" style={CARD}>
      <button type="button"
        onClick={() => periodized ? setGoalFor(bi) : setWeeksFor(bi)}
        className="block w-full text-left text-[15px] font-bold"
        style={{ color: 'var(--color-text-main)' }}>
        {periodized
          ? `Блок ${bi + 1} · ${GOAL_LABELS_RU[b.goal] || 'Масса'} · ${b.weeks} нед.`
          : 'Курс'}
      </button>
      <button type="button" onClick={() => setWeeksFor(bi)}
        className="block text-left text-[13px] py-0.5"
        style={{ color: 'var(--color-text-secondary)' }}>
        Недель: {b.weeks}
      </button>
      {periodized && (
        <MiniBtn size={28} radius={14} fontSize={14}
          onClick={() => { setConfirmKind('block'); setConfirmIdx({ bi }); }}>−</MiniBtn>
      )}
      {b.days.map((d, di) => renderDay(bi, di, d))}
      <AddButton onClick={() => addDay(bi)}>+ День</AddButton>
    </div>
  );

  // ---------- диалоги ----------

  const slotDialog = () => {
    if (!slotEdit) return null;
    const { bi, di, si, sets, reps, rest, restEx, weight, workSec, workOn } = slotEdit;
    const set = (patch: Partial<SlotEdit>) => setSlotEdit(s => s ? { ...s, ...patch } : null);
    return (
      <Dialog title={getSlot(bi, di, si)?.exercise || 'Упражнение'} onClose={() => setSlotEdit(null)}
        actions={
          <>
            <DialogAction onClick={() => setSlotEdit(null)}>Отмена</DialogAction>
            <DialogAction strong onClick={applySlotEdit}>ОК</DialogAction>
          </>
        }>
        <div className="pt-1">
          <div className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>Подходы</div>
          <input value={sets} onChange={e => set({ sets: e.target.value })} inputMode="numeric"
            className="fg-input mt-1" />
        </div>

        <OptionRow label="Повторы" value={reps}
          onClick={() => setOptionPick({ field: 'reps', options: REPS_OPTIONS, value: reps })} />
        <OptionRow label="Отдых между подходами" value={rest}
          onClick={() => setOptionPick({ field: 'rest', options: REST_OPTIONS, value: rest })} />
        <OptionRow label="Отдых между упражнениями" value={restEx || '—'}
          onClick={() => setOptionPick({ field: 'restEx', options: REST_OPTIONS, value: restEx })} />

        <div className="mt-3 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>Стартовый вес, кг</div>
        <input value={weight} onChange={e => set({ weight: e.target.value })} inputMode="decimal"
          placeholder="Не задан" className="fg-input mt-1" />

        <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
          <input type="checkbox" checked={workOn} onChange={() => set({ workOn: !workOn })}
            className="w-4 h-4" style={{ accentColor: 'var(--p-circle)' }} />
          <span className="text-[13px]" style={{ color: 'var(--color-text-main)' }}>Считать время подхода</span>
        </label>

        {workOn && (
          <div className="mt-2">
            <div className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>Секунд на подход</div>
            <input value={workSec} onChange={e => set({ workSec: e.target.value })} inputMode="numeric"
              className="fg-input mt-1" />
          </div>
        )}
      </Dialog>
    );
  };

  const optionDialog = () => {
    if (!optionPick) return null;
    return (
      <Dialog title="" onClose={() => setOptionPick(null)}>
        <div className="py-1">
          {optionPick.options.map(o => (
            <button key={o} type="button"
              onClick={() => {
                const p = optionPick;
                setSlotEdit(s => {
                  if (!s) return s;
                  return p.field === 'reps' ? { ...s, reps: o }
                    : p.field === 'rest' ? { ...s, rest: o } : { ...s, restEx: o };
                });
                setOptionPick(null);
              }}
              className="block w-full text-left px-2 py-3 text-[15px] rounded-lg active:bg-white/10"
              style={{ color: o === optionPick.value ? 'var(--p-on-labels)' : 'var(--p-on-labels-soft)' }}>
              {o}
            </button>
          ))}
        </div>
      </Dialog>
    );
  };

  const goalDialog = () => {
    if (goalFor === null) return null;
    return (
      <Dialog title="Цель блока" onClose={() => setGoalFor(null)}>
        <div className="py-1">
          {GOAL_ORDER.map(g => (
            <button key={g} type="button"
              onClick={() => { setBlockGoal(goalFor, g); setGoalFor(null); }}
              className="block w-full text-left px-2 py-3 text-[15px] rounded-lg active:bg-white/10"
              style={{ color: 'var(--p-on-labels)' }}>
              {GOAL_LABELS_RU[g]}
            </button>
          ))}
        </div>
      </Dialog>
    );
  };

  const weeksDialog = () => {
    if (weeksFor === null) return null;
    const b = getBlock(weeksFor);
    if (!b) return null;
    return (
      <Dialog title={`Недель: ${b.weeks}`} onClose={() => setWeeksFor(null)}
        actions={
          <>
            <DialogAction onClick={() => setWeeksFor(null)}>Отмена</DialogAction>
            <DialogAction strong onClick={() => setWeeksFor(null)}>ОК</DialogAction>
          </>
        }>
        <div className="flex items-center justify-center gap-4 py-4">
          <button type="button" onClick={() => setBlockWeeks(weeksFor, b.weeks - 1)}
            className="w-12 h-12 rounded-[14px] text-[18px] font-bold active:opacity-80"
            style={{ background: 'var(--p-circle)', color: 'var(--p-on-circle)' }}>−</button>
          <span className="min-w-[48px] text-center text-[18px]" style={{ color: 'var(--p-on-labels)' }}>
            {b.weeks}
          </span>
          <button type="button" onClick={() => setBlockWeeks(weeksFor, b.weeks + 1)}
            className="w-12 h-12 rounded-[14px] text-[18px] font-bold active:opacity-80"
            style={{ background: 'var(--p-circle)', color: 'var(--p-on-circle)' }}>+</button>
        </div>
      </Dialog>
    );
  };

  const confirmDialog = () => {
    if (!confirmKind || !confirmIdx) return null;
    const { bi } = confirmIdx;
    const title = confirmKind === 'block' ? 'Удалить блок?'
      : confirmKind === 'day' ? 'Удалить день?'
      : 'Удалить упражнение?';
    const body = confirmKind === 'block'
      ? `Блок «${GOAL_LABELS_RU[getBlock(bi)?.goal] || 'Масса'} · ${getBlock(bi)?.weeks} нед.» будет удалён.`
      : confirmKind === 'day' ? `День «${getDay(bi, confirmIdx.di ?? 0)?.title}» будет удалён вместе с упражнениями.`
      : `Упражнение «${getSlot(bi, confirmIdx.di!, confirmIdx.si!)?.exercise}» будет удалено из дня.`;
    return (
      <ConfirmDialog title={title} message={body}
        onConfirm={() => {
          if (confirmKind === 'block') removeBlock(bi);
          else if (confirmKind === 'day') removeDay(bi, confirmIdx.di!);
          else if (confirmKind === 'slot') removeSlot(bi, confirmIdx.di!, confirmIdx.si!);
          setConfirmKind(null); setConfirmIdx(null);
        }}
        onClose={() => { setConfirmKind(null); setConfirmIdx(null); }} />
    );
  };

  const dayRenameDialog = () => {
    if (!renameFor) return null;
    const { bi, di } = renameFor;
    return (
      <Dialog title="Название дня" onClose={() => setRenameFor(null)}
        actions={
          <>
            <DialogAction onClick={() => setRenameFor(null)}>Отмена</DialogAction>
            <DialogAction strong onClick={() => {
              const t = renameTitle.trim();
              if (t) renameDay(bi, di, t);
              setRenameFor(null);
            }}>ОК</DialogAction>
          </>
        }>
        <input value={renameTitle} onChange={e => setRenameTitle(e.target.value)}
          placeholder="Название дня" className="fg-input" />
      </Dialog>
    );
  };

  return (
    <div className="max-w-2xl mx-auto pb-4 w-full max-w-full">
      <PageHeader title="Конструктор программы" subtitle="Курсы → дни → упражнения"
        onBack={() => navigate('/programs')} />

      <div className="px-4">
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="Название программы" className="fg-input" />

        <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
          <input type="checkbox" checked={periodized} onChange={() => setPeriodized(!periodized)}
            className="w-4 h-4" style={{ accentColor: 'var(--p-circle)' }} />
          <span className="text-[14px]" style={{ color: 'var(--color-text-main)' }}>Периодизация</span>
        </label>

        <div className="mt-1">
          {blocks.map((b, bi) => renderBlock(bi, b))}
          {!periodized && (
            <div className="my-2 p-3" style={CARD}>
              <AddButton onClick={addBlock}>+ Блок</AddButton>
            </div>
          )}
        </div>

        <button type="button" onClick={save}
          className="mt-2 w-full h-[52px] rounded-[26px] text-[16px] font-bold uppercase tracking-[0.089em] active:opacity-80"
          style={BTN}>
          Сохранить в перечень
        </button>
      </div>

      {slotDialog()}
      {optionDialog()}
      {goalDialog()}
      {weeksDialog()}
      {dayRenameDialog()}
      {confirmDialog()}

      {pickFor && (
        <ExercisePickerScreen title="Выберите упражнения"
          subtitle="Отметьте упражнения и нажмите «Добавить»"
          onPick={names => addSlots(pickFor.bi, pickFor.di, names)}
          onClose={() => setPickFor(null)} />
      )}

      <Toast text={toast} />
    </div>
  );
}

function OptionRow({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <div className="flex items-center gap-2 mt-2">
      <span className="flex-1 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <button type="button" onClick={onClick}
        className="min-h-[36px] px-3 rounded-[14px] text-[12px] font-bold active:opacity-80"
        style={{ background: 'var(--p-circle)', color: 'var(--p-on-circle)' }}>
        {value || '—'}
      </button>
    </div>
  );
}
