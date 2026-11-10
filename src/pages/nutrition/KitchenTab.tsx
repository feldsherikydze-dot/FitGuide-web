// Вкладка «Кухня» (порт KitchenFragment + activity_kitchen.xml).
// Меню на неделю под целевые калории с БЖУ. Разметка — плоская форма,
// как в Android: заголовок, подзаголовок, цель, поля, кнопка, список дней.

import { useCallback, useMemo, useState } from 'react';
import { useProfileStore } from '../../core/store';
import { getJSON, setJSON, KEYS } from '../../core/storage';
import { dailyCalories, goalList, goalLabel } from '../../core/goals';
import { week } from '../../core/nutrition';
import type { Day } from '../../core/nutrition';
import { Field, PrimaryButton, Toast } from '../progress/common';

interface MenuState {
  kcal: string;
  favs: string;
  dislikes: string;
  menu: Day[] | null;
}

export function KitchenTab() {
  const { profile } = useProfileStore();
  const [state, setState] = useState<MenuState>(() => {
    const calc = Math.round(dailyCalories(profile)) || 2200;
    return { kcal: String(calc), favs: '', dislikes: '', menu: null };
  });
  const [toast, setToast] = useState<string | null>('');

  const showToast = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 2500);
  };

  const targetKcal = useMemo(() => {
    const v = parseInt(state.kcal, 10) || 0;
    return Math.max(1200, Math.min(5000, v));
  }, [state.kcal]);

  const goals = useMemo(() => {
    const g = profile?.goal ? goalList(profile.goal) : [];
    return g.map(goalLabel).join(' + ') || 'Поддержание';
  }, [profile]);

  const loadMenu = useCallback((): Day[] => {
    const raw = getJSON<Day[]>(KEYS.KITCHEN_MENU, []);
    return raw || [];
  }, []);

  const saveMenu = useCallback((menu: Day[]) => {
    setJSON(KEYS.KITCHEN_MENU, menu);
  }, []);

  const generate = useCallback(() => {
    const favs = state.favs.split(',').map(x => x.trim()).filter(Boolean);
    const dis = state.dislikes.split(',').map(x => x.trim()).filter(Boolean);
    const days = week(targetKcal, profile?.goal || 'mass', favs, dis);
    saveMenu(days);
    setState(s => ({ ...s, menu: days }));
    showToast('Меню готово');
  }, [state.favs, state.dislikes, targetKcal, profile?.goal, saveMenu, showToast]);

  const clear = useCallback(() => {
    saveMenu([]);
    setState(s => ({ ...s, menu: [] }));
    showToast('Меню очищено');
  }, [saveMenu, showToast]);

  const menu = state.menu ?? loadMenu();

  const hasMenu = menu.length > 0;

  return (
    <div className="pb-6 px-2">
      <div className="text-[18px] font-bold" style={{ color: 'var(--color-text-main)' }}>
        Кухня — меню на неделю
      </div>
      <div className="mt-1 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
        По профилю, целям и КБЖУ. Разнообразие каждый день.
      </div>

      <div className="mt-3 text-[14px] font-bold" style={{ color: 'var(--p-labels-text)' }}>
        Цель: {goals} · ~{targetKcal} ккал/день
      </div>

      <div className="mt-1.5 space-y-2">
        <Field value={state.kcal} onChange={v => setState(s => ({ ...s, kcal: v }))}
          placeholder="Калории в день" inputMode="numeric" />
        <Field value={state.favs} onChange={v => setState(s => ({ ...s, favs: v }))}
          placeholder="Любимые продукты/блюда через запятую" inputMode="text" multiline />
        <Field value={state.dislikes} onChange={v => setState(s => ({ ...s, dislikes: v }))}
          placeholder="Не ем (исключить) через запятую" inputMode="text" multiline />
      </div>

      <PrimaryButton className="mt-2.5 h-12" onClick={hasMenu ? clear : generate}>
        {hasMenu ? 'Очистить меню' : 'Сгенерировать меню'}
      </PrimaryButton>

      <div className="mt-2">
        {menu.map(day => (
          <div key={day.name}>
            <div className="pt-4 pb-1.5 text-[16px] font-bold" style={{ color: 'var(--color-text-main)' }}>
              {day.name} · {day.meals.reduce((s, m) => s + m.dishes.reduce((d2, d) => d2 + d.kcal, 0), 0)} ккал
            </div>
            {day.meals.map((meal, mi) => (
              <div key={`${meal.title}-${mi}`}>
                <div className="pt-2 pb-0.5 text-[14px] font-bold" style={{ color: 'var(--color-text-main)' }}>
                  {meal.title} · {meal.dishes.reduce((s, d) => s + d.kcal, 0)} ккал
                </div>
                {meal.dishes.map((d, dk) => (
                  <div key={`${mi}-${dk}`} className="pl-2 mb-0.5 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                    • {d.name}{d.portion && Math.abs(d.portion - 1) > 0.01 ? ` ×${d.portion}` : ''} — {d.kcal} ккал (Б{d.p}/Ж{d.f}/У{d.c})
                  </div>
                ))}
              </div>
            ))}
            <div className="pb-2 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
              Итого: Б{day.meals.reduce((s, m) => s + m.dishes.reduce((d2, d) => d2 + d.p, 0), 0)}/Ж{day.meals.reduce((s, m) => s + m.dishes.reduce((d2, d) => d2 + d.f, 0), 0)}/У{day.meals.reduce((s, m) => s + m.dishes.reduce((d2, d) => d2 + d.c, 0), 0)}
            </div>
            <div className="h-px mb-1" style={{ background: 'var(--color-outline)' }} />
          </div>
        ))}
      </div>

      <Toast text={toast} />
    </div>
  );
}
