// FitGuide Web — «База упражнений» (порт GroupsActivity + activity_groups.xml).
// Сетка мышечных групп 2 колонки, режим выбора групп, кнопки
// «Смотреть выбранные (N)» и «Начать тренировку» — как в Android 1.18.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader, MaskIcon, asset } from '../components/ui';
import { MuscleIcon } from '../components/MuscleIcon';
import { useExercises } from '../hooks/useExercises';
import { useProfileStore } from '../core/store';
import {
  buildExerciseIndex, byGroupPrimary, filterByStyle, pluralExercises,
} from '../core/exerciseIndex';

export function ExercisesPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { exercises, muscleGroups, loading } = useExercises();
  const profile = useProfileStore(s => s.profile);

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const index = useMemo(
    () => buildExerciseIndex(muscleGroups, exercises),
    [muscleGroups, exercises],
  );

  // Счётчик — только целевые упражнения группы (без синергистов), как в Android.
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of muscleGroups) map.set(g.id, byGroupPrimary(index, g.id).length);
    return map;
  }, [index, muscleGroups]);

  // Старые ссылки из поиска: ?group= и ?open= — ведём на новые маршруты.
  const legacyGroup = params.get('group');
  const legacyOpen = params.get('open');
  useEffect(() => {
    if (legacyOpen) navigate(`/exercise/${legacyOpen}`, { replace: true });
    else if (legacyGroup) navigate(`/exercises/${legacyGroup}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legacyGroup, legacyOpen]);

  const toggle = (id: string) => {
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const toggleSelectMode = () => {
    setSelectMode(v => !v);
    setSelected([]);
  };

  /** Как startGroupWorkout: до 12 силовых упражнений из выбранных групп. */
  const startWorkout = () => {
    if (!selected.length) return;
    const style = profile?.trainStyle || 'any';
    const names: string[] = [];
    for (const id of selected) {
      for (const ex of filterByStyle(byGroupPrimary(index, id), style)) {
        names.push(ex.name);
        if (names.length >= 12) break;
      }
      if (names.length >= 12) break;
    }
    if (!names.length) return;
    const qs = names.map(n => encodeURIComponent(n)).join('|');
    navigate(`/workout?names=${qs}&title=${encodeURIComponent('Мышечные группы')}`);
  };

  return (
    <div className="max-w-2xl mx-auto w-full flex flex-col min-h-[calc(100vh-56px)]">
      <PageHeader
        title="База упражнений"
        onBack={() => navigate(-1)}
        right={
          <>
            <button
              onClick={toggleSelectMode}
              aria-label="Выбрать группы"
              className="w-12 h-12 flex items-center justify-center rounded-full active:bg-black/5 flex-shrink-0"
            >
              <MaskIcon src={asset('icons/ic_select.svg')} color="var(--p-labels-text)" size={24} />
            </button>
            <button
              onClick={() => navigate('/search')}
              aria-label="Поиск"
              className="w-12 h-12 flex items-center justify-center rounded-full active:bg-black/5 flex-shrink-0"
            >
              <MaskIcon src={asset('icons/ic_search.svg')} color="var(--p-labels-text)" size={24} />
            </button>
          </>
        }
      />

      {loading ? (
        <div className="text-center py-12 text-[var(--color-text-secondary)]">Загрузка базы упражнений…</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 px-4 pt-1 pb-2">
          {muscleGroups.map(g => {
            const on = selected.includes(g.id);
            const count = counts.get(g.id) || 0;
            return (
              <button
                key={g.id}
                onClick={() => (selectMode ? toggle(g.id) : navigate(`/exercises/${g.id}`))}
                className="relative rounded-[20px] p-[18px] flex flex-col items-center justify-center text-center active:brightness-95"
                style={{ background: 'var(--p-labels)', border: '1px solid var(--p-outline)' }}
              >
                <span className="relative w-[64px] h-[84px] flex items-center justify-center">
                  {/* Как item_muscle_group.xml: тело 36×80dp в рамке 64×84dp.
                      Целевая мышца подсвечена самим MuscleIcon. */}
                  <MuscleIcon name={g.icon || 'legs'} height={80} />
                  {selectMode && (
                    <span className="absolute bottom-0 right-0">
                      <MaskIcon
                        src={asset(on ? 'icons/ic_check_circle.svg' : 'icons/ic_uncheck_circle.svg')}
                        color="var(--p-circle)"
                        size={22}
                      />
                    </span>
                  )}
                </span>
                <span
                  className="mt-3 text-[15px] font-medium leading-tight"
                  style={{ color: 'var(--p-on-labels)' }}
                >
                  {g.name}
                </span>
                {count > 0 && (
                  <span className="mt-0.5 text-[12px]" style={{ color: 'var(--p-on-labels-soft)' }}>
                    {pluralExercises(count)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {selectMode && selected.length > 0 && (
        <div className="mt-auto px-4 pt-1 pb-2.5 space-y-1">
          <button
            onClick={() => navigate(`/exercises/selection?ids=${selected.join(',')}`)}
            className="fg-btn fg-btn-primary w-full h-[52px]"
          >
            Смотреть выбранные ({selected.length})
          </button>
          <button onClick={startWorkout} className="fg-btn fg-btn-primary w-full h-[52px]">
            Начать тренировку
          </button>
        </div>
      )}
    </div>
  );
}
