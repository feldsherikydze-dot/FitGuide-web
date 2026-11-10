// Иконка мышечной группы: анатомия из body-muscles (Apache-2.0).
// Inline SVG, а не CSS-маска: на мелких мышцах маска мылит контуры.
// Тело — приглушённый цвет темы, целевая мышца — акцент с подсветкой.

import { MUSCLE_BODY_BACK, MUSCLE_BODY_FRONT, MUSCLE_FIT, MUSCLE_VIEW } from '../data/muscleIcons';

const VIEWBOX = { front: '0 0 35 93', back: '37 0 35 93' } as const;

export function MuscleIcon({ name, height = 150, className }: {
  name: string; height?: number; className?: string;
}) {
  const view = MUSCLE_VIEW[name] || 'front';
  const body = view === 'front' ? MUSCLE_BODY_FRONT : MUSCLE_BODY_BACK;
  const fit = MUSCLE_FIT[name] || [];
  const width = Math.round((height * 35) / 93);

  return (
    <svg
      viewBox={VIEWBOX[view]}
      width={width}
      height={height}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g
        fill="var(--color-text-secondary)"
        fillOpacity={0.5}
        stroke="var(--color-text-secondary)"
        strokeOpacity={0.28}
        strokeWidth={0.12}
        strokeLinejoin="round"
      >
        {body.map((d, i) => <path key={i} d={d} />)}
      </g>
      <g fill="var(--p-circle)" style={{ filter: 'drop-shadow(0 0 2.5px var(--p-circle))' }}>
        {fit.map((d, i) => <path key={i} d={d} />)}
      </g>
    </svg>
  );
}
