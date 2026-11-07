// Экран добавки (порт SportPitDetailActivity + activity_sportpit_detail.xml).
// Шапка с названием, градиентная плашка с описанием, список продуктов, примечание.

import { useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/ui';
import { additivesForProfile } from '../core/additives';
import type { Additive } from '../core/additives';
import { GOALS_ALL, normalizeGoal } from '../core/goals';

const LEVELS = ['beginner', 'intermediate', 'advanced'];
const BUDGETS = ['econom', 'medium', 'premium'];

/** Ищем добавку по ключу: сначала в выбранной связке, потом перебором остальных. */
function findAdditive(key: string, goal: string, level: string, budget: string): Additive | null {
  const base = { weightKg: 0, age: 0, gender: 'male' };
  const direct = additivesForProfile({ ...base, goal, level, budget }).find(a => a.key === key);
  if (direct) return direct;
  for (const g of GOALS_ALL) {
    for (const l of LEVELS) {
      for (const b of BUDGETS) {
        const hit = additivesForProfile({ ...base, goal: g, level: l, budget: b }).find(a => a.key === key);
        if (hit) return hit;
      }
    }
  }
  return null;
}

export function SportPitDetailPage() {
  const navigate = useNavigate();
  const { key = '' } = useParams();
  const [params] = useSearchParams();
  const goal = normalizeGoal(params.get('goal') || 'maintain');
  const level = params.get('level') || 'beginner';
  const budget = params.get('budget') || 'medium';

  const additive = useMemo(
    () => findAdditive(key, goal, level, budget),
    [key, goal, level, budget],
  );

  const name = additive?.name || 'Добавка';

  return (
    <div className="max-w-2xl mx-auto w-full flex flex-col min-h-[calc(100vh-56px)]">
      <PageHeader title={name} onBack={() => navigate(-1)} />

      <div className="px-4 pt-1 pb-8">
        <div className="fg-banner-grad px-4 py-[18px]">
          <div className="text-[20px] font-bold" style={{ color: 'var(--color-text-main)' }}>
            {name}
          </div>
          {additive?.dose && (
            <div className="pt-1.5 text-[13px]" style={{ color: 'var(--p-labels)' }}>
              Дозировка: {additive.dose}
            </div>
          )}
          {additive?.why && (
            <p className="pt-3 text-[14px] leading-relaxed" style={{ color: 'var(--color-text-main)' }}>
              {additive.why}
            </p>
          )}
        </div>

        <div className="mt-[22px] text-[16px] font-bold" style={{ color: 'var(--color-text-main)' }}>
          Рекомендуемые варианты
        </div>

        {(additive?.products || []).map((p, i) => (
          <div key={`${p.name}-${i}`} className="fg-banner-grad mt-2.5 px-3.5 py-3">
            <div className="text-[15px] font-bold" style={{ color: 'var(--color-text-main)' }}>
              {p.best ? `★ ${p.name}` : `•  ${p.name}`}
            </div>
            {(p.format || p.price) && (
              <div className="pt-1 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                {[p.format, p.price].filter(Boolean).join('  ·  ')}
              </div>
            )}
            {p.best && (
              <div className="pt-1.5 text-[12px] font-bold" style={{ color: 'var(--p-labels)' }}>
                Рекомендуемый выбор
              </div>
            )}
          </div>
        ))}

        {(additive?.products || []).length === 0 && (
          <p className="mt-2.5 text-[13px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            Рекомендации по конкретным продуктам скоро появятся.
          </p>
        )}

        <p className="mt-[18px] text-[12px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          Перед приёмом добавок проконсультируйтесь с врачом. Не заменяйте полноценное питание добавками.
        </p>
      </div>
    </div>
  );
}
