// FitGuide Web — карточка упражнения (порт ExerciseDetailActivity + activity_exercise_detail.xml).
// Тип, «Тренироваться», оборудование, зона/целевые/вспомогательные мышцы,
// описание, биомеханика, программа, ошибки, советы и техника выполнения.

import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useExercises } from '../hooks/useExercises';
import { isBasicExercise } from '../core/exercises';
import { slotColor, contrastOn, darken } from '../core/palette';

function blend(from: string, to: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  const [r1, g1, b1] = parse(from);
  const [r2, g2, b2] = parse(to);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  const to2 = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to2(mix(r1, r2))}${to2(mix(g1, g2))}${to2(mix(b1, b2))}`;
}

export function ExerciseDetailPage() {
  const navigate = useNavigate();
  const { exerciseId = '' } = useParams();
  const { exercises, muscleGroups, loading } = useExercises();
  const ex = exercises.find(e => e.id === exerciseId);

  const circle = slotColor('circleIcons');
  const labels = slotColor('labelsButtons');

  const subgroup = useMemo(() => {
    if (!ex) return null;
    const g = muscleGroups.find(x => x.id === ex.muscleGroup);
    return g?.subgroups.find(s => s.id === ex.subgroup) || null;
  }, [ex, muscleGroups]);

  if (loading) {
    return <div className="text-center py-12 text-[var(--color-text-secondary)]">Загрузка базы упражнений…</div>;
  }
  if (!ex) {
    return <div className="text-center py-12 text-[var(--color-text-secondary)]">Упражнение не найдено</div>;
  }

  const basic = isBasicExercise(ex);
  const typeText = ex.exType || (basic ? 'Основное (базовое)' : 'Дополнительное (изолирующее)');
  const typeBg = blend(labels, circle, basic ? 1.0 : 0.6);

  const hasDescription = !!ex.description?.trim();
  const hasBiomech = !!ex.biomech?.trim() && ex.biomech !== ex.description;
  const hasProgram = ex.sets > 0 && !!ex.reps;

  // Уровень — как ExerciseDetailActivity.setLevelChip (русские значения разбираются).
  const lvl = (ex.difficulty || '').trim().toLowerCase();
  let levelText = '';
  let levelT = 0.55;
  if (lvl) {
    if (lvl.includes('продвинутый') || lvl === 'advanced') { levelText = 'Продвинутый'; levelT = 1.0; }
    else if (lvl.includes('средний') || lvl === 'intermediate') { levelText = 'Средний'; levelT = 0.78; }
    else { levelText = 'Новичок'; levelT = 0.55; }
  }
  const levelBg = blend(labels, circle, levelT);

  const setsText = `${ex.sets}${ex.sets > 1 ? ' подходов' : ''} × ${ex.reps}`;

  const train = () => {
    const sets = ex.sets > 0 ? ex.sets : 3;
    const reps = ex.reps || '10';
    const qs = new URLSearchParams({
      names: ex.name,
      title: ex.name,
      reps,
      sets: String(sets),
      rest: ex.rest || '',
    });
    navigate(`/workout?${qs.toString()}`);
  };

  const cardStyle = {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-outline)',
  } as const;

  const labelStyle = {
    color: 'var(--p-labels-text)',
    fontSize: '13px',
    fontWeight: 700,
    letterSpacing: '0.03em',
  } as const;

  return (
    <div className="max-w-2xl mx-auto w-full">
      {/* Шапка: назад + название (19sp, до 2 строк) */}
      <div className="flex items-center px-2 py-1 w-full">
        <button
          onClick={() => navigate(-1)}
          aria-label="Назад"
          className="w-12 h-12 flex items-center justify-center rounded-full active:bg-black/5 flex-shrink-0"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--p-labels-text)" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </button>
        <div className="ml-1 flex-1 min-w-0 text-[19px] font-bold leading-tight" style={{ color: 'var(--p-labels-text)' }}>
          {ex.name}
        </div>
      </div>

      <div className="px-4 pb-6 space-y-3">
        <div
          className="inline-block px-3.5 py-1.5 rounded-[7px] text-[13px] font-bold"
          style={{ background: typeBg, color: contrastOn(typeBg) }}
        >
          {typeText}
        </div>

        <button onClick={train} className="fg-btn fg-btn-primary w-full h-[52px]">
          Тренироваться
        </button>

        {/* Оборудование */}
        <div className="rounded-[18px] p-[18px]" style={cardStyle}>
          <div style={labelStyle}>Оборудование</div>
          <div className="mt-1.5 text-[15px]" style={{ color: 'var(--color-text-main)' }}>
            {ex.equipment}
          </div>
        </div>

        {/* Зона, целевые и вспомогательные мышцы */}
        <div className="rounded-[18px] p-[18px]" style={cardStyle}>
          {subgroup && (
            <>
              <div style={labelStyle}>Зона (пучок)</div>
              <div className="mt-1.5 text-[15px]" style={{ color: 'var(--color-text-main)' }}>
                {subgroup.name} — {subgroup.muscles}
              </div>
            </>
          )}
          <div className={subgroup ? 'mt-4' : ''} style={labelStyle}>Целевые мышцы</div>
          <div className="mt-1.5 text-[15px]" style={{ color: 'var(--color-text-main)' }}>
            {ex.target}
          </div>
          <div className="mt-4" style={labelStyle}>Вспомогательные мышцы</div>
          <div className="mt-1.5 text-[15px]" style={{ color: 'var(--color-text-main)' }}>
            {ex.secondaryMuscles?.length ? ex.secondaryMuscles.join(', ') : 'Нет'}
          </div>
        </div>

        {/* Описание */}
        {hasDescription && (
          <div className="rounded-[18px] p-[18px]" style={cardStyle}>
            <div style={labelStyle}>Описание</div>
            <div
              className="mt-1.5 text-[15px] whitespace-pre-line"
              style={{ color: 'var(--color-text-main)', lineHeight: 1.45 }}
            >
              {ex.description}
            </div>
          </div>
        )}

        {/* Биомеханика / ЭМГ */}
        {hasBiomech && (
          <div
            className="rounded-[18px] p-[18px]"
            style={{ background: 'var(--color-surface-variant)' }}
          >
            <div style={labelStyle}>Биомеханика / ЭМГ</div>
            <div
              className="mt-1.5 text-[14px]"
              style={{ color: 'var(--color-text-main)', lineHeight: 1.45 }}
            >
              {ex.biomech}
            </div>
          </div>
        )}

        {/* Программа */}
        {hasProgram && (
          <div
            className="rounded-[18px] p-[18px]"
            style={{ background: 'var(--color-surface-variant)' }}
          >
            <div style={labelStyle}>Программа</div>
            <div className="mt-2 text-[17px] font-bold" style={{ color: 'var(--color-text-main)' }}>
              {setsText}
            </div>
            {!!ex.rest && (
              <div className="mt-0.5 text-[14px]" style={{ color: 'var(--color-text-secondary)' }}>
                Отдых: {ex.rest}
              </div>
            )}
            {levelText && (
              <div
                className="mt-2.5 inline-block px-3 py-1 rounded-[7px] text-[12px] font-bold"
                style={{ background: levelBg, color: contrastOn(levelBg) }}
              >
                {levelText}
              </div>
            )}
          </div>
        )}

        {/* Частые ошибки */}
        {ex.mistakes?.length > 0 && (
          <>
            <div className="pt-3 text-[16px] font-bold" style={{ color: 'var(--p-labels-text)' }}>
              Частые ошибки
            </div>
            <div className="space-y-3">
              {ex.mistakes.map((m, i) => (
                <div key={i} className="text-[15px] leading-snug" style={{ color: 'var(--color-text-main)' }}>
                  •&nbsp;&nbsp;{m}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Советы */}
        {ex.tips?.length > 0 && (
          <>
            <div className="pt-3 text-[16px] font-bold" style={{ color: 'var(--p-labels-text)' }}>
              Советы
            </div>
            <div className="space-y-3">
              {ex.tips.map((t, i) => (
                <div key={i} className="text-[15px] leading-snug" style={{ color: 'var(--color-text-main)' }}>
                  •&nbsp;&nbsp;{t}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Техника выполнения */}
        {ex.steps?.length > 0 && (
          <>
            <div className="pt-3 text-[16px] font-bold" style={{ color: 'var(--color-text-main)' }}>
              Техника выполнения
            </div>
            <div className="space-y-3">
              {ex.steps.map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[14px] font-bold"
                    style={{
                      background: `linear-gradient(135deg, ${circle} 0%, ${darken(circle)} 100%)`,
                      color: contrastOn(circle),
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 text-[15px] leading-snug pt-1" style={{ color: 'var(--color-text-main)' }}>
                    {s}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
