// FitGuide Web — общие детали хаба «Мой прогресс».

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { useExercises } from '../../hooks/useExercises';
import { useCoachStore, useProfileStore } from '../../core/store';
import {
  buildExerciseIndex, exercisesOf, byGroupPrimary, secondaryForGroup,
  isPrimaryForGroup, levelRank, matchesType, filterByStyle,
} from '../../core/exerciseIndex';
import { isBasicExercise, isIsolationExercise } from '../../core/exercises';
import { conflictsWithLimits } from '../../core/coach';
import type { Exercise } from '../../data/types';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={clsx('rounded-[16px] p-4', className)}
      style={{ background: 'var(--p-labels)', border: '1px solid var(--p-outline)' }}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('text-[15px] font-bold', className)} style={{ color: 'var(--color-text-main)' }}>
      {children}
    </div>
  );
}

export function Hint({ children, className, style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <p className={clsx('text-[12px] leading-snug', className)} style={{ color: 'var(--color-text-secondary)', ...style }}>
      {children}
    </p>
  );
}

export function PrimaryButton({ children, onClick, disabled, className }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx('w-full h-12 rounded-[22px] text-[14px] font-bold uppercase disabled:opacity-50 active:opacity-90', className)}
      style={{
        background: 'var(--p-labels)',
        border: '1px solid var(--p-outline)',
        color: 'var(--p-labels-text)',
      }}
    >
      {children}
    </button>
  );
}

export function OutlineButton({ children, onClick, className }: {
  children: ReactNode; onClick?: () => void; className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx('w-full h-11 rounded-[22px] text-[14px] font-semibold active:opacity-80', className)}
      style={{ border: '1px solid var(--p-outline)', color: 'var(--p-labels-text)', background: 'transparent' }}
    >
      {children}
    </button>
  );
}

export function Field({ value, onChange, placeholder, inputMode = 'decimal', className, label, multiline, type }: {
  value: string; onChange: (v: string) => void; placeholder: string;
  inputMode?: 'decimal' | 'numeric' | 'text'; className?: string;
  label?: string; multiline?: boolean; type?: string;
}) {
  const inputClass = 'fg-field w-full px-4 rounded-[14px] text-[15px] outline-none';
  const style = {
    background: 'var(--p-labels)',
    border: '1px solid var(--p-outline)',
    color: 'var(--color-text-main)',
  } as const;
  return (
    <label className={clsx('block min-w-0', className)}>
      {label && (
        <span
          className="block text-[13px] font-bold mb-1.5"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {label}
        </span>
      )}
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className={clsx(inputClass, 'py-3 resize-none min-h-[64px]')}
          style={style}
        />
      ) : (
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          type={type || (inputMode === 'numeric' ? 'number' : inputMode === 'decimal' ? 'number' : 'text')}
          className={clsx(inputClass, 'h-[46px]')}
          style={style}
        />
      )}
    </label>
  );
}

/** Диалог как TintedAlertDialog: плашка (B) с обводкой (A), текст контрастный. */
export function Dialog({ title, children, onClose, actions }: {
  title?: string; children: ReactNode; onClose: () => void; actions?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[85vh] flex flex-col rounded-[20px] overflow-hidden"
        style={{ background: 'var(--p-labels)', border: '1px solid var(--p-outline)' }}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div className="px-5 pt-4 pb-1 text-[20px] font-medium" style={{ color: 'var(--p-on-labels)' }}>
            {title}
          </div>
        )}
        <div className="px-5 py-2 overflow-y-auto min-h-0">{children}</div>
        {actions && <div className="px-3 py-2 flex justify-end gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function DialogAction({ children, onClick, strong }: {
  children: ReactNode; onClick: () => void; strong?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx('px-4 py-2.5 rounded-full text-[14px] font-bold uppercase tracking-[0.089em] active:opacity-80', strong && 'font-bold')}
      style={{ background: 'var(--p-circle)', color: 'var(--p-on-circle)' }}
    >
      {children}
    </button>
  );
}

export function Toast({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 bottom-24 px-4 py-2 rounded-full text-[13px] font-medium text-white z-[60] max-w-[90vw] text-center"
      style={{ background: 'var(--p-labels)' }}
    >
      {text}
    </div>
  );
}

export function formatDate(ts: number, withTime = false): string {
  const d = new Date(ts);
  const date = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(d);
  if (!withTime) return date;
  const time = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(d);
  return `${date} · ${time}`;
}

export function formatFullDate(ts: number): string {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(ts)).replace(/\s*г\.$/, '');
}

export function trimNum(v: number): string {
  if (Math.abs(v - Math.round(v)) < 0.05) return String(Math.round(v));
  return v.toFixed(1);
}

export function parseNum(s: string): number {
  const v = parseFloat(s.trim().replace(',', '.'));
  return Number.isFinite(v) ? v : 0;
}

export function parseInt10(s: string): number {
  const v = parseInt(s.trim(), 10);
  return Number.isFinite(v) ? v : 0;
}

/**
 * Выбор упражнения: поиск + список — то же окно, что «Добавить упражнение».
 *
 * Режим замены отличается только содержимым: сверху секция «Альтернативы»
 * заменяемому, ниже — базовые и изолирующие упражнения его группы.
 */
export function ExercisePicker({ title, initialQuery = '', onPick, onClose, alternatives = [], pool, banName, onBan }: {
  title: string;
  initialQuery?: string;
  onPick: (name: string) => void;
  onClose: () => void;
  /** Имена лучших замен — верхняя секция экрана замены. */
  alternatives?: string[];
  /** Список упражнений группы; без него показываем всю базу (режим «Добавить»). */
  pool?: Exercise[];
  /** Экран замены из тренировки: «Не предлагать «…»». */
  banName?: string;
  onBan?: () => void;
}) {
  const { exercises } = useExercises();
  const [query, setQuery] = useState(initialQuery);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (name: string) => !q || name.toLowerCase().includes(q);
  }, [query]);

  const altNames = useMemo(
    () => alternatives.filter(matches).slice(0, 8),
    [alternatives, matches],
  );

  const rest = useMemo(() => {
    if (!pool) {
      const all = Array.from(new Set(exercises.map(e => e.name))).sort((a, b) => a.localeCompare(b, 'ru'));
      return all.filter(matches).slice(0, 300).map(name => ({ name, basic: false }));
    }
    const altSet = new Set(alternatives);
    return pool
      .filter(ex => matches(ex.name) && !altSet.has(ex.name))
      .map(ex => ({ name: ex.name, basic: isBasicExercise(ex) }));
  }, [pool, exercises, matches, alternatives]);

  const basic = rest.filter(r => r.basic);
  const isolation = rest.filter(r => !r.basic);

  const row = (name: string, key?: string) => (
    <button
      key={key || name}
      onClick={() => onPick(name)}
      className="block w-full text-left px-2 py-3 text-[15px] active:bg-black/5 rounded-lg"
      style={{ color: 'var(--color-text-main)' }}
    >
      {name}
    </button>
  );

  const header = (text: string) => (
    <div className="mt-3 mb-0.5 px-2 text-[12px] font-bold uppercase tracking-wide"
      style={{ color: 'var(--color-text-secondary)' }}>
      {text}
    </div>
  );

  return (
    <Dialog title={title} onClose={onClose} actions={<DialogAction onClick={onClose}>Отмена</DialogAction>}>
      <Field value={query} onChange={setQuery} placeholder="Поиск упражнения…" inputMode="text" />
      <div className="mt-1 -mx-2">
        {altNames.length > 0 && (
          <>
            {header('Альтернативы')}
            {altNames.map(n => row(n, 'alt:' + n))}
          </>
        )}
        {pool && basic.length > 0 && header('Базовые упражнения')}
        {basic.map(r => row(r.name))}
        {pool && isolation.length > 0 && header('Изолирующие упражнения')}
        {isolation.map(r => row(r.name))}
        {altNames.length === 0 && rest.length === 0 && (
          <Hint className="px-2 py-4">Ничего не найдено</Hint>
        )}
      </div>
      {banName && onBan && (
        <button
          onClick={onBan}
          className="w-full mt-3 px-3 py-2.5 rounded-xl border text-[13px]"
          style={{ borderColor: 'var(--p-outline)', color: 'var(--color-text-secondary)' }}
        >
          Не предлагать «{banName}»
        </button>
      )}
    </Dialog>
  );
}

/**
 * Замена упражнения — тот же пикер, что «Добавить» в Android: сверху
 * «Альтернативы» заменяемому (лучшие сначала, до 8), ниже — базовые и
 * изолирующие упражнения группы. Запрещённые тренером и конфликтующие с
 * ограничениями по здоровью не показываем.
 */
export function ReplaceExercisePicker({ title = 'Заменить упражнение', currentName, groupId, onPick, onClose, onBan }: {
  title?: string;
  currentName: string;
  groupId?: string;
  onPick: (name: string) => void;
  onClose: () => void;
  /** Только в тренировке: «Не предлагать «…»». */
  onBan?: () => void;
}) {
  const { exercises, muscleGroups } = useExercises();
  const { profile } = useProfileStore();
  const coach = useCoachStore();

  const index = useMemo(() => buildExerciseIndex(muscleGroups, exercises), [muscleGroups, exercises]);
  const level = profile?.level || '';
  const style = profile?.trainStyle || 'any';
  const restrictions = coach.restrictions || [];
  const banned = coach.banned || [];

  const current = useMemo(
    () => exercises.find(e => e.name === currentName) || null,
    [exercises, currentName],
  );
  const gid = groupId || current?.muscleGroup || '';

  // Альтернативы: та же группа, «лучшие сначала» — базовые, затем основная
  // группа, затем алфавит. Текущее, запрещённое и конфликтующее исключаем.
  const alternatives = useMemo(() => {
    if (!gid) return [] as Exercise[];
    const pool = exercisesOf(index, gid).filter(ex =>
      ex.id !== current?.id
      && ex.name !== currentName
      && !banned.includes(ex.name)
      && !conflictsWithLimits(ex.name, restrictions)
      && (!level || levelRank(ex.difficulty) <= levelRank(level)));
    const ordered = [...filterByStyle(pool, style)];
    ordered.sort((a, b) => {
      const ab = isBasicExercise(a) ? 1 : 0;
      const bb = isBasicExercise(b) ? 1 : 0;
      if (ab !== bb) return bb - ab;
      const ap = isPrimaryForGroup(a, gid) ? 1 : 0;
      const bp = isPrimaryForGroup(b, gid) ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return a.name.localeCompare(b.name, 'ru');
    });
    return ordered.slice(0, 8);
  }, [index, gid, current, currentName, style, level, restrictions, banned]);

  // Ниже — упражнения той же группы: базовые, изолирующие, затем пришедшие
  // по вторичным мышцам. Ровно как список группы в Android.
  const pool = useMemo(() => {
    if (!gid) return [] as Exercise[];
    const primary = byGroupPrimary(index, gid, level, '');
    const secondary = secondaryForGroup(index, gid, level, '');
    const ordered: Exercise[] = [];
    for (const ex of primary) if (isBasicExercise(ex)) ordered.push(ex);
    for (const ex of primary) if (!isBasicExercise(ex) && isIsolationExercise(ex)) ordered.push(ex);
    for (const ex of primary) if (!isBasicExercise(ex) && !isIsolationExercise(ex)) ordered.push(ex);
    ordered.push(...secondary);
    return filterByStyle(ordered, style).filter(ex =>
      ex.id !== current?.id
      && !banned.includes(ex.name)
      && !conflictsWithLimits(ex.name, restrictions));
  }, [index, gid, current, style, level, restrictions, banned]);

  return (
    <ExercisePicker
      title={title}
      alternatives={alternatives.map(e => e.name)}
      pool={pool}
      banName={onBan ? currentName : undefined}
      onBan={onBan}
      onPick={onPick}
      onClose={onClose}
    />
  );
}

/** Подтверждение удаления. */
export function ConfirmDialog({ title, message, onConfirm, onClose }: {
  title: string; message: string; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Dialog
      title={title}
      onClose={onClose}
      actions={
        <>
          <DialogAction onClick={onClose}>Отмена</DialogAction>
          <DialogAction strong onClick={() => { onConfirm(); onClose(); }}>ОК</DialogAction>
        </>
      }
    >
      <p className="text-[14px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{message}</p>
    </Dialog>
  );
}
