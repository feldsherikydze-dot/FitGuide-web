// FitGuide Web — типы данных (порт с Android-версии)

// --- База упражнений ---
export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;      // e.g. "Плечи"
  subgroup: string;         // e.g. "Передняя дельта"
  type: string;             // "basic" | "изолирующее" | ...
  equipmentType: string;    // "штанга / Смит", "гантели", "блок", "свой вес", ...
  gender: string;           // "male" | "female" | "both"
  equipment: string;        // детали инвентаря
  target: string;           // целевая мышца
  description: string;
  secondaryMuscles: string[];
  steps: string[];
  sets: number;
  reps: string;
  rest: string;
  difficulty: string;
  biomech: string;
  exType: string;
  bundle: string;
  category: string;
  mistakes: string[];
  tips: string[];
}

// --- Структура программы ---
export interface Slot {
  exercise: string;
  group: string;
  reps: string;
  rest: string;
  sets: number;
  role?: 'main' | 'secondary' | 'isolation';
  startWeight?: number;
  restEx?: string;
  workSec?: number;
}

export interface Day {
  title: string;
  slots: Slot[];
}

export interface Phase {
  weekStart: number;
  weekEnd: number;
  label: string;
  scheme: string;
  deload: boolean;
  days: Day[];
}

export interface Program {
  id: string;
  name: string;
  goal: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  daysPerWeek: number;
  weeks: number;
  createdAt: number;
  template?: string;
  phases: Phase[];
}

// --- Состояние тренера ---
export interface Session {
  id: string;
  programId: string;
  week: number;
  dayTitle: string;
  startedAt: number;
  finishedAt?: number;
  items: SessionItem[];
}

export interface SessionItem {
  exercise: string;
  weightKg: number;
  reps: number;
  sets: number;
  feel?: 1 | 2 | 3; // 1=тяжело, 2=в самый раз, 3=легко
}

export interface Checkin {
  id: string;
  ts: number;
  sleep: number;        // 1-9
  fatigue: number;      // 1-9
  soreness: number;     // 1-9
  mood: number;         // 1-9
  stress: number;       // 1-9
  note?: string;
}

export interface Assessment {
  id: string;
  date: number;
  weight: number;
  height: number;
  age: number;
  gender: 'male' | 'female';
  bodyFat?: number;
  measurements: Record<string, number>; // waist, chest, arm, thigh, calf
  skinfolds: Record<string, number>;
  movements: number[];    // 0-2 per movement
  tests: TestResult[];
  amrap: number[];
  pain: number;
  mmc: number;
  tech: number;
  e1rm: Record<string, number>;
}

export interface TestResult {
  exercise: string;
  weight: number;
  reps: number;
}

export interface CoachState {
  activeProgramId: string | null;
  activeSince: number | null;
  coachPath: 'own' | 'coach';
  coachProgramId: string | null;
  sessions: Session[];
  checkins: Checkin[];
  feels: Record<string, number>; // sessionId -> 1|2|3
  banned: string[]; // exercise ids
  limits: Record<string, { weight: number; reps: number }>;
  programUpdated: boolean;
  programUpdatedNote: string;
  resetAt: number | null;
}

// --- Генератор программ ---
export type ProgramType = 'auto' | 'fullbody' | 'split' | 'circuit';
export type Periodization = 'none' | 'linear' | 'wave';

export interface GeneratorInput {
  goals: string[];           // ['strength', 'hypertrophy', 'endurance', 'fat_loss']
  level: 'beginner' | 'intermediate' | 'advanced';
  direction: 'powerlifting' | 'bodybuilding' | 'any';
  type: ProgramType;
  daysPerWeek: 2 | 3 | 4 | 5 | 6;
  weeks: number;
  periodization: Periodization;
  location: 'gym' | 'home';
  age?: number;
  gender?: 'male' | 'female';
  equipment?: string[];      // available equipment categories
}

export interface MuscleGroup {
  id: string;
  name: string;
  icon: string;
  subgroups: Subgroup[];
}

export interface Subgroup {
  id: string;
  name: string;
  muscles: string;
  order: number;
}

export interface ExercisesDB {
  version: number;
  muscleGroups: MuscleGroup[];
  exercises: Exercise[];
}

// --- Настройки ---
export interface UserProfile {
  name: string;
  gender: 'male' | 'female';
  birthDate: string;        // ISO date
  height: number;
  weight: number;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  goal: 'maintain' | 'lose' | 'gain';
  equipment: string[];
  location: 'gym' | 'home';
}