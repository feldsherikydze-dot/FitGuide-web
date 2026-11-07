// FitGuide Web — упражнения мышечной группы (порт MuscleGroupActivity + item_exercise.xml).
// Шапка с поиском, чипы пучков и типа, список с секциями
// «Базовые упражнения» / «Изолирующие упражнения», бейдж уровня и основной группы.

import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { PageHeader, MaskIcon, asset } from '../components/ui';
import { useExercises } from '../hooks/useExercises';
import { useProfileStore } from '../core/store';
import { isBasicExercise, isIsolationExercise } from '../core/exercises';
import { slotColor, contrastOn } from '../core/palette';
import {
  buildExerciseIndex, byGroupPrimary, secondaryForGroup, subgroupInGroup,
  filterByStyle,
} from '../core/exerciseIndex';
import type { Exercise } from '../data/types';

/** Смешивание цветов как BaseActivity.blend: t=0 — фон, t=1 — акцент. */
function blend(from: string, to: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  const [r1, g1, b1] = parse(from);
  const [r2, g2, b2] = parse(to);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  const to2 = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to2(mix(r1, r2))}${to2(mix(g1, g2))}${to2(mix(b1, b2))}`;
}

/**
 * Бейдж уровня в списке — как ExerciseAdapter.setLevelBadge: сравнение идёт
 * со значениями "beginner"/"advanced", поэтому русские значения из базы
 * попадают в ветку по умолчанию («Средний»). Так же ведёт себя APK 1.18.
 */
function levelBadge(ex: Exercise): { text: string; bg: string; color: string } | null {
  if (!ex.difficulty) return null;
  const circle = slotColor('circleIcons');
  const labels = slotColor('labelsButtons');
  let text = 'Средний';
  let t = 0.78;
  if (ex.difficulty === 'beginner') { text = 'Новичок'; t = 0.55; }
  else if (ex.difficulty === 'advanced') { text = 'Продвинутый'; t = 1.0; }
  const bg = blend(labels, circle, t);
  return { text, bg, color: contrastOn(bg) };
}

export function MuscleGroupPage() {
  const navigate = useNavigate();
  const { groupId = '' } = useParams();
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const { exercises, muscleGroups, loading } = useExercises();
  const profile = useProfileStore(s => s.profile);

  // Статический маршрут /exercises/selection не даёт :groupId — определяем по пути.
  const multi = pathname.endsWith('/selection');
  const multiIds = useMemo(
    () => (multi ? (params.get('ids') || '').split(',').filter(Boolean) : []),
    [multi, params],
  );

  const group = muscleGroups.find(g => g.id === groupId);
  const index = useMemo(() => buildExerciseIndex(muscleGroups, exercises), [muscleGroups, exercises]);

  const [subgroup, setSubgroup] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [multiSelected, setMultiSelected] = useState('');

  const level = profile?.level || '';
  const style = profile?.trainStyle || 'any';

  const groupNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of muscleGroups) map.set(g.id, g.name);
    if (!multi) map.delete(groupId);
    return map;
  }, [muscleGroups, groupId, multi]);

  const rows = useMemo(() => {
    if (!index) return [] as Exercise[];

    if (multi) {
      const perGroup = new Map<string, Exercise[]>();
      const all: Exercise[] = [];
      for (const id of multiIds) {
        const list = filterByStyle(byGroupPrimary(index, id, level, typeFilter), style);
        perGroup.set(id, list);
        all.push(...list);
      }
      if (!multiSelected) return all;
      return perGroup.get(multiSelected) || [];
    }

    const primary = byGroupPrimary(index, groupId, level, typeFilter)
      .filter(ex => {
        if (!subgroup) return true;
        const sg = subgroupInGroup(index, ex, groupId);
        return !sg || sg === subgroup;
      });

    const secondary = secondaryForGroup(index, groupId, level, typeFilter)
      .filter(ex => {
        if (!subgroup) return true;
        const sg = subgroupInGroup(index, ex, groupId);
        return !sg || sg === subgroup;
      });

    const ordered: Exercise[] = [];
    for (const ex of primary) if (isBasicExercise(ex)) ordered.push(ex);
    for (const ex of primary) if (!isBasicExercise(ex) && isIsolationExercise(ex)) ordered.push(ex);
    for (const ex of primary) if (!isBasicExercise(ex) && !isIsolationExercise(ex)) ordered.push(ex);
    ordered.push(...secondary);
    return filterByStyle(ordered, style);
  }, [index, multi, multiIds, multiSelected, groupId, subgroup, level, typeFilter, style]);

  const sections = useMemo(() => {
    const basic = rows.filter(isBasicExercise);
    const additional = rows.filter(ex => !isBasicExercise(ex));
    const out: { key: string; title: string; items: Exercise[] }[] = [];
    if (basic.length) out.push({ key: 'basic', title: 'Базовые упражнения', items: basic });
    if (additional.length) out.push({ key: 'additional', title: 'Изолирующие упражнения', items: additional });
    return out;
  }, [rows]);

  const title = multi ? 'Выбранные группы' : (group?.name || '');
  const subgroups = group?.subgroups || [];

  return (
    <div className="max-w-2xl mx-auto w-full flex flex-col min-h-[calc(100vh-56px)]">
      <PageHeader
        title={title}
        onBack={() => navigate(-1)}
        right={
          <button
            onClick={() => navigate('/search')}
            aria-label="Поиск"
            className="w-12 h-12 flex items-center justify-center rounded-full active:bg-black/5 flex-shrink-0"
          >
            <MaskIcon src={asset('icons/ic_search.svg')} color="var(--p-labels-text)" size={24} />
          </button>
        }
      />

      {/* Пучки (подгруппы) — переносятся на несколько строк, как ChipGroup в Android */}
      {!multi && subgroups.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-2">
          <button
            onClick={() => setSubgroup('')}
            className={`fg-chip flex items-center gap-1.5 ${subgroup === '' ? 'fg-chip-on' : ''}`}
          >
            <MaskIcon
              src={asset('icons/ic_dumbbell.svg')}
              color={subgroup === '' ? 'var(--p-on-circle)' : 'var(--p-labels-text)'}
              size={16}
            />
            Все
          </button>
          {subgroups.map(sg => (
            <button
              key={sg.id}
              onClick={() => setSubgroup(sg.id)}
              className={`fg-chip ${subgroup === sg.id ? 'fg-chip-on' : ''}`}
            >
              {sg.name}
            </button>
          ))}
        </div>
      )}

      {/* Тип упражнения */}
      <div className="flex flex-wrap gap-1.5 px-2 pb-1">
        {[
          { v: '', label: 'Все' },
          { v: 'basic', label: 'Базовые' },
          { v: 'isolation', label: 'Изолирующие' },
        ].map(t => (
          <button
            key={t.v}
            onClick={() => setTypeFilter(t.v)}
            className={`fg-chip ${typeFilter === t.v ? 'fg-chip-on' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* В режиме нескольких групп — чипы самих групп */}
      {multi && (
        <div className="flex flex-wrap gap-1.5 px-2 pb-1">
          <button
            onClick={() => setMultiSelected('')}
            className={`fg-chip ${multiSelected === '' ? 'fg-chip-on' : ''}`}
          >
            Все
          </button>
          {multiIds.map(id => {
            const g = muscleGroups.find(x => x.id === id);
            if (!g) return null;
            return (
              <button
                key={id}
                onClick={() => setMultiSelected(id)}
                className={`fg-chip ${multiSelected === id ? 'fg-chip-on' : ''}`}
              >
                {g.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex-1 px-2 pt-1 pb-2">
        {loading ? (
          <div className="text-center py-12 text-[var(--color-text-secondary)]">Загрузка базы упражнений…</div>
        ) : rows.length === 0 ? (
          <div className="text-center px-8 pb-12 pt-8 text-[15px] text-[var(--color-text-secondary)]">
            Нет упражнений для выбранного уровня
          </div>
        ) : (
          sections.map(section => (
            <div key={section.key}>
              <div
                className="px-4 pt-[18px] pb-2 text-[13px] font-bold uppercase"
                style={{ color: 'var(--p-labels-text)', letterSpacing: '0.04em' }}
              >
                {section.title}
              </div>
              <div className="space-y-4">
                {section.items.map(ex => {
                  const badge = levelBadge(ex);
                  const groupName = groupNames.get(ex.muscleGroup);
                  return (
                    <button
                      key={ex.id}
                      onClick={() => navigate(`/exercise/${ex.id}`)}
                      className="w-full text-left rounded-[18px] px-5 pt-4 pb-4 active:brightness-95"
                      style={{ background: 'var(--p-labels)', border: '1px solid var(--p-outline)' }}
                    >
                      <div className="flex items-center gap-2">
                        <MaskIcon src={asset('icons/ic_dumbbell.svg')} color="var(--p-outline)" size={18} />
                        {groupName && (
                          <span
                            className="px-2 py-0.5 rounded-[10px] text-[11px] font-bold"
                            style={{ background: 'var(--color-surface-variant)', color: 'var(--p-labels-text)' }}
                          >
                            {groupName}
                          </span>
                        )}
                        <span
                          className="flex-1 min-w-0 text-[16px] font-bold leading-snug"
                          style={{ color: 'var(--color-text-main)' }}
                        >
                          {ex.name}
                        </span>
                      </div>
                      <div className="mt-1 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                        {ex.target}
                      </div>
                      <div className="mt-2.5 flex items-center gap-2">
                        {badge && (
                          <span
                            className="px-2.5 py-[3px] rounded-[7px] text-[12px] font-bold"
                            style={{ background: badge.bg, color: badge.color }}
                          >
                            {badge.text}
                          </span>
                        )}
                        <span className="flex-1 min-w-0 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
                          {ex.equipment}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
