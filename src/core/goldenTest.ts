// FitGuide Web — уборка тестовых данных «Золотой эры».
//
// 12.11.2026 в вебе прогоняли «Анализ» на легенде Арнольда: в localStorage
// лежали 78 синтетических тренировок за 90 дней. Легенда удалена из каталога,
// но данные в браузере владельца остались. Здесь два аккуратных способа:
//  1) удалить только тренировки/программу «Золотой эры», всё остальное не трогать;
//  2) вернуть состояние тренера из копии, снятой до теста (если копия есть).
//
// Копия писалась руками в консоли, поэтому ключ может быть с префиксом и без.

import { useCoachStore, useProgramsStore } from './store';

/** id программы, которую собирает LegendPlanBuilder: `legend_${id}_${now}`. */
const GOLDEN_PROGRAM_PREFIX = 'legend_golden_age_';
const COACH_KEY = 'fitguide_web_coach_state';
const BACKUP_KEYS = [
  'coach_state_backup_before_golden',
  'fitguide_web_coach_state_backup_before_golden',
  'fitguide_coach_state_backup_before_golden',
];

function isGoldenProgram(id: string | null | undefined): boolean {
  return !!id && id.startsWith(GOLDEN_PROGRAM_PREFIX);
}

function goldenSessions() {
  return useCoachStore.getState().sessions.filter(s => isGoldenProgram(s.programId));
}

function goldenPrograms() {
  return useProgramsStore.getState().programs.filter(p => isGoldenProgram(p.id));
}

/** Сколько тестовых данных осталось: тренировки и сохранённые программы. */
export function goldenTestCounts(): { sessions: number; programs: number } {
  return { sessions: goldenSessions().length, programs: goldenPrograms().length };
}

/** Ключ резервной копии состояния тренера до теста либо null. */
export function goldenBackupKey(): string | null {
  try {
    for (const key of BACKUP_KEYS) {
      if (localStorage.getItem(key)) return key;
    }
  } catch {
    // приватный режим — копий нет
  }
  return null;
}

/** Удаляет тренировки «Золотой эры» и её программу. Возвращает, что удалено. */
export function removeGoldenTestData(): { sessions: number; programs: number } {
  const coach = useCoachStore.getState();
  const doomed = coach.sessions.filter(s => isGoldenProgram(s.programId));
  const doomedTs = new Set(doomed.map(s => String(s.ts)));
  const feels = { ...coach.feels };
  for (const ts of doomedTs) delete feels[ts];

  useCoachStore.setState({
    sessions: coach.sessions.filter(s => !isGoldenProgram(s.programId)),
    feels,
    activeProgramId: isGoldenProgram(coach.activeProgramId) ? null : coach.activeProgramId,
    prevProgramId: isGoldenProgram(coach.prevProgramId) ? null : coach.prevProgramId,
    coachProgramId: isGoldenProgram(coach.coachProgramId) ? null : coach.coachProgramId,
  });

  const programs = useProgramsStore.getState();
  const gone = programs.programs.filter(p => isGoldenProgram(p.id));
  if (gone.length) programs.save(programs.programs.filter(p => !isGoldenProgram(p.id)));

  return { sessions: doomed.length, programs: gone.length };
}

/**
 * Возвращает coach_state из копии до теста. Понимает и конверт zustand
 * ({state,version}), и «сырой» объект состояния. Программу «Золотой эры»
 * из «Моих программ» тоже убирает.
 */
export function restoreCoachStateFromGoldenBackup():
  { ok: true; sessions: number } | { ok: false; reason: 'no-backup' | 'bad-json' | 'bad-shape' } {
  const key = goldenBackupKey();
  if (!key) return { ok: false, reason: 'no-backup' };

  let state: unknown;
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null') as unknown;
    const maybe = parsed as { state?: unknown } | null;
    state = maybe && typeof maybe === 'object' && 'state' in maybe ? maybe.state : parsed;
  } catch {
    return { ok: false, reason: 'bad-json' };
  }
  const candidate = state as { sessions?: unknown } | null;
  if (!candidate || typeof candidate !== 'object' || !Array.isArray(candidate.sessions)) {
    return { ok: false, reason: 'bad-shape' };
  }

  localStorage.setItem(COACH_KEY, JSON.stringify({ state, version: 0 }));

  const programs = useProgramsStore.getState();
  if (programs.programs.some(p => isGoldenProgram(p.id))) {
    programs.save(programs.programs.filter(p => !isGoldenProgram(p.id)));
  }
  return { ok: true, sessions: (candidate.sessions as unknown[]).length };
}
