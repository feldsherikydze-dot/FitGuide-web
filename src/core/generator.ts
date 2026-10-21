// FitGuide Web — генератор программ (порт с Android ProgramGenerator)

import type { Program, Slot, Phase, Day, Exercise, GeneratorInput, ExercisesDB } from '../data/types';
import { getEquipCategory, isBasicExercise } from './exercises';

export type { GeneratorInput };

// --- Утилиты ---
export function sanitize(s: string): string {
  if (!s) return '';
  return s.replace(/[\p{Cc}\p{Cf}]/gu, '').trim().replace(/\s+/g, ' ');
}

export function roundHalf(kg: number): number {
  return Math.round(kg * 2) / 2;
}

function epley1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return weight * (1 + reps / 30);
}

function brzycki1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return weight * 36 / (37 - reps);
}

function conservative1RM(weight: number, reps: number): number {
  const e = epley1RM(weight, reps);
  const b = brzycki1RM(weight, reps);
  return Math.min(e, b);
}

// --- Главная функция генерации ---
export function generateProgram(input: GeneratorInput, db: ExercisesDB): Program {
  const {
    goals,
    level,
    direction,
    type,
    daysPerWeek,
    weeks,
    periodization,
    location,
    age,
    gender,
    equipment = [],
  } = input;

  const primaryGoal = goals[0] || 'hypertrophy';
  const isStrength = primaryGoal === 'strength' || direction === 'powerlifting';
  const isEndurance = primaryGoal === 'endurance' || primaryGoal === 'fat_loss';
  const isHypertrophy = primaryGoal === 'hypertrophy' || direction === 'bodybuilding';

  // Определяем доступные упражнения
  const availableExercises = filterByLocationAndEquipment(db, location, equipment);

  // Базовые параметры по уровню
  const levelParams = getLevelParams(level, daysPerWeek);

  // Строим фазы (мезоциклы)
  const phases = buildPhases({
    weeks,
    periodization,
    daysPerWeek,
    primaryGoal,
    isStrength,
    isHypertrophy,
    isEndurance,
    levelParams,
    availableExercises,
    age,
    gender,
  });

  // Собираем программу
  const program: Program = {
    id: crypto.randomUUID(),
    name: buildProgramName(type, daysPerWeek, primaryGoal),
    goal: primaryGoal,
    level,
    daysPerWeek,
    weeks,
    createdAt: Date.now(),
    template: type,
    phases,
  };

  return program;
}

function getLevelParams(level: string, daysPerWeek: number) {
  const levelConfigs = {
    beginner: { setsPerMuscleWeek: 9, setsPerSession: 3, restMult: 1.15, maxIntensity: 0.85 },
    intermediate: { setsPerMuscleWeek: 12, setsPerSession: 4, restMult: 1.0, maxIntensity: 0.9 },
    advanced: { setsPerMuscleWeek: 15, setsPerSession: 5, restMult: 0.9, maxIntensity: 0.95 },
  } as const;
  const base = levelConfigs[level as keyof typeof levelConfigs] || levelConfigs.intermediate;

  // Корректировка под частоту
  const freqFactor = daysPerWeek <= 3 ? 1.0 : 0.85;

  return {
    ...base,
    setsPerMuscleWeek: Math.round(base.setsPerMuscleWeek * freqFactor),
    setsPerSession: Math.max(2, Math.round(base.setsPerSession * freqFactor)),
  };
}

function buildPhases(params: {
  weeks: number;
  periodization: string;
  daysPerWeek: number;
  primaryGoal: string;
  isStrength: boolean;
  isHypertrophy: boolean;
  isEndurance: boolean;
  levelParams: any;
  availableExercises: Exercise[];
  age?: number;
  gender?: string;
}): Phase[] {
  const { weeks, periodization, daysPerWeek, primaryGoal, isStrength, isHypertrophy, isEndurance, levelParams, availableExercises, age, gender } = params;

  const phases: Phase[] = [];
  const weeksPerPhase = Math.max(3, Math.floor(weeks / 3)); // минимум 3 недели на фазу
  const numPhases = Math.ceil(weeks / weeksPerPhase);

  let currentWeek = 1;

  for (let p = 0; p < numPhases; p++) {
    const weekStart = currentWeek;
    const weekEnd = Math.min(currentWeek + weeksPerPhase - 1, weeks);
    const isLastPhase = p === numPhases - 1;
    const isDeload = isLastPhase && weekEnd - weekStart >= 2; // разгрузка в последней фазе если она длинная

    const phase: Phase = {
      weekStart,
      weekEnd,
      label: getPhaseLabel(p, numPhases, periodization),
      scheme: getSchemeForPhase(p, numPhases, periodization, isStrength, isHypertrophy, isEndurance, levelParams),
      deload: isDeload,
      days: [],
    };

    // Генерируем дни для этой фазы
    phase.days = generatePhaseDays({
      phase,
      daysPerWeek,
      primaryGoal,
      isStrength,
      isHypertrophy,
      isEndurance,
      levelParams,
      availableExercises,
      age,
      gender,
    });

    phases.push(phase);
    currentWeek = weekEnd + 1;
  }

  return phases;
}

function getPhaseLabel(phaseIndex: number, totalPhases: number, periodization: string): string {
  if (periodization === 'none') return `Фаза ${phaseIndex + 1}`;
  if (periodization === 'linear') {
    const labels = ['Накопление', 'Интенсификация', 'Реализация'];
    return labels[phaseIndex] || `Фаза ${phaseIndex + 1}`;
  }
  if (periodization === 'wave') {
    return phaseIndex % 2 === 0 ? 'Объёмная неделя' : 'Интенсивная неделя';
  }
  return `Фаза ${phaseIndex + 1}`;
}

function getSchemeForPhase(
  phaseIndex: number,
  totalPhases: number,
  periodization: string,
  isStrength: boolean,
  isHypertrophy: boolean,
  isEndurance: boolean,
  levelParams: any
): string {
  const baseSets = levelParams.setsPerSession;
  const isDeload = phaseIndex === totalPhases - 1 && totalPhases > 1;

  if (isDeload) {
    return `${Math.max(2, baseSets - 1)}x${isStrength ? '3-5' : isEndurance ? '15-20' : '10-15'}`;
  }

  if (periodization === 'linear') {
    if (phaseIndex === 0) return `${baseSets}x${isStrength ? '5-8' : isEndurance ? '12-15' : '8-12'}`;
    if (phaseIndex === 1) return `${baseSets}x${isStrength ? '3-5' : isEndurance ? '10-12' : '6-10'}`;
    return `${baseSets}x${isStrength ? '1-3' : isEndurance ? '8-12' : '6-8'}`;
  }

  if (periodization === 'wave') {
    return phaseIndex % 2 === 0
      ? `${baseSets}x${isEndurance ? '12-15' : '8-12'}`
      : `${baseSets}x${isStrength ? '3-5' : '6-8'}`;
  }

  return `${baseSets}x${isStrength ? '5-6' : isEndurance ? '12-15' : '8-12'}`;
}

function generatePhaseDays(params: {
  phase: Phase;
  daysPerWeek: number;
  primaryGoal: string;
  isStrength: boolean;
  isHypertrophy: boolean;
  isEndurance: boolean;
  levelParams: any;
  availableExercises: Exercise[];
  age?: number;
  gender?: string;
}): Day[] {
  const { phase, daysPerWeek, primaryGoal, isStrength, isHypertrophy, isEndurance, levelParams, availableExercises, age, gender } = params;

  const split = getSplit(daysPerWeek);
  const days: Day[] = [];

  for (let d = 0; d < daysPerWeek; d++) {
    const dayTitle = split[d] || `День ${d + 1}`;
    const muscleGroups = splitMuscleGroups[dayTitle] || [];

    const slots: Slot[] = [];

    for (const mg of muscleGroups) {
      const exercises = pickExercisesForGroup(availableExercises, mg, {
        isStrength,
        isHypertrophy,
        isEndurance,
        count: mg === 'legs' ? 3 : mg === 'push' || mg === 'pull' ? 2 : 1,
      });

      exercises.forEach((ex, idx) => {
        const role = idx === 0 ? 'main' : idx === 1 ? 'secondary' : 'isolation';
        const scheme = parseScheme(phase.scheme);
        const sets = scheme.sets;
        const reps = scheme.reps;
        const rest = calcRest(reps, isStrength, isEndurance, levelParams.restMult);

        slots.push({
          exercise: ex.name,
          group: mg,
          reps,
          rest,
          sets,
          role,
          startWeight: 0, // будет заполнено тренером
        });
      });
    }

    days.push({ title: dayTitle, slots });
  }

  return days;
}

function getSplit(daysPerWeek: number): string[] {
  const splits: Record<number, string[]> = {
    2: ['Full Body A', 'Full Body B'],
    3: ['Push', 'Pull', 'Legs'],
    4: ['Upper A', 'Lower A', 'Upper B', 'Lower B'],
    5: ['Push', 'Pull', 'Legs', 'Upper', 'Lower'],
    6: ['Push A', 'Pull A', 'Legs A', 'Push B', 'Pull B', 'Legs B'],
  };
  return splits[daysPerWeek] || splits[3];
}

const splitMuscleGroups: Record<string, string[]> = {
  'Full Body A': ['push', 'pull', 'legs', 'core'],
  'Full Body B': ['legs', 'push', 'pull', 'core'],
  'Push': ['push', 'triceps', 'shoulders'],
  'Pull': ['pull', 'biceps', 'rear_delts'],
  'Legs': ['legs', 'glutes', 'calves'],
  'Upper A': ['push', 'pull', 'shoulders', 'arms'],
  'Lower A': ['legs', 'glutes', 'calves', 'core'],
  'Upper B': ['push', 'pull', 'rear_delts', 'arms'],
  'Lower B': ['legs', 'glutes', 'calves', 'core'],
  'Push A': ['push', 'triceps', 'shoulders'],
  'Pull A': ['pull', 'biceps', 'rear_delts'],
  'Legs A': ['legs', 'glutes', 'calves'],
  'Push B': ['push', 'triceps', 'shoulders'],
  'Pull B': ['pull', 'biceps', 'rear_delts'],
  'Legs B': ['legs', 'glutes', 'calves'],
};

function pickExercisesForGroup(
  exercises: Exercise[],
  group: string,
  opts: { isStrength: boolean; isHypertrophy: boolean; isEndurance: boolean; count: number }
): Exercise[] {
  const groupExercises = exercises.filter(e => {
    const cat = getExerciseCategory(e);
    return cat === group;
  });

  // Сортируем: базовые сначала, потом изолирующие
  groupExercises.sort((a, b) => {
    const aBasic = isBasicExercise(a) ? 0 : 1;
    const bBasic = isBasicExercise(b) ? 0 : 1;
    return aBasic - bBasic;
  });

  return groupExercises.slice(0, opts.count);
}

function getExerciseCategory(ex: Exercise): string {
  const mg = ex.muscleGroup;
  const sg = ex.subgroup;
  const t = (ex.type || '').toLowerCase();

  // Маппинг групп мышц на сплит-категории
  if (mg === 'g16' || mg === 'g1' || mg === 'g7') return 'push'; // грудь, плечи (перед), трицепс
  if (mg === 'g3' || mg === 'g5' || mg === 'g6' || mg === 'g15') return 'pull'; // спина, бицепс, шея
  if (mg === 'g9' || mg === 'g10' || mg === 'g11' || mg === 'g12' || mg === 'g13') return 'legs'; // ноги
  if (mg === 'g14') return 'core'; // пресс
  if (mg === 'g2') return 'pull'; // трапеции
  if (mg === 'g4') return 'legs'; // поясница
  if (mg === 'g8') return 'pull'; // предплечья
  if (mg === 'g1') return 'shoulders'; // плечи
  if (mg === 'g7') return 'triceps'; // трицепс
  if (mg === 'g6') return 'biceps'; // бицепс
  if (mg === 'g11') return 'glutes'; // ягодицы
  if (mg === 'g13') return 'calves'; // икры
  return 'other';
}

function parseScheme(scheme: string): { sets: number; reps: string } {
  // формат: "3x8-12" или "4x5-6"
  const match = scheme.match(/(\d+)x(\d+[-–]\d+|\d+)/);
  if (match) {
    return { sets: parseInt(match[1]), reps: match[2] };
  }
  return { sets: 3, reps: '8-12' };
}

function calcRest(reps: string, isStrength: boolean, isEndurance: boolean, mult: number): string {
  // Парсим репы (берём среднее)
  const nums = reps.match(/\d+/g)?.map(Number) || [10];
  const avgReps = nums.reduce((a, b) => a + b, 0) / nums.length;

  let restSec: number;
  if (avgReps <= 3) restSec = 180;
  else if (avgReps <= 5) restSec = 150;
  else if (avgReps <= 8) restSec = 120;
  else if (avgReps <= 12) restSec = 90;
  else if (avgReps <= 15) restSec = 60;
  else restSec = 45;

  restSec = Math.round(restSec * mult);

  // Округляем до 15 сек
  return `${Math.round(restSec / 15) * 15} сек`;
}

function filterByLocationAndEquipment(db: ExercisesDB, location: 'gym' | 'home', equipment: string[]): Exercise[] {
  return db.exercises.filter(ex => {
    const eqType = (ex.equipmentType || '').toLowerCase();
    if (location === 'home') {
      // Дома: свой вес, гантели, резинки, турник
      const homeKeywords = ['свой вес', 'гантел', 'резинк', 'турник', 'перекладин', 'коврик', 'эспандер', 'bodyweight', 'dumbbell', 'band', 'bar'];
      return homeKeywords.some(k => eqType.includes(k)) || !eqType;
    }
    // В зале — всё, что есть оборудование, или фильтруем по доступному
    if (equipment.length === 0) return true;
    const eqCat = getEquipCategory(ex);
    return eqCat === 'free' || equipment.includes(eqCat);
  });
}

function buildProgramName(type: string, days: number, goal: string): string {
  const typeNames: Record<string, string> = {
    auto: 'Авто',
    fullbody: 'Фулбоди',
    split: 'Сплит',
    circuit: 'Круговая',
  };
  const goalNames: Record<string, string> = {
    strength: 'Сила',
    hypertrophy: 'Масса',
    endurance: 'Выносливость',
    fat_loss: 'Сушка',
  };
  return `${typeNames[type] || type} ${days}дн · ${goalNames[goal] || goal}`;
}

// --- Утилиты для калькулятора e1RM ---
export function calculate1RM(weight: number, reps: number): number {
  return Math.round(conservative1RM(weight, reps));
}

export function calculateStartWeight(e1rm: number, percent: number = 0.85): number {
  return roundHalf(e1rm * percent);
}

export function getRepRangeForGoal(goal: string): string {
  if (goal === 'strength') return '3-5';
  if (goal === 'endurance' || goal === 'fat_loss') return '12-15';
  return '8-12';
}