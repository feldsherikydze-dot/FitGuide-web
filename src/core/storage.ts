// FitGuide Web — локальное хранилище (порт с SharedPreferences)

const PREFIX = 'fitguide_web_';

function key(name: string): string {
  return PREFIX + name;
}

export function getString(name: string, fallback: string = ''): string {
  try {
    return localStorage.getItem(key(name)) ?? fallback;
  } catch {
    return fallback;
  }
}

export function setString(name: string, value: string): void {
  try {
    localStorage.setItem(key(name), value);
  } catch {
    // ignore quota exceeded
  }
}

export function getJSON<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key(name));
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function setJSON<T>(name: string, value: T): void {
  try {
    localStorage.setItem(key(name), JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function remove(name: string): void {
  try {
    localStorage.removeItem(key(name));
  } catch {
    // ignore
  }
}

export function clearAll(): void {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(PREFIX));
    keys.forEach(k => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

// Keys
export const KEYS = {
  PROGRAMS: 'saved_programs',
  COACH: 'coach_state',
  PROFILE: 'user_profile',
  SETTINGS: 'settings',
  CACHE_EXERCISES: 'cache_exercises',
  CACHE_PICKER: 'cache_picker',
} as const;