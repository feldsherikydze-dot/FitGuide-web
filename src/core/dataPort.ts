// FitGuide Web — экспорт и импорт всех данных одним JSON-файлом.
//
// Зеркало Android DataPort.java. Всё состояние приложения лежит в
// localStorage под префиксом fitguide_web_ (см. core/storage.ts), поэтому
// резервная копия — это снимок этих ключей. Кэши упражнений и справочников
// не переносим: они восстанавливаются из сети и только раздувают файл.
//
// Формат (format = 1):
// {
//   "app": "FitGuide", "format": 1, "platform": "web",
//   "appVersion": "1.15.9", "exportedAt": 1763550000000,
//   "storage": { "user_profile": "<raw JSON>", "settings": "<raw JSON>" }
// }
// Значения — исходные строки localStorage, а не разобранный JSON: так
// импорт возвращает байт в байт то, что было сохранено, включая поля,
// которых текущая версия ещё не знает.
//
// Импорт принимает и файл Android-версии (platform="android"): его prefs
// конвертируются в ключи веба через core/crossPort.ts. Это и есть перенос
// Android ↔ веб: файл один и тот же, разбирает его принимающая сторона.

import { convertAndroidBackup } from './crossPort';

const PREFIX = 'fitguide_web_';
const APP = 'FitGuide';
export const FORMAT = 1;
const SAFETY_KEY = 'backup_before_import';
/** Разумный потолок файла резервной копии: защита от зависания и мусора. */
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
/** Имена, которые нельзя писать в localStorage даже с префиксом. */
const BAD_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
/** Восстановимые кэши: в файл не кладём. */
const SKIP = new Set([
  'cache_exercises',
  'cache_picker',
  SAFETY_KEY,
]);

/**
 * Данные пользователя: при импорте Android-файла заменяются всегда,
 * даже если в файле их нет (иначе старые тренировки смешаются с новыми).
 */
const DATA_KEYS = new Set([
  'user_profile',
  'saved_programs',
  'coach_state',
  'journal_entries',
  'assessments',
  'one_rm_manual',
  'pr_manual',
  'body_log',
  'kitchen_menu',
  'diary_entries',
]);

/** Тема из Android-файла применяется, но настройки веба (боковая панель) целы. */
function mergeWebSettings(incoming: string): string {
  try {
    const prevRaw = localStorage.getItem(PREFIX + 'settings');
    if (!prevRaw) return incoming;
    const prev = JSON.parse(prevRaw) as { state?: Record<string, unknown>; version?: number };
    const next = JSON.parse(incoming) as { state?: Record<string, unknown>; version?: number };
    if (!prev.state || !next.state) return incoming;
    const state = { ...prev.state, ...next.state };
    // sidebarOpen — состояние интерфейса веба, Android о нём не знает
    if ('sidebarOpen' in prev.state) state.sidebarOpen = prev.state.sidebarOpen;
    return JSON.stringify({
      state,
      version: Math.max(Number(prev.version) || 0, Number(next.version) || 0),
    });
  } catch {
    return incoming;
  }
}

export interface BackupInfo {
  platform: string;
  appVersion: string;
  exportedAt: number;
  keys: number;
}

export interface ImportResult {
  keys: number;
  /** Что перенесено и что осталось на платформе — для отчёта после импорта. */
  report: string[];
}

export function exportDataJson(): string {
  const storage: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const full = localStorage.key(i);
    if (!full || !full.startsWith(PREFIX)) continue;
    const name = full.slice(PREFIX.length);
    if (SKIP.has(name)) continue;
    const value = localStorage.getItem(full);
    if (value != null) storage[name] = value;
  }
  return JSON.stringify({
    app: APP,
    format: FORMAT,
    platform: 'web',
    appVersion: __APP_VERSION__,
    exportedAt: Date.now(),
    storage,
  }, null, 2);
}

export function inspectBackup(text: string): BackupInfo {
  if (typeof text !== 'string' || !text) throw new Error('empty');
  if (text.length > MAX_BACKUP_BYTES) throw new Error('too-big');
  const root = JSON.parse(text) as Record<string, unknown>;
  if (!root || typeof root !== 'object' || Array.isArray(root)) throw new Error('not-fitguide');
  if (root.app !== APP) throw new Error('not-fitguide');
  const format = Number(root.format);
  if (!Number.isFinite(format) || format < 1 || format > FORMAT) throw new Error('format');
  const platform = typeof root.platform === 'string' ? root.platform : 'web';
  if (platform !== 'web' && platform !== 'android') throw new Error('platform');

  let keys = 0;
  if (platform === 'android') {
    // Резервная копия Android: prefs-файлы → ключи хранилища. Для диалога
    // считаем по ключам prefs: ровно столько сущностей приедет после конвертера.
    const prefs = root.prefs;
    if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) throw new Error('prefs');
    keys = Object.keys(prefs as Record<string, unknown>).length;
  } else {
    const storage = root.storage;
    if (!storage || typeof storage !== 'object' || Array.isArray(storage)) throw new Error('storage');
    keys = Object.keys(storage as Record<string, unknown>)
      .filter(k => !SKIP.has(k) && !BAD_KEYS.has(k)
        && typeof (storage as Record<string, unknown>)[k] === 'string').length;
  }
  if (keys === 0) throw new Error('empty');
  return {
    platform,
    appVersion: typeof root.appVersion === 'string' ? root.appVersion : '?',
    exportedAt: Number(root.exportedAt) || 0,
    keys,
  };
}

/** Заменяет данные приложения. Перед заменой сохраняет копию «как было». */
export function importData(text: string): ImportResult {
  const info = inspectBackup(text);
  if (info.platform !== 'web' && info.platform !== 'android') throw new Error('platform');
  const root = JSON.parse(text) as Record<string, unknown>;

  // Точка возврата: снимок текущего состояния под отдельным ключом.
  try {
    localStorage.setItem(PREFIX + SAFETY_KEY, exportDataJson());
  } catch {
    // Переполнение хранилища не должно мешать импорту: данных и так мало.
  }

  const report: string[] = [];
  let storage: Record<string, string>;
  if (info.platform === 'android') {
    const converted = convertAndroidBackup(root);
    storage = converted.storage;
    report.push('Файл Android-версии — данные сконвертированы под веб.');
    report.push(...converted.report);
  } else {
    storage = (root.storage || {}) as Record<string, string>;
  }

  // Импорт заменяет данные, как в Android: старые ключи, которых нет в файле,
  // иначе остались бы (например, старые замеры) и смешались бы с новыми.
  // Кэши и точка возврата — не данные пользователя, их не трогаем.
  // Файл Android веб-настроек не содержит (палитра, заставка, часы, погода,
  // плеер), поэтому при таком импорте локальные настройки веба остаются:
  // иначе импорт Android-копии «перекрашивал» бы приложение и стирал свои фоны.
  const fromAndroid = info.platform === 'android';
  try {
    // localStorage перебираем через length/key: Object.keys по Storage
    // работает не во всех браузерах (Safari), а пропустить старые данные нельзя.
    const ours: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX) && !SKIP.has(k.slice(PREFIX.length))) ours.push(k);
    }
    ours.forEach((k) => {
      const name = k.slice(PREFIX.length);
      if (fromAndroid && !DATA_KEYS.has(name)) return;
      localStorage.removeItem(k);
    });
  } catch {
    // Хранилище недоступно — ниже всё равно попробуем записать.
  }

  let written = 0;
  try {
    for (const [name, raw] of Object.entries(storage)) {
      if (SKIP.has(name) || BAD_KEYS.has(name) || typeof raw !== 'string') continue;
      const value = name === 'settings' && fromAndroid ? mergeWebSettings(raw) : raw;
      localStorage.setItem(PREFIX + name, value);
      written++;
    }
  } catch {
    // Не оставляем полуимпорт: возвращаем снимок, снятый до замены.
    try { restoreSafetyBackup(); } catch { /* возврат недоступен */ }
    throw new Error('quota');
  }
  return { keys: written, report };
}

export function hasSafetyBackup(): boolean {
  try {
    return (localStorage.getItem(PREFIX + SAFETY_KEY) || '').length > 0;
  } catch {
    return false;
  }
}

export function restoreSafetyBackup(): number {
  const raw = localStorage.getItem(PREFIX + SAFETY_KEY);
  if (!raw) throw new Error('no-backup');
  const root = JSON.parse(raw) as { storage?: Record<string, string> };
  if (!root || typeof root !== 'object' || !root.storage || typeof root.storage !== 'object') {
    throw new Error('no-backup');
  }
  // Восстанавливаем снимок целиком: ключи, появившиеся после него, убираем,
  // иначе откат оставит смесь старых и новых данных.
  try {
    const ours: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX) && k.slice(PREFIX.length) !== SAFETY_KEY) ours.push(k);
    }
    ours.forEach(k => localStorage.removeItem(k));
  } catch {
    // Хранилище недоступно — ниже попробуем записать хотя бы снимок.
  }
  let written = 0;
  for (const [name, value] of Object.entries(root.storage)) {
    if (name === SAFETY_KEY || BAD_KEYS.has(name) || typeof value !== 'string') continue;
    localStorage.setItem(PREFIX + name, value);
    written++;
  }
  return written;
}

/** Имя файла по дате: fitguide-web-2026-11-19.json */
export function backupFileName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `fitguide-web-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}
