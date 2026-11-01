// FitGuide Web — страница упражнений

import { useState, useMemo } from 'react';
import { Search, Filter, Dumbbell, Target, ChevronDown, ChevronUp, ExternalLink, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { useExercises } from '../hooks/useExercises';
import type { Exercise, MuscleGroup } from '../data/types';

const EQUIPMENT_FILTERS = [
  { id: 'all', label: 'Все', icon: null },
  { id: 'barbell', label: 'Штанга', icon: Dumbbell },
  { id: 'dumbbell', label: 'Гантели', icon: Dumbbell },
  { id: 'cable', label: 'Блоки/Кроссовер', icon: Target },
  { id: 'smith', label: 'Смит', icon: Dumbbell },
  { id: 'machine', label: 'Тренажёры', icon: Dumbbell },
  { id: 'free', label: 'Свой вес', icon: null },
] as const;

export function ExercisesPage() {
  const { exercises, muscleGroups, search, filterByAvail, getEquipCategory, isBasic, isIsolation, loading } = useExercises();
  const [query, setQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedEquip, setSelectedEquip] = useState<string>('all');
  const [showBasic, setShowBasic] = useState(false);
  const [showIsolation, setShowIsolation] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const filteredExercises = useMemo(() => {
    let result = exercises;

    if (query) {
      result = search(query);
    }

    if (selectedGroup !== 'all') {
      result = result.filter(e => e.muscleGroup === selectedGroup);
    }

    if (selectedEquip !== 'all') {
      if (selectedEquip === 'free') {
        result = result.filter(e => getEquipCategory(e) === 'free');
      } else {
        result = result.filter(e => getEquipCategory(e) === selectedEquip);
      }
    }

    if (showBasic) {
      result = result.filter(isBasic);
    }
    if (showIsolation) {
      result = result.filter(isIsolation);
    }

    return result;
  }, [exercises, query, selectedGroup, selectedEquip, showBasic, showIsolation, search, getEquipCategory, isBasic, isIsolation]);

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 w-full max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--p-labels-text)]">База упражнений</h1>
          <p className="text-[var(--color-text-secondary)]">
            {exercises.length} упражнений · {muscleGroups.length} мышечных групп
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-[var(--p-labels)] rounded-xl border border-[var(--p-outline)] p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-secondary)]" />
          <input
            type="text"
            placeholder="Поиск по названию, мышце, инвентарю..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-[var(--p-outline)] rounded-lg bg-[var(--p-labels)] text-[var(--p-labels-text)] focus:ring-2 focus:ring-[var(--p-outline)]"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[var(--color-text-secondary)]" />
            <select
              value={selectedGroup}
              onChange={e => setSelectedGroup(e.target.value)}
              className="px-3 py-2 border border-[var(--p-outline)] rounded-lg bg-[var(--p-labels)] text-[var(--p-labels-text)] text-sm min-w-[200px]"
            >
              <option value="all">Все группы мышц</option>
              {muscleGroups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedEquip}
              onChange={e => setSelectedEquip(e.target.value)}
              className="px-3 py-2 border border-[var(--p-outline)] rounded-lg bg-[var(--p-labels)] text-[var(--p-labels-text)] text-sm min-w-[180px]"
            >
              {EQUIPMENT_FILTERS.map(f => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 px-3 py-2 border border-[var(--p-outline)] rounded-lg bg-[var(--p-labels)] text-sm cursor-pointer hover:bg-black/5">
            <input type="checkbox" checked={showBasic} onChange={e => setShowBasic(e.target.checked)} className="w-4 h-4 text-[var(--p-labels-text)] rounded border-[var(--p-outline)]" />
            Только базовые
          </label>
          <label className="flex items-center gap-2 px-3 py-2 border border-[var(--p-outline)] rounded-lg bg-[var(--p-labels)] text-sm cursor-pointer hover:bg-black/5">
            <input type="checkbox" checked={showIsolation} onChange={e => setShowIsolation(e.target.checked)} className="w-4 h-4 text-[var(--p-labels-text)] rounded border-[var(--p-outline)]" />
            Только изолирующие
          </label>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--p-outline)] mx-auto mb-2" />
          <p className="text-[var(--color-text-secondary)]">Загрузка базы упражнений...</p>
        </div>
      ) : filteredExercises.length === 0 ? (
        <div className="text-center py-12 bg-[var(--p-labels)] rounded-xl border border-[var(--p-outline)]">
          <Dumbbell className="w-16 h-16 text-[var(--color-text-secondary)] mx-auto mb-4" />
          <h3 className="text-lg font-medium text-[var(--p-labels-text)] mb-2">Ничего не найдено</h3>
          <p className="text-[var(--color-text-secondary)]">Попробуй изменить фильтры или поисковый запрос</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredExercises.map((exercise, index) => {
            const isExpanded = expandedIds.has(exercise.id);
            const equipCat = getEquipCategory(exercise);
            
            return (
              <div
                key={exercise.id}
                className={clsx(
                  'bg-[var(--p-labels)] rounded-xl border overflow-hidden transition-all',
                  isExpanded ? 'border-[var(--p-outline)] ring-2 ring-[var(--p-outline)]/20' : 'border-[var(--p-outline)]'
                )}
              >
                <button
                  onClick={() => toggleExpanded(exercise.id)}
                  className="w-full p-4 flex items-start justify-between gap-4 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={clsx(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        isBasic(exercise) ? 'bg-[var(--p-circle)] text-[#000000]' :
                        isIsolation(exercise) ? 'bg-[var(--p-circle)] text-[#000000]' :
                        'bg-[var(--p-outline)]/20 text-[var(--p-outline)]'
                      )}>
                        {isBasic(exercise) ? 'Базовое' : isIsolation(exercise) ? 'Изолирующее' : 'Упражнение'}
                      </span>
                      {equipCat !== 'free' && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-[var(--p-circle)] text-[#000000]">
                          {equipCat.charAt(0).toUpperCase() + equipCat.slice(1)}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-[var(--p-labels-text)] truncate">{exercise.name}</h3>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--color-text-secondary)] mt-1">
                      <span>{exercise.sets} × {exercise.reps}</span>
                      <span>⏱ {exercise.rest}</span>
                      {exercise.target && <span>{exercise.target}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <ExternalLink className="w-5 h-5 text-[var(--color-text-secondary)] hover:text-[var(--p-labels-text)]" />
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-[var(--color-text-secondary)]" /> : <ChevronDown className="w-5 h-5 text-[var(--color-text-secondary)]" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-[var(--p-outline)] bg-[var(--color-bg)] p-4 space-y-4 animate-slide-down">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <p className="text-[var(--color-text-secondary)]">{exercise.description}</p>
                    </div>

                    {exercise.steps.length > 0 && (
                      <div>
                        <h4 className="font-medium text-[var(--p-labels-text)] mb-2">Техника выполнения:</h4>
                        <ol className="space-y-1 text-sm text-[var(--color-text-secondary)]">
                          {exercise.steps.map((step, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="font-mono text-[var(--p-labels-text)]">{i + 1}.</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {(exercise.mistakes.length > 0 || exercise.tips.length > 0) && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {exercise.mistakes.length > 0 && (
                          <div className="bg-[#C0392B]/20 border-[#C0392B] rounded-lg p-3">
                            <h5 className="font-medium text-[#C0392B] mb-2 flex items-center gap-1">
                              <AlertTriangle className="w-4 h-4" />
                              Типичные ошибки
                            </h5>
                            <ul className="space-y-1 text-sm text-[#C0392B]">
                              {exercise.mistakes.map((m, i) => (
                                <li key={i} className="flex gap-1">• {m}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {exercise.tips.length > 0 && (
                          <div className="bg-[var(--p-circle)]/20 border border-[var(--p-outline)] rounded-lg p-3">
                            <h5 className="font-medium text-[var(--p-outline)] mb-2 flex items-center gap-1">
                              <Target className="w-4 h-4" />
                              Советы
                            </h5>
                            <ul className="space-y-1 text-sm text-[var(--p-outline)]">
                              {exercise.tips.map((t, i) => (
                                <li key={i} className="flex gap-1">• {t}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 text-xs text-[var(--color-text-secondary)] pt-2 border-t border-[var(--p-outline)]">
                      <span>ID: {exercise.id}</span>
                      <span>Категория: {exercise.category || '—'}</span>
                      <span>Сложность: {exercise.difficulty || '—'}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}