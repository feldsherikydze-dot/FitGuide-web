// FitGuide Web — хаб «Программы» (порт ProgramHubActivity + activity_program_hub.xml)
//
// Точная копия Android: шапка «Программы» с подзаголовком, раздел «Разделы»,
// карточки тренера, моих программ, легенд, генератора и своей сборки,
// затем раздел «Учёба» с базой упражнений.

import { useNavigate } from 'react-router-dom';
import { PageHeader, HubCard, HubSection, asset } from '../components/ui';

export function ProgramHubPage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto pb-4 w-full max-w-full">
      <PageHeader
        title="Программы"
        onBack={() => navigate('/')}
        right={null}
      />
      <div className="px-3">
        <div className="-mt-1 mb-2 ml-1 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
          Лучшие программы и база упражнений
        </div>

        <HubSection>Разделы</HubSection>

        <HubCard
          icon={asset('icons/ic_tool_coach.svg')}
          title="Карманный тренер"
          subtitle="Прогрессия весов"
          onClick={() => navigate('/coach')}
        />
        <HubCard
          icon={asset('icons/ic_tool_workout.svg')}
          title="Мои программы"
          subtitle="Перечень выбранных тренировок"
          onClick={() => navigate('/programs/mine')}
        />
        <HubCard
          icon={asset('icons/ic_tool_program.svg')}
          title="Программы легенд"
          subtitle="Лучшие программы чемпионов и бодибилдинга"
          onClick={() => navigate('/programs/legends')}
        />
        <HubCard
          icon={asset('icons/ic_add.svg')}
          title="Генератор"
          subtitle="Создать программу по анкете: с периодизацией и без"
          onClick={() => navigate('/programs/new')}
        />
        <HubCard
          icon={asset('icons/ic_tool_strength.svg')}
          title="Своя сборка"
          subtitle="Собрать тренировочный комплекс из упражнений"
          onClick={() => navigate('/programs/custom')}
        />

        <HubSection>Учёба</HubSection>
        <HubCard
          icon={asset('icons/ic_knowledge.svg')}
          title="База упражнений"
          subtitle="Изучай упражнения по мышечным группам"
          onClick={() => navigate('/exercises')}
        />
      </div>
    </div>
  );
}
