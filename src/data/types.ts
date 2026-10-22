// FitGuide Web — типы данных (порт с Android-версии)

// --- Цели (Goals.java) ---
export const GOAL = {
  LOSE: 'lose',
  MAINTAIN: 'maintain',
  GAIN: 'gain',       // старый ключ → нормализуется в MASS
  STRENGTH: 'strength',
  MASS: 'mass',
  CUT: 'cut',
  ENDURANCE: 'endurance',
  RECOMP: 'recomp',
} as const;

export type Goal = typeof GOAL[keyof typeof GOAL];

export const ACTIVITY = {
  SEDENTARY: 'sedentary',
  LIGHT: 'light',
  MODERATE: 'moderate',
  HIGH: 'high',
  ATHLETE: 'athlete',
} as const;

export const STYLE = { ANY: 'any', BB: 'bb', PL: 'pl' } as const;
export const PLACE = { GYM: 'gym', HOME: 'home' } as const;
export const LEVEL = { BEGINNER: 'beginner', INTERMEDIATE: 'intermediate', ADVANCED: 'advanced' } as const;
export const GENDER = { MALE: 'male', FEMALE: 'female' } as const;

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

// --- Picker (picker.json) ---
export interface PickerHead { id: string; name: string }
export interface PickerMuscle { id: string; name: string; heads: PickerHead[] }
export interface PickerRegion { id: string; name: string; icon: string; muscles: PickerMuscle[] }
export interface PickerDB { regions: PickerRegion[]; map: Record<string, string[]> }

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
  level: string;
  daysPerWeek: number;
  weeks: number;
  createdAt: number;
  template?: string;
  phases: Phase[];
}

// --- Состояние тренера (CoachStore.java) ---
export interface SessionItem {
  exercise: string;
  weightKg: number;
  reps: number;
  sets: number;          // реально выполнено подходов
  targetSets: number;    // план по программе (0 = не задано)
  feel?: 1 | 2 | 3;      // 1=тяжело, 2=в самый раз, 3=легко (упражнение)
  setFeels?: (1 | 2 | 3)[]; // оценки каждого подхода (пер-сет)
}

export interface Session {
  id: string;
  programId: string;
  week: number;
  dayTitle: string;
  ts: number;                    // время начала
  feel?: 1 | 2 | 3;              // оценка всей сессии
  /** Веса скорректированы (разгрузка / низкая готовность) — показатель силы не считается. */
  adjusted?: boolean;
  items: SessionItem[];
  /** Факты по каждому выполненному подходу (пер-сет оценка). */
  setFacts?: Array<{ exercise: string; feel: 1 | 2 | 3; reps?: number; weightKg?: number; atMs?: number }>;
}

/** Утренняя отметка самочувствия: сон / забитость / энергия, каждая 1..3. */
export interface Checkin {
  day: string;       // ключ дня «yyyyMMdd» — отметка одна на день
  sleep: number;     // 1 плохо, 2 норма, 3 отлично
  sore: number;      // 1 сильная забитость, 2 средняя, 3 нет
  energy: number;    // 1 нет, 2 есть, 3 полна
}

// --- Оценка (Assessment.java) ---
export interface TestResult {
  exercise: string;
  weight: number;
  reps: number;
}

/** Ключевые движения калибровки (AssessmentFormulas.MOV_*) */
export const MOV = {
  SQUAT: 0,
  BENCH: 1,
  DEAD: 2,
  OHP: 3,
  ROW: 4,
  PULLUP: 5,
  LEGPRESS: 6,
  HIP: 7,
  COUNT: 8,
} as const;

export interface Assessment {
  id: string;
  timestamp: number;
  weightKg: number;
  heightCm: number;
  age: number;
  female: boolean;
  bodyFatPct: number;
  leanMassKg: number;
  ffmi: number;
  // обхваты, см
  neckCm: number;
  chestCm: number;
  waistCm: number;
  hipsCm: number;
  armCm: number;
  thighCm: number;
  calfCm: number;
  // складки, мм
  skinfoldChest: number;
  skinfoldMidaxillary: number;
  skinfoldTriceps: number;
  skinfoldSubscapular: number;
  skinfoldAbdominal: number;
  skinfoldSuprailiac: number;
  skinfoldThigh: number;
  // e1RM по 8 движениям
  e1rmSquat: number;
  e1rmBench: number;
  e1rmDeadlift: number;
  e1rmOHP: number;
  e1rmRow: number;
  e1rmPullup: number;
  e1rmLegPress: number;
  e1rmHipThrust: number;
  // стартовые веса (85% e1RM, вниз до 2,5)
  startSquat: number;
  startBench: number;
  startDeadlift: number;
  startOHP: number;
  startRow: number;
  startLegPress: number;
  startHipThrust: number;
  // тесты
  movementScores: number[];   // 0-2 на каждое движение
  testWeights: number[];
  testReps: number[];
  amrap: number[];
  pain: number;
  mmc: number;
  tech: number;
}

// --- Профиль (Profile.java) ---
export interface UserProfile {
  name: string;
  gender: string;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: string;
  goal: string;
  trainStyle: string;
  bodyFatPercent: number;
  workoutsPerWeek: number;
  bio: string;
  country: string;
  city: string;
  level: string;
  equipment: string[];       // доступное оборудование в зале
  place: string;             // gym | home
  compDate?: number;         // дата старта (для сезонного плана)
  compCategory?: string;
}

// --- Тренер (CoachStore) ---
export interface CoachState {
  activeProgramId: string | null;
  prevProgramId: string | null;
  activeSince: number | null;
  coachPath: 'own' | 'coach';
  coachProgramId: string | null;
  programPhase: string;
  programType: string;
  sessions: Session[];
  checkins: Checkin[];
  feels: Record<string, number>;
  banned: string[];
  limits: Record<string, { weight: number; reps: number }>;
  programUpdated: boolean;
  programUpdatedNote: string;
  resetAt: number | null;
  compPhase: string | null;
}

// --- Генератор программ ---
export type ProgramType = 'auto' | 'fullbody' | 'split' | 'circuit';
export type Periodization = 'none' | 'linear' | 'wave';

export interface GeneratorInput {
  goals: string[];
  level: string;
  direction: string;     // powerlifting | bodybuilding | any
  type: ProgramType;
  daysPerWeek: number;
  weeks: number;
  periodization: Periodization;
  location: string;      // gym | home
  age?: number;
  gender?: string;
  equipment?: string[];
}

// --- Знания (knowledge.md) ---
export interface KnowledgeChapter {
  id: string;
  number: string;
  title: string;
  content: string;
  isSection: boolean;
}

// --- Группа мышц и база упражнений ---
export interface Subgroup {
  id: string;
  name: string;
  muscles: string;
  order: number;
}

export interface MuscleGroup {
  id: string;
  name: string;
  icon: string;
  subgroups: Subgroup[];
}

export interface ExercisesDB {
  version: number;
  muscleGroups: MuscleGroup[];
  exercises: Exercise[];
}

// --- Дневник ---
export interface JournalEntry {
  id: string;
  date: number;
  title: string;
  text: string;
  mood?: number;
  items: { exercise: string; weightKg: number; reps: number }[];
}

// --- Замеры тела ---
export interface BodyLogEntry {
  id: string;
  date: number;
  weightKg: number;
  bodyFatPct?: number;
  waistCm?: number;
  chestCm?: number;
  armCm?: number;
  thighCm?: number;
  calfCm?: number;
}

// --- Сезонный план ---
export const COMP_PHASE = {
  OFFSEASON: 'offseason',
  BUILD: 'build',
  CUT: 'cut',
  PEAK: 'peak',
  DAY: 'day',
  RECOVERY: 'recovery',
} as const;

export interface SeasonBlock {
  phase: string;
  name: string;
  goal: string;
  style: string;
  weeks: number;
  period: number;   // ProgramGenerator.PERIOD_*
  type: string;
}

// --- План дня (DailyCoach) ---
export type PlanKind = 'train' | 'rest' | 'nocheckin' | 'checkpoint';

export interface DailyPlan {
  kind: PlanKind;
  title: string;
  loadLine: string;
  restLine: string;
  deload: boolean;
  light: boolean;
  canStart: boolean;
  dayTitle: string;
  week: number;
  cycle: number;
}
