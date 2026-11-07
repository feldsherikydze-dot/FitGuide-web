// FitGuide Web — соревновательные категории (порт CompCategory.java)
//
// Ориентир веса на сцене считается от роста: рост + смещение категории.
// Мужские: бодибилдинг −93, классик −96.5, пляжный −100.
// Женские: бодифитнес −110, фигура −108, бикини −111, велнес −105.
// Межсезонье — сцена плюс запас на сушку: 4 кг мужчинам, 3 кг женщинам.

export interface CompCat {
  key: string;
  label: string;
  desc: string;
  stageOffsetCm: number;
  gender: 'male' | 'female';
}

const MALE: CompCat[] = [
  {
    key: 'bb',
    label: 'Бодибилдинг',
    desc: 'Максимум мышц и пропорции. Ориентир веса сцены выше классики.',
    stageOffsetCm: -93,
    gender: 'male',
  },
  {
    key: 'classic',
    label: 'Классик-бодибилдинг',
    desc: 'Пропорции и эстетика с ограничением по весу для роста.',
    stageOffsetCm: -96.5,
    gender: 'male',
  },
  {
    key: 'mp',
    label: 'Мужской пляжный',
    desc: 'Плечи и пресс, сухая форма. Ориентир веса ниже классики.',
    stageOffsetCm: -100,
    gender: 'male',
  },
];

const FEMALE: CompCat[] = [
  {
    key: 'bf',
    label: 'Бодифитнес',
    desc: 'Спортивная мускулатура и низкий процент жира.',
    stageOffsetCm: -110,
    gender: 'female',
  },
  {
    key: 'figure',
    label: 'Фигура',
    desc: 'Пропорции и подтянутая форма, чуть мягче бодифитнеса.',
    stageOffsetCm: -108,
    gender: 'female',
  },
  {
    key: 'bikini',
    label: 'Бикини',
    desc: 'Стройная форма, акцент на тонус и подачу.',
    stageOffsetCm: -111,
    gender: 'female',
  },
  {
    key: 'wellness',
    label: 'Велнес',
    desc: 'Выраженные ноги и ягодицы при тонкой талии.',
    stageOffsetCm: -105,
    gender: 'female',
  },
];

/** Категории для пола спортсмена; неизвестный пол — мужские. */
export function compCatsForGender(gender: string | null | undefined): CompCat[] {
  return gender === 'female' ? FEMALE : MALE;
}

export function compCatByKey(key: string | null | undefined): CompCat | null {
  if (!key) return null;
  return MALE.find(c => c.key === key) ?? FEMALE.find(c => c.key === key) ?? null;
}

export function compCatLabel(key: string | null | undefined): string {
  return compCatByKey(key)?.label ?? '';
}

export function compCatDescribe(key: string | null | undefined): string {
  return compCatByKey(key)?.desc ?? '';
}

/** Ориентир веса на сцене, кг. 0 — если рост или категория неизвестны. */
export function stageWeightKg(heightCm: number, key: string | null | undefined): number {
  const cat = compCatByKey(key);
  if (!cat || heightCm <= 0) return 0;
  const stage = heightCm + cat.stageOffsetCm;
  return stage > 0 ? Math.round(stage * 10) / 10 : 0;
}

/** Ориентир веса в межсезонье: сцена плюс запас на сушку. */
export function offseasonKg(heightCm: number, key: string | null | undefined): number {
  const stage = stageWeightKg(heightCm, key);
  if (stage <= 0) return 0;
  const cat = compCatByKey(key);
  const reserve = cat?.gender === 'female' ? 3 : 4;
  return Math.round((stage + reserve) * 10) / 10;
}
