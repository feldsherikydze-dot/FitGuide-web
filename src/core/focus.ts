// FitGuide Web — акцент на группы мышц (порт FocusPolicy.java).
//
// Шаблон сплита отвечает на вопрос «как тренироваться», пол — «какая
// физиология», а этот выбор — «ради чего». Приоритетные группы получают
// больше недельного объёма и идут раньше в своём дне, пока силы свежие;
// остальные чуть ужимаются, чтобы тренировка не расползлась по времени.
// Если группы нет в шаблоне (трицепс в фулбоди), она добавляется в подходящий
// день — иначе выбор был бы обманом.

export type FocusKey = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'glutes' | 'abs' | 'calves';

export const FOCUS_ALL: FocusKey[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'glutes', 'abs', 'calves'];

export const FOCUS_LABELS: Record<FocusKey, string> = {
  chest: 'Грудь',
  back: 'Спина',
  shoulders: 'Плечи',
  arms: 'Руки',
  legs: 'Ноги',
  glutes: 'Ягодицы',
  abs: 'Пресс',
  calves: 'Икры',
};

function isKey(value: string): value is FocusKey {
  return (FOCUS_ALL as string[]).includes(value);
}

/**
 * Ключи из строки профиля: только известные, без дублей, как угодно много
 * (можно отметить все группы).
 * Порядок канонический (как FOCUS_ALL), а не в порядке кликов: иначе один и
 * тот же выбор ложился бы в профиль по-разному и подпись прыгала бы местами.
 */
export function focusKeys(raw?: string | null): FocusKey[] {
  if (!raw) return [];
  const picked = new Set<FocusKey>();
  for (const part of raw.split(',')) {
    const k = part.trim().toLowerCase();
    if (isKey(k)) picked.add(k);
  }
  return FOCUS_ALL.filter(k => picked.has(k));
}

/** Нормализованная строка для хранения в профиле. */
export function normalizeFocus(raw?: string | null): string {
  return focusKeys(raw).join(',');
}

/**
 * Акцент для расчёта программы: все восемь групп — не перекос, а обычная
 * тренировка. Выбор при этом сохраняется в программе и профиле.
 */
export function effectiveFocus(raw?: string | null): string {
  const keys = focusKeys(raw);
  return keys.length >= FOCUS_ALL.length ? '' : keys.join(',');
}

/** Группы каталога, которые попадают под ключ. */
export function musclesOfFocus(key: FocusKey): string[] {
  switch (key) {
    case 'chest': return ['Грудь'];
    case 'back': return ['Широчайшие', 'Ромбовидные'];
    case 'shoulders': return ['Плечи'];
    case 'arms': return ['Бицепс', 'Трицепс'];
    case 'legs': return ['Квадрицепс', 'Бицепс бедра', 'Приводящие'];
    case 'glutes': return ['Ягодицы'];
    case 'abs': return ['Пресс'];
    case 'calves': return ['Икры'];
    default: return [];
  }
}

/** Приоритетна ли группа при таком выборе. */
export function isFocus(raw: string | null | undefined, muscle: string | null | undefined): boolean {
  if (!muscle) return false;
  return focusKeys(raw).some(key => musclesOfFocus(key).includes(muscle));
}

/**
 * Множитель недельного объёма. Чем больше отмечено групп, тем мягче перекос:
 * 1–2 — полный (+35% приоритету, −10% остальным), 3–4 — умеренный, 5–6 —
 * лёгкий, 7–8 — все группы отмечены, значит перекоса нет вовсе. Иначе выбор
 * «всё» раздувал бы тренировку вдвое вместо того, чтобы ничего не менять.
 */
export function focusVolumeFactor(raw: string | null | undefined, muscle: string): number {
  const n = focusKeys(raw).length;
  if (n === 0) return 1;
  const focus = isFocus(raw, muscle);
  if (n <= 2) return focus ? 1.35 : 0.9;
  if (n <= 4) return focus ? 1.2 : 0.95;
  if (n <= 6) return focus ? 1.1 : 1;
  return 1;
}

/** Верхняя граница недельного объёма для группы. */
export function focusMaxWeeklySets(raw: string | null | undefined, muscle: string): number {
  return isFocus(raw, muscle) && focusKeys(raw).length <= 2 ? 22 : 20;
}

/** Подпись выбора для карточки программы: «Грудь, спина». */
export function focusLabel(raw?: string | null): string {
  const labels = focusKeys(raw).map(k => FOCUS_LABELS[k]);
  if (labels.length === 0) return '';
  const joined = labels.join(', ');
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

/**
 * Недостающее в дне: ключи из выбора, чьих групп нет в плане этого дня.
 *
 * «Руки» — это обе мышцы: если в дне есть только бицепс, трицепс всё равно
 * нужно добавить, иначе акцент на руки в фулбоди тихо превращался в «+1 подход
 * к бицепсу». Для остальных групп достаточно одной мышцы ключа.
 */
export function missingInDay(raw: string | null | undefined, present: Set<string>): FocusKey[] {
  const out: FocusKey[] = [];
  for (const key of focusKeys(raw)) {
    const muscles = musclesOfFocus(key);
    const here = key === 'arms'
      ? muscles.every(m => present.has(m))
      : muscles.some(m => present.has(m));
    if (!here) out.push(key);
  }
  return out;
}

/**
 * Уместен ли ключ в этом дне: грудь и руки не суют в день ног, икры — не в
 * день жима. Семья определяется по названию дня, как и остальной шаблон.
 */
export function fitsDay(key: FocusKey, dayTitle: string): boolean {
  const t = dayTitle || '';
  const upper = t.includes('Верх') || t.includes('Толкай') || t.includes('Тяни')
    || t.includes('Грудь') || t.includes('Спина')
    || t.includes('Полное тело') || t.includes('Круговая');
  const lower = t.includes('Низ') || t.includes('Ноги') || t.includes('квадрицепс')
    || t.includes('Полное тело') || t.includes('Круговая');
  const push = t.includes('Толкай') || t.includes('жим') || t.includes('Грудь');
  const pull = t.includes('Тяни') || t.includes('Спина');

  switch (key) {
    case 'chest': return push || t.includes('Верх') || t.includes('Полное тело') || t.includes('Круговая');
    case 'back': return pull || t.includes('Верх') || t.includes('Полное тело') || t.includes('Круговая');
    case 'shoulders':
    case 'arms': return upper;
    case 'legs':
    case 'glutes':
    case 'calves': return lower;
    case 'abs': return upper || lower;
    default: return false;
  }
}

/** Спека слота для добавки: группа, приоритет подбора, роль, ключи, запреты. */
export interface FocusSpec {
  group: string;
  priority: string;
  role: string;
  keys: string;
  ban: string;
}

export function focusSpec(key: FocusKey): FocusSpec | null {
  switch (key) {
    case 'chest': return { group: 'Грудь', priority: 'bench', role: 'main', keys: 'жим;развед;кроссовер;отжиман', ban: '' };
    case 'back': return { group: 'Широчайшие', priority: 'row', role: 'main', keys: 'тяга;подтягиван;блок', ban: '' };
    case 'shoulders': return { group: 'Плечи', priority: 'press', role: 'secondary', keys: 'жим;махи;развед', ban: '' };
    case 'arms': return { group: 'Трицепс', priority: 'iso', role: 'isolation', keys: 'блок;французск;канат', ban: '' };
    case 'legs': return { group: 'Квадрицепс', priority: 'squat', role: 'main', keys: 'присед;выпад;ногами', ban: '' };
    case 'glutes': return { group: 'Ягодицы', priority: 'hinge', role: 'secondary', keys: 'мост;хип-траст;выпад', ban: '' };
    case 'abs': return { group: 'Пресс', priority: 'core', role: 'isolation', keys: 'скручиван;планка', ban: '' };
    case 'calves': return { group: 'Икры', priority: 'calf', role: 'isolation', keys: 'носк;икр', ban: '' };
    default: return null;
  }
}

/**
 * Спека для добавки с учётом того, что уже стоит в дне. Руки — особый случай:
 * в дне может быть только бицепс или только трицепс, и добавлять нужно именно
 * недостающую мышцу, а не второй раз ту же.
 */
export function focusSpecMissing(key: FocusKey, present: Set<string>): FocusSpec | null {
  if (key === 'arms') {
    const hasBiceps = present.has('Бицепс');
    const hasTriceps = present.has('Трицепс');
    if (hasTriceps && !hasBiceps) {
      return {
        group: 'Бицепс', priority: 'biceps', role: 'isolation',
        keys: 'сгибан;молот;подъем;бицепс', ban: '',
      };
    }
    return focusSpec('arms');
  }
  return focusSpec(key);
}

/**
 * Второе упражнение на приоритетную крупную группу — другой угол или снаряд.
 * Один слот упирается в потолок подходов (6), поэтому «акцент на грудь» без
 * второго жима/разводки давал бы +1 подход и никакой разницы на глаз.
 * Для мелких групп (пресс, икры, руки) второго слота нет: день и так полон.
 */
export function focusSpecSecond(key: FocusKey): FocusSpec | null {
  switch (key) {
    case 'chest': return { group: 'Грудь', priority: 'fly', role: 'secondary', keys: 'развед;кроссовер;бабочка;сведен', ban: 'жим' };
    case 'back': return { group: 'Широчайшие', priority: 'pulldown', role: 'secondary', keys: 'блок;подтягиван;пуловер', ban: 'наклон' };
    case 'shoulders': return { group: 'Плечи', priority: 'lateral', role: 'secondary', keys: 'махи;развед', ban: 'жим' };
    case 'legs': return { group: 'Квадрицепс', priority: 'extension', role: 'secondary', keys: 'разгибан;выпад', ban: 'присед;ногами' };
    case 'glutes': return { group: 'Ягодицы', priority: 'abduction', role: 'secondary', keys: 'отведен;махи;мост', ban: 'тяга;станов' };
    default: return null;
  }
}
