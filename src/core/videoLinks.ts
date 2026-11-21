// FitGuide Web — ссылки на видео техники.
//
// Своих роликов у приложения нет: 323 упражнения по 15–40 МБ — это гигабайты,
// которые некуда класть в APK. Поэтому карточка ведёт в подборку по точному
// названию упражнения: VK Видео по умолчанию (в РФ открывается стабильно),
// YouTube — вторым вариантом. Ссылки не устаревают и не ведут на «не то»
// упражнение, как это бывает с автоматически подобранными роликами.

export type VideoSource = 'vk' | 'youtube';

export interface VideoSourceDef {
  key: VideoSource;
  label: string;
}

/** Порядок важен: первый — основной вариант. */
export const VIDEO_SOURCES: VideoSourceDef[] = [
  { key: 'vk', label: 'VK Видео' },
  { key: 'youtube', label: 'YouTube' },
];

/** Поисковый запрос: название упражнения как в базе + «техника выполнения». */
export function videoQuery(name: string): string {
  const trimmed = String(name || '').replace(/\s+/g, ' ').trim();
  // Скобки — это уточнения для карточки («30–45°», «Hammer Shoulder Press»).
  // В поиске они только сужают выдачу, поэтому убираем — но лишь если
  // осмысленная часть остаётся не короче 20 символов: «Подъём на носки (стоя)»
  // без «стоя» уже другое упражнение, его не трогаем.
  const stripped = trimmed.replace(/\s*\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  const base = stripped.length >= 20 ? stripped : trimmed;
  return `${base} техника выполнения`.trim();
}

/** encodeURIComponent оставляет скобки и апострофы — в адресе они лишние. */
function encodeStrict(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

/** Адрес подборки. Неизвестный источник — VK: молча в пустоту не отправляем. */
export function videoSearchUrl(source: VideoSource | string, name: string): string {
  const q = encodeStrict(videoQuery(name));
  if (source === 'youtube') return `https://www.youtube.com/results?search_query=${q}`;
  return `https://vk.com/video?section=search&q=${q}`;
}
