// FitGuide Web — поиск (порт SearchActivity.java + UnifiedSearch.java)
//
// Ищет по упражнениям, мышцам, базе знаний, спортпиту и программам.

import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Dumbbell, BookOpen, Pill, Calendar, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';
import { useExercises, useKnowledge } from '../hooks/useExercises';
import { usePaletteVars, TopBar, TopBarButton, SearchField } from '../components/ui';
import { useProgramsStore } from '../core/store';
import { additivesForProfile } from '../core/additives';
import { GOAL_LABELS, normalizeGoal } from '../core/goals';

export function SearchPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { exercises, muscleGroups } = useExercises();
  const { chapters } = useKnowledge();
  const { programs: savedPrograms } = useProgramsStore();
  usePaletteVars();

  const [query, setQuery] = useState(params.get('q') || '');

  const q = query.trim().toLowerCase();

  const found = useMemo(() => {
    if (!q) return { ex: [], muscles: [], kb: [], pit: [], programs: [] };

    const ex = exercises.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.target?.toLowerCase().includes(q) ||
      e.equipmentType?.toLowerCase().includes(q));

    const muscles = muscleGroups.filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.subgroups.some(s => s.name.toLowerCase().includes(q)));

    const kb = chapters.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.content.toLowerCase().includes(q));

    const pit = additivesForProfile({
      goal: 'mass', level: 'intermediate', budget: 'medium',
      weightKg: 80, age: 30, gender: 'male',
    }).filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.why.toLowerCase().includes(q));

    const programs = savedPrograms.filter(p =>
      p.name.toLowerCase().includes(q));

    return { ex, muscles, kb, pit, programs };
  }, [q, exercises, muscleGroups, chapters, savedPrograms]);

  const total = found.ex.length + found.muscles.length + found.kb.length
    + found.pit.length + found.programs.length;

  const Group = ({ title, icon: Icon, children }: any) => (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-2 px-1">
        <Icon className="w-4 h-4" style={{ color: 'var(--p-labels)' }} />
        <span className="text-[13px] font-bold uppercase tracking-wide"
          style={{ color: 'var(--color-text-secondary)' }}>{title}</span>
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-stroke)' }}>
        {children}
      </div>
    </div>
  );

  const Row = ({ title, sub, onClick }: { title: string; sub?: string; onClick: () => void }) => (
    <button onClick={onClick} className="w-full p-3.5 text-left flex items-center gap-3 active:opacity-70"
      style={{ borderBottom: '1px solid var(--color-stroke)' }}>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate" style={{ color: 'var(--color-text-main)' }}>{title}</div>
        {sub && <div className="text-sm truncate" style={{ color: 'var(--color-text-secondary)' }}>{sub}</div>}
      </div>
      <ArrowRight className="w-4 h-4 flex-shrink-0 opacity-40" />
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar
        title="Поиск"
        subtitle="Упражнения, мышцы, база знаний, спортпит, программы"
        right={<TopBarButton onClick={() => navigate(-1)} icon="/icons/ic_close.svg" label="Закрыть" />}
      />

      <SearchField value={query} onChange={setQuery} placeholder="Мышца, пучок, упражнение…" />

      <div className="flex-1 fg-scroll px-4 pb-8">
        {!q && (
          <div className="text-center py-16" style={{ color: 'var(--color-text-secondary)' }}>
            <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Начни вводить — поиск идёт по всей базе</p>
          </div>
        )}

        {q && total === 0 && (
          <div className="text-center py-16" style={{ color: 'var(--color-text-secondary)' }}>
            <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Ничего не найдено по запросу «{query}»</p>
          </div>
        )}

        {found.ex.length > 0 && (
          <Group title={`Упражнения (${found.ex.length})`} icon={Dumbbell}>
            {found.ex.slice(0, 30).map(e => (
              <Row key={e.id} title={e.name} sub={e.target || e.equipmentType}
                onClick={() => navigate(`/exercises?open=${e.id}`)} />
            ))}
          </Group>
        )}

        {found.muscles.length > 0 && (
          <Group title={`Мышцы (${found.muscles.length})`} icon={Dumbbell}>
            {found.muscles.map(g => (
              <Row key={g.id} title={g.name} sub={g.subgroups.map(s => s.name).join(', ')}
                onClick={() => navigate(`/exercises?group=${g.id}`)} />
            ))}
          </Group>
        )}

        {found.kb.length > 0 && (
          <Group title={`База знаний (${found.kb.length})`} icon={BookOpen}>
            {found.kb.slice(0, 20).map(c => (
              <Row key={c.number + c.title} title={c.title} sub={`Глава ${c.number}`}
                onClick={() => navigate(`/knowledge/${c.number}`)} />
            ))}
          </Group>
        )}

        {found.pit.length > 0 && (
          <Group title={`Спортпит (${found.pit.length})`} icon={Pill}>
            {found.pit.map(a => (
              <Row key={a.key} title={a.name} sub={a.dose} onClick={() => navigate('/nutrition')} />
            ))}
          </Group>
        )}

        {found.programs.length > 0 && (
          <Group title={`Программы (${found.programs.length})`} icon={Calendar}>
            {found.programs.map(p => (
              <Row key={p.id} title={p.name} sub={GOAL_LABELS[normalizeGoal(p.goal)] || p.goal}
                onClick={() => navigate(`/programs/${p.id}`)} />
            ))}
          </Group>
        )}
      </div>
    </div>
  );
}
