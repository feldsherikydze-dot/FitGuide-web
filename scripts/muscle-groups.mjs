// Соответствие групп приложения мышцам набора body-muscles.
// Один источник для генератора иконок и превью.

export const GROUPS = {
  chest: { view: 'front', title: 'Грудь', ids: ['chest-upper-left', 'chest-lower-left', 'chest-upper-right', 'chest-lower-right'] },
  abs: { view: 'front', title: 'Пресс', ids: ['abs-upper-left', 'abs-lower-left', 'abs-upper-right', 'abs-lower-right'] },
  delts: { view: 'front', title: 'Плечи', ids: ['shoulder-front-left', 'shoulder-side-left', 'shoulder-front-right', 'shoulder-side-right'] },
  biceps: { view: 'front', title: 'Бицепс', ids: ['biceps-left', 'biceps-right'] },
  forearms: { view: 'front', title: 'Предплечья', ids: ['forearm-left', 'forearm-right'] },
  quads: { view: 'front', title: 'Квадрицепс', ids: ['quads-left', 'quads-right'] },
  adductors: { view: 'front', title: 'Приводящие', ids: ['adductors-left', 'adductors-right'] },
  neck: { view: 'front', title: 'Шея', ids: ['neck-left', 'neck-right'] },
  trap: {
    view: 'back',
    title: 'Трапеции',
    ids: ['traps-upper-left', 'traps-mid-left', 'traps-lower-left',
      'traps-upper-right', 'traps-mid-right', 'traps-lower-right'],
  },
  back: {
    view: 'back',
    title: 'Широчайшие',
    ids: ['lats-upper-left', 'lats-mid-left', 'lats-lower-left',
      'lats-upper-right', 'lats-mid-right', 'lats-lower-right'],
  },
  midback: { view: 'back', title: 'Ромбовидные', ids: ['traps-mid-left', 'traps-mid-right'] },
  lowback: {
    view: 'back',
    title: 'Поясница',
    ids: ['lower-back-erectors-left', 'lower-back-erectors-right', 'spine'],
  },
  triceps: {
    view: 'back',
    title: 'Трицепс',
    ids: ['triceps-long-left', 'triceps-lateral-left', 'triceps-long-right', 'triceps-lateral-right'],
  },
  hamstrings: {
    view: 'back',
    title: 'Бицепс бедра',
    ids: ['hamstrings-medial-left', 'hamstrings-lateral-left',
      'hamstrings-medial-right', 'hamstrings-lateral-right'],
  },
  glutes: {
    view: 'back',
    title: 'Ягодицы',
    ids: ['gluteus-maximus-left', 'gluteus-medius-left',
      'gluteus-maximus-right', 'gluteus-medius-right'],
  },
  calves: {
    view: 'back',
    title: 'Икры',
    ids: ['calves-gastroc-medial-left', 'calves-gastroc-lateral-left', 'calves-soleus-left',
      'calves-gastroc-medial-right', 'calves-gastroc-lateral-right', 'calves-soleus-right'],
  },
};

// Алиасы из Android ICON_MAP, чтобы ничего не отвалилось.
GROUPS.arms = { view: 'front', title: 'Руки', ids: [...GROUPS.biceps.ids, ...GROUPS.forearms.ids] };
GROUPS.legs = { view: 'front', title: 'Ноги', ids: [...GROUPS.quads.ids, ...GROUPS.adductors.ids] };
GROUPS.shoulders = { ...GROUPS.delts, title: 'Плечи' };
