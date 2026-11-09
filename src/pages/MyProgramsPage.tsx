// FitGuide Web — «Тренировки» (порт ProgramActivity + item_program.xml)
//
// Как в Android: шапка, плюс в правом углу, карточки программ с метаданными
// и крестиком удаления. Плюс открывает выбор: своя сборка, чемпионы, генератор.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, asset, MaskIcon } from '../components/ui';
import { useProgramsStore } from '../core/store';
import { GOAL_LABELS, normalizeGoal } from '../core/goals';
import { Toast } from './progress/common';

const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Новичок',
  intermediate: 'Средний',
  advanced: 'Продвинутый',
};

export function MyProgramsPage() {
  const navigate = useNavigate();
  const { programs, remove } = useProgramsStore();
  const [chooser, setChooser] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const deleteProgram = (id: string) => {
    remove(id);
    setToast('Программа удалена');
    window.setTimeout(() => setToast(null), 2000);
  };

  const items = [
    { label: 'Своя сборка (создать лично)', to: '/programs/custom' },
    { label: 'Программы чемпионов', to: '/programs/legends' },
    { label: 'Сгенерировать программу', to: '/programs/new' },
  ];

  return (
    <div className="max-w-2xl mx-auto pb-4 w-full max-w-full">
      <PageHeader
        title="Программы тренировок"
        subtitle="Индивидуальные планы по линейной периодизации"
        onBack={() => navigate('/programs')}
        right={
          <button
            onClick={() => setChooser(true)}
            aria-label="Создать программу"
            className="w-12 h-12 flex items-center justify-center rounded-full active:bg-black/5 flex-shrink-0"
          >
            <MaskIcon src={asset('icons/ic_add.svg')} color="var(--p-labels-text)" size={24} />
          </button>
        }
      />

      {programs.length === 0 ? (
        <div className="px-8 py-16 text-center">
          <p className="text-[14px] leading-relaxed whitespace-pre-line" style={{ color: 'var(--color-text-secondary)' }}>
            {'У вас пока нет программ.\nНажмите «Добавить тренировку» и выберите, что добавить: свою сборку, программу чемпионов или сгенерированную.'}
          </p>
          <button onClick={() => setChooser(true)}
            className="mt-4 h-[50px] px-6 rounded-[25px] text-[16px] font-bold uppercase tracking-[0.089em]"
            style={{ background: 'var(--p-labels)', border: '1px solid var(--p-outline)', color: 'var(--p-labels-text)' }}>
            Добавить тренировку
          </button>
        </div>
      ) : (
        <div className="px-2">
          {programs.map(p => (
            <div key={p.id} className="px-4 pt-4 pb-1 mb-2 rounded-[16px]"
              style={{ background: 'var(--p-labels)', border: '1px solid var(--p-outline)' }}>
              <button onClick={() => navigate(`/programs/${p.id}`)} className="block w-full text-left">
                <div className="text-[16px] font-bold" style={{ color: 'var(--color-text-main)' }}>
                  {p.name}
                </div>
                <div className="mt-1 text-[13px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  {GOAL_LABELS[normalizeGoal(p.goal)] || p.goal} · {LEVEL_LABELS[p.level] || LEVEL_LABELS.intermediate}
                  <br />
                  {p.daysPerWeek} тренировок в неделю · {p.weeks} нед.
                </div>
              </button>
              <div className="flex justify-end">
                <button
                  onClick={() => deleteProgram(p.id)}
                  aria-label="Удалить"
                  className="w-10 h-10 flex items-center justify-center rounded-full active:bg-black/5"
                >
                  <MaskIcon src={asset('icons/ic_close.svg')} color="var(--p-labels-text)" size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {chooser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50"
          onClick={() => setChooser(false)}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: 'var(--p-labels)', border: '1px solid var(--p-outline)' }}
            onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-4 pb-2 text-[18px] font-bold" style={{ color: 'var(--p-on-labels)' }}>
              Что добавить?
            </div>
            {items.map(it => (
              <button key={it.to} onClick={() => { setChooser(false); navigate(it.to); }}
                className="block w-full text-left px-5 py-3.5 text-[15px] active:bg-white/10"
                style={{ color: 'var(--p-on-labels)' }}>
                {it.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <Toast text={toast} />
    </div>
  );
}
