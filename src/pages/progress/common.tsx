// FitGuide Web — общие детали хаба «Мой прогресс».

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { useExercises } from '../../hooks/useExercises';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={clsx('rounded-[16px] p-4', className)}
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-outline)' }}
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
      className={clsx('w-full h-12 rounded-[24px] text-[14px] font-bold disabled:opacity-50 active:opacity-90', className)}
      style={{ background: 'var(--p-labels)', color: 'var(--p-on-labels)' }}
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
      style={{ border: '1px solid var(--p-labels)', color: 'var(--p-labels)', background: 'var(--color-surface-variant)' }}
    >
      {children}
    </button>
  );
}

export function Field({ value, onChange, placeholder, inputMode = 'decimal', className }: {
  value: string; onChange: (v: string) => void; placeholder: string;
  inputMode?: 'decimal' | 'numeric' | 'text'; className?: string;
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      className={clsx('w-full h-[46px] px-4 rounded-[10px] text-[15px] outline-none', className)}
      style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-outline)',
        color: 'var(--color-text-main)',
      }}
    />
  );
}

/** Диалог как TintedAlertDialog: затемнение, карточка по центру. */
export function Dialog({ title, children, onClose, actions }: {
  title?: string; children: ReactNode; onClose: () => void; actions?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[85vh] flex flex-col rounded-[20px] overflow-hidden"
        style={{ background: 'var(--color-surface)' }}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div className="px-5 pt-4 pb-1 text-[18px] font-bold" style={{ color: 'var(--color-text-main)' }}>
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
      className="px-4 py-2.5 rounded-full text-[14px] font-bold active:bg-black/5"
      style={{ color: strong ? 'var(--p-labels)' : 'var(--color-text-secondary)' }}
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
      style={{ background: 'rgba(0,0,0,0.85)' }}
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

/** Выбор упражнения: поиск + список, как AlertDialog со списком в Android. */
export function ExercisePicker({ title, initialQuery = '', onPick, onClose }: {
  title: string; initialQuery?: string; onPick: (name: string) => void; onClose: () => void;
}) {
  const { exercises } = useExercises();
  const [query, setQuery] = useState(initialQuery);
  const names = useMemo(() => {
    const all = Array.from(new Set(exercises.map(e => e.name))).sort((a, b) => a.localeCompare(b, 'ru'));
    const q = query.trim().toLowerCase();
    return (q ? all.filter(n => n.toLowerCase().includes(q)) : all).slice(0, 300);
  }, [exercises, query]);

  return (
    <Dialog title={title} onClose={onClose} actions={<DialogAction onClick={onClose}>Отмена</DialogAction>}>
      <Field value={query} onChange={setQuery} placeholder="Поиск упражнения…" inputMode="text" />
      <div className="mt-1 -mx-2">
        {names.map(n => (
          <button
            key={n}
            onClick={() => onPick(n)}
            className="block w-full text-left px-2 py-3 text-[15px] active:bg-black/5 rounded-lg"
            style={{ color: 'var(--color-text-main)' }}
          >
            {n}
          </button>
        ))}
        {names.length === 0 && <Hint className="px-2 py-4">Ничего не найдено</Hint>}
      </div>
    </Dialog>
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
