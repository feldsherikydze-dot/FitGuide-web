// FitGuide Web — хук для работы с базой упражнений

import { useState, useEffect, useCallback } from 'react';
import type { ExercisesDB, Exercise, MuscleGroup } from '../data/types';
import { loadExercisesDB, getAllExercises, filterByEquipment, searchExercises, getEquipCategory, isBasicExercise, isIsolationExercise } from '../core/exercises';

export function useExercises() {
  const [db, setDb] = useState<ExercisesDB | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadExercisesDB()
      .then(data => {
        setDb(data);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const exercises = db ? getAllExercises(db) : [];
  const muscleGroups = db?.muscleGroups || [];

  const findById = useCallback((id: string) => db ? db.exercises.find(e => e.id === id) : undefined, [db]);
  const getByMuscleGroup = useCallback((groupId: string) => db ? db.exercises.filter(e => e.muscleGroup === groupId) : [], [db]);
  const getBySubgroup = useCallback((groupId: string, subgroupId: string) => db ? db.exercises.filter(e => e.muscleGroup === groupId && e.subgroup === subgroupId) : [], [db]);
  const filterByAvail = useCallback((equip: string[]) => db ? filterByEquipment(db, equip) : [], [db]);
  const search = useCallback((q: string) => db ? searchExercises(db, q) : [], [db]);

  return {
    db,
    loading,
    error,
    exercises,
    muscleGroups,
    findById,
    getByMuscleGroup,
    getBySubgroup,
    filterByAvail,
    search,
    getEquipCategory,
    isBasic: isBasicExercise,
    isIsolation: isIsolationExercise,
  };
}

export function useMuscleGroups() {
  const { muscleGroups, loading } = useExercises();
  return { muscleGroups, loading };
}