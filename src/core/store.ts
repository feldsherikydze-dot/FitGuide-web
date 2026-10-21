// FitGuide Web — состояние приложения (порт ProgramGenerator / CoachStore /
// AssessmentStore / OneRmStore / ProfileStore / JournalStore / BodyLogStore)
//
// Всё в localStorage. Android-версия использует SharedPreferences с ключами —
// здесь те же данные, но в JSON по ключу на файл.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  Program, Session, Checkin, CoachState, UserProfile, Assessment, JournalEntry, BodyLogEntry,
} from '../data/types';
import { KEYS, getJSON, setJSON } from './storage';

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
      setProfile: (p) => { setJSON(KEYS.PROFILE, p); set({ profile: p }); },
      clearProfile: () => { setJSON(KEYS.PROFILE, null); set({ profile: null }); },
    }),
    { name: KEYS.PROFILE, storage: createJSONStorage(() => localStorage) }
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
      load: () => set({ programs: getJSON<Program[]>(KEYS.PROGRAMS, []) }),
      save: (programs) => { setJSON(KEYS.PROGRAMS, programs); set({ programs }); },
      add: (p) => get().save([...get().programs, p]),
      update: (p) => get().save(get().programs.map(x => (x.id === p.id ? p : x))),
      remove: (id) => get().save(get().programs.filter(x => x.id !== id)),
      getById: (id) => get().programs.find(x => x.id === id),
    }),
    {
      name: KEYS.PROGRAMS,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ programs: s.programs }),
    }
  )
);
useProgramsStore.getState().load();

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
};

interface CoachSlice extends CoachState {
  setActiveProgram: (id: string | null) => void;
  setPrevProgram: (id: string | null) => void;
  setCoachPath: (path: 'own' | 'coach') => void;
  setCoachProgram: (id: string | null) => void;
  setProgramPhase: (phase: string) => void;
  setProgramType: (type: string) => void;
  setCompPhase: (phase: string | null) => void;
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
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// ------------------------------------------------------------------ Оценки (Assessment)

interface AssessmentSlice {
  assessments: Assessment[];
  current: Assessment | null;
  addAssessment: (a: Assessment) => void;
  removeAssessment: (id: string) => void;
}

export const useAssessmentStore = create<AssessmentSlice>()(
  persist(
    (set, get) => ({
      assessments: getJSON<Assessment[]>(KEYS.ASSESSMENTS, []),
      get current() {
        const list = get().assessments;
        return list.length ? list[0] : null;
      },
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
    }),
    { name: KEYS.ASSESSMENTS, storage: createJSONStorage(() => localStorage) }
  )
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
      oneRms: getJSON<OneRm[]>(KEYS.ONE_RM, []),
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
        if (changed) {
          setJSON(KEYS.ONE_RM, list);
          set({ oneRms: list });
        }
      },
      remove: (exercise) => {
        const list = get().oneRms.filter(r => r.n.toLowerCase() !== exercise.toLowerCase());
        setJSON(KEYS.ONE_RM, list);
        set({ oneRms: list });
      },
      get: (exercise) => {
        if (!exercise) return 0;
        const found = get().oneRms.find(r => r.n.toLowerCase() === exercise.toLowerCase());
        return found ? found.v : 0;
      },
    }),
    { name: KEYS.ONE_RM, storage: createJSONStorage(() => localStorage) }
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
      entries: getJSON<JournalEntry[]>(KEYS.JOURNAL, []),
      addEntry: (e) => {
        const list = [e, ...get().entries];
        setJSON(KEYS.JOURNAL, list);
        set({ entries: list });
      },
      removeEntry: (id) => {
        const list = get().entries.filter(x => x.id !== id);
        setJSON(KEYS.JOURNAL, list);
        set({ entries: list });
      },
      updateEntry: (id, updates) => {
        const list = get().entries.map(x => (x.id === id ? { ...x, ...updates } : x));
        setJSON(KEYS.JOURNAL, list);
        set({ entries: list });
      },
    }),
    { name: KEYS.JOURNAL, storage: createJSONStorage(() => localStorage) }
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
      logs: getJSON<BodyLogEntry[]>(KEYS.BODYLOG, []),
      addLog: (l) => {
        const list = [l, ...get().logs];
        setJSON(KEYS.BODYLOG, list);
        set({ logs: list });
      },
      removeLog: (id) => {
        const list = get().logs.filter(x => x.id !== id);
        setJSON(KEYS.BODYLOG, list);
        set({ logs: list });
      },
    }),
    { name: KEYS.BODYLOG, storage: createJSONStorage(() => localStorage) }
  )
);

// ------------------------------------------------------------------ UI

interface UIState {
  theme: 'light' | 'dark' | 'system';
  setTheme: (t: 'light' | 'dark' | 'system') => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (t) => set({ theme: t }),
      sidebarOpen: false,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
    }),
    { name: KEYS.SETTINGS, storage: createJSONStorage(() => localStorage) }
  )
);
