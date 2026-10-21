// FitGuide Web — дневник и замеры тела (порт DiaryFragment + JournalFragment + BodyLogStore)

import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { Calendar, Plus, Trash2, NotebookPen, Ruler, TrendingUp, X, Check } from 'lucide-react';
import { useCoachStore, useJournalStore, useBodyLogStore, useProfileStore } from '../core/store';
import { tonnage } from '../core/coach';
import type { JournalEntry, BodyLogEntry } from '../data/types';

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function DiaryPage() {
  const [tab, setTab] = useState<'calendar' | 'journal' | 'body'>('calendar');

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Дневник</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Календарь тренировок, записи и замеры тела</p>
      </div>

      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-1 flex">
        {([
          { id: 'calendar', label: 'Календарь', icon: Calendar },
          { id: 'journal', label: 'Записи', icon: NotebookPen },
          { id: 'body', label: 'Тело', icon: Ruler },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx('flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5',
              tab === t.id ? 'bg-primary-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-border')}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'calendar' && <CalendarView />}
      {tab === 'journal' && <JournalView />}
      {tab === 'body' && <BodyView />}
    </div>
  );
}

// ---------------------------------------------------------------- календарь

function CalendarView() {
  const { sessions } = useCoachStore();
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });

  // Карта «дата → тренировки»
  const byDay = useMemo(() => {
    const map = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const d = new Date(s.ts);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [sessions]);

  const first = new Date(cursor.y, cursor.m, 1);
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7; // пн = 0

  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthSessions = sessions.filter(s => {
    const d = new Date(s.ts);
    return d.getFullYear() === cursor.y && d.getMonth() === cursor.m;
  });
  const monthTonnage = monthSessions.reduce((sum, s) => sum + tonnage(s), 0);
  const monthVolume = monthSessions.reduce((sum, s) =>
    sum + s.items.reduce((v, i) => v + i.weightKg * i.reps * i.sets, 0), 0);

  return (
    <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setCursor(c => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-border">
          ←
        </button>
        <h2 className="font-semibold text-slate-900 dark:text-white">{MONTHS[cursor.m]} {cursor.y}</h2>
        <button onClick={() => setCursor(c => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-border">
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map(w => (
          <div key={w} className="text-center text-xs text-slate-400 dark:text-slate-500 font-medium">{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const key = `${cursor.y}-${cursor.m}-${d}`;
          const list = byDay.get(key) || [];
          const isToday = d === now.getDate() && cursor.m === now.getMonth() && cursor.y === now.getFullYear();
          return (
            <div key={i}
              className={clsx(
                'aspect-square rounded-lg flex flex-col items-center justify-center text-sm relative',
                list.length
                  ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-semibold'
                  : 'text-slate-600 dark:text-slate-400',
                isToday && 'ring-2 ring-primary-500'
              )}>
              {d}
              {list.length > 0 && (
                <span className="text-[9px] leading-none mt-0.5">{list.length} тр.</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-200 dark:border-dark-border">
        <Stat label="Тренировок" value={String(monthSessions.length)} />
        <Stat label="Тоннаж" value={`${Math.round(monthTonnage / 1000)} т`} />
        <Stat label="Объём" value={`${Math.round(monthVolume / 1000)} т`} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- записи

function JournalView() {
  const { entries, addEntry, removeEntry } = useJournalStore();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');

  const add = () => {
    if (!title.trim() && !text.trim()) return;
    const e: JournalEntry = {
      id: crypto.randomUUID(),
      date: Date.now(),
      title: title.trim(),
      text: text.trim(),
      items: [],
    };
    addEntry(e);
    setTitle(''); setText(''); setAdding(false);
  };

  return (
    <div className="space-y-3">
      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-4">
        {adding ? (
          <div className="space-y-3">
            <input
              type="text" placeholder="Заголовок" value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white"
            />
            <textarea
              placeholder="Что записать?" value={text} rows={4}
              onChange={e => setText(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white resize-y"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAdding(false)} className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-border">
                Отмена
              </button>
              <button onClick={add} className="px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700">Сохранить</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="w-full flex items-center justify-center gap-2 py-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg">
            <Plus className="w-4 h-4" /> Новая запись
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-10 text-slate-500 dark:text-slate-400 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border">
          <NotebookPen className="w-10 h-10 mx-auto mb-2 opacity-50" />
          Записей пока нет
        </div>
      ) : entries.map(e => (
        <div key={e.id} className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-slate-400 dark:text-slate-500">
                {new Date(e.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              {e.title && <h3 className="font-semibold text-slate-900 dark:text-white mt-0.5">{e.title}</h3>}
            </div>
            <button onClick={() => { if (confirm('Удалить запись?')) removeEntry(e.id); }}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex-shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          {e.text && <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 whitespace-pre-wrap">{e.text}</p>}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- замеры тела

function BodyView() {
  const { logs, addLog, removeLog } = useBodyLogStore();
  const { profile } = useProfileStore();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    weightKg: profile?.weightKg || 0,
    bodyFatPct: profile?.bodyFatPercent || 0,
    waistCm: 0, chestCm: 0, armCm: 0, thighCm: 0, calfCm: 0,
  });

  const add = () => {
    if (!form.weightKg) return;
    const e: BodyLogEntry = { id: crypto.randomUUID(), date: Date.now(), ...form };
    addLog(e);
    setAdding(false);
  };

  const sorted = [...logs].sort((a, b) => b.date - a.date);
  const first = sorted[sorted.length - 1];
  const last = sorted[0];
  const delta = first && last ? last.weightKg - first.weightKg : 0;

  return (
    <div className="space-y-3">
      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-4">
        {adding ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Вес, кг" value={form.weightKg} onChange={v => setForm(f => ({ ...f, weightKg: v }))} step="0.1" />
              <Field label="% жира" value={form.bodyFatPct} onChange={v => setForm(f => ({ ...f, bodyFatPct: v }))} step="0.1" />
              <Field label="Талия, см" value={form.waistCm} onChange={v => setForm(f => ({ ...f, waistCm: v }))} step="0.5" />
              <Field label="Грудь, см" value={form.chestCm} onChange={v => setForm(f => ({ ...f, chestCm: v }))} step="0.5" />
              <Field label="Бицепс, см" value={form.armCm} onChange={v => setForm(f => ({ ...f, armCm: v }))} step="0.5" />
              <Field label="Бедро, см" value={form.thighCm} onChange={v => setForm(f => ({ ...f, thighCm: v }))} step="0.5" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAdding(false)} className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-border">Отмена</button>
              <button onClick={add} className="px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700">Сохранить</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="w-full flex items-center justify-center gap-2 py-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg">
            <Plus className="w-4 h-4" /> Записать замеры
          </button>
        )}
      </div>

      {sorted.length > 1 && (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Сейчас" value={`${last.weightKg} кг`} />
          <Stat label="Динамика" value={`${delta > 0 ? '+' : ''}${delta.toFixed(1)} кг`} />
          <Stat label="Замеров" value={String(sorted.length)} />
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="text-center py-10 text-slate-500 dark:text-slate-400 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border">
          <Ruler className="w-10 h-10 mx-auto mb-2 opacity-50" />
          Замеров пока нет
        </div>
      ) : sorted.map(e => (
        <div key={e.id} className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs text-slate-400 dark:text-slate-500">
                {new Date(e.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                {e.weightKg} кг{e.bodyFatPct ? ` · ${e.bodyFatPct}% жира` : ''}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {[e.waistCm && `талия ${e.waistCm}`, e.chestCm && `грудь ${e.chestCm}`,
                  e.armCm && `бицепс ${e.armCm}`, e.thighCm && `бедро ${e.thighCm}`]
                  .filter(Boolean).join(' · ')}
              </div>
            </div>
            <button onClick={() => { if (confirm('Удалить замер?')) removeLog(e.id); }}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Field({ label, value, onChange, step }: { label: string; value: number; onChange: (v: number) => void; step: string }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</label>
      <input
        type="number" step={step} value={value || ''}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white text-center"
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-lg text-center">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
