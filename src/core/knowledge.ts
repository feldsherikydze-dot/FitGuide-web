// FitGuide Web — база знаний (порт KnowledgeProvider + KnowledgeTips + KnowledgeFormat)

import type { KnowledgeChapter } from '../data/types';

let chaptersCache: KnowledgeChapter[] | null = null;
let haystackCache: string[] = [];

export async function loadKnowledge(): Promise<KnowledgeChapter[]> {
  if (chaptersCache) return chaptersCache;
  try {
    const res = await fetch('/knowledge.md');
    if (!res.ok) throw new Error('knowledge.md not found');
    const text = await res.text();
    chaptersCache = parseKnowledge(text);
    haystackCache = chaptersCache.map(ch => ((ch.title || '') + ' ' + (ch.content || '')).toLowerCase());
  } catch (e) {
    console.error('Failed to load knowledge.md:', e);
    chaptersCache = [];
    haystackCache = [];
  }
  return chaptersCache;
}

export function getKnowledgeSync(): KnowledgeChapter[] {
  return chaptersCache || [];
}

export function getKnowledgeHaystacks(): string[] {
  return haystackCache;
}

/**
 * Разбор knowledge.md в главы.
 * «## 1. Что такое бодибилдинг» → номер «1», заголовок «Что такое бодибилдинг».
 */
export function parseKnowledge(md: string): KnowledgeChapter[] {
  const parsed: KnowledgeChapter[] = [];
  let current: KnowledgeChapter | null = null;
  let content: string[] = [];

  for (const raw of md.split('\n')) {
    if (raw.startsWith('## ')) {
      if (current) {
        current.content = content.join('\n').trim();
        parsed.push(current);
      }
      let heading = raw.substring(3).trim();
      const m = heading.match(/^\s*(\d+)\s*[.)]\s*(.+)$/);
      const number = m ? m[1] : '';
      if (m) heading = m[2].trim();
      current = { id: number || `sec:${heading}`, number, title: heading, content: '', isSection: false };
      content = [];
    } else if (current) {
      content.push(raw);
    }
  }
  if (current) {
    current.content = content.join('\n').trim();
    parsed.push(current);
  }
  return parsed;
}

// --- KnowledgeTips ---

export interface Tip {
  number: string;
  title: string;
  text: string;
}

/**
 * Порядок «по кругу» для дней, когда ситуация не подсказала тему.
 * Всё прикладное: перегрузка, объём, частота, темп, разминка, RIR, сон, белок, вода, дневник.
 */
const ROTATION = ['19', '20', '27', '22', '24', '23', '60', '44', '49', '86', '42', '34'];

/** Глава, в заголовке которой встречается одно из ключевых слов (по порядку). */
export function findTip(keywords: string[]): Tip | null {
  const list = getKnowledgeSync();
  for (const key of keywords) {
    if (!key || !key.trim()) continue;
    const needle = key.trim().toLowerCase();
    for (const ch of list) {
      if (ch.isSection || !ch.title?.trim()) continue;
      if (ch.title.toLowerCase().includes(needle)) return tipOf(ch);
    }
  }
  return null;
}

/** Глава по номеру. */
export function tipByNumber(number: string): Tip | null {
  if (!number?.trim()) return null;
  for (const ch of getKnowledgeSync()) {
    if (!ch.isSection && number.trim() === ch.number) return tipOf(ch);
  }
  return null;
}

/** Глава «по кругу» — для дней без особого повода. */
export function rotateTip(slot: number): Tip | null {
  for (let i = 0; i < ROTATION.length; i++) {
    const idx = ((slot + i) % ROTATION.length + ROTATION.length) % ROTATION.length;
    const t = tipByNumber(ROTATION[idx]);
    if (t && t.text) return t;
  }
  for (const ch of getKnowledgeSync()) {
    const t = tipOf(ch);
    if (t && t.text) return t;
  }
  return null;
}

function tipOf(ch: KnowledgeChapter): Tip | null {
  if (!ch || ch.isSection || !ch.title?.trim()) return null;
  return { number: ch.number || '', title: ch.title, text: excerpt(ch.content) };
}

/** Первый абзац главы (или два пункта списка) без разметки — до 240 знаков. */
export function excerpt(content: string): string {
  if (!content?.trim()) return '';
  const parts: string[] = [];
  let bullets = false;
  let first = true;

  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      if (parts.length > 0) break;
      continue;
    }
    if (line.startsWith('#')) continue;
    const bull = line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ');
    if (first) {
      bullets = bull;
      parts.push(bull ? line.substring(2).trim() : line);
      first = false;
      if (!bullets) break; // абзаца достаточно
    } else {
      if (!bullets) break; // после абзаца пункты не мешаем
      parts.push(bull ? line.substring(2).trim() : line);
      if (parts.length >= 2) break;
    }
  }

  const sb = parts.join(' ');
  return fit(collapse(sb), 240);
}

function collapse(s: string): string {
  return s.replace(/\*\*/g, '').replace(/__/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim();
}

/** Аккуратно обрезает текст по концу предложения. */
function fit(s: string, limit: number): string {
  if (s.length <= limit) return s;
  let cut = s.substring(0, limit);
  let at = -1;
  for (const end of ['. ', '! ', '? ', '; ', ': ']) {
    at = Math.max(at, cut.lastIndexOf(end));
  }
  if (at >= 80) return cut.substring(0, at + 1);
  const space = cut.lastIndexOf(' ');
  if (space > 0) cut = cut.substring(0, space);
  return cut + '…';
}

// --- KnowledgeFormat: markdown -> HTML (для показа главы) ---

export function knowledgeToHtml(raw: string): string {
  if (!raw) return '';
  const out: string[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
      out.push(`<p><b>${bold(escape(trimmed.substring(trimmed.indexOf(' ') + 1)))}</b></p>`);
    } else if (trimmed.startsWith('- ')) {
      out.push(`<p>•&nbsp;${bold(escape(trimmed.substring(2)))}</p>`);
    } else if (isTableSeparator(trimmed)) {
      continue;
    } else if (trimmed.includes('|')) {
      out.push(`<p>${bold(escape(joinTableCells(trimmed)))}</p>`);
    } else {
      out.push(`<p>${bold(escape(trimmed))}</p>`);
    }
  }
  return out.join('');
}

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function bold(escaped: string): string {
  if (!escaped.includes('**')) return escaped;
  const parts = escaped.split(/\*\*/);
  let open = false;
  let sb = '';
  for (let i = 0; i < parts.length; i++) {
    sb += parts[i];
    if (i < parts.length - 1) {
      sb += open ? '</b>' : '<b>';
      open = !open;
    }
  }
  if (open) sb += '</b>';
  return sb;
}

function isTableSeparator(line: string): boolean {
  if (!line.startsWith('|') && !line.includes('|-') && !line.endsWith('|')) return false;
  for (const c of line) {
    if (c !== '|' && c !== '-' && c !== ':' && c !== ' ') return false;
  }
  return true;
}

function joinTableCells(line: string): string {
  const cells = line.split('|');
  const out: string[] = [];
  for (const cell of cells) {
    const c = cell.trim();
    if (!c) continue;
    out.push(c);
  }
  return out.join(' &nbsp;·&nbsp; ');
}
