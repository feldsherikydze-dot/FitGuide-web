// Хаб «Мой прогресс» — порт ProgressHubActivity + activity_hub.xml.
// 5 вкладок: Журнал, Рекорды, 1ПМ, Тело, Анализ. Выбранная — цветом темы,
// индикатор 2px снизу, остальные — textSecondary. Контент скроллится.

import { useMemo, useState } from 'react';
import type React from 'react';
import { PageHeader } from '../components/ui';
import { AnalysisTab } from './progress/AnalysisTab';
import { BodyTab } from './progress/BodyTab';
import { JournalTab } from './progress/JournalTab';
import { OneRmTab } from './progress/OneRmTab';
import { RecordsTab } from './progress/RecordsTab';

const TABS = [
  { key: 'journal', label: 'Журнал' },
  { key: 'records', label: 'Рекорды' },
  { key: 'one_rm', label: '1ПМ' },
  { key: 'body', label: 'Тело' },
  { key: 'analysis', label: 'Анализ' },
];

const RENDER: Record<string, () => React.ReactElement> = {
  journal: () => <JournalTab />,
  records: () => <RecordsTab />,
  one_rm: () => <OneRmTab />,
  body: () => <BodyTab />,
  analysis: () => <AnalysisTab />,
};

export function ProgressHubPage() {
  const [tab, setTab] = useState<string>('journal');
  const Comp = RENDER[tab] || JournalTab;

  return (
    <div className="max-w-2xl mx-auto pb-4 w-full flex flex-col min-h-[calc(100vh-56px)] max-w-full">
      <PageHeader title="Мой прогресс" onBack={() => window.history.back()} />

      {/* Tab bar: фиксированная ширина каждой, как TabLayout в Android. */}
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
