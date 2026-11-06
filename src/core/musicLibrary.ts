// FitGuide Web — своя музыка в IndexedDB.
//
// В Android «Моя музыка» читает MediaStore и умеет досканировать телефон.
// В браузере доступа к файловой системе нет, поэтому:
//   • «Добавить треки» — выбор файлов;
//   • «Найти всё» — выбор папки (File System Access API) или каталога
//     через <input webkitdirectory>, после чего аудиофайлы сохраняются в
//     IndexedDB и переживают перезагрузку страницы.
//
// Метаданные ID3 браузер без библиотеки не отдаёт, поэтому название и
// исполнитель разбираются из имени файла («Artist - Title.mp3»).

const DB_NAME = 'fitguide_music';
const DB_VERSION = 1;
const STORE = 'tracks';

export interface LocalRecord {
  key: string;
  title: string;
  artist: string;
  fileName: string;
  blob: Blob;
  durationMs: number;
  addedAt: number;
  size: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB недоступен'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' });
        store.createIndex('addedAt', 'addedAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Не удалось открыть хранилище'));
  });
  return dbPromise;
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Ошибка хранилища'));
    tx.onabort = () => reject(tx.error || new Error('Операция отменена'));
  });
}

export async function listLocalRecords(): Promise<LocalRecord[]> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  const req = tx.objectStore(STORE).getAll();
  const rows = await new Promise<LocalRecord[]>((resolve, reject) => {
    req.onsuccess = () => resolve((req.result || []) as LocalRecord[]);
    req.onerror = () => reject(req.error);
  });
  return rows.sort((a, b) => b.addedAt - a.addedAt);
}

export async function getLocalBlob(key: string): Promise<Blob | null> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  const req = tx.objectStore(STORE).get(key);
  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      const row = req.result as LocalRecord | undefined;
      resolve(row?.blob || null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteLocalRecord(key: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(key);
  await txDone(tx);
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function localKeyFor(file: File): string {
  return `l_${hash(`${file.name}|${file.size}|${file.lastModified}`)}`;
}

const AUDIO_RE = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm|weba|mp4|3gp)$/i;

export function isAudioFile(file: File): boolean {
  if (file.type && file.type.startsWith('audio/')) return true;
  if (file.type === 'video/mp4' || file.type === 'video/webm') return true;
  return AUDIO_RE.test(file.name);
}

function parseName(fileName: string): { title: string; artist: string } {
  let base = fileName.replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim();
  base = base.replace(/\s+/g, ' ');
  const m = base.match(/^(.{1,60}?)\s+-\s+(.{1,120})$/);
  if (m) return { artist: m[1].trim(), title: m[2].trim() };
  return { title: base || fileName, artist: '' };
}

function probeDuration(blob: Blob): Promise<number> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    const audio = document.createElement('audio');
    let done = false;
    const finish = (ms: number) => {
      if (done) return;
      done = true;
      audio.removeAttribute('src');
      audio.load();
      URL.revokeObjectURL(url);
      resolve(ms);
    };
    const timer = window.setTimeout(() => finish(0), 10000);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const d = audio.duration;
      finish(Number.isFinite(d) && d > 0 ? Math.round(d * 1000) : 0);
    };
    audio.onerror = () => {
      window.clearTimeout(timer);
      finish(0);
    };
    audio.src = url;
  });
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

export interface AddResult {
  added: number;
  total: number;
  skipped: number;
}

/** Сохраняет выбранные файлы в IndexedDB. Дубликаты пропускаются. */
export async function addLocalFiles(
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<AddResult> {
  const audio = files.filter(isAudioFile);
  if (!audio.length) return { added: 0, total: 0, skipped: 0 };

  const db = await openDb();
  const existing = new Set((await listLocalRecords()).map(r => r.key));
  const fresh = audio.filter(f => !existing.has(localKeyFor(f)));
  const skipped = audio.length - fresh.length;

  let done = 0;
  const records = await mapLimit(fresh, 3, async file => {
    const key = localKeyFor(file);
    const { title, artist } = parseName(file.name);
    const durationMs = await probeDuration(file);
    done++;
    onProgress?.(done, fresh.length);
    const record: LocalRecord = {
      key,
      title,
      artist,
      fileName: file.name,
      blob: file,
      durationMs,
      addedAt: Date.now() - done, // стабильный порядок внутри одной пачки
      size: file.size,
    };
    return record;
  });

  if (records.length) {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const record of records) store.put(record);
    await txDone(tx);
  }

  return { added: records.length, total: audio.length, skipped };
}

/**
 * Создаёт input и обязательно вешает его в DOM: часть мобильных браузеров
 * игнорирует click() у отвязанного элемента, и кнопка «Добавить треки»
 * выглядела нерабочей. После выбора/отмены элемент убирается.
 */
function openFilePicker(configure: (input: HTMLInputElement) => void, filter?: (f: File) => boolean): Promise<File[]> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0';
    configure(input);
    document.body.appendChild(input);

    let settled = false;
    const finish = (files: File[]) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(files);
    };
    input.addEventListener('change', () => {
      const files = Array.from(input.files || []);
      finish(filter ? files.filter(filter) : files);
    });
    input.addEventListener('cancel', () => finish([]));
    input.click();
  });
}

/** Выбор файлов через обычный диалог. */
export function pickAudioFiles(): Promise<File[]> {
  return openFilePicker(input => {
    input.accept = 'audio/*,.mp3,.m4a,.aac,.ogg,.opus,.wav,.flac';
    input.multiple = true;
  });
}

interface DirHandle {
  name: string;
  values?: () => AsyncIterable<DirHandle | FileHandle>;
  entries?: () => AsyncIterable<[string, DirHandle | FileHandle]>;
}
interface FileHandle {
  kind: 'file';
  getFile: () => Promise<File>;
}
interface DirectoryHandle {
  kind: 'directory';
  name: string;
  values: () => AsyncIterable<DirectoryHandle | FileHandle>;
}

async function walkDirectory(dir: DirectoryHandle, out: File[], depth = 0): Promise<void> {
  if (depth > 8) return;
  for await (const entry of dir.values()) {
    if (entry.kind === 'file') {
      try {
        const file = await entry.getFile();
        if (isAudioFile(file)) out.push(file);
      } catch {
        // файл мог исчезнуть — пропускаем
      }
    } else {
      await walkDirectory(entry, out, depth + 1);
    }
  }
}

/** «Найти всё»: папка через File System Access API или webkitdirectory. */
export async function pickFolderAudioFiles(): Promise<File[]> {
  const picker = (window as unknown as { showDirectoryPicker?: () => Promise<DirectoryHandle> }).showDirectoryPicker;
  if (picker) {
    try {
      const dir = await picker();
      const out: File[] = [];
      await walkDirectory(dir, out);
      return out;
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return [];
      // нет доступа к File System Access — уходим на webkitdirectory
    }
  }

  return openFilePicker(input => {
    input.multiple = true;
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
  }, isAudioFile);
}

export function formatDuration(ms?: number): string {
  if (!ms || !Number.isFinite(ms) || ms <= 0) return '';
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
