// FitGuide Web — поиск (порт SearchActivity.java + UnifiedSearch.java)
//
// Как в Android: шапка «Поиск», поле с иконкой и крестиком, ниже — плоский
// список карточек (группы, пучки, упражнения, база знаний, спортпит, программы).
// Карточка: фон (B), обводка (A), иконка (C), заголовок textMain, подпись textSecondary.

import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useExercises, useKnowledge } from '../hooks/useExercises';
import { useProfileStore } from '../core/store';
import { PageHeader, MaskIcon, asset } from '../components/ui';
import { additivesForProfile } from '../core/additives';
import { LEGEND_CATALOG } from '../core/legends';

const MAX_KNOWLEDGE = 8;
const MAX_ADDITIVES = 8;
const MAX_PROGRAMS = 6;

interface Hit {
  key: string;
  title: string;
  sub: string;
  icon: string;
  go: () => void;
}

export function SearchPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { exercises, muscleGroups } = useExercises();
  const { chapters } = useKnowledge();
  const { profile } = useProfileStore();

  const [query, setQuery] = useState(params.get('q') || '');
  const q = query.trim().toLowerCase();

  const hits = useMemo<Hit[]>(() => {
    if (!q) return [];
    const out: Hit[] = [];

    // Группы мышц → пучки → упражнения (порядок DataProvider.search).
    for (const g of muscleGroups) {
      if (g.name.toLowerCase().includes(q)) {
        out.push({
          key: `g:${g.id}`, title: g.name, sub: 'Группа мышц',
          icon: asset('icons/ic_tool_strength.svg'),
          go: () => navigate(`/exercises?group=${g.id}`),
        });
      }
    }
    for (const g of muscleGroups) {
      for (const sg of g.subgroups) {
        if (sg.name.toLowerCase().includes(q)) {
          out.push({
            key: `sg:${g.id}:${sg.id}`, title: sg.name, sub: g.name,
            icon: asset('icons/ic_tool_strength.svg'),
            go: () => navigate(`/exercises?group=${g.id}`),
          });
        }
      }
    }
    for (const e of exercises) {
      if (e.name.toLowerCase().includes(q) || (e.target || '').toLowerCase().includes(q)) {
        out.push({
          key: `e:${e.id}`, title: e.name, sub: e.target || '',
          icon: asset('icons/ic_tool_strength.svg'),
          go: () => navigate(`/exercises?open=${e.id}`),
        });
      }
    }

    let k = 0;
    for (const c of chapters) {
      if ((c.title + ' ' + c.content).toLowerCase().includes(q)) {
        out.push({
          key: `k:${c.number}`, title: c.title, sub: 'База знаний',
          icon: asset('icons/ic_knowledge.svg'),
          go: () => navigate(`/knowledge/${c.number}`),
        });
        if (++k >= MAX_KNOWLEDGE) break;
      }
    }

    let a = 0;
    for (const it of additivesForProfile({
      goal: profile?.goal || 'mass',
      level: profile?.level || 'beginner',
      budget: 'medium',
      weightKg: profile?.weightKg || 0,
      age: profile?.age || 0,
      gender: profile?.gender || 'male',
    })) {
      const hay = (it.name + ' ' + it.dose + ' ' + it.why).toLowerCase();
      if (hay.includes(q)) {
        out.push({
          key: `a:${it.key}`, title: it.name, sub: `Спортпит · ${it.dose}`,
          icon: asset('icons/ic_tool_kbju.svg'),
          go: () => navigate('/nutrition'),
        });
        if (++a >= MAX_ADDITIVES) break;
      }
    }

    let p = 0;
    for (const it of LEGEND_CATALOG) {
      const hay = (it.name + ' ' + it.author + ' ' + it.description).toLowerCase();
      if (hay.includes(q)) {
        out.push({
          key: `p:${it.id}`, title: it.name, sub: `Программа · ${it.author}`,
          icon: asset('icons/ic_tool_program.svg'),
          go: () => navigate('/programs/legends'),
        });
        if (++p >= MAX_PROGRAMS) break;
      }
    }

    return out;
  }, [q, exercises, muscleGroups, chapters, profile, navigate]);

  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto w-full">
      <PageHeader title="Поиск" onBack={() => navigate(-1)} />

      {/* Поле поиска — search_field_bg: surfaceVariant, обводка outline, радиус 16 */}
      <div
        className="flex items-center min-h-[58px] mx-2 mb-2 px-4 py-3 rounded-[16px]"
        style={{ background: 'var(--color-surface-variant)', border: '1px solid var(--color-outline)' }}
      >
        <MaskIcon src={asset('icons/ic_search.svg')} color="var(--color-text-secondary)" size={20} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Мышца, пучок, упражнение…"
          className="flex-1 min-w-0 ml-2.5 bg-transparent outline-none text-[16px]"
          style={{ color: 'var(--color-text-main)' }}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            aria-label="Очистить"
            className="w-12 h-12 flex items-center justify-center flex-shrink-0 active:opacity-70"
          >
            <MaskIcon src={asset('icons/ic_close.svg')} color="var(--color-text-secondary)" size={20} />
          </button>
        )}
      </div>

      <div className="flex-1 fg-scroll pt-1.5 pb-4">
        {hits.map(h => (
          <button
            key={h.key}
            onClick={h.go}
            className="w-full flex items-center mx-4 mb-3 px-3.5 py-3 rounded-[18px] text-left active:opacity-80"
            style={{
              width: 'calc(100% - 32px)',
              background: 'var(--p-labels)',
              border: '1px solid var(--p-outline)',
            }}
          >
            <span className="w-11 h-11 flex items-center justify-center flex-shrink-0">
              <MaskIcon src={h.icon} color="var(--p-circle)" size={34} />
            </span>
            <span className="flex-1 min-w-0 ml-3.5">
              <span className="block text-[15px] font-bold truncate" style={{ color: 'var(--color-text-main)' }}>
                {h.title}
              </span>
              <span className="block mt-0.5 text-[12px] truncate" style={{ color: 'var(--color-text-secondary)' }}>
                {h.sub}
              </span>
            </span>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--p-labels-text)"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        ))}

        {hits.length === 0 && (
          <p className="px-8 pb-12 pt-16 text-center text-[15px] leading-relaxed"
            style={{ color: 'var(--color-text-secondary)' }}>
            {q ? 'Ничего не найдено' : 'Упражнения, база знаний, спортпит, программы'}
          </p>
        )}
      </div>
    </div>
  );
}
