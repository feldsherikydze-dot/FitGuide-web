// FitGuide Web — «Эквалайзер» (порт PlayerEqActivity + activity_player_eq.xml).
//
// 5 полос 60/230/910/3.6k/14k Гц, пресеты, усиление басов, виртуализатор и
// выравнивание громкости. Всё применяется сразу: полосы — BiquadFilter,
// бас — lowshelf, громкость — компрессор с компенсацией, виртуализатор —
// расширение стереобазы (mid/side). На потоках (радио, онлайн) граф не
// подключается: у них нет CORS-заголовков.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, usePaletteVars } from '../components/ui';
import { getEq, setEq, type EqState } from '../core/player';

const BANDS = ['60 Гц', '230 Гц', '910 Гц', '3.6 кГц', '14 кГц'];

// Значения — в дБ, как массивы short[] в PlayerEqActivity (там миллибелы).
const PRESETS: { name: string; bands: number[] }[] = [
  { name: 'Равномерно', bands: [0, 0, 0, 0, 0] },
  { name: 'Рок', bands: [4, 2, 0, -2, 4] },
  { name: 'Поп', bands: [-2, 0, 2, 4, 2] },
  { name: 'Джаз', bands: [0, 4, 2, 0, -2] },
  { name: 'Классика', bands: [-4, -2, 0, 2, 4] },
  { name: 'Басы', bands: [6, 4, 2, 0, -2] },
  { name: 'Высокие', bands: [-2, 0, 2, 4, 6] },
];

function fmtDb(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)} дБ`;
}

/** Material CheckBox: рамка (A), включён — заливка (C) и галочка. */
function CheckRow({ checked, label, onChange, className }: {
  checked: boolean; label: string; onChange: (v: boolean) => void; className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`w-full flex items-center gap-3 py-2.5 text-left active:opacity-80 ${className || ''}`}
    >
      <span
        className="w-5 h-5 rounded-[4px] flex items-center justify-center flex-shrink-0"
        style={{
          border: `2px solid ${checked ? 'var(--p-circle)' : 'var(--p-outline)'}`,
          background: checked ? 'var(--p-circle)' : 'transparent',
        }}
      >
        {checked && (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="var(--p-on-circle)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
      </span>
      <span className="text-[15px] leading-snug" style={{ color: 'var(--color-text-main)' }}>
        {label}
      </span>
    </button>
  );
}

export function MusicEqPage() {
  usePaletteVars();
  const navigate = useNavigate();
  const [eq, setEqLocal] = useState<EqState>(getEq);

  const update = (patch: Partial<EqState>) => {
    setEq(patch);
    setEqLocal(getEq());
  };

  const setBand = (i: number, db: number) => {
    const bands = eq.bands.slice();
    bands[i] = Math.round(db * 100) / 100;
    update({ bands });
  };

  return (
    <div className="max-w-2xl mx-auto w-full pb-8" style={{ background: 'var(--color-bg)' }}>
      <PageHeader title="Эквалайзер" onBack={() => navigate('/music')} />

      <div className="px-4">
        <CheckRow
          checked={eq.on}
          label="Эквалайзер включён"
          onChange={v => update({ on: v })}
          className="mt-1"
        />
        <CheckRow checked={eq.bass} label="Усиление басов" onChange={v => update({ bass: v })} />
        <CheckRow checked={eq.virt} label="Виртуализатор" onChange={v => update({ virt: v })} />
        <CheckRow
          checked={eq.loud}
          label="Выравнивать громкость между треками"
          onChange={v => update({ loud: v })}
          className="mt-2"
        />

        <div className="mt-3">
          {BANDS.map((name, i) => (
            <div key={name} className="py-2">
              <div className="flex items-baseline justify-between">
                <span className="text-[14px] font-medium" style={{ color: 'var(--color-text-main)' }}>
                  {name}
                </span>
                <span className="text-[13px] tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                  {fmtDb(eq.bands[i])}
                </span>
              </div>
              <input
                type="range"
                min={-15}
                max={15}
                step={0.15}
                value={eq.bands[i]}
                onChange={e => setBand(i, Number(e.target.value))}
                className="w-full mt-1"
                style={{ accentColor: 'var(--p-circle)' }}
              />
            </div>
          ))}
        </div>

        <div className="mt-4 text-[16px] font-bold" style={{ color: 'var(--color-text-main)' }}>
          Пресеты
        </div>
        <div className="mt-1 flex flex-col gap-1.5">
          {PRESETS.map(p => (
            <button
              key={p.name}
              type="button"
              onClick={() => update({ bands: p.bands.slice() })}
              className="w-full h-11 rounded-[22px] text-[14px] font-medium active:opacity-80"
              style={{
                background: 'var(--p-labels)',
                border: '1px solid var(--p-outline)',
                color: 'var(--p-labels-text)',
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
