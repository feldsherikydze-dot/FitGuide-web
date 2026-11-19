// Скрининг красных флагов перед первой тренировкой (порт RedFlags.java).
//
// Спрашиваем один раз и запоминаем ответ. Красные флаги — не диагноз:
// это состояния, при которых нагрузку начинают с разрешения врача.

const KEY = 'fitguide_redflags_v1';

export type RedFlagsAnswer = '' | 'ok' | 'flag';

export function redFlagsAnswer(): RedFlagsAnswer {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'ok' || v === 'flag' ? v : '';
  } catch {
    return '';
  }
}

export function markRedFlags(answer: RedFlagsAnswer): void {
  try {
    localStorage.setItem(KEY, answer);
  } catch {
    // приватный режим — спросим ещё раз, это не ошибка
  }
}

export const REDFLAGS_TITLE = 'Готовность к нагрузке';

export const REDFLAGS_BODY =
  'Перед первой тренировкой проверь себя. Если есть хоть один пункт — сначала врач, потом зал:\n\n'
  + '• боль или давление в груди при нагрузке;\n'
  + '• обмороки или сильное головокружение;\n'
  + '• давление выше 160/100 или не под контролем;\n'
  + '• недавняя операция, травма или беременность без разрешения врача.\n\n'
  + 'Это не диагноз: приложение просто не пускает к нагрузке вслепую.';

export const REDFLAGS_ADVICE_TITLE = 'Сначала врач';

export const REDFLAGS_ADVICE_BODY =
  'С такими симптомами тренировка без разрешения врача опасна. Покажи этот список врачу '
  + 'и начинай нагрузку только после его ответа.\n\n'
  + 'Если решишь заниматься сейчас — снизь вес, не работай до отказа и остановись при любом ухудшении.';
