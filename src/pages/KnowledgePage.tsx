// FitGuide Web — база знаний (порт KnowledgeActivity + KnowledgeDetailActivity)

import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BookOpen, ChevronRight, X } from 'lucide-react';
import { PageHeader } from '../components/ui';
import { useKnowledge } from '../hooks/useExercises';
import { knowledgeToHtml } from '../core/knowledge';

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
    <div className="max-w-2xl mx-auto w-full">
      <PageHeader title="Библиотека" onBack={() => navigate('/')} />

      {/* Поле поиска — TextInputLayout OutlinedBox (activity_knowledge.xml):
          без ведущей иконки, только подсказка, крестик очистки справа. */}
      <div
        className="relative mx-4 mt-1 mb-1 flex items-center rounded-[16px]"
        style={{ background: 'var(--p-labels)', border: '1px solid var(--p-outline)' }}
      >
        <input
          type="text"
          placeholder="Поиск по библиотеке"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full bg-transparent outline-none px-4 py-3.5 text-[16px]"
          style={{ color: 'var(--color-text-main)' }}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            aria-label="Очистить"
            className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center active:opacity-70"
          >
            <X className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
          </button>
        )}
      </div>

      {!ready ? (
        <div className="text-center py-12 text-[var(--color-text-secondary)]">Загрузка базы знаний...</div>
      ) : filtered.length === 0 ? (
        <div className="mx-4 text-center py-12" style={{ color: 'var(--color-text-secondary)' }}>
          <BookOpen className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--color-text-secondary)' }} />
          <p>Ничего не найдено</p>
        </div>
      ) : (
        <div className="px-3.5 pt-1.5 pb-4 space-y-3">
          {filtered.map(ch => (
            <button
              key={ch.number || ch.title}
              onClick={() => navigate(`/knowledge/${ch.number}`)}
              className="w-full text-left flex items-center active:opacity-80"
              style={{
                background: 'var(--p-labels)',
                border: '1px solid var(--p-outline)',
                borderRadius: 18,
                padding: '12px 14px',
              }}
            >
              <span
                className="flex-shrink-0 w-10 h-10 rounded-full font-bold text-[13px] flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, var(--p-circle-from), var(--p-circle-to))',
                  color: 'var(--p-on-circle)',
                }}>
                {ch.number || '—'}
              </span>
              <span
                className="flex-1 min-w-0 ml-3.5 text-[15px] font-medium truncate"
                style={{ color: 'var(--color-text-main)' }}
              >
                {ch.title}
              </span>
              <ChevronRight className="w-[18px] h-[18px] flex-shrink-0" style={{ color: 'var(--p-outline)' }} />
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
        className="px-5 pt-1 pb-8 text-[16px] leading-[1.85] select-text text-[var(--color-text-main)] [&_p]:mb-2 [&_p]:last:mb-0"
        dangerouslySetInnerHTML={{ __html: knowledgeToHtml(chapter.content) }}
      />
    </div>
  );
}
