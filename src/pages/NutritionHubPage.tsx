// Хаб «Питание» — порт NutritionHubActivity.
// 4 вкладки: КБЖУ, Кухня, Спортпит, Дневник.

import { useState } from 'react';
import type React from 'react';
import { PageHeader } from '../components/ui';
import { KbjuTab } from './nutrition/KbjuTab';
import { KitchenTab } from './nutrition/KitchenTab';
import { SportPitTab } from './nutrition/SportPitTab';
import { DiaryTab } from './nutrition/DiaryTab';

const TABS = [
  { key: 'kbju', label: 'КБЖУ' },
  { key: 'kitchen', label: 'Кухня' },
  { key: 'sportpit', label: 'Спортпит' },
  { key: 'diary', label: 'Дневник' },
];

const RENDER: Record<string, () => React.ReactElement> = {
  kbju: () => <KbjuTab />,
  kitchen: () => <KitchenTab />,
  sportpit: () => <SportPitTab />,
  diary: () => <DiaryTab />,
};

export function NutritionHubPage() {
  const [tab, setTab] = useState<string>('kbju');
  const Comp = RENDER[tab] || KbjuTab;

  return (
    <div className="max-w-2xl mx-auto pb-4 w-full flex flex-col min-h-[calc(100vh-56px)] max-w-full">
      <PageHeader title="Питание" onBack={() => window.history.back()} />

      <div className="flex border-b" style={{ borderColor: 'var(--color-stroke)' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-1 py-3.5 text-center border-b-2 transition-colors"
            style={{
              borderColor: tab === t.key ? 'var(--p-labels)' : 'transparent',
              color: tab === t.key ? 'var(--p-labels)' : 'var(--color-text-secondary)',
              fontWeight: tab === t.key ? 700 : 400,
              fontSize: 13,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <Comp />
      </div>
    </div>
  );
}
