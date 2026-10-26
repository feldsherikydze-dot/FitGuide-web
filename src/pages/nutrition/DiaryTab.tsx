// Вкладка «Дневник» (порт DiaryFragment + activity_diary.xml).
// Учёт съеденного по дням с нормой из профиля и средним за неделю.

import { useCallback, useMemo, useState } from 'react';
import { useProfileStore } from '../../core/store';
import { getJSON, setJSON, KEYS } from '../../core/storage';
import { proteinPerKg } from '../../core/goals';
import { Card, Dialog, DialogAction, Field, Hint, PrimaryButton, Toast, parseInt10, parseNum } from '../progress/common';
import { MaskIcon, asset } from '../../components/ui';

interface DiaryEntry {
  id: string;
  ts: number;
  day: string;   // yyyy-MM-dd
  meal: string;
  name: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

const MONTHS_RU = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function displayDay(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const fmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    .format(d).replace(/\s*г\.$/, '');
  return offset === 0 ? `Сегодня · ${fmt}` : fmt;
}

function mealByTime(ts: number): string {
  const h = new Date(ts).getHours();
  if (h >= 6 && h < 11) return 'Завтрак';
  if (h >= 12 && h < 16) return 'Обед';
  if (h >= 17 && h < 22) return 'Ужин';
  return 'Перекус';
}

function format1(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export function DiaryTab() {
  const { profile } = useProfileStore();
  const [dayOffset, setDayOffset] = useState(0);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [toast, setToast] = useState<string | null>('');
  const [adding, setAdding] = useState(false);
  const [custom, setCustom] = useState<{ name: string; kcal: string; protein: string }>({ name: '', kcal: '', protein: '' });
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const showToast = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 2500);
  };

  const ready = !!profile && profile.weightKg > 0 && profile.age > 0;
  const kcalTarget = ready ? Math.max(1200, Math.round(profile.weightKg * 25)) : 0;
  const proteinTarget = ready ? profile.weightKg * proteinPerKg(profile.goal) : 0;

  const dayKeyStr = useMemo(() => dayKeyOf(new Date(Date.now() + dayOffset * 86400000)), [dayOffset]);
  const dayEntries = useMemo(() => entries.filter(e => e.day === dayKeyStr), [entries, dayKeyStr]);

  const totals = useMemo(() => {
    let kcal = 0, p = 0, f = 0, c = 0;
    for (const e of dayEntries) { kcal += e.kcal; p += e.protein; f += e.fat; c += e.carbs; }
    return { kcal, p, f, c };
  }, [dayEntries]);

  // Средний факт за 7 дней
  const weekAvg = useMemo(() => {
    const now = Date.now();
    let sum = 0, sumP = 0, count = 0;
    for (let i = 0; i < 7; i++) {
      const k = dayKeyOf(new Date(now - i * 86400000));
      const es = entries.filter(e => e.day === k);
      if (es.length) {
        count++;
        for (const e of es) { sum += e.kcal; sumP += e.protein; }
      }
    }
    return { count, kcal: count ? Math.round(sum / count) : 0, protein: count ? sumP / count : 0 };
  }, [entries]);

  const loadEntries = useCallback((): DiaryEntry[] => {
    return getJSON<DiaryEntry[]>(KEYS.DIARY_ENTRIES, []);
  }, []);

  const saveEntries = useCallback((list: DiaryEntry[]) => {
    setJSON(KEYS.DIARY_ENTRIES, list);
    setEntries(list);
  }, []);

  const addEntry = useCallback((e: Omit<DiaryEntry, 'id'>) => {
    const entry: DiaryEntry = { ...e, id: crypto.randomUUID() };
    const list = [entry, ...entries];
    saveEntries(list);
    showToast(`Записал: ${entry.name} · ${entry.kcal} ккал`);
  }, [entries, saveEntries, showToast]);

  const removeEntry = useCallback((id: string) => {
    saveEntries(entries.filter(e => e.id !== id));
    showToast('Запись удалена');
  }, [entries, saveEntries]);

  const addFromMenu = (meal: string, name: string, kcal: number, p: number, f: number, c: number) => {
    setAdding(false);
    addEntry({ ts: Date.now(), day: dayKeyStr, meal, name, kcal, protein: p, fat: f, carbs: c });
  };

  return (
    <div className="pb-6 space-y-2">
      <div className="flex items-center justify-between mt-1 px-2">
        <button
          onClick={() => setDayOffset(o => o - 1)}
          aria-label="Предыдущий день"
          className="w-10 h-10 flex items-center justify-center rounded-full active:bg-black/5 flex-shrink-0"
        >
          <MaskIcon src={asset('icons/ic_skip_prev.svg')} color="var(--p-labels)" size={20} />
        </button>
        <div className="text-[16px] font-bold" style={{ color: 'var(--color-text-main)' }}>
          {displayDay(dayOffset)}
        </div>
        <button
          onClick={() => dayOffset < 0 && setDayOffset(o => o + 1)}
          disabled={dayOffset >= 0}
          aria-label="Следующий день"
          className={`w-10 h-10 flex items-center justify-center rounded-full active:bg-black/5 flex-shrink-0 ${dayOffset >= 0 ? 'opacity-35' : ''}`}
        >
          <MaskIcon src={asset('icons/ic_skip_next.svg')} color="var(--p-labels)" size={20} />
        </button>
      </div>

      {!ready && (
        <Hint className="px-3">Заполни профиль — тогда покажу норму калорий и белка.</Hint>
      )}

      <div className="flex justify-between px-3 mt-1 text-[14px]">
        <div>
          {ready
            ? `Ккал: ${totals.kcal} из ${kcalTarget} · осталось ${kcalTarget - totals.kcal >= 0 ? kcalTarget - totals.kcal : 0}`
            : `Съедено: ${totals.kcal} ккал`}
        </div>
        <div>
          {ready ? `Белок: ${format1(totals.p)} из ${format1(proteinTarget)} г` : `Белок: ${format1(totals.p)} г`}
        </div>
        <div className="text-[13px]">Жиры ${format1(totals.f)} · Углеводы ${format1(totals.c)} г</div>
      </div>

      {dayEntries.length === 0 && (
        <Hint className="px-8 py-6 text-center">
          Пока пусто. Добавьте еду — и следите за питанием.
        </Hint>
      )}

      <div className="mt-1">
        {dayEntries.map(e => (
          <div key={e.id} className="select-none pt-2 pb-2">
            <div className="text-[15px] font-bold truncate" style={{ color: 'var(--color-text-main)' }}>
              {e.meal ? `${e.meal} · ${e.name}` : e.name}
            </div>
            <div className="mt-0.5 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
              {e.kcal} ккал · Б {format1(e.protein)} · Ж {format1(e.fat)} · У {format1(e.carbs)}
            </div>
            <div className="flex justify-end mt-1">
              <button
                onClick={() => removeEntry(e.id)}
                aria-label="Удалить запись"
                className="w-8 h-8 flex items-center justify-center rounded-full active:bg-black/5 flex-shrink-0"
              >
                <MaskIcon src={asset('icons/ic_delete.svg')} color="var(--color-text-secondary)" size={16} />
              </button>
            </div>
            <div className="h-px my-1.5" style={{ background: 'var(--color-outline)' }} />
          </div>
        ))}
      </div>

      <div className="mt-2 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
        {weekAvg.count === 0
          ? 'Итоги за неделю появятся, когда отметишь питание.'
          : `Средний факт за ${weekAvg.count} дн.: ${weekAvg.kcal} ккал · белок ${format1(weekAvg.protein)} г`}
      </div>

      <PrimaryButton className="mt-2 w-full h-11" onClick={() => setAdding(true)}>
        + ДОБАВИТЬ ЕДУ
      </PrimaryButton>

      {adding && (
        <Dialog
          title="Что съел?"
          onClose={() => setAdding(false)}
          actions={
            <>
              <DialogAction onClick={() => setAdding(false)}>Отмена</DialogAction>
              <DialogAction strong onClick={() => setAdding(false)}>Готово</DialogAction>
            </>
          }
        >
          <div className="pt-1 space-y-3">
            {/* Блюда из меню кухни на этот день недели */}
            <div>
              <div className="text-[13px] font-bold mb-1" style={{ color: 'var(--color-text-main)' }}>Из меню кухни</div>
              <div className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>Выберите блюдо из сохранённого меню</div>
            </div>

            <div className="space-y-2 pt-1">
              <Field value={custom.name} onChange={(v: string) => setCustom({ ...custom, name: v })} placeholder="Название" />
              <Field value={custom.kcal} onChange={(v: string) => setCustom({ ...custom, kcal: v })} placeholder="Ккал" inputMode="numeric" />
              <Field value={custom.protein} onChange={(v: string) => setCustom({ ...custom, protein: v })} placeholder="Белок, г" inputMode="decimal" />
              <PrimaryButton className="mt-1 h-10" onClick={() => {
                if (!custom.name || parseInt10(custom.kcal) <= 0) {
                  showToast('Впиши название и калории');
                  return;
                }
                addEntry({
                  ts: Date.now(), day: dayKeyStr, meal: mealByTime(Date.now()),
                  name: custom.name, kcal: parseInt10(custom.kcal),
                  protein: parseNum(custom.protein), fat: 0, carbs: 0,
                });
                setCustom({ name: '', kcal: '', protein: '' });
                setAdding(false);
              }}>Сохранить</PrimaryButton>
            </div>
          </div>
        </Dialog>
      )}

      <Toast text={toast} />
    </div>
  );
}
