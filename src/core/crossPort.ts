// FitGuide Web — конвертер резервной копии Android в хранилище веба.
//
// Android пишет SharedPreferences: файлы prefs → ключи с типом {t,v}
// (см. DataPort.java). Веб хранит всё в localStorage под fitguide_web_*:
// состояние zustand — конвертом {state,version}, остальное — сырым JSON.
// Импорт файла с platform="android" идёт через этот модуль: сущности
// переводятся по одной, а не подменяются чужие ключи.
//
// Что переносится: профиль, программы, тренер (активная программа, история
// тренировок, отметки самочувствия, «не предлагать», ограничения), дневник
// тренировок, оценки, 1ПМ, ручные рекорды, замеры тела, меню кухни, дневник
// питания и тема. Что остаётся на платформе — плеер, погода, вода, палитра:
// в другой версии этим просто нечего сопоставить.

import type {
  Assessment, BodyLogEntry, CoachState, JournalEntry, Program, PrEntry, Session, SessionItem, UserProfile,
} from '../data/types';
import type { OneRm } from './store';

export interface TransferResult {
  storage: Record<string, string>;
  report: string[];
}

type Encoded = { t?: string; v?: unknown };
type Prefs = Record<string, Record<string, Encoded>>;

const envelope = (state: unknown, version = 0) => JSON.stringify({ state, version });

function file(prefs: Prefs, name: string): Record<string, Encoded> {
  return prefs[name] || {};
}

function raw(g: Record<string, Encoded>, key: string): unknown {
  return g[key] ? g[key].v : undefined;
}

function str(g: Record<string, Encoded>, key: string, fallback = ''): string {
  const v = raw(g, key);
  return typeof v === 'string' ? v : fallback;
}

function num(g: Record<string, Encoded>, key: string, fallback = 0): number {
  const v = raw(g, key);
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function bool(g: Record<string, Encoded>, key: string): boolean {
  return raw(g, key) === true;
}

/** Значение-строка, внутри которой лежит JSON (так Android хранит списки). */
function parsed(g: Record<string, Encoded>, key: string): unknown {
  const v = raw(g, key);
  if (typeof v !== 'string' || !v) return undefined;
  try {
    return JSON.parse(v);
  } catch {
    return undefined;
  }
}

function list<T>(g: Record<string, Encoded>, key: string): T[] {
  const v = parsed(g, key);
  return Array.isArray(v) ? (v as T[]) : [];
}

function object(g: Record<string, Encoded>, key: string): Record<string, unknown> {
  const v = parsed(g, key);
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

// ------------------------------------------------------------------ профиль

function convertProfile(g: Record<string, Encoded>): UserProfile | null {
  const known = ['profile_name', 'profile_gender', 'profile_age', 'profile_height', 'profile_weight', 'profile_goal'];
  if (!known.some(k => k in g)) return null;
  const equipment = Array.isArray(raw(g, 'gym_equipment'))
    ? (raw(g, 'gym_equipment') as unknown[]).map(String)
    : [];
  return {
    name: str(g, 'profile_name'),
    gender: str(g, 'profile_gender'),
    age: Math.round(num(g, 'profile_age')),
    heightCm: Math.round(num(g, 'profile_height')),
    weightKg: num(g, 'profile_weight'),
    activityLevel: str(g, 'profile_activity', 'sedentary'),
    goal: str(g, 'profile_goal', 'maintain'),
    trainStyle: str(g, 'profile_style', 'any'),
    bodyFatPercent: num(g, 'profile_bodyfat'),
    workoutsPerWeek: Math.round(num(g, 'profile_workouts')),
    bio: str(g, 'profile_bio'),
    country: str(g, 'profile_country'),
    city: str(g, 'profile_city'),
    level: str(g, 'profile_level'),
    equipment,
    place: 'gym',
    trainingEmphasis: str(g, 'profile_emphasis', 'auto'),
    focusMuscles: str(g, 'profile_focus'),
    lifeStage: str(g, 'profile_life_stage', 'none'),
    lastPeriodDate: num(g, 'profile_last_period'),
    cycleLength: Math.round(num(g, 'profile_cycle_length', 28)) || 28,
  };
}

// ------------------------------------------------------------------ тренер

function convertSessions(g: Record<string, Encoded>): Session[] {
  return list<Record<string, unknown>>(g, 'sessions').map((s) => {
    const ts = Number(s.ts) || 0;
    const items: SessionItem[] = (Array.isArray(s.items) ? s.items : []).map((it: Record<string, unknown>) => {
      const item: SessionItem = {
        exercise: String(it.exercise || ''),
        weightKg: Number(it.weight) || 0,
        reps: Number(it.reps) || 0,
        sets: Number(it.sets) || 0,
        targetSets: Number(it.targetSets) || 0,
      };
      const feel = Number(it.feel) || 0;
      if (feel > 0) item.feel = feel as 1 | 2 | 3;
      if (Array.isArray(it.sf) && it.sf.length) {
        const sf = it.sf.map(Number).filter(v => v >= 1 && v <= 3) as (1 | 2 | 3)[];
        if (sf.length) item.setFeels = sf;
      }
      if (Array.isArray(it.sr) && it.sr.length) {
        item.setReps = it.sr.map(Number).filter(v => v > 0);
      }
      return item;
    });
    const session: Session = {
      id: `s${ts}`,
      programId: String(s.programId || ''),
      week: Number(s.week) || 0,
      dayTitle: String(s.dayTitle || ''),
      ts,
      items,
    };
    const feel = Number(s.feel) || 0;
    if (feel > 0) session.feel = feel as 1 | 2 | 3;
    if (s.adjusted) session.adjusted = true;
    if (Number(s.durationSec) > 0) session.durationSec = Number(s.durationSec);
    return session;
  });
}

function convertCoach(g: Record<string, Encoded>): CoachState {
  const active = str(g, 'active_program_id');
  const since = num(g, 'active_since');
  const reset = num(g, 'reset_at');
  const comp = num(g, 'comp_date');
  const feelsRaw = object(g, 'feels');
  const feels: Record<string, number> = {};
  for (const [k, v] of Object.entries(feelsRaw)) {
    const n = Number(v);
    if (n > 0) feels[k] = n;
  }
  return {
    activeProgramId: active || null,
    prevProgramId: str(g, 'plan_prev_id') || null,
    activeSince: since > 0 ? since : null,
    coachPath: str(g, 'coach_path', 'own') === 'coach' ? 'coach' : 'own',
    coachProgramId: str(g, 'coach_program_id') || null,
    programPhase: str(g, 'plan_phase'),
    programType: str(g, 'program_type', 'auto'),
    sessions: convertSessions(g),
    checkins: list<Record<string, unknown>>(g, 'checkins').map(c => ({
      day: String(c.day || ''),
      sleep: Number(c.sleep) || 0,
      sore: Number(c.sore) || 0,
      energy: Number(c.energy) || 0,
    })),
    feels,
    banned: list<unknown>(g, 'banned').map(String),
    limits: {},
    programUpdated: bool(g, 'program_updated'),
    programUpdatedNote: str(g, 'program_updated_note'),
    resetAt: reset > 0 ? reset : null,
    compPhase: null,
    compDate: comp > 0 ? comp : null,
    compCategory: str(g, 'comp_category'),
    restrictions: list<unknown>(g, 'limits').map(String),
  };
}

// ------------------------------------------------------------------ прочее

function convertJournal(g: Record<string, Encoded>): JournalEntry[] {
  return list<Record<string, unknown>>(g, 'journal').map((e, i) => {
    const id = String(e.id || e.date || i);
    return {
      id,
      date: Number(e.date) || 0,
      title: String(e.title || ''),
      text: '',
      items: (Array.isArray(e.items) ? e.items : []).map((it: Record<string, unknown>) => ({
        exercise: String(it.exercise || ''),
        weightKg: Number(it.weightKg) || 0,
        reps: Number(it.reps) || 0,
      })),
    };
  });
}

const MOVEMENT_KEYS = ['mSq', 'mHi', 'mLu', 'mPh', 'mPv', 'mRh', 'mRv', 'mCa'] as const;
const E1RM_KEYS = ['eSq', 'eBe', 'eDl', 'eOhp', 'eRow', 'ePu', 'eLp', 'eHt'] as const;
const START_KEYS = ['sSq', 'sBe', 'sDl', 'sOhp', 'sRow', 'sLp', 'sHt'] as const;
const AMRAP_KEYS = ['aSq', 'aBe', 'aRow', 'aOhp'] as const;
const SKINFOLD_KEYS = [
  'skChest', 'skAx', 'skTri', 'skSub', 'skAbd', 'skSup', 'skThigh',
] as const;

function convertAssessment(o: Record<string, unknown>, profile: UserProfile | null, index: number): Assessment {
  const n = (k: string) => Number(o[k]) || 0;
  return {
    id: `a${n('ts') || index}`,
    timestamp: n('ts') || 0,
    weightKg: n('weightKg'),
    heightCm: n('heightCm'),
    age: profile ? profile.age : 0,
    female: profile ? profile.gender === 'female' : false,
    bodyFatPct: n('bodyFatPct'),
    leanMassKg: n('leanMassKg'),
    ffmi: n('ffmi'),
    neckCm: n('neckCm'),
    shouldersCm: n('shouldersCm'),
    chestCm: n('chestCm'),
    waistCm: n('waistCm'),
    abdomenCm: n('abdomenCm'),
    hipsCm: n('hipsCm'),
    armCm: n('upperArmCm'),
    thighCm: n('thighCm'),
    calfCm: n('calfCm'),
    ankleCm: n('ankleCm'),
    forearmCm: n('forearmCm'),
    scapulaCm: n('scapulaCm'),
    skinfoldChest: n(SKINFOLD_KEYS[0]),
    skinfoldMidaxillary: n(SKINFOLD_KEYS[1]),
    skinfoldTriceps: n(SKINFOLD_KEYS[2]),
    skinfoldSubscapular: n(SKINFOLD_KEYS[3]),
    skinfoldAbdominal: n(SKINFOLD_KEYS[4]),
    skinfoldSuprailiac: n(SKINFOLD_KEYS[5]),
    skinfoldThigh: n(SKINFOLD_KEYS[6]),
    e1rmSquat: n(E1RM_KEYS[0]),
    e1rmBench: n(E1RM_KEYS[1]),
    e1rmDeadlift: n(E1RM_KEYS[2]),
    e1rmOHP: n(E1RM_KEYS[3]),
    e1rmRow: n(E1RM_KEYS[4]),
    e1rmPullup: n(E1RM_KEYS[5]),
    e1rmLegPress: n(E1RM_KEYS[6]),
    e1rmHipThrust: n(E1RM_KEYS[7]),
    startSquat: n(START_KEYS[0]),
    startBench: n(START_KEYS[1]),
    startDeadlift: n(START_KEYS[2]),
    startOHP: n(START_KEYS[3]),
    startRow: n(START_KEYS[4]),
    startLegPress: n(START_KEYS[5]),
    startHipThrust: n(START_KEYS[6]),
    movementScores: MOVEMENT_KEYS.map(k => n(k)),
    testWeights: [],
    testReps: [],
    amrap: AMRAP_KEYS.map(k => n(k)),
    pain: n('pain'),
    mmc: n('mmc'),
    tech: n('tech'),
  };
}

function convertAssessments(assess: Record<string, Encoded>, profile: UserProfile | null): Assessment[] {
  let items = list<Record<string, unknown>>(assess, 'assessment_history');
  if (!items.length) {
    const current = parsed(assess, 'current_assessment');
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      items = [current as Record<string, unknown>];
    }
  }
  return items.map((o, i) => convertAssessment(o, profile, i));
}

function convertOneRm(g: Record<string, Encoded>): OneRm[] {
  return list<Record<string, unknown>>(g, 'one_rm_manual')
    .map(r => ({ n: String(r.n || ''), v: Number(r.v) || 0, d: Number(r.d) || 0 }))
    .filter(r => r.n && r.v > 0);
}

function convertPrs(g: Record<string, Encoded>): PrEntry[] {
  return list<Record<string, unknown>>(g, 'pr_manual')
    .map(p => ({
      name: String(p.n || ''),
      weight: Number(p.w) || 0,
      reps: Number(p.r) || 0,
      date: Number(p.d) || 0,
    }))
    .filter(p => p.name && p.weight > 0 && p.reps > 0);
}

function convertBodyLog(g: Record<string, Encoded>): BodyLogEntry[] {
  return list<Record<string, unknown>>(g, 'body_log').map((b, i) => ({
    id: String(b.id || b.date || i),
    date: Number(b.date) || 0,
    weightKg: Number(b.weightKg) || 0,
    chestCm: Number(b.chestCm) || 0,
    waistCm: Number(b.waistCm) || 0,
    bicepsCm: Number(b.bicepsCm) || 0,
    hipsCm: Number(b.hipsCm) || 0,
    thighCm: Number(b.thighCm) || 0,
  }));
}

function convertKitchen(g: Record<string, Encoded>): unknown[] {
  return list<Record<string, unknown>>(g, 'kitchen_menu').map(day => ({
    name: String(day.name || ''),
    meals: (Array.isArray(day.meals) ? day.meals : []).map((m: Record<string, unknown>) => ({
      title: String(m.title || ''),
      dishes: (Array.isArray(m.dishes) ? m.dishes : []).map((d: Record<string, unknown>) => ({
        name: String(d.n || ''),
        kcal: Number(d.k) || 0,
        p: Number(d.p) || 0,
        f: Number(d.f) || 0,
        c: Number(d.c) || 0,
        portion: Number(d.pt) || 1,
      })),
    })),
  }));
}

function convertDiary(g: Record<string, Encoded>): unknown[] {
  return list<Record<string, unknown>>(g, 'food_diary').map((e, i) => {
    const ts = Number(e.t) || 0;
    return {
      id: `d${ts || i}`,
      ts,
      day: String(e.d || ''),
      meal: String(e.m || ''),
      name: String(e.n || ''),
      kcal: Number(e.k) || 0,
      protein: Number(e.p) || 0,
      fat: Number(e.f) || 0,
      carbs: Number(e.c) || 0,
    };
  });
}

// ------------------------------------------------------------------ сборка

export function convertAndroidBackup(root: unknown): TransferResult {
  const backup = root as { prefs?: Prefs };
  const prefs = backup.prefs || {};
  const g = file(prefs, 'fitguide');
  const coachPrefs = file(prefs, 'fitguide_coach');
  const assessPrefs = file(prefs, 'fitguide_assess');

  const storage: Record<string, string> = {};
  const done: string[] = [];
  const skipped: string[] = [];

  const profile = convertProfile(g);
  if (profile) {
    storage.user_profile = envelope({ profile });
    done.push('профиль');
  }

  const programs = list<Program>(g, 'saved_programs');
  if (programs.length) {
    storage.saved_programs = envelope({ programs });
    done.push(`программы: ${programs.length}`);
  }

  if (Object.keys(coachPrefs).length) {
    const coach = convertCoach(coachPrefs);
    const sessions = coach.sessions.length;
    const checkins = coach.checkins.length;
    if (sessions || checkins || coach.activeProgramId) {
      storage.coach_state = envelope(coach);
      const bits = [sessions ? `тренировки ${sessions}` : '', checkins ? `отметки ${checkins}` : '']
        .filter(Boolean).join(', ');
      done.push(bits ? `тренер: ${bits}` : 'тренер: состояние');
    }
    if (Object.keys(object(coachPrefs, 'limits')).length) {
      skipped.push('ограничения по весам: в Android их нет');
    }
  }

  const journal = convertJournal(g);
  if (journal.length) {
    storage.journal_entries = envelope({ entries: journal });
    done.push(`дневник тренировок: ${journal.length}`);
    skipped.push('подходы в дневнике тренировок: веб-дневник их не хранит');
  }

  const assessments = convertAssessments(assessPrefs, profile);
  if (assessments.length) {
    storage.assessments = JSON.stringify(assessments);
    done.push(`оценки: ${assessments.length}`);
  }

  const oneRms = convertOneRm(g);
  if (oneRms.length) {
    storage.one_rm_manual = envelope({ oneRms });
    done.push(`1ПМ: ${oneRms.length}`);
  }

  const prs = convertPrs(g);
  if (prs.length) {
    storage.pr_manual = envelope({ prs });
    done.push(`рекорды: ${prs.length}`);
  }

  const bodyLog = convertBodyLog(g);
  if (bodyLog.length) {
    storage.body_log = envelope({ logs: bodyLog });
    done.push(`замеры тела: ${bodyLog.length}`);
  }

  const menu = convertKitchen(g);
  if (menu.length) {
    storage.kitchen_menu = JSON.stringify(menu);
    done.push(`кухня: меню на ${menu.length} дн.`);
  }

  const diary = convertDiary(g);
  if (diary.length) {
    storage.diary_entries = JSON.stringify(diary);
    done.push(`дневник питания: ${diary.length}`);
  }

  const theme = str(g, 'theme');
  if (theme === 'light' || theme === 'dark') {
    storage.settings = envelope({ theme, sidebarOpen: false }, 2);
    done.push(`тема: ${theme === 'dark' ? 'тёмная' : 'светлая'}`);
  }

  skipped.push('плеер, погода, вода, часы: в вебе этого нет');
  skipped.push('палитра и заставка: у платформ разные настройки');

  const report = [...(done.length ? ['Перенесено:', ...done.map(x => `• ${x}`)] : ['Перенесено: ничего']),
    ...(skipped.length ? ['', 'Не переносится:', ...skipped.map(x => `• ${x}`)] : [])];
  return { storage, report };
}
