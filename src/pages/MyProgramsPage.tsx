// FitGuide Web — «Тренировки» (порт ProgramActivity + item_program.xml)
//
// Как в Android: шапка, плюс в правом углу, карточки программ с метаданными
// и крестиком удаления. Плюс открывает выбор: своя сборка, чемпионы, генератор.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, asset, MaskIcon } from '../components/ui';
import { useProgramsStore } from '../core/store';
import { GOAL_LABELS, normalizeGoal } from '../core/goals';

const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Новичок',
  intermediate: 'Средний',
  advanced: 'Продвинутый',
};

export function MyProgramsPage() {
  const navigate = useNavigate();
  const { programs, remove } = useProgramsStore();
  const [chooser, setChooser] = useState(false);

  const items = [
    { label: 'Своя сборка (создать лично)', to: '/programs/custom' },
    { label: 'Программы чемпионов', to: '/programs/legends' },
    { label: 'Сгенерировать программу', to: '/programs/new' },
  ];

  return (
    <div className="max-w-2xl mx-auto pb-4 w-full max-w-full">
      <PageHeader
        title="Тренировки"
        onBack={() => navigate('/programs')}
        right={
          <button
            onClick={() => setChooser(true)}
            aria-label="Создать программу"
            className="w-12 h-12 flex items-center justify-center rounded-full active:bg-black/5 flex-shrink-0"
          >
            <MaskIcon src={asset('icons/ic_add.svg')} color="var(--p-labels)" size={24} />
          </button>
        }
      />
      <div className="-mt-1 mb-2 ml-4 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
        Перечень выбранных программ
      </div>

      {programs.length === 0 ? (
        <div className="px-8 py-16 text-center">
          <p className="text-[14px] leading-relaxed whitespace-pre-line" style={{ color: 'var(--color-text-secondary)' }}>
            {'Тренировок пока нет.\nНажмите «Добавить тренировку» и выберите, что добавить.'}
          </p>
          <button onClick={() => setChooser(true)} className="mt-4 h-[50px] px-6 rounded-[25px] text-[16px] font-bold text-white"
            style={{ background: 'var(--p-labels)', color: 'var(--p-on-labels)' }}>
            Добавить тренировку
          </button>
        </div>
      ) : (
        <div className="px-2">
          {programs.map(p => (
            <div key={p.id} className="px-4 pt-4 pb-1 mb-2 rounded-[16px]"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-stroke)' }}>
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
                  onClick={() => remove(p.id)}
                  aria-label="Удалить"
                  className="w-10 h-10 flex items-center justify-center rounded-full active:bg-black/5"
                >
                  <MaskIcon src={asset('icons/ic_close.svg')} color="var(--color-warning)" size={20} />
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
            style={{ background: 'var(--color-surface)' }}
            onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-4 pb-2 text-[18px] font-bold" style={{ color: 'var(--color-text-main)' }}>
              Что добавить?
            </div>
            {items.map(it => (
              <button key={it.to} onClick={() => { setChooser(false); navigate(it.to); }}
                className="block w-full text-left px-5 py-3.5 text-[15px] active:bg-black/5"
                style={{ color: 'var(--color-text-main)' }}>
                {it.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
