// Вкладка «Дневник» (порт DiaryFragment + activity_diary.xml).
// Учёт съеденного по дням с нормой из профиля и средним за неделю.

import { useCallback, useMemo, useState } from 'react';
import { useProfileStore } from '../../core/store';
import { getJSON, setJSON, KEYS } from '../../core/storage';
import { dailyCalories, proteinPerKg } from '../../core/goals';
import { Dialog, DialogAction, Field, Toast, parseInt10, parseNum } from '../progress/common';
import type { Day } from '../../core/nutrition';
import { searchFoods, foodPortion } from '../../data/foods';
import type { Food } from '../../data/foods';

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

const WEEKDAYS_RU = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Формат tvDay: «d MMMM yyyy», для сегодня — с префиксом diary_today_fmt. */
function displayDay(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const fmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    .format(d).replace(/\s*г\.$/, '');
  return offset === 0 ? `Сегодня · ${fmt}` : fmt;
}

/** Порт DiaryStore.mealByTime: до 11 — завтрак, до 16 — обед, до 19 — перекус. */
function mealByTime(ts: number): string {
  const h = new Date(ts).getHours();
  if (h < 11) return 'Завтрак';
  if (h < 16) return 'Обед';
  if (h < 19) return 'Перекус';
  return 'Ужин';
}

function format1(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** Порт KitchenStore.menuFor: день меню по названию дня недели. */
function menuFor(menu: Day[], date: Date): Day | null {
  const weekday = WEEKDAYS_RU[date.getDay()];
  const found = menu.find(d => (d.name || '').trim().toLowerCase() === weekday);
  return found || null;
}

interface MenuDish {
  meal: string;
  name: string;
  kcal: number;
  p: number;
  f: number;
  c: number;
}

export function DiaryTab() {
  const { profile } = useProfileStore();
  const [dayOffset, setDayOffset] = useState(0);
  const [entries, setEntries] = useState<DiaryEntry[]>(() => getJSON<DiaryEntry[]>(KEYS.DIARY_ENTRIES, []));
  const [toast, setToast] = useState<string | null>('');
  const [picking, setPicking] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState({ name: '', kcal: '', protein: '' });
  const [foodOpen, setFoodOpen] = useState(false);
  const [foodQuery, setFoodQuery] = useState('');
  const [foodPick, setFoodPick] = useState<Food | null>(null);
  const [grams, setGrams] = useState('100');
  const [confirmEntry, setConfirmEntry] = useState<DiaryEntry | null>(null);

  const showToast = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 2500);
  };

  // Норма — из профиля, её же считает КБЖУ-калькулятор (Profile.getDailyCalories).
  const kcalTarget = Math.round(dailyCalories(profile));
  const ready = !!profile && (profile.weightKg || 0) > 0 && kcalTarget > 0;
  const proteinTarget = ready ? (profile!.weightKg || 0) * proteinPerKg(profile!.goal) : 0;

  const date = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    return d;
  }, [dayOffset]);

  const dayKeyStr = dayKeyOf(date);
  const dayEntries = useMemo(() => entries.filter(e => e.day === dayKeyStr), [entries, dayKeyStr]);

  const totals = useMemo(() => {
    let kcal = 0, p = 0, f = 0, c = 0;
    for (const e of dayEntries) { kcal += e.kcal; p += e.protein; f += e.fat; c += e.carbs; }
    return { kcal, p, f, c };
  }, [dayEntries]);

  // Средний факт за 7 дней (DiaryStore.average).
  const weekAvg = useMemo(() => {
    const from = Date.now() - 7 * 86400000;
    const seen = new Set<string>();
    let sum = 0, sumP = 0;
    for (const e of entries) {
      if (e.ts < from) continue;
      sum += e.kcal;
      sumP += e.protein;
      seen.add(e.day);
    }
    const count = seen.size;
    return { count, kcal: count ? Math.round(sum / count) : 0, protein: count ? sumP / count : 0 };
  }, [entries]);

  const saveEntries = useCallback((list: DiaryEntry[]) => {
    setJSON(KEYS.DIARY_ENTRIES, list);
    setEntries(list);
  }, []);

  const addEntry = useCallback((e: Omit<DiaryEntry, 'id'>) => {
    const entry: DiaryEntry = { ...e, id: crypto.randomUUID() };
    // Как DiaryStore.add: новые записи дописываются в конец списка.
    saveEntries([...entries, entry]);
    showToast(`Записал: ${entry.name} · ${entry.kcal} ккал`);
  }, [entries, saveEntries, showToast]);

  const removeEntry = useCallback((entry: DiaryEntry) => {
    saveEntries(entries.filter(e => e.id !== entry.id));
  }, [entries, saveEntries]);

  // Блюда меню «Кухни» на выбранный день недели.
  const menuDishes = useMemo<MenuDish[]>(() => {
    const menu = getJSON<Day[]>(KEYS.KITCHEN_MENU, []) || [];
    const day = menuFor(menu, date);
    if (!day) return [];
    const out: MenuDish[] = [];
    for (const m of day.meals || []) {
      for (const d of m.dishes || []) {
        out.push({ meal: m.title, name: d.name, kcal: d.kcal, p: d.p, f: d.f, c: d.c });
      }
    }
    return out;
  }, [date, picking]);

  // База продуктов: фильтр по названию, первые 80 — чтобы список не тормозил.
  const foodList = useMemo<Food[]>(() => searchFoods(foodQuery).slice(0, 80), [foodQuery]);

  const closeFood = () => {
    setFoodOpen(false);
    setFoodPick(null);
    setFoodQuery('');
    setGrams('100');
  };

  const addFood = () => {
    if (!foodPick) return;
    const g = parseNum(grams);
    if (!(g > 0)) {
      showToast('Укажи граммы');
      return;
    }
    const m = foodPortion(foodPick, g);
    const ts = Date.now();
    addEntry({
      ts, day: dayKeyStr, meal: mealByTime(ts),
      name: `${foodPick.name}, ${Math.round(g)} г`,
      kcal: m.kcal, protein: m.p, fat: m.f, carbs: m.c,
    });
    closeFood();
  };

  const openAdd = () => {
    setPicking(true);
  };

  const pickDish = (md: MenuDish) => {
    setPicking(false);
    const ts = Date.now();
    addEntry({
      ts, day: dayKeyStr, meal: md.meal || mealByTime(ts),
      name: md.name, kcal: md.kcal, protein: md.p, fat: md.f, carbs: md.c,
    });
  };

  const saveCustom = () => {
    const name = custom.name.trim();
    const kcal = parseInt10(custom.kcal);
    const protein = parseNum(custom.protein);
    setCustomOpen(false);
    setCustom({ name: '', kcal: '', protein: '' });
    if (!name || kcal <= 0) {
      showToast('Впиши название и калории');
      return;
    }
    const ts = Date.now();
    addEntry({ ts, day: dayKeyStr, meal: mealByTime(ts), name, kcal, protein, fat: 0, carbs: 0 });
  };

  return (
    <div className="pb-6 px-2">
      {/* День: ‹ дата › */}
      <div className="flex items-center mt-1">
        <button
          onClick={() => setDayOffset(o => o - 1)}
          aria-label="Предыдущий день"
          className="w-12 h-12 flex items-center justify-center rounded-full active:bg-black/5 flex-shrink-0 text-[22px]"
          style={{ color: 'var(--p-labels-text)', background: 'transparent' }}
        >
          ‹
        </button>
        <div className="flex-1 text-center text-[16px] font-bold truncate" style={{ color: 'var(--p-labels-text)' }}>
          {displayDay(dayOffset)}
        </div>
        <button
          onClick={() => dayOffset < 0 && setDayOffset(o => o + 1)}
          disabled={dayOffset >= 0}
          aria-label="Следующий день"
          className="w-12 h-12 flex items-center justify-center rounded-full active:bg-black/5 flex-shrink-0 text-[22px]"
          style={{
            color: 'var(--p-labels-text)',
            background: 'transparent',
            opacity: dayOffset >= 0 ? 0.35 : 1,
          }}
        >
          ›
        </button>
      </div>

      {/* Карточка нормы */}
      <div
        className="mt-1 rounded-[16px] p-4"
        style={{ background: 'var(--p-labels)', border: '1px solid var(--p-outline)' }}
      >
        <div className="text-[15px]" style={{ color: 'var(--color-text-main)' }}>
          {ready
            ? (kcalTarget - totals.kcal >= 0
              ? `Ккал: ${totals.kcal} из ${kcalTarget} · осталось ${kcalTarget - totals.kcal}`
              : `Ккал: ${totals.kcal} из ${kcalTarget} · перебор ${totals.kcal - kcalTarget}`)
            : `Съедено: ${totals.kcal} ккал`}
        </div>
        <div className="mt-1 text-[15px]" style={{ color: 'var(--p-labels-text)' }}>
          {ready
            ? `Белок: ${format1(totals.p)} из ${format1(proteinTarget)} г`
            : `Белок: ${format1(totals.p)} г`}
        </div>
        <div className="mt-1 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
          Жиры {format1(totals.f)} · Углеводы {format1(totals.c)} г
        </div>
        {!ready && (
          <div className="mt-1 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
            Заполни профиль — тогда покажу норму калорий и белка.
          </div>
        )}
      </div>

      {/* Добавить еду */}
      <button
        onClick={openAdd}
        className="fg-btn fg-btn-primary w-full h-12 mt-3"
        style={{ borderRadius: 24 }}
      >
        + ДОБАВИТЬ ЕДУ
      </button>
      <div className="mt-2 text-[12px] leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
        Выбери блюдо из меню кухни или впиши своё. Долгое нажатие на запись — удалить.
      </div>

      {/* Записи дня */}
      <div className="mt-4">
        {dayEntries.map(e => (
          <div
            key={e.id}
            className="pt-2.5 select-none"
            onContextMenu={ev => { ev.preventDefault(); setConfirmEntry(e); }}
            onTouchStart={() => {
              const t = window.setTimeout(() => setConfirmEntry(e), 550);
              const cancel = () => { window.clearTimeout(t); window.removeEventListener('touchend', cancel); window.removeEventListener('touchmove', cancel); };
              window.addEventListener('touchend', cancel);
              window.addEventListener('touchmove', cancel);
            }}
          >
            <div className="text-[15px] truncate" style={{ color: 'var(--color-text-main)' }}>
              {e.meal ? `${e.meal} · ${e.name}` : e.name}
            </div>
            <div className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
              {e.kcal} ккал · Б {format1(e.protein)} · Ж {format1(e.fat)} · У {format1(e.carbs)}
            </div>
            <div className="mt-2.5 h-px" style={{ background: 'var(--color-outline)' }} />
          </div>
        ))}
      </div>

      {dayEntries.length === 0 && (
        <div className="mt-4 text-center text-[14px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          Пока пусто.
          <br />
          Отмечай съеденное — тренер подскажет, чего не хватает.
        </div>
      )}

      <div className="mt-5 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
        {weekAvg.count === 0
          ? 'Итоги за неделю появятся, когда отметишь питание.'
          : `Средний факт за ${weekAvg.count} дн.: ${weekAvg.kcal} ккал · белок ${format1(weekAvg.protein)} г`}
      </div>

      {/* Выбор блюда из меню кухни */}
      {picking && (
        <Dialog
          title="Что съел?"
          onClose={() => setPicking(false)}
          actions={<DialogAction onClick={() => setPicking(false)}>Отмена</DialogAction>}
        >
          <div className="-mx-2">
            {menuDishes.map((md, i) => (
              <button
                key={`${md.meal}:${md.name}:${i}`}
                onClick={() => pickDish(md)}
                className="block w-full text-left px-2 py-3 text-[15px] active:bg-black/5 rounded-lg"
                style={{ color: 'var(--p-on-labels)' }}
              >
                {md.kcal} ккал · {md.name}
              </button>
            ))}
            <button
              onClick={() => { setPicking(false); setFoodOpen(true); }}
              className="block w-full text-left px-2 py-3 text-[15px] active:bg-black/5 rounded-lg"
              style={{ color: 'var(--p-on-labels)' }}
            >
              Из базы продуктов…
            </button>
            <button
              onClick={() => { setPicking(false); setCustomOpen(true); }}
              className="block w-full text-left px-2 py-3 text-[15px] active:bg-black/5 rounded-lg"
              style={{ color: 'var(--p-on-labels)' }}
            >
              Ввести своё…
            </button>
          </div>
        </Dialog>
      )}

      {/* Своя еда */}
      {customOpen && (
        <Dialog
          title="Своя еда"
          onClose={() => setCustomOpen(false)}
          actions={
            <>
              <DialogAction onClick={() => setCustomOpen(false)}>Отмена</DialogAction>
              <DialogAction strong onClick={saveCustom}>Сохранить</DialogAction>
            </>
          }
        >
          <div className="pt-1 space-y-2">
            <Field value={custom.name} onChange={(v: string) => setCustom({ ...custom, name: v })} placeholder="Название" inputMode="text" />
            <Field value={custom.kcal} onChange={(v: string) => setCustom({ ...custom, kcal: v })} placeholder="Ккал" inputMode="numeric" />
            <Field value={custom.protein} onChange={(v: string) => setCustom({ ...custom, protein: v })} placeholder="Белок, г" inputMode="decimal" />
          </div>
        </Dialog>
      )}

      {/* База продуктов: поиск и граммы */}
      {foodOpen && (
        <Dialog
          title={foodPick ? foodPick.name : 'База продуктов'}
          onClose={closeFood}
          actions={foodPick ? (
            <>
              <DialogAction onClick={() => setFoodPick(null)}>Назад</DialogAction>
              <DialogAction strong onClick={addFood}>Записать</DialogAction>
            </>
          ) : (
            <DialogAction onClick={closeFood}>Отмена</DialogAction>
          )}
        >
          {!foodPick ? (
            <>
              <Field
                value={foodQuery}
                onChange={(v: string) => setFoodQuery(v)}
                placeholder="Поиск: курица, рис, творог…"
                inputMode="text"
              />
              <div className="mt-2 -mx-2 max-h-[45vh] overflow-y-auto">
                {foodList.map((f, i) => (
                  <button
                    key={`${f.name}:${i}`}
                    onClick={() => { setFoodPick(f); setGrams('100'); }}
                    className="block w-full text-left px-2 py-2.5 active:bg-black/5 rounded-lg"
                  >
                    <span className="block text-[14px]" style={{ color: 'var(--p-on-labels)' }}>{f.name}</span>
                    <span className="block text-[12px]" style={{ color: 'var(--p-on-labels-soft)' }}>
                      {f.kcal} ккал · Б {format1(f.p)} · Ж {format1(f.f)} · У {format1(f.c)} на 100 г
                    </span>
                  </button>
                ))}
                {foodList.length === 0 && (
                  <div className="px-2 py-3 text-[13px]" style={{ color: 'var(--p-on-labels-soft)' }}>
                    Ничего не найдено
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="pt-1">
              <div className="text-[13px]" style={{ color: 'var(--p-on-labels-soft)' }}>
                На 100 г: {foodPick.kcal} ккал · Б {format1(foodPick.p)} · Ж {format1(foodPick.f)} · У {format1(foodPick.c)}
              </div>
              <div className="mt-2">
                <Field value={grams} onChange={(v: string) => setGrams(v)} placeholder="Граммы" inputMode="numeric" />
              </div>
              <div className="mt-3 text-[15px]" style={{ color: 'var(--p-on-labels)' }}>
                {(() => {
                  const m = foodPortion(foodPick, parseNum(grams));
                  return `${m.kcal} ккал · Б ${format1(m.p)} · Ж ${format1(m.f)} · У ${format1(m.c)}`;
                })()}
              </div>
            </div>
          )}
        </Dialog>
      )}

      {/* Подтверждение удаления */}
      {confirmEntry && (
        <Dialog
          title="Удалить запись?"
          onClose={() => setConfirmEntry(null)}
          actions={
            <>
              <DialogAction onClick={() => setConfirmEntry(null)}>Отмена</DialogAction>
              <DialogAction strong onClick={() => { removeEntry(confirmEntry); setConfirmEntry(null); }}>ОК</DialogAction>
            </>
          }
        >
          <p className="text-[14px] leading-relaxed" style={{ color: 'var(--p-on-labels-soft)' }}>
            Убрать «{confirmEntry.name}» из дневника?
          </p>
        </Dialog>
      )}

      <Toast text={toast} />
    </div>
  );
}
