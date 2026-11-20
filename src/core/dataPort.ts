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
/** Восстановимые кэши: в файл не кладём. */
const SKIP = new Set([
  'cache_exercises',
  'cache_picker',
  SAFETY_KEY,
]);

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
  const root = JSON.parse(text) as Record<string, unknown>;
  if (root.app !== APP) throw new Error('not-fitguide');
  const format = Number(root.format);
  if (!Number.isFinite(format) || format < 1 || format > FORMAT) throw new Error('format');
  const platform = typeof root.platform === 'string' ? root.platform : 'web';

  let keys = 0;
  if (platform === 'android') {
    // Резервная копия Android: prefs-файлы → ключи хранилища. Для диалога
    // считаем по ключам prefs: ровно столько сущностей приедет после конвертера.
    const prefs = root.prefs;
    if (!prefs || typeof prefs !== 'object') throw new Error('prefs');
    keys = Object.keys(prefs as Record<string, unknown>).length;
  } else {
    const storage = root.storage;
    if (!storage || typeof storage !== 'object') throw new Error('storage');
    keys = Object.keys(storage as Record<string, unknown>).filter(k => !SKIP.has(k)).length;
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
  try {
    const ours = Object.keys(localStorage).filter(
      k => k.startsWith(PREFIX) && !SKIP.has(k.slice(PREFIX.length)),
    );
    ours.forEach(k => localStorage.removeItem(k));
  } catch {
    // Хранилище недоступно — ниже всё равно попробуем записать.
  }

  let written = 0;
  for (const [name, raw] of Object.entries(storage)) {
    if (SKIP.has(name) || typeof raw !== 'string') continue;
    localStorage.setItem(PREFIX + name, raw);
    written++;
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
  const root = JSON.parse(raw) as { storage: Record<string, string> };
  let written = 0;
  for (const [name, value] of Object.entries(root.storage || {})) {
    if (name === SAFETY_KEY || typeof value !== 'string') continue;
    localStorage.setItem(PREFIX + name, value);
    written++;
  }
  return written;
}

/** Имя файла по дате: fitguide-backup-2026-11-19.json */
export function backupFileName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `fitguide-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}
