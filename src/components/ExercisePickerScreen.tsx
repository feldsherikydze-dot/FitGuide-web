// Экран выбора упражнений — порт режима выбора CustomProgramActivity:
// регион → мышца → головка/пучок, фильтр типа, «хлебные крошки», поиск,
// список карточек с галочками и кнопка «Добавить (N)» / «Заменить».
//
// Один экран на все случаи: «+ Упражнение» в своей сборке (несколько сразу),
// «+ Добавить упражнение» в правке готовой программы и «Заменить»
// (одиночный выбор, тап сразу возвращает замену).

import { useEffect, useMemo, useRef, useState } from 'react';
import { useExercises, usePicker } from '../hooks/useExercises';
import { useCoachStore, useProfileStore } from '../core/store';
import {
  buildExerciseIndex, exercisesOf, filterByStyle,
  levelRank, matchesType, pluralExercises,
} from '../core/exerciseIndex';
import { isBasicExercise } from '../core/exercises';
import { conflictsWithLimits } from '../core/coach';
import {
  buildPickerIndex, isPrimaryInPicker, pickerExercises, regionOfMuscle,
} from '../core/picker';
import { contrastOn, slotColor, withAlpha } from '../core/palette';
import { PageHeader } from './ui';
import type { Exercise } from '../data/types';

export interface ExercisePickerScreenProps {
  title: string;
  subtitle?: string;
  /** false — одиночный выбор (замена): тап сразу возвращает упражнение. */
  multiple?: boolean;
  /** Замена: заменяемое упражнение — исключаем и открываем на его мышце. */
  currentName?: string;
  /** Запасная группа (имя или id) — если упражнение не нашлось в базе. */
  groupId?: string;
  onPick: (names: string[]) => void;
  onClose: () => void;
  /** Замена из тренировки: «Не предлагать «…»». */
  banName?: string;
  onBan?: () => void;
}

export function ExercisePickerScreen({
  title, subtitle, multiple = true, currentName, groupId,
  onPick, onClose, banName, onBan,
}: ExercisePickerScreenProps) {
  const { exercises, muscleGroups } = useExercises();
  const picker = usePicker();
  const { profile } = useProfileStore();
  const coach = useCoachStore();

  const [regionId, setRegionId] = useState('');
  const [muscleId, setMuscleId] = useState('');
  const [headId, setHeadId] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const index = useMemo(
    () => buildExerciseIndex(muscleGroups, exercises),
    [muscleGroups, exercises],
  );
  const pickerIdx = useMemo(
    () => buildPickerIndex(picker, muscleGroups, exercises),
    [picker, muscleGroups, exercises],
  );

  const current = useMemo(
    () => exercises.find(e => e.name === currentName) || null,
    [exercises, currentName],
  );

  // Группа заменяемого: id из базы, иначе имя/id из слота.
  const currentGroupId = useMemo(() => {
    if (current?.muscleGroup) return current.muscleGroup;
    const raw = (groupId || '').trim();
    if (!raw) return '';
    if (index.groupNameById.has(raw)) return raw;
    return index.groupIdByLowerName.get(raw.toLowerCase()) || '';
  }, [current, groupId, index]);

  // Замена открывается на мышце заменяемого — ровно там, где оно лежит в базе.
  const presetDone = useRef(false);
  const initialNode = useRef({ region: '', muscle: '', head: '' });
  useEffect(() => {
    if (presetDone.current || !picker || !current) return;
    const pair = picker.map?.[current.id];
    if (!pair || !pair[0]) return;
    const region = regionOfMuscle(picker, pair[0]);
    setRegionId(region);
    setMuscleId(pair[0]);
    setHeadId(pair[1] || '');
    initialNode.current = { region, muscle: pair[0], head: pair[1] || '' };
    presetDone.current = true;
  }, [picker, current]);

  const region = useMemo(
    () => (picker?.regions || []).find(r => r.id === regionId) || null,
    [picker, regionId],
  );
  // Одна мышца в регионе — не дублируем её кнопкой, сразу показываем пучки.
  const singleMuscle = region && region.muscles.length === 1 ? region.muscles[0] : null;
  const effMuscleId = muscleId || singleMuscle?.id || '';
  const muscle = useMemo(() => {
    if (!picker || !effMuscleId) return null;
    for (const r of picker.regions) {
      const m = r.muscles.find(x => x.id === effMuscleId);
      if (m) return m;
    }
    return null;
  }, [picker, effMuscleId]);

  const level = profile?.level || '';
  const style = profile?.trainStyle || 'any';
  const restrictions = coach.restrictions || [];
  const banned = coach.banned || [];

  // Альтернативы заменяемому — верхняя секция, как в Android.
  const alternatives = useMemo(() => {
    if (!current || !currentGroupId) return [] as Exercise[];
    const pool = exercisesOf(index, currentGroupId).filter(ex =>
      ex.id !== current.id
      && !banned.includes(ex.name)
      && !conflictsWithLimits(ex.name, restrictions)
      && (!level || levelRank(ex.difficulty) <= levelRank(level)));
    const ordered = [...filterByStyle(pool, style)];
    ordered.sort((a, b) => {
      const ab = isBasicExercise(a) ? 1 : 0;
      const bb = isBasicExercise(b) ? 1 : 0;
      if (ab !== bb) return bb - ab;
      const ap = a.muscleGroup === currentGroupId ? 1 : 0;
      const bp = b.muscleGroup === currentGroupId ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return a.name.localeCompare(b.name, 'ru');
    });
    return ordered.slice(0, 8);
  }, [index, current, currentGroupId, banned, restrictions, level, style]);

  const q = query.trim().toLowerCase();
  const nodeList = useMemo(() => {
    let list = picker
      ? pickerExercises(pickerIdx, exercises, regionId, effMuscleId, headId)
      : exercises;
    if (typeFilter) list = list.filter(ex => matchesType(ex, typeFilter));
    if (current) list = list.filter(ex => ex.id !== current.id);
    if (q) list = list.filter(ex => ex.name.toLowerCase().includes(q));
    return list;
  }, [picker, pickerIdx, exercises, regionId, effMuscleId, headId, typeFilter, current, q]);

  const onInitialNode = initialNode.current.region === regionId
    && initialNode.current.muscle === muscleId
    && initialNode.current.head === headId;
  const showAlternatives = !multiple && !!current && onInitialNode && !typeFilter && !q;
  const altIds = new Set(showAlternatives ? alternatives.map(e => e.id) : []);
  const mainList = altIds.size ? nodeList.filter(ex => !altIds.has(ex.id)) : nodeList;

  const listCount = (showAlternatives ? alternatives.length : 0) + mainList.length;

  const crumb = useMemo(() => {
    let path = 'Все упражнения';
    if (region) {
      path = region.name;
      const single = region.muscles.length === 1;
      if (muscle) {
        if (!single) path += ' › ' + muscle.name;
        if (headId) {
          path += ' › ' + (muscle.heads.find(h => h.id === headId)?.name || headId);
        } else if (muscle.heads.length) {
          path += ' › все части';
        }
      } else {
        path += ' › все мышцы';
      }
    }
    return `${path} — ${pluralExercises(listCount)}`;
  }, [region, muscle, headId, listCount]);

  const toggle = (ex: Exercise) => {
    if (!multiple) {
      onPick([ex.name]);
      return;
    }
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(ex.id)) next.delete(ex.id);
      else next.add(ex.id);
      return next;
    });
  };

  const confirm = () => {
    if (!selected.size) return;
    const names = exercises.filter(ex => selected.has(ex.id)).map(ex => ex.name);
    onPick(names);
  };

  const badgeFor = (ex: Exercise): string => {
    if (isPrimaryInPicker(pickerIdx, ex, regionId, effMuscleId)) return '';
    return index.groupNameById.get(ex.muscleGroup) || '';
  };

  const row = (ex: Exercise, keyPrefix = '') => {
    const on = selected.has(ex.id);
    const badge = badgeFor(ex);
    return (
      <button
        key={keyPrefix + ex.id}
        type="button"
        onClick={() => toggle(ex)}
        className="w-full text-left flex items-center gap-2 rounded-[16px] px-3.5 py-3 mb-2 active:opacity-80"
        style={{ background: 'var(--p-labels)', border: '1px solid var(--p-outline)' }}
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            {badge && (
              <span className="flex-shrink-0 text-[11px] font-bold rounded-[10px] px-2 py-0.5"
                style={{ background: withAlpha(slotColor('circleIcons'), 0.22), color: 'var(--p-labels-text)' }}>
                {badge}
              </span>
            )}
            <span className="text-[15px] font-bold leading-snug" style={{ color: 'var(--color-text-main)' }}>
              {ex.name}
            </span>
          </span>
          <span className="block text-[12px] mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            {ex.target || index.groupNameById.get(ex.muscleGroup) || ''}
          </span>
        </span>
        <span
          className="w-[18px] h-[18px] rounded-[4px] border flex items-center justify-center flex-shrink-0"
          style={{
            borderColor: 'var(--p-outline)',
            background: on ? slotColor('circleIcons') : 'transparent',
          }}
        >
          {on && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke={contrastOn(slotColor('circleIcons'))} strokeWidth="3.5"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          )}
        </span>
      </button>
    );
  };

  const header = (text: string) => (
    <div className="mt-4 mb-2 px-1 text-[13px] font-bold uppercase tracking-wide"
      style={{ color: 'var(--p-labels-text)' }}>
      {text}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'var(--color-bg)' }}>
      <PageHeader title={title} subtitle={subtitle} onBack={onClose} />

      {/* Регион */}
      <div className="flex gap-1.5 px-3 overflow-x-auto fg-no-scrollbar pb-1">
        <button type="button" onClick={() => { setRegionId(''); setMuscleId(''); setHeadId(''); }}
          className={`fg-chip flex-shrink-0 ${regionId === '' ? 'fg-chip-on' : ''}`}>
          Все группы
        </button>
        {(picker?.regions || []).map(r => (
          <button key={r.id} type="button"
            onClick={() => {
              setRegionId(prev => (prev === r.id ? '' : r.id));
              setMuscleId('');
              setHeadId('');
            }}
            className={`fg-chip flex-shrink-0 ${regionId === r.id ? 'fg-chip-on' : ''}`}>
            {r.name}
          </button>
        ))}
      </div>

      {/* Мышца (если в регионе их несколько) */}
      {region && region.muscles.length > 1 && (
        <div className="flex gap-1.5 px-3 overflow-x-auto fg-no-scrollbar pb-1">
          {region.muscles.map(m => (
            <button key={m.id} type="button"
              onClick={() => {
                setMuscleId(prev => (prev === m.id ? '' : m.id));
                setHeadId('');
              }}
              className={`fg-chip flex-shrink-0 ${muscleId === m.id ? 'fg-chip-on' : ''}`}>
              {m.name}
            </button>
          ))}
        </div>
      )}

      {/* Головка/пучок */}
      {muscle && muscle.heads.length > 0 && (
        <div className="flex gap-1.5 px-3 overflow-x-auto fg-no-scrollbar pb-1">
          {muscle.heads.map(h => (
            <button key={h.id} type="button"
              onClick={() => setHeadId(prev => (prev === h.id ? '' : h.id))}
              className={`fg-chip flex-shrink-0 ${headId === h.id ? 'fg-chip-on' : ''}`}>
              {h.name}
            </button>
          ))}
        </div>
      )}

      {/* Тип упражнения */}
      <div className="flex flex-wrap gap-1.5 px-3 pb-1">
        {[
          { v: '', label: 'Все' },
          { v: 'basic', label: 'Базовые' },
          { v: 'isolation', label: 'Изолирующие' },
        ].map(t => (
          <button key={t.v} type="button" onClick={() => setTypeFilter(t.v)}
            className={`fg-chip ${typeFilter === t.v ? 'fg-chip-on' : ''}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 pt-1.5 text-[13px] font-bold" style={{ color: 'var(--p-labels-text)' }}>
        {crumb}
      </div>

      <div className="px-4 pt-2">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Поиск упражнения…"
          inputMode="text"
          className="fg-input"
        />
      </div>

      <div className="px-4 pt-1.5 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
        Выбрано: {selected.size} упражнений
      </div>

      <div className="flex-1 overflow-y-auto px-3 pt-2 pb-24">
        {showAlternatives && alternatives.length > 0 && (
          <>
            {header('Альтернативы')}
            {alternatives.map(ex => row(ex, 'alt:'))}
          </>
        )}
        {mainList.map(ex => row(ex))}
        {listCount === 0 && (
          <div className="px-3 py-6 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
            Ничего не найдено
          </div>
        )}
      </div>

      {banName && onBan && (
        <button type="button" onClick={onBan}
          className="mx-4 mb-2 px-3 py-2.5 rounded-[14px] text-[13px]"
          style={{ border: '1px solid var(--p-outline)', color: 'var(--color-text-secondary)' }}>
          Не предлагать «{banName}»
        </button>
      )}

      <div className="px-4 pb-4 pt-1">
        <button
          type="button"
          onClick={multiple ? confirm : undefined}
          disabled={multiple ? selected.size === 0 : true}
          className="w-full h-[52px] rounded-[26px] text-[16px] font-bold uppercase tracking-[0.089em] active:opacity-80 disabled:opacity-50"
          style={{
            background: 'var(--p-labels)',
            border: '1px solid var(--p-outline)',
            color: 'var(--p-labels-text)',
          }}>
          {multiple ? `Добавить (${selected.size})` : 'Заменить'}
        </button>
      </div>
    </div>
  );
}
