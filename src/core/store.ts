// FitGuide Web — глобальное состояние (Zustand)

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Program, Session, Checkin, CoachState, UserProfile, Exercise, GeneratorInput } from '../data/types';
import { KEYS, getJSON, setJSON } from './storage';

// --- Profile Store ---
interface ProfileState {
  profile: UserProfile | null;
  setProfile: (p: UserProfile) => void;
  clearProfile: () => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      profile: null,
      setProfile: (p) => set({ profile: p }),
      clearProfile: () => set({ profile: null }),
    }),
    {
      name: KEYS.PROFILE,
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// --- Programs Store ---
interface ProgramsState {
  programs: Program[];
  load: () => void;
  save: (programs: Program[]) => void;
  add: (p: Program) => void;
  update: (p: Program) => void;
  remove: (id: string) => void;
  getById: (id: string) => Program | undefined;
}

export const useProgramsStore = create<ProgramsState>()(
  persist(
    (set, get) => ({
      programs: [],
      load: () => {
        const data = getJSON<Program[]>(KEYS.PROGRAMS, []);
        set({ programs: data });
      },
      save: (programs) => {
        setJSON(KEYS.PROGRAMS, programs);
        set({ programs });
      },
      add: (p) => {
        const next = [...get().programs, p];
        get().save(next);
      },
      update: (p) => {
        const next = get().programs.map(x => x.id === p.id ? p : x);
        get().save(next);
      },
      remove: (id) => {
        const next = get().programs.filter(x => x.id !== id);
        get().save(next);
      },
      getById: (id) => get().programs.find(x => x.id === id),
    }),
    {
      name: KEYS.PROGRAMS + '_meta',
      storage: createJSONStorage(() => localStorage),
      partialize: () => ({}), // не сохраняем через zustand, используем свой load/save
    }
  )
);

// Инициализация при загрузке
useProgramsStore.getState().load();

// --- Coach Store ---
interface CoachStoreState extends CoachState {
  setActiveProgram: (id: string | null) => void;
  setCoachPath: (path: 'own' | 'coach') => void;
  setCoachProgram: (id: string | null) => void;
  addSession: (s: Session) => void;
  updateSession: (id: string, updates: Partial<Session>) => void;
  addCheckin: (c: Checkin) => void;
  setFeel: (sessionId: string, feel: 1 | 2 | 3) => void;
  toggleBanned: (exerciseId: string) => void;
  setLimit: (exerciseId: string, limit: { weight: number; reps: number } | null) => void;
  markProgramUpdated: (note: string) => void;
  clearProgramUpdated: () => void;
  resetCoach: () => void;
}

const initialCoachState: CoachState = {
  activeProgramId: null,
  activeSince: null,
  coachPath: 'own',
  coachProgramId: null,
  sessions: [],
  checkins: [],
  feels: {},
  banned: [],
  limits: {},
  programUpdated: false,
  programUpdatedNote: '',
  resetAt: null,
};

export const useCoachStore = create<CoachStoreState>()(
  persist(
    (set, get) => ({
      ...initialCoachState,
      setActiveProgram: (id) => set({ activeProgramId: id, activeSince: id ? Date.now() : null }),
      setCoachPath: (path) => set({ coachPath: path }),
      setCoachProgram: (id) => set({ coachProgramId: id }),
      addSession: (s) => set((state) => ({
        sessions: [s, ...state.sessions].slice(0, 600),
      })),
      updateSession: (id, updates) => set((state) => ({
        sessions: state.sessions.map(s => s.id === id ? { ...s, ...updates } : s),
      })),
      addCheckin: (c) => set((state) => ({
        checkins: [c, ...state.checkins].slice(0, 200),
      })),
      setFeel: (sessionId, feel) => set((state) => ({
        feels: { ...state.feels, [sessionId]: feel },
      })),
      toggleBanned: (exerciseId) => set((state) => ({
        banned: state.banned.includes(exerciseId)
          ? state.banned.filter(x => x !== exerciseId)
          : [...state.banned, exerciseId],
      })),
      setLimit: (exerciseId, limit) => set((state) => {
        const next = { ...state.limits };
        if (limit) next[exerciseId] = limit;
        else delete next[exerciseId];
        return { limits: next };
      }),
      markProgramUpdated: (note) => set({ programUpdated: true, programUpdatedNote: note }),
      clearProgramUpdated: () => set({ programUpdated: false, programUpdatedNote: '' }),
      resetCoach: () => set(initialCoachState),
    }),
    {
      name: KEYS.COACH,
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// --- UI Store ---
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
    {
      name: KEYS.SETTINGS,
      storage: createJSONStorage(() => localStorage),
    }
  )
);