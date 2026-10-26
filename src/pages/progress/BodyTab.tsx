// Вкладка «Тело» — вес, обхваты, график и целевая форма (порт ProgressFragment).

import { useMemo, useState } from 'react';
import { useBodyLogStore, useProfileStore } from '../../core/store';
import { getString, setString } from '../../core/storage';
import type { BodyLogEntry } from '../../data/types';
import {
  Card, Field, Hint, PrimaryButton, SectionTitle, Toast, formatFullDate, parseNum,
} from './common';
import { MaskIcon, asset } from '../../components/ui';

const TARGETS = [
  {
    id: 'bikini', label: 'Фитнес-бикини',
    text: 'Фитнес-бикини — эстетичная подтянутая форма. Ориентир жира: ~18–21% (ж) / 8–12% (м). '
      + 'Акцент: рельеф, талия и плечи, ягодицы.',
  },
  {
    id: 'bodyfitness', label: 'Бодифитнес',
    text: 'Бодифитнес — атлетичная мышечная форма. Ориентир жира: ~16–19% (ж) / 8–10% (м). '
      + 'Акцент: плотность мышц, кор и ноги.',
  },
  {
    id: 'mens_physique', label: 'Менс физик',
    text: 'Менс физик — V-силуэт. Ориентир жира: 8–10%. Приоритет: плечи, спина и талия; '
      + 'без избыточной массы ног.',
  },
  {
    id: 'classic', label: 'Классик',
    text: 'Классик — симметрия и эстетика. Ориентир жира: 6–8%. Приоритет: пропорции, '
      + 'тонкая талия, детализация мышц.',
  },
  {
    id: 'power', label: 'Пауэрлифтинг',
    text: 'Пауэрлифтинг — результат в приседе, жиме и тяге. Приоритет: сила и техника; '
      + 'допускается больше жира, чем в сушке.',
  },
];

function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return 'Недостаточный вес';
  if (bmi < 25) return 'Норма';
  if (bmi < 30) return 'Избыточный вес';
  return 'Ожирение';
}

function measurements(b: BodyLogEntry): string {
  const parts: string[] = [];
  if (b.chestCm && b.chestCm > 0) parts.push(`Грудь ${b.chestCm.toFixed(1)}`);
  if (b.waistCm && b.waistCm > 0) parts.push(`Талия ${b.waistCm.toFixed(1)}`);
  if (b.bicepsCm && b.bicepsCm > 0) parts.push(`Бицепс ${b.bicepsCm.toFixed(1)}`);
  if (b.hipsCm && b.hipsCm > 0) parts.push(`Бёдра ${b.hipsCm.toFixed(1)}`);
  if (b.thighCm && b.thighCm > 0) parts.push(`Бедро ${b.thighCm.toFixed(1)}`);
  return parts.join(' · ');
}

function WeightChart({ values }: { values: number[] }) {
  const W = 320;
  const H = 160;
  const padL = 32;
  const padR = 36;
  const padT = 14;
  const padB = 22;
  const plotL = padL;
  const plotR = W - padR;
  const plotT = padT;
  const plotB = H - padB;
  const plotW = plotR - plotL;
  const plotH = plotB - plotT;

  if (values.length === 0) {
    return (
      <div className="h-[160px] flex items-center justify-center text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
        —
      </div>
    );
  }

  let minW = Math.min(...values);
  let maxW = Math.max(...values);
  if (Math.abs(maxW - minW) < 0.5) {
    const m = (maxW + minW) / 2;
    minW = m - 1;
    maxW = m + 1;
  }
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  const yFor = (v: number) => plotB - ((v - minW) / (maxW - minW)) * plotH;
  const points = values.map((v, i) => ({
    x: values.length === 1 ? plotL + plotW / 2 : plotL + plotW * i / (values.length - 1),
    y: values.length === 1 ? plotT + plotH / 2 : yFor(v),
  }));
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
      <line x1={plotL} y1={plotT} x2={plotR} y2={plotT} stroke="var(--color-outline)" strokeWidth="0.8" />
      <line x1={plotL} y1={(plotT + plotB) / 2} x2={plotR} y2={(plotT + plotB) / 2} stroke="var(--color-outline)" strokeWidth="0.8" />
      <line x1={plotL} y1={plotB} x2={plotR} y2={plotB} stroke="var(--color-outline)" strokeWidth="0.8" />
      <text x={plotL - 4} y={plotT + 4} textAnchor="end" fontSize="10" fill="var(--color-text-secondary)">{fmt(maxW)}</text>
      <text x={plotL - 4} y={plotB + 3} textAnchor="end" fontSize="10" fill="var(--color-text-secondary)">{fmt(minW)}</text>

      {points.length > 1 && (
        <>
          <path
            d={`M${points[0].x},${plotB} L${points.map(p => `${p.x},${p.y}`).join(' L')} L${last.x},${plotB} Z`}
            fill="var(--p-labels)" opacity="0.10"
          />
          <path
            d={`M${points.map(p => `${p.x},${p.y}`).join(' L')}`}
            fill="none" stroke="var(--p-labels)" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
          />
        </>
      )}
      {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--p-labels)" />)}
      <text x={last.x + 5} y={last.y + 4} fontSize="12" fontWeight="bold" fill="var(--p-labels)">
        {fmt(values[values.length - 1])}
      </text>
    </svg>
  );
}

export function BodyTab() {
  const { logs, addLog, removeLog } = useBodyLogStore();
  const { profile } = useProfileStore();
  const [weight, setWeight] = useState('');
  const [chest, setChest] = useState('');
  const [waist, setWaist] = useState('');
  const [biceps, setBiceps] = useState('');
  const [hips, setHips] = useState('');
  const [thigh, setThigh] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [target, setTarget] = useState(() => getString('target_physique', ''));

  const sorted = useMemo(() => [...logs].sort((a, b) => a.date - b.date), [logs]);
  const latest = sorted[sorted.length - 1];
  const first = sorted[0];

  const showToast = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 2500);
  };

  const save = () => {
    const w = parseNum(weight);
    if (w <= 0) {
      showToast('Укажите вес');
      return;
    }
    addLog({
      id: crypto.randomUUID(),
      date: Date.now(),
      weightKg: w,
      chestCm: parseNum(chest) || undefined,
      waistCm: parseNum(waist) || undefined,
      bicepsCm: parseNum(biceps) || undefined,
      hipsCm: parseNum(hips) || undefined,
      thighCm: parseNum(thigh) || undefined,
    });
    setWeight(''); setChest(''); setWaist(''); setBiceps(''); setHips(''); setThigh('');
    showToast('Запись добавлена');
  };

  const bmi = latest && profile?.heightCm
    ? latest.weightKg / Math.pow(profile.heightCm / 100, 2)
    : 0;

  const delta = latest && first && sorted.length > 1 ? latest.weightKg - first.weightKg : null;
  const targetInfo = TARGETS.find(t => t.id === target);

  return (
    <div className="pb-6 space-y-3">
      <Card className="mt-2">
        <SectionTitle>Новая запись</SectionTitle>
        <div className="mt-2.5 space-y-2">
          <Field value={weight} onChange={setWeight} placeholder="Вес, кг" />
          <div className="flex gap-2">
            <Field value={chest} onChange={setChest} placeholder="Грудь, см" className="flex-1" />
            <Field value={waist} onChange={setWaist} placeholder="Талия, см" className="flex-1" />
          </div>
          <div className="flex gap-2">
            <Field value={biceps} onChange={setBiceps} placeholder="Бицепс, см" className="flex-1" />
            <Field value={hips} onChange={setHips} placeholder="Бёдра, см" className="flex-1" />
          </div>
          <Field value={thigh} onChange={setThigh} placeholder="Бедро, см" />
        </div>
        <PrimaryButton className="mt-3 h-11" onClick={save}>Добавить запись</PrimaryButton>
      </Card>

      <Card>
        <SectionTitle>Текущее состояние</SectionTitle>
        <div className="mt-1 text-[28px] font-bold" style={{ color: 'var(--p-labels)' }}>
          {latest ? `${latest.weightKg.toFixed(1)} кг` : '—'}
        </div>
        {delta !== null && (
          <div className="mt-0.5 text-[13px]" style={{ color: delta < 0 ? 'var(--p-labels)' : 'var(--color-warning)' }}>
            {delta > 0 ? '+' : ''}{delta.toFixed(1)} кг с начала
          </div>
        )}
        {latest && delta === null && (
          <div className="mt-0.5 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
            Первая запись
          </div>
        )}
        {bmi > 0 && (
          <div className="mt-0.5 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
            ИМТ {bmi.toFixed(1)} · {bmiCategory(bmi)}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>Динамика веса</SectionTitle>
        <div className="mt-2">
          <WeightChart values={sorted.map(l => l.weightKg)} />
        </div>
      </Card>

      <Card>
        <SectionTitle>Целевая форма</SectionTitle>
        <Hint className="mt-0.5">
          Условные ориентиры по соревновательным категориям; зависят от роста и индивидуальных особенностей.
        </Hint>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {TARGETS.map(t => {
            const on = target === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  const next = on ? '' : t.id;
                  setTarget(next);
                  setString('target_physique', next);
                }}
                className="min-h-[32px] px-3 rounded-[8px] text-[13px]"
                style={{
                  background: on ? 'var(--p-labels)' : 'var(--color-surface-variant)',
                  border: `1px solid ${on ? 'var(--p-labels)' : 'var(--color-stroke)'}`,
                  color: on ? 'var(--p-on-labels)' : 'var(--color-text-main)',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        {targetInfo && (
          <p className="mt-2.5 text-[13px] leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
            {targetInfo.text}
          </p>
        )}
      </Card>

      <div className="pt-2 text-[14px] font-bold" style={{ color: 'var(--color-text-secondary)' }}>
        История
      </div>

      {logs.length === 0 ? (
        <Hint className="mt-4 text-center whitespace-pre-line">
          {'Нет записей.\nДобавьте свой вес и обхваты — и следите за прогрессом.'}
        </Hint>
      ) : (
        <div>
          {sorted.map((log, i) => {
            const prev = i > 0 ? sorted[i - 1] : null;
            const d = prev ? log.weightKg - prev.weightKg : null;
            const m = measurements(log);
            return (
              <div key={log.id}>
                <div className="flex items-center py-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                        {formatFullDate(log.date)}
                      </span>
                      <span className="text-[16px] font-bold" style={{ color: 'var(--color-text-main)' }}>
                        {log.weightKg.toFixed(1)} кг
                      </span>
                      {d !== null && (
                        <span
                          className="text-[12px]"
                          style={{
                            color: d > 0 ? 'var(--color-warning)'
                              : d < 0 ? 'var(--p-labels)' : 'var(--color-text-secondary)',
                          }}
                        >
                          {d > 0 ? `▲ +${d.toFixed(1)}` : d < 0 ? `▼ ${d.toFixed(1)}` : '— 0.0'}
                        </span>
                      )}
                    </div>
                    {m && (
                      <div className="mt-0.5 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
                        {m}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeLog(log.id)}
                    aria-label="Удалить"
                    className="w-9 h-9 flex items-center justify-center rounded-full active:bg-black/5 flex-shrink-0"
                  >
                    <MaskIcon src={asset('icons/ic_close.svg')} color="var(--color-text-secondary)" size={18} />
                  </button>
                </div>
                <div className="h-px" style={{ background: 'var(--color-outline)' }} />
              </div>
            );
          })}
        </div>
      )}

      <Toast text={toast} />
    </div>
  );
}
