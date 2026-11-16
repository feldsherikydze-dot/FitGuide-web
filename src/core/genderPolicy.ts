// FitGuide Web — политика пола и акцента (порт GenderPolicy.java).
//
// Пол — только физиология: BMR, состав тела, цикл, менопауза, беременность.
// Тренировочный акцент — отдельный выбор пользователя.

export type Emphasis = 'auto' | 'glutes_legs' | 'upper' | 'balanced';
export type LifeStage = 'none' | 'perimenopause' | 'menopause' | 'pregnancy' | 'postpartum';

export const EMPHASIS_LABELS: Record<Emphasis, string> = {
  auto: 'Авто',
  glutes_legs: 'Ягодицы и ноги',
  upper: 'Верх тела',
  balanced: 'Баланс',
};

export const STAGE_LABELS: Record<LifeStage, string> = {
  none: 'Не указывать',
  perimenopause: 'Пременопауза',
  menopause: 'Менопауза',
  pregnancy: 'Беременность',
  postpartum: 'Послеродовой',
};

export function normalizeEmphasis(value?: string | null): Emphasis {
  return value === 'glutes_legs' || value === 'upper' || value === 'balanced'
    ? value : 'auto';
}

export function effectiveEmphasis(gender?: string | null, emphasis?: string | null): Emphasis {
  const e = normalizeEmphasis(emphasis);
  if (e !== 'auto') return e;
  return gender === 'female' ? 'glutes_legs' : 'balanced';
}

export function glutesTemplate(gender?: string | null, emphasis?: string | null): boolean {
  return effectiveEmphasis(gender, emphasis) === 'glutes_legs';
}

export function normalizeStage(value?: string | null): LifeStage {
  return value === 'perimenopause' || value === 'menopause'
    || value === 'pregnancy' || value === 'postpartum'
    ? value : 'none';
}

export interface CycleInfo {
  day: number;
  phase: 'menstruation' | 'follicular' | 'ovulation' | 'luteal';
  label: string;
  note: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function cycleInfo(
  lastPeriodMillis: number,
  cycleLength: number,
  nowMillis: number,
): CycleInfo | null {
  if (!lastPeriodMillis || lastPeriodMillis <= 0) return null;
  const len = cycleLength < 21 || cycleLength > 45 ? 28 : cycleLength;
  let diff = nowMillis - lastPeriodMillis;
  if (diff < 0) diff = 0;
  const day = Math.floor(diff / DAY_MS) % len + 1;
  let phase: CycleInfo['phase'];
  let label: string;
  if (day <= 5) {
    phase = 'menstruation';
    label = 'менструация';
  } else if (day < len / 2 - 1) {
    phase = 'follicular';
    label = 'фолликулярная';
  } else if (day <= len / 2 + 1) {
    phase = 'ovulation';
    label = 'овуляция';
  } else {
    phase = 'luteal';
    label = 'лютеиновая';
  }
  return {
    day, phase, label,
    note: 'Средний эффект фазы на силу небольшой: важнее сон, еда и самочувствие.',
  };
}

export function healthNotes(
  profile: { gender?: string; lastPeriodDate?: number; cycleLength?: number; lifeStage?: string } | null,
  nowMillis = Date.now(),
): string[] {
  const out: string[] = [];
  if (!profile) return out;
  const cycle = cycleInfo(profile.lastPeriodDate || 0, profile.cycleLength || 28, nowMillis);
  if (cycle) {
    out.push(`Цикл: день ${cycle.day}, ${cycle.label} фаза. ${cycle.note}`);
  }
  if (profile.gender === 'female' && normalizeStage(profile.lifeStage) !== 'pregnancy') {
    out.push('Колени: 2 раза в неделю прыжки-приземления и упражнения на ягодичные и заднюю поверхность бедра снижают риск травмы ACL.');
    out.push('Железо, кальций и витамин D — частые дефициты у женщин. Проверяй по анализам, без мегадоз.');
  }
  switch (normalizeStage(profile.lifeStage)) {
    case 'perimenopause':
      out.push('Пременопауза: сон и восстановление могут колебаться. Силовая 2–3 раза в неделю помогает сохранить мышцы и кости; объём подбирай по самочувствию.');
      break;
    case 'menopause':
      out.push('Менопауза: силовая 2–3 раза в неделю и ударная нагрузка поддерживают кости. Белок 1,6–2,2 г/кг, кальций и витамин D — по анализу и согласованию с врачом.');
      break;
    case 'pregnancy':
      out.push('Беременность: после первого триместра не тренируйся лёжа на спине, следи за давлением и тазовым дном. Программу согласуй с врачом.');
      break;
    case 'postpartum':
      out.push('Послеродовой период: начни с дыхания и тазового дна, не гонись за весом. При диастазе или боли — к специалисту.');
      break;
    default:
      break;
  }
  return out;
}
