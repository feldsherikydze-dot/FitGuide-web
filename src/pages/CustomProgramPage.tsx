// «Своя сборка» — полный порт CustomProgramActivity (режим редактора).
// Курсы → дни → упражнения: имя, галочка «Периодизация», блоки (с периодизацией —
// несколько блоков с целью и неделями; без — один курс), дни, упражнения с настройками
// подходов/повторов/отдыха/времени подхода, сохранение в перечень тренировок.

import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type React from 'react';
import { useProfileStore, useProgramsStore } from '../core/store';
import { GOALS, GOAL_LABELS, normalizeGoal } from '../core/goals';
import type { Program } from '../data/types';
import {
  Card, Dialog, DialogAction, ExercisePicker, Field, Hint, PrimaryButton,
  ConfirmDialog, Toast, trimNum, parseInt10, parseNum,
} from './progress/common';
import { MaskIcon, asset, PageHeader } from '../components/ui';

const REPS_OPTIONS = ['3–5', '5–8', '8–10', '10–12', '12–15', '15–20', '20–25'];
const REST_OPTIONS = ['45–60 сек', '60–90 сек', '90–120 сек', '2–3 мин'];
const DEFAULT_WORK_SEC = 40;
const MIN_SETS = 1;
const MAX_SETS = 6;
const MIN_WEEKS = 1;
const MAX_WEEKS = 12;

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

function goalLabelRu(code: string): string {
  const m: Record<string, string> = {
    [GOALS.MASS]: 'Масса', [GOALS.LOSE]: 'Похудение', [GOALS.STRENGTH]: 'Сила',
    [GOALS.CUT]: 'Рельеф', [GOALS.RECOMP]: 'Рекомпозиция', [GOALS.ENDURANCE]: 'Выносливость',
  };
  return m[code] || 'Масса';
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

function emptySlot(): SlotDraft {
  return { exercise: '', reps: '8–12', rest: '60–90 сек', restEx: '2–3 мин', sets: 3, startWeight: 0, workSec: 0 };
}

function emptyDay(title: string): DayDraft {
  return { title, slots: [] };
}

function emptyBlock(): BlockDraft {
  return { goal: GOALS.MASS, weeks: 4, days: [emptyDay('Тренировка 1')] };
}

interface SlotEdit {
  bi: number; di: number; si: number;
  sets: string; reps: string; rest: string; restEx: string;
  weight: string; workSec: string; workOn: boolean;
}

export function CustomProgramPage() {
  const navigate = useNavigate();
  const { add } = useProgramsStore();
  const { profile } = useProfileStore();
  const [name, setName] = useState(profile?.name ? `${profile.name} — программа` : '');
  const [periodized, setPeriodized] = useState(false);
  const [blocks, setBlocks] = useState<BlockDraft[]>([emptyBlock()]);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmKind, setConfirmKind] = useState<'block' | 'day' | 'slot' | null>(null);
  const [confirmIdx, setConfirmIdx] = useState<{ bi: number; di?: number; si?: number } | null>(null);
  const [pickFor, setPickFor] = useState<{ bi: number; di: number } | null>(null);
  const [slotEdit, setSlotEdit] = useState<SlotEdit | null>(null);
  const [renameFor, setRenameFor] = useState<{ bi: number; di: number } | null>(null);
  const [renameTitle, setRenameTitle] = useState('');

  const showToast = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 2500);
  };

  const getBlock = (bi: number) => blocks[bi];
  const getDay = (bi: number, di: number) => blocks[bi]?.days[di];
  const getSlot = (bi: number, di: number, si: number) => blocks[bi]?.days[di]?.slots[si];

  const setBlocksMapped = (fn: (list: BlockDraft[]) => BlockDraft[]) => {
    setBlocks(fn);
  };

  const addBlock = () => setBlocksMapped(list => [...list, emptyBlock()]);
  const removeBlock = (bi: number) => setBlocksMapped(list => {
    const next = list.filter((_, i) => i !== bi);
    return next.length ? next : [emptyBlock()];
  });
  const setBlockGoal = (bi: number, goal: string) => setBlocksMapped(list =>
    list.map((b, i) => i === bi ? { ...b, goal } : b));
  const setBlockWeeks = (bi: number, weeks: number) => {
    const v = Math.max(MIN_WEEKS, Math.min(MAX_WEEKS, weeks));
    setBlocksMapped(list => list.map((b, i) => i === bi ? { ...b, weeks: v } : b));
  };

  const addDay = (bi: number) => {
    const n = blocks.reduce((s, b) => s + b.days.length, 0) + 1;
    setBlocksMapped(list => list.map((b, i) => i === bi
      ? { ...b, days: [...b.days, emptyDay(`Тренировка ${n}`)] } : b));
  };
  const removeDay = (bi: number, di: number) => setBlocksMapped(list => list.map((b, i) => i === bi
    ? { ...b, days: b.days.filter((_, d) => d !== di) } : b));
  const renameDay = (bi: number, di: number, title: string) => setBlocksMapped(list => list.map((b, i) => i === bi
    ? { ...b, days: b.days.map((d, d2) => d2 === di ? { ...d, title } : d) } : b));

  const addSlot = (bi: number, di: number, exercise: string) => {
    setBlocksMapped(list => list.map((b, i) => i === bi
      ? { ...b, days: b.days.map((d, d2) => d2 === di
        ? { ...d, slots: [...d.slots, { ...emptySlot(), exercise }] } : d) }
      : b));
    setPickFor(null);
  };
  const removeSlot = (bi: number, di: number, si: number) => setBlocksMapped(list => list.map((b, i) => i === bi
    ? { ...b, days: b.days.map((d, d2) => d2 === di
      ? { ...d, slots: d.slots.filter((_, s) => s !== si) } : d) }
    : b));
  const moveSlot = (bi: number, di: number, si: number, dir: -1 | 1) => {
    const day = getDay(bi, di);
    if (!day || si + dir < 0 || si + dir >= day.slots.length) return;
    setBlocksMapped(list => list.map((b, i) => i === bi
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
    setBlocksMapped(list => list.map((b, i) => i === bi
      ? { ...b, days: b.days.map((d, d2) => d2 === di
        ? { ...d, slots: d.slots.map((s2, s3) => s3 === si
          ? { ...s2, sets: Math.max(MIN_SETS, Math.min(MAX_SETS, parseInt10(sets))), reps, rest, restEx,
            startWeight: parseNum(weight) || 0,
            workSec: workOn ? Math.max(1, Math.min(600, parseInt10(workSec))) : 0 }
          : s2) } : d) } : b));
    setSlotEdit(null);
  };

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const pGoal = normalizeGoal(profile?.goal || GOALS.MASS);
    const pLevel = profile?.level || 'intermediate';

    const phases: Program['phases'] = blocks.map(b => {
      const weekStart = blocks.indexOf(b) * 0 + 1; // placeholder, replaced below
      return { deload: false, weekStart: 1, weekEnd: b.weeks, label: 'Курс',
        scheme: `${defaultSets(b.goal)} × ${defaultReps(b.goal)} · отдых ${defaultRest(b.goal)}`,
        days: b.days.map(d => ({
          title: d.title,
          slots: d.slots.map(s => ({
            exercise: s.exercise, group: '', reps: s.reps || defaultReps(b.goal),
            rest: s.rest || defaultRest(b.goal), restEx: s.restEx,
            sets: s.sets > 0 ? s.sets : defaultSets(b.goal),
            startWeight: s.startWeight, workSec: s.workSec > 0 ? s.workSec : 0,
          })),
        })),
      };
    });

    // неделями сквозно по всем блокам
    let wc = 1;
    for (const ph of phases) { ph.weekStart = wc; ph.weekEnd = wc + (ph.weekEnd - ph.weekStart); wc = ph.weekEnd + 1; }

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

  const hasExercises = blocks.some(b => b.days.some(d => d.slots.length > 0));

  // ---------- UI ----------
  const btnUpDown = (disabled: boolean, ch: string, onClick: () => void) => (
    <button onClick={onClick} disabled={disabled}
      className="w-6 h-6 flex items-center justify-center rounded-[6px] text-[10px] font-bold"
      style={{ border: '1px solid var(--color-stroke)', color: disabled ? 'var(--color-text-secondary)' : 'var(--color-text-main)', background: 'var(--color-surface)', opacity: disabled ? 0.35 : 1 }}>
      {ch}
    </button>
  );

  const chipToggle = (value: string, options: string[], onChange: (v: string) => void) => {
    const idx = options.indexOf(value);
    const next = options[(idx + 1) % options.length];
    return (
      <button onClick={() => onChange(next)}
        className="h-9 px-3 rounded-[14px] text-[12px] font-medium"
        style={{ border: '1px solid var(--color-stroke)', background: 'var(--color-surface-variant)', color: 'var(--color-text-main)' }}>
        {value}
      </button>
    );
  };

  const renderSlotRow = (bi: number, di: number, si: number, s: SlotDraft) => {
    const restTail = s.restEx ? ` · отд. упр. ${s.restEx}` : '';
    const workTail = s.workSec > 0 ? ` · ${s.workSec} с` : '';
    return (
      <div key={si} className="flex items-center gap-2 pt-1 pb-1">
        {btnUpDown(si === 0, '▲', () => moveSlot(bi, di, si, -1))}
        {btnUpDown(si === (getDay(bi, di)?.slots.length || 1) - 1, '▼', () => moveSlot(bi, di, si, 1))}
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-bold truncate" style={{ color: 'var(--color-text-main)' }}>{s.exercise || 'Упражнение'}</div>
          <div className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
            {s.sets} × {s.reps} · отдых {s.rest}{restTail}{workTail}
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => openSlotEdit(bi, di, si)}
            className="w-8 h-8 flex items-center justify-center rounded-full active:bg-black/5"
            style={{ border: '1px solid var(--color-stroke)', color: 'var(--color-text-main)' }}
            title="Настройки">
            <MaskIcon src={asset('icons/ic_settings.svg')} color="var(--color-text-main)" size={16} />
          </button>
          <button onClick={() => { setConfirmKind('slot'); setConfirmIdx({ bi, di, si }); }}
            className="w-8 h-8 flex items-center justify-center rounded-full active:bg-black/5"
            style={{ border: '1px solid var(--color-warning)', color: 'var(--color-warning)' }}
            title="Удалить">
            <MaskIcon src={asset('icons/ic_delete.svg')} color="var(--color-warning)" size={16} />
          </button>
        </div>
      </div>
    );
  };

  const renderDay = (bi: number, di: number, d: DayDraft) => (
    <div key={di} className="mb-2">
      <div className="rounded-[16px] p-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-stroke)' }}>
        <div className="flex items-center gap-2 mb-2">
          <input value={d.title} onChange={e => renameDay(bi, di, e.target.value)}
            className="bg-transparent text-[14px] font-bold outline-none w-full"
            style={{ color: 'var(--color-text-main)' }} />
          <button onClick={() => { setRenameFor({ bi, di }); setRenameTitle(d.title); }}
            className="w-8 h-8 flex items-center justify-center rounded-full active:bg-black/5"
            style={{ border: '1px solid var(--color-warning)', color: 'var(--color-warning)' }}
            title="Удалить день">
            <MaskIcon src={asset('icons/ic_delete.svg')} color="var(--color-warning)" size={16} />
          </button>
        </div>
        <div className="space-y-1">
          {d.slots.map((s, si) => renderSlotRow(bi, di, si, s))}
          {d.slots.length === 0 && (
            <div className="text-[12px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              Упражнений нет — нажмите «+ Упражнение».
            </div>
          )}
        </div>
        <button onClick={() => setPickFor({ bi, di })}
          className="w-full h-9 mt-1.5 rounded-[20px] text-[12px] font-semibold"
          style={{ border: '1px solid var(--color-outline)', color: 'var(--p-labels)', background: 'var(--color-surface-variant)' }}>
          + Упражнение
        </button>
      </div>
    </div>
  );

  const renderBlock = (bi: number, b: BlockDraft) => (
    <div key={bi} className="mb-2.5">
      <div className="rounded-[16px] p-3 mb-2" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-stroke)' }}>
        <div className="flex items-center gap-2 mb-2">
          <div className="text-[15px] font-bold" style={{ color: 'var(--color-text-main)' }}>
            {periodized ? `Блок ${bi + 1} · ${goalLabelRu(b.goal)} · ${b.weeks} нед.` : 'Курс'}
          </div>
          {periodized && (
            <button onClick={() => setBlockGoal(bi, b.goal === GOALS.MASS ? GOALS.STRENGTH : GOALS.MASS)}
              className="flex-1 text-[12px] text-center rounded-[16px] px-2 py-1"
              style={{ border: '1px solid var(--p-labels)', color: 'var(--p-labels)', background: 'transparent' }}>
              сменить цель
            </button>
          )}
          <button onClick={() => { setConfirmKind('block'); setConfirmIdx({ bi }); }}
            className="w-8 h-8 flex items-center justify-center rounded-full active:bg-black/5"
            style={{ border: '1px solid var(--color-warning)', color: 'var(--color-warning)' }}
            title="Удалить блок">
            <MaskIcon src={asset('icons/ic_delete.svg')} color="var(--color-warning)" size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>Недель:</span>
          <input type="number" min={MIN_WEEKS} max={MAX_WEEKS} value={b.weeks}
            onChange={e => setBlockWeeks(bi, parseInt10(e.target.value))}
            className="w-12 h-8 text-center text-[12px] rounded-[6px] outline-none"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-stroke)', color: 'var(--color-text-main)' }} />
        </div>
        <div className="space-y-1">
          {b.days.map((d, di) => renderDay(bi, di, d))}
        </div>
        <button onClick={() => addDay(bi)}
          className="w-full h-9 mt-1.5 rounded-[20px] text-[12px] font-semibold"
          style={{ border: '1px solid var(--color-outline)', color: 'var(--p-labels)', background: 'var(--color-surface-variant)' }}>
          + День
        </button>
        {!periodized && (
          <button onClick={addBlock}
            className="w-full h-9 mt-1 rounded-[20px] text-[12px] font-semibold"
            style={{ border: '1px solid var(--color-outline)', color: 'var(--p-labels)', background: 'var(--color-surface-variant)' }}>
            + Блок
          </button>
        )}
      </div>
    </div>
  );

  const slotDialog = () => {
    if (!slotEdit) return null;
    const { bi, di, si, sets, reps, rest, restEx, weight, workSec, workOn } = slotEdit;
    return (
      <Dialog title={getSlot(bi, di, si)?.exercise || 'Упражнение'} onClose={() => setSlotEdit(null)}
        actions={
          <>
            <DialogAction onClick={() => setSlotEdit(null)}>Отмена</DialogAction>
            <DialogAction strong onClick={applySlotEdit}>ОК</DialogAction>
          </>
        }>
        <div className="space-y-3 pt-1">
          <div>
            <div className="text-[12px] mb-1" style={{ color: 'var(--color-text-secondary)' }}>Подходы</div>
            <Field value={sets} onChange={v => setSlotEdit(s => s ? { ...s, sets: v } : null)}
              placeholder="3" inputMode="numeric" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>Повторы</span>
            {chipToggle(reps, REPS_OPTIONS, v => setSlotEdit(s => s ? { ...s, reps: v } : null))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>Отдых между подходами</span>
            {chipToggle(rest, REST_OPTIONS, v => setSlotEdit(s => s ? { ...s, rest: v } : null))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>Отдых между упражнениями</span>
            {chipToggle(restEx, REST_OPTIONS, v => setSlotEdit(s => s ? { ...s, restEx: v } : null))}
          </div>
          <div>
            <div className="text-[12px] mb-1" style={{ color: 'var(--color-text-secondary)' }}>Стартовый вес, кг</div>
            <Field value={weight} onChange={v => setSlotEdit(s => s ? { ...s, weight: v } : null)}
              placeholder="Не задан" inputMode="decimal" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={workOn}
              onChange={() => setSlotEdit(s => s ? { ...s, workOn: !s.workOn } : null)}
              className="w-4 h-4 rounded" style={{ accentColor: 'var(--p-labels)' }} />
            <span className="text-[13px] font-medium" style={{ color: 'var(--color-text-main)' }}>Считать время подхода</span>
          </div>
          {workOn && (
            <div>
              <div className="text-[12px] mb-1 mt-1" style={{ color: 'var(--color-text-secondary)' }}>Секунд на подход</div>
              <Field value={workSec} onChange={v => setSlotEdit(s => s ? { ...s, workSec: v } : null)}
                placeholder="40" inputMode="numeric" />
            </div>
          )}
        </div>
      </Dialog>
    );
  };

  const confirmDialog = () => {
    if (!confirmKind || !confirmIdx) return null;
    const { bi } = confirmIdx;
    const title = confirmKind === 'block' ? 'Удалить блок?'
      : confirmKind === 'day' ? `Удалить день «${getDay(bi, confirmIdx.di ?? 0)?.title}»?`
      : `Удалить упражнение «${getSlot(bi, confirmIdx.di!, confirmIdx.si!)?.exercise}»?`;
    const body = confirmKind === 'block' ? 'Блок будет удалён.'
      : confirmKind === 'day' ? 'День будет удалён вместе с упражнениями.'
      : 'Упражнение будет удалено из дня.';
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
            <DialogAction strong onClick={() => { renameDay(bi, di, renameTitle); setRenameFor(null); }}>ОК</DialogAction>
          </>
        }>
        <Field value={renameTitle} onChange={setRenameTitle} placeholder="Название дня" />
      </Dialog>
    );
  };

  return (
    <div className="max-w-2xl mx-auto pb-4 w-full max-w-full">
      <PageHeader title="Конструктор программы" onBack={() => navigate('/programs')} />
      <div className="-mt-1 mb-2 ml-4 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
        Курсы → дни → упражнения
      </div>

      <div className="px-4 space-y-3">
        <Field value={name} onChange={setName} placeholder="Название программы" />

        <div className="flex items-center gap-2 mt-1">
          <input type="checkbox" checked={periodized}
            onChange={() => setPeriodized(!periodized)}
            className="w-4 h-4 rounded" style={{ accentColor: 'var(--p-labels)' }} />
          <label className="text-[14px] font-medium cursor-pointer select-none"
            onClick={() => setPeriodized(!periodized)} style={{ color: 'var(--color-text-main)' }}>
            Периодизация
          </label>
          <span className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
            (курсы: сила → масса → рельеф)
          </span>
        </div>

        <div className="mt-1 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
          {periodized ? 'Каждый блок — свой курс с целью и количеством недель.'
            : 'Один курс без разбивки на периодизацию.'}
        </div>

        <div className="mt-2 space-y-1">
          {blocks.map((b, bi) => renderBlock(bi, b))}
          {periodized && (
            <button onClick={addBlock}
              className="w-full h-9 mt-1 rounded-[20px] text-[12px] font-semibold"
              style={{ border: '1px solid var(--color-outline)', color: 'var(--p-labels)', background: 'var(--color-surface-variant)' }}>
              + Блок
            </button>
          )}
        </div>

        <PrimaryButton className="w-full h-[52px] mt-3 rounded-[26px] text-[16px] font-bold disabled:opacity-50"
          onClick={save} disabled={!hasExercises}>
          Сохранить в перечень
        </PrimaryButton>
      </div>

      {slotDialog()}
      {dayRenameDialog()}
      {confirmDialog()}

      {pickFor && (
        <ExercisePicker title="Выберите упражнения"
          onPick={ex => addSlot(pickFor.bi, pickFor.di, ex)}
          onClose={() => setPickFor(null)} />
      )}

      <Toast text={toast} />
    </div>
  );
}
