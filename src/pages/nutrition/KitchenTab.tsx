// Вкладка «Кухня» (порт KitchenFragment + activity_kitchen.xml).
// Меню на неделю под целевые калории с БЖУ.

import { useCallback, useMemo, useState } from 'react';
import { useProfileStore } from '../../core/store';
import { getJSON, setJSON, KEYS } from '../../core/storage';
import { goalList, goalLabel } from '../../core/goals';
import { week } from '../../core/nutrition';
import type { Day } from '../../core/nutrition';
import { Card, Field, Hint, PrimaryButton, SectionTitle, Toast } from '../progress/common';

interface MenuState {
  kcal: string;
  favs: string;
  dislikes: string;
  menu: Day[] | null;
}

export function KitchenTab() {
  const { profile } = useProfileStore();
  const [state, setState] = useState<MenuState>(() => {
    const calc = profile ? Math.round(profile.weightKg * 25) : 2200;
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
    setJSON(KEYS.KITCHEN_MENU, days);
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
    <div className="pb-6 space-y-2">
      <Card className="mt-2">
        <SectionTitle>Кухня — меню на неделю</SectionTitle>
        <Hint className="mt-0.5">По профилю, целям и КБЖУ. Разнообразие каждый день.</Hint>

        <div className="mt-2 space-y-1.5">
          <Field value={state.kcal} onChange={v => setState(s => ({ ...s, kcal: v }))}
            placeholder="Калории в день" inputMode="numeric" />
          <Field value={state.favs} onChange={v => setState(s => ({ ...s, favs: v }))}
            placeholder="Любимые продукты/блюда через запятую" />
          <Field value={state.dislikes} onChange={v => setState(s => ({ ...s, dislikes: v }))}
            placeholder="Не ем (исключить) через запятую" />
        </div>

        <div className="mt-1 text-[13px] font-bold" style={{ color: 'var(--color-text-main)' }}>
          Цель: {goals} · ~{targetKcal} ккал/день
        </div>

        <PrimaryButton className="mt-2 h-11" onClick={hasMenu ? clear : generate}>
          {hasMenu ? 'Очистить меню' : 'Сгенерировать меню'}
        </PrimaryButton>

        {hasMenu && (
          <Hint className="mt-1" style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
            Меню очищено — нажмите «Сгенерировать меню», чтобы составить новое.
          </Hint>
        )}
      </Card>

      {menu.length > 0 && (
        <div className="mt-3 space-y-1">
          {menu.map((day, di) => (
            <div key={day.name}>
              <div className="text-[16px] font-bold mb-1" style={{ color: 'var(--color-text-main)', paddingTop: 16, paddingBottom: 6 }}>
                {day.name} · {day.meals.reduce((s, m) => s + m.dishes.reduce((d2, d) => d2 + d.kcal, 0), 0)} ккал
              </div>
              {day.meals.map((meal, mi) => (
                <div key={meal.title}>
                  <div className="text-[14px] font-bold mb-0.5" style={{ color: 'var(--color-text-main)', paddingTop: 8, paddingBottom: 2 }}>
                    {meal.title} · {meal.dishes.reduce((s, d) => s + d.kcal, 0)} ккал
                  </div>
                  {meal.dishes.map((d, dk) => (
                    <div key={`${mi}-${dk}`} className="text-[13px] pl-2 mb-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                      • {d.name} — {d.kcal} ккал (Б{d.p}/Ж{d.f}/У{d.c})
                    </div>
                  ))}
                </div>
              ))}
              <div className="text-[12px] mb-2" style={{ color: 'var(--color-text-secondary)', paddingBottom: 8 }}>
                Итого: Б{day.meals.reduce((s, m) => s + m.dishes.reduce((d2, d) => d2 + d.p, 0), 0)}/Ж{day.meals.reduce((s, m) => s + m.dishes.reduce((d2, d) => d2 + d.f, 0), 0)}/У{day.meals.reduce((s, m) => s + m.dishes.reduce((d2, d) => d2 + d.c, 0), 0)}
              </div>
              <div className="h-px" style={{ background: 'var(--color-outline)', marginBottom: 4 }} />
            </div>
          ))}
        </div>
      )}

      {!hasMenu && menu.length === 0 && (
        <Hint className="mt-4 text-center">
          Меню пока не сформировано. Укажите калории и нажмите «Сгенерировать меню».
        </Hint>
      )}

      <Toast text={toast} />
    </div>
  );
}
