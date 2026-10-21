// FitGuide Web — хуки загрузки баз

import { useState, useEffect, useCallback } from 'react';
import type { ExercisesDB, Exercise, MuscleGroup, PickerDB } from '../data/types';
import { loadExercisesDB, getAllExercises, filterByEquipment, searchExercises, getEquipCategory, isBasicExercise, isIsolationExercise } from '../core/exercises';
import { loadKnowledge, getKnowledgeSync } from '../core/knowledge';

export function useExercises() {
  const [db, setDb] = useState<ExercisesDB | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadExercisesDB()
      .then(data => { setDb(data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const exercises = db ? getAllExercises(db) : [];
  const muscleGroups = db?.muscleGroups || [];

  const findById = useCallback((id: string) => db?.exercises.find(e => e.id === id), [db]);
  const getByMuscleGroup = useCallback((groupId: string) => db?.exercises.filter(e => e.muscleGroup === groupId) || [], [db]);
  const getBySubgroup = useCallback((groupId: string, subgroupId: string) =>
    db?.exercises.filter(e => e.muscleGroup === groupId && e.subgroup === subgroupId) || [], [db]);
  const filterByAvail = useCallback((equip: string[]) => (db ? filterByEquipment(db, equip) : []), [db]);
  const search = useCallback((q: string) => (db ? searchExercises(db, q) : []), [db]);

  // Карта «id группы → название группы» — нужна PlanAdvisor.
  const groupNameById = useCallback((): Record<string, string> => {
    const map: Record<string, string> = {};
    for (const g of muscleGroups) map[g.id] = g.name;
    return map;
  }, [muscleGroups]);

  const byName = useCallback((): Map<string, Exercise> => {
    const m = new Map<string, Exercise>();
    for (const e of exercises) m.set(e.name, e);
    return m;
  }, [exercises]);

  return {
    db, loading, error, exercises, muscleGroups,
    findById, getByMuscleGroup, getBySubgroup, filterByAvail, search,
    groupNameById, byName,
    getEquipCategory, isBasic: isBasicExercise, isIsolation: isIsolationExercise,
  };
}

/** Загрузка дерева мышц (picker.json) — для анализа объёма. */
export function usePicker() {
  const [picker, setPicker] = useState<PickerDB | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/picker.json')
      .then(r => (r.ok ? r.json() : null))
      .then((data: PickerDB | null) => { if (alive) setPicker(data); })
      .catch(() => { if (alive) setPicker(null); });
    return () => { alive = false; };
  }, []);

  return picker;
}

/** Загрузка базы знаний (knowledge.md). */
export function useKnowledge() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    loadKnowledge().then(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  return { ready, chapters: getKnowledgeSync() };
}
