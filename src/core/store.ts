// FitGuide Web — состояние приложения (порт ProgramGenerator / CoachStore /
// AssessmentStore / OneRmStore / ProfileStore / JournalStore / BodyLogStore)
//
// Всё в localStorage. Android-версия использует SharedPreferences с ключами —
// здесь те же данные, но в JSON по ключу на файл.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  Program, Session, Checkin, CoachState, UserProfile, Assessment, JournalEntry, BodyLogEntry, PrEntry,
} from '../data/types';
import { KEYS, getJSON, setJSON } from './storage';

// ------------------------------------------------------------------ Хранилище
//
// Раньше zustand persist писал под «сырым» именем (user_profile,
// saved_programs, coach_state, ...), а ручные getJSON/setJSON — под
// fitguide_web_*. Одни и те же данные лежали в двух копиях: они расходились
// при сбое записи, занимали место дважды, а на общем домене (github.io/user/)
// сырые имена ещё и пересекались с чужими приложениями. Теперь единственный
// источник правды — ключ с префиксом, как у остальных данных приложения.

const PREFIX = 'fitguide_web_';

const prefixedStateStorage = {
  getItem: (name: string) => localStorage.getItem(PREFIX + name),
  setItem: (name: string, value: string) => localStorage.setItem(PREFIX + name, value),
  removeItem: (name: string) => localStorage.removeItem(PREFIX + name),
};
const prefixedJSON = createJSONStorage(() => prefixedStateStorage);

/** Разбор конверта zustand persist: { state, version }. */
function readPersisted<T>(name: string, field: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + name);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const state = parsed && typeof parsed === 'object' && 'state' in parsed ? parsed.state : parsed;
    return state && field in state ? (state[field] as T) : null;
  } catch {
    return null;
  }
}

/**
 * Одноразовая миграция старых ключей в единый префиксный конверт.
 * Понимает оба старых формата: конверт persist ({state,version}) и сырое
 * значение, которое писали ручные setJSON.
 */
function migrateLegacy(storeKey: string, field: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const pref = PREFIX + storeKey;
    const prefRaw = localStorage.getItem(pref);
    const legacyRaw = localStorage.getItem(storeKey);
    const isEnvelope = (v: unknown): v is { state: unknown; version?: number } =>
      !!v && typeof v === 'object' && 'state' in (v as Record<string, unknown>);
    const parse = (raw: string | null): unknown => {
      try { return raw == null ? undefined : JSON.parse(raw); } catch { return undefined; }
    };
    const prefVal = parse(prefRaw);
    // Всё уже в новом формате и старых копий нет — делать нечего.
    if (isEnvelope(prefVal) && legacyRaw == null) return;
    const legacyVal = parse(legacyRaw);
    let state: unknown;
    if (isEnvelope(prefVal)) state = prefVal.state;
    else if (isEnvelope(legacyVal)) state = legacyVal.state;
    else if (prefVal !== undefined) state = field ? { [field]: prefVal } : prefVal;
    else if (legacyVal !== undefined) state = field ? { [field]: legacyVal } : legacyVal;
    else {
      if (legacyRaw != null) localStorage.removeItem(storeKey);
      return;
    }
    const version = isEnvelope(prefVal) && typeof prefVal.version === 'number' ? prefVal.version : 0;
    localStorage.setItem(pref, JSON.stringify({ state, version }));
    if (legacyRaw != null) localStorage.removeItem(storeKey);
  } catch {
    // Хранилище недоступно — стартуем с пустого состояния, как раньше.
  }
}

migrateLegacy('user_profile', 'profile');
migrateLegacy('saved_programs', 'programs');
migrateLegacy('coach_state', '');
migrateLegacy('one_rm_manual', 'oneRms');
migrateLegacy('journal_entries', 'entries');
migrateLegacy('pr_manual', 'prs');
migrateLegacy('body_log', 'logs');
migrateLegacy('settings', '');

// ------------------------------------------------------------------ Профиль

interface ProfileSlice {
  profile: UserProfile | null;
  setProfile: (p: UserProfile) => void;
  clearProfile: () => void;
}

export const useProfileStore = create<ProfileSlice>()(
  persist(
    (set) => ({
      profile: null,
      setProfile: (p) => set({ profile: p }),
      clearProfile: () => set({ profile: null }),
    }),
    { name: KEYS.PROFILE, storage: prefixedJSON }
  )
);

// ------------------------------------------------------------------ Программы

interface ProgramsSlice {
  programs: Program[];
  load: () => void;
  save: (programs: Program[]) => void;
  add: (p: Program) => void;
  update: (p: Program) => void;
  remove: (id: string) => void;
  getById: (id: string) => Program | undefined;
}

export const useProgramsStore = create<ProgramsSlice>()(
  persist(
    (set, get) => ({
      programs: [],
      load: () => {
        const saved = readPersisted<Program[]>(KEYS.PROGRAMS, 'programs');
        if (saved) set({ programs: saved });
      },
      save: (programs) => set({ programs }),
      add: (p) => get().save([...get().programs, p]),
      update: (p) => get().save(get().programs.map(x => (x.id === p.id ? p : x))),
      remove: (id) => get().save(get().programs.filter(x => x.id !== id)),
      getById: (id) => get().programs.find(x => x.id === id),
    }),
    {
      name: KEYS.PROGRAMS,
      storage: prefixedJSON,
      partialize: (s) => ({ programs: s.programs }),
    }
  )
);

// ------------------------------------------------------------------ Тренер

const initialCoachState: CoachState = {
  activeProgramId: null,
  prevProgramId: null,
  activeSince: null,
  coachPath: 'own',
  coachProgramId: null,
  programPhase: '',
  programType: 'auto',
  sessions: [],
  checkins: [],
  feels: {},
  banned: [],
  limits: {},
  programUpdated: false,
  programUpdatedNote: '',
  resetAt: null,
  compPhase: null,
  compDate: null,
  compCategory: '',
  restrictions: [],
};

interface CoachSlice extends CoachState {
  setActiveProgram: (id: string | null) => void;
  setPrevProgram: (id: string | null) => void;
  setCoachPath: (path: 'own' | 'coach') => void;
  setCoachProgram: (id: string | null) => void;
  setProgramPhase: (phase: string) => void;
  setProgramType: (type: string) => void;
  setCompPhase: (phase: string | null) => void;
  setCompDate: (ts: number | null) => void;
  setCompCategory: (key: string) => void;
  setRestrictions: (list: string[]) => void;
  addSession: (s: Session) => void;
  updateSession: (id: string, updates: Partial<Session>) => void;
  removeSession: (id: string) => void;
  setFeel: (ts: number, feel: 1 | 2 | 3) => void;
  saveCheckin: (c: Checkin) => void;
  toggleBanned: (exerciseId: string) => void;
  setLimit: (exerciseId: string, limit: { weight: number; reps: number } | null) => void;
  markProgramUpdated: (note: string) => void;
  clearProgramUpdated: () => void;
  resetCoach: () => void;
}

export const useCoachStore = create<CoachSlice>()(
  persist(
    (set, get) => ({
      ...initialCoachState,
      setActiveProgram: (id) => set({ activeProgramId: id, activeSince: id ? Date.now() : null }),
      setPrevProgram: (id) => set({ prevProgramId: id }),
      setCoachPath: (path) => set({ coachPath: path }),
      setCoachProgram: (id) => set({ coachProgramId: id }),
      setProgramPhase: (phase) => set({ programPhase: phase }),
      setProgramType: (type) => set({ programType: type }),
      setCompPhase: (phase) => set({ compPhase: phase }),
      setCompDate: (ts) => set({ compDate: ts && ts > 0 ? ts : null }),
      setCompCategory: (key) => set({ compCategory: key }),
      setRestrictions: (list) => set({ restrictions: list }),
      addSession: (s) => set((st) => ({ sessions: [s, ...st.sessions].slice(0, 600) })),
      updateSession: (id, updates) => set((st) => ({
        sessions: st.sessions.map(s => (s.id === id ? { ...s, ...updates } : s)),
      })),
      removeSession: (id) => set((st) => ({ sessions: st.sessions.filter(s => s.id !== id) })),
      setFeel: (ts, feel) => set((st) => ({ feels: { ...st.feels, [String(ts)]: feel } })),
      saveCheckin: (c) => set((st) => {
        // отметка одна на день — перезаписываем
        const rest = st.checkins.filter(x => x.day !== c.day);
        return { checkins: [c, ...rest].slice(0, 200) };
      }),
      toggleBanned: (exerciseId) => set((st) => ({
        banned: st.banned.includes(exerciseId)
          ? st.banned.filter(x => x !== exerciseId)
          : [...st.banned, exerciseId],
      })),
      setLimit: (exerciseId, limit) => set((st) => {
        const next = { ...st.limits };
        if (limit) next[exerciseId] = limit;
        else delete next[exerciseId];
        return { limits: next };
      }),
      markProgramUpdated: (note) => set({ programUpdated: true, programUpdatedNote: note }),
      clearProgramUpdated: () => set({ programUpdated: false, programUpdatedNote: '' }),
      resetCoach: () => set({ ...initialCoachState }),
    }),
    {
      name: KEYS.COACH,
      storage: prefixedJSON,
    }
  )
);

// ------------------------------------------------------------------ Оценки (Assessment)

interface AssessmentSlice {
  assessments: Assessment[];
  addAssessment: (a: Assessment) => void;
  removeAssessment: (id: string) => void;
}

export const useAssessmentStore = create<AssessmentSlice>()(
  (set, get) => ({
    assessments: getJSON<Assessment[]>(KEYS.ASSESSMENTS, []),
    addAssessment: (a) => {
      const list = [a, ...get().assessments];
      setJSON(KEYS.ASSESSMENTS, list);
      set({ assessments: list });
    },
    removeAssessment: (id) => {
      const list = get().assessments.filter(x => x.id !== id);
      setJSON(KEYS.ASSESSMENTS, list);
      set({ assessments: list });
    },
  })
);

// ------------------------------------------------------------------ 1ПМ (OneRmStore)

export interface OneRm { n: string; v: number; d: number }

interface OneRmSlice {
  oneRms: OneRm[];
  put: (exercise: string, value: number) => void;
  putAll: (values: Record<string, number>) => void;
  remove: (exercise: string) => void;
  get: (exercise: string) => number;
}

export const useOneRmStore = create<OneRmSlice>()(
  persist(
    (set, get) => ({
      oneRms: [],
      put: (exercise, value) => get().putAll({ [exercise]: value }),
      putAll: (values) => {
        const list = [...get().oneRms];
        const now = Date.now();
        let changed = false;
        for (const [exercise, value] of Object.entries(values)) {
          if (!exercise || value <= 0) continue;
          const found = list.find(r => r.n.toLowerCase() === exercise.toLowerCase());
          if (found) {
            found.n = exercise; found.v = value; found.d = now;
          } else {
            list.push({ n: exercise, v: value, d: now });
          }
          changed = true;
        }
        if (changed) set({ oneRms: list });
      },
      remove: (exercise) => {
        set({ oneRms: get().oneRms.filter(r => r.n.toLowerCase() !== exercise.toLowerCase()) });
      },
      get: (exercise) => {
        if (!exercise) return 0;
        const found = get().oneRms.find(r => r.n.toLowerCase() === exercise.toLowerCase());
        return found ? found.v : 0;
      },
    }),
    { name: KEYS.ONE_RM, storage: prefixedJSON }
  )
);

// ------------------------------------------------------------------ Дневник (JournalStore)

interface JournalSlice {
  entries: JournalEntry[];
  addEntry: (e: JournalEntry) => void;
  removeEntry: (id: string) => void;
  updateEntry: (id: string, updates: Partial<JournalEntry>) => void;
}

export const useJournalStore = create<JournalSlice>()(
  persist(
    (set, get) => ({
      entries: [],
      addEntry: (e) => set({ entries: [e, ...get().entries] }),
      removeEntry: (id) => set({ entries: get().entries.filter(x => x.id !== id) }),
      updateEntry: (id, updates) => set({
        entries: get().entries.map(x => (x.id === id ? { ...x, ...updates } : x)),
      }),
    }),
    { name: KEYS.JOURNAL, storage: prefixedJSON }
  )
);

// ------------------------------------------------------------------ Ручные рекорды (PrStore)

interface PrSlice {
  prs: PrEntry[];
  add: (p: PrEntry) => void;
  remove: (exercise: string) => void;
  best: (exercise: string) => PrEntry | null;
}

export const usePrStore = create<PrSlice>()(
  persist(
    (set, get) => ({
      prs: [],
      add: (p) => set({ prs: [p, ...get().prs].slice(0, 500) }),
      remove: (exercise) => set({
        prs: get().prs.filter(x => x.name.toLowerCase() !== exercise.toLowerCase()),
      }),
      best: (exercise) => {
        const list = get().prs.filter(x => x.name.toLowerCase() === exercise.toLowerCase());
        if (!list.length) return null;
        return list.reduce((a, b) => (b.weight * (1 + b.reps / 30) > a.weight * (1 + a.reps / 30) ? b : a));
      },
    }),
    { name: KEYS.PR, storage: prefixedJSON }
  )
);

// ------------------------------------------------------------------ Замеры тела (BodyLogStore)

interface BodyLogSlice {
  logs: BodyLogEntry[];
  addLog: (l: BodyLogEntry) => void;
  removeLog: (id: string) => void;
}

export const useBodyLogStore = create<BodyLogSlice>()(
  persist(
    (set, get) => ({
      logs: [],
      addLog: (l) => set({ logs: [l, ...get().logs] }),
      removeLog: (id) => set({ logs: get().logs.filter(x => x.id !== id) }),
    }),
    { name: KEYS.BODYLOG, storage: prefixedJSON }
  )
);

// ------------------------------------------------------------------ UI

const THEME_BG: Record<'light' | 'dark', string> = {
  light: '#F5F8F6',
  dark: '#0D0F11',
};

function systemTheme(): 'light' | 'dark' {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Красит «борды» PWA-окна (верхнюю/нижнюю полосы, статус-бар, фон overscroll)
 * в цвет выбранной темы — как statusBar/navigationBar в Android.
 */
function syncBrowserChrome(t: 'light' | 'dark' | 'system') {
  const resolved = t === 'system' ? systemTheme() : t;
  const bg = THEME_BG[resolved];
  const root = document.documentElement;
  root.style.backgroundColor = bg;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', bg);
  const scheme = document.querySelector('meta[name="color-scheme"]');
  if (scheme) scheme.setAttribute('content', resolved);
}

function applyTheme(t: 'light' | 'dark' | 'system') {
  const root = document.documentElement;
  if (t === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', t);
  }
  syncBrowserChrome(t);
}

interface UIState {
  theme: 'light' | 'dark' | 'system';
  setTheme: (t: 'light' | 'dark' | 'system') => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // Android 1.18: при первом запуске SplashActivity пишет theme=dark.
      theme: 'dark',
      setTheme: (t) => {
        set({ theme: t });
        applyTheme(t);
      },
      sidebarOpen: false,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
    }),
    { name: KEYS.SETTINGS, storage: prefixedJSON, version: 2,
      migrate: (persisted: any, version: number) => {
        // До v2 веб по умолчанию использовал «Как в системе». Android 1.18
        // при первом запуске ставит тёмную — выравниваем существующие профили.
        if (version < 2 && persisted && (!persisted.theme || persisted.theme === 'system')) {
          persisted.theme = 'dark';
        }
        return persisted;
      },
    }
  )
);

// Apply theme on load (дефолт — тёмная, как в Android 1.18)
if (typeof window !== 'undefined') {
  let initial: 'light' | 'dark' | 'system' = 'dark';
  const stored = localStorage.getItem(PREFIX + KEYS.SETTINGS);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.state?.theme) initial = parsed.state.theme;
    } catch {}
  }
  applyTheme(initial);

  // «Как в системе»: полосы окна должны перекрашиваться вместе с системной темой.
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
  mq?.addEventListener?.('change', () => {
    if (useUIStore.getState().theme === 'system') syncBrowserChrome('system');
  });
}
