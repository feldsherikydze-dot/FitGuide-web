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
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">База упражнений</h1>
          <p className="text-slate-500 dark:text-slate-400">
            {exercises.length} упражнений · {muscleGroups.length} мышечных групп
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Поиск по названию, мышце, инвентарю..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedGroup}
              onChange={e => setSelectedGroup(e.target.value)}
              className="px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white text-sm min-w-[200px]"
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
              className="px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white text-sm min-w-[180px]"
            >
              {EQUIPMENT_FILTERS.map(f => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-dark-border/50">
            <input type="checkbox" checked={showBasic} onChange={e => setShowBasic(e.target.checked)} className="w-4 h-4 text-primary-600 rounded border-slate-300" />
            Только базовые
          </label>
          <label className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-dark-border/50">
            <input type="checkbox" checked={showIsolation} onChange={e => setShowIsolation(e.target.checked)} className="w-4 h-4 text-primary-600 rounded border-slate-300" />
            Только изолирующие
          </label>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2" />
          <p className="text-slate-500 dark:text-slate-400">Загрузка базы упражнений...</p>
        </div>
      ) : filteredExercises.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border">
          <Dumbbell className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Ничего не найдено</h3>
          <p className="text-slate-500 dark:text-slate-400">Попробуй изменить фильтры или поисковый запрос</p>
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
                  'bg-white dark:bg-dark-card rounded-xl border overflow-hidden transition-all',
                  isExpanded ? 'border-primary-300 dark:border-primary-700 ring-2 ring-primary-500/20' : 'border-slate-200 dark:border-dark-border'
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
                        isBasic(exercise) ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        isIsolation(exercise) ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                      )}>
                        {isBasic(exercise) ? 'Базовое' : isIsolation(exercise) ? 'Изолирующее' : 'Упражнение'}
                      </span>
                      {equipCat !== 'free' && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          {equipCat.charAt(0).toUpperCase() + equipCat.slice(1)}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-slate-900 dark:text-white truncate">{exercise.name}</h3>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400 mt-1">
                      <span>{exercise.sets} × {exercise.reps}</span>
                      <span>⏱ {exercise.rest}</span>
                      {exercise.target && <span>{exercise.target}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <ExternalLink className="w-5 h-5 text-slate-400 hover:text-primary-600" />
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-bg/50 p-4 space-y-4 animate-slide-down">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <p className="text-slate-700 dark:text-slate-300">{exercise.description}</p>
                    </div>

                    {exercise.steps.length > 0 && (
                      <div>
                        <h4 className="font-medium text-slate-900 dark:text-white mb-2">Техника выполнения:</h4>
                        <ol className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                          {exercise.steps.map((step, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="font-mono text-primary-600 dark:text-primary-400">{i + 1}.</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {(exercise.mistakes.length > 0 || exercise.tips.length > 0) && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {exercise.mistakes.length > 0 && (
                          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                            <h5 className="font-medium text-red-700 dark:text-red-400 mb-2 flex items-center gap-1">
                              <AlertTriangle className="w-4 h-4" />
                              Типичные ошибки
                            </h5>
                            <ul className="space-y-1 text-sm text-red-600 dark:text-red-400">
                              {exercise.mistakes.map((m, i) => (
                                <li key={i} className="flex gap-1">• {m}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {exercise.tips.length > 0 && (
                          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                            <h5 className="font-medium text-green-700 dark:text-green-400 mb-2 flex items-center gap-1">
                              <Target className="w-4 h-4" />
                              Советы
                            </h5>
                            <ul className="space-y-1 text-sm text-green-600 dark:text-green-400">
                              {exercise.tips.map((t, i) => (
                                <li key={i} className="flex gap-1">• {t}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-dark-border">
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