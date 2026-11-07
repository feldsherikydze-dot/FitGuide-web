// FitGuide Web — база знаний (порт KnowledgeActivity + KnowledgeDetailActivity)

import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BookOpen, Search, ChevronRight, List, X } from 'lucide-react';
import { PageHeader } from '../components/ui';
import { useKnowledge } from '../hooks/useExercises';
import { knowledgeToHtml, excerpt } from '../core/knowledge';

export function KnowledgePage() {
  const navigate = useNavigate();
  const { ready, chapters } = useKnowledge();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return chapters;
    const q = query.toLowerCase();
    return chapters.filter(ch =>
      ch.title.toLowerCase().includes(q) || ch.content.toLowerCase().includes(q));
  }, [chapters, query]);

  return (
    <div className="max-w-3xl mx-auto space-y-4 w-full max-w-full">
      <PageHeader title="Библиотека" onBack={() => navigate('/')} />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-secondary)]" />
        <input
          type="text"
          placeholder="Поиск по библиотеке"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-[var(--p-outline)] rounded-lg bg-[var(--p-labels)] text-[var(--p-labels-text)] focus:ring-2 focus:ring-[var(--p-outline)]"
        />
      </div>

      {!ready ? (
        <div className="text-center py-12 text-[var(--color-text-secondary)]">Загрузка базы знаний...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-[var(--p-labels)] rounded-xl border border-[var(--p-outline)]">
          <BookOpen className="w-12 h-12 text-[var(--color-text-secondary)] mx-auto mb-3" />
          <p className="text-[var(--color-text-secondary)]">Ничего не найдено</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(ch => (
            <button
              key={ch.number || ch.title}
              onClick={() => navigate(`/knowledge/${ch.number}`)}
              className="w-full text-left bg-[var(--p-labels)] rounded-xl border border-[var(--p-outline)] p-4 hover:border-[var(--p-outline)] transition-colors"
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex-shrink-0 w-10 h-10 rounded-full font-mono font-bold text-[13px] flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, var(--p-circle-from), var(--p-circle-to))',
                    color: '#FFFFFF',
                  }}>
                  {ch.number || '—'}
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[var(--color-text-main)]">{ch.title}</h3>
                  <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 mt-0.5">{excerpt(ch.content)}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-[var(--color-text-secondary)] flex-shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function KnowledgeDetailPage() {
  const { number } = useParams();
  const navigate = useNavigate();
  const { ready, chapters } = useKnowledge();

  const chapter = chapters.find(c => c.number === number);

  if (!ready) {
    return <div className="text-center py-12 text-[var(--color-text-secondary)]">Загрузка...</div>;
  }

  if (!chapter) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12 w-full max-w-full">
        <BookOpen className="w-12 h-12 text-[var(--color-text-secondary)] mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-[var(--p-labels-text)] mb-2">Глава не найдена</h2>
        <button onClick={() => navigate('/knowledge')}
          className="px-4 py-2 bg-[var(--p-circle)] text-[var(--p-on-circle)] rounded-lg hover:bg-black/5">
          К базе знаний
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto w-full max-w-full">
      <PageHeader title={chapter.title} onBack={() => navigate('/knowledge')} />

      <div
        className="px-5 pt-1 pb-8 text-[16px] leading-relaxed text-[var(--color-text-main)] [&_p]:mb-2 [&_p]:last:mb-0"
        dangerouslySetInnerHTML={{ __html: knowledgeToHtml(chapter.content) }}
      />
    </div>
  );
}
