// FitGuide Web — база знаний (порт KnowledgeActivity + KnowledgeDetailActivity)

import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { clsx } from 'clsx';
import { BookOpen, Search, ChevronLeft, ChevronRight, List, X } from 'lucide-react';
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Поиск по главам..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-[var(--p-outline)] rounded-lg bg-[var(--p-labels)] text-[var(--p-labels-text)] focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {!ready ? (
        <div className="text-center py-12 text-[var(--color-text-secondary)]">Загрузка базы знаний...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-[var(--p-labels)] rounded-xl border border-[var(--p-outline)]">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
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
                <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-mono font-bold text-sm flex items-center justify-center">
                  {ch.number || '—'}
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[var(--p-labels-text)]">{ch.title}</h3>
                  <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 mt-0.5">{excerpt(ch.content)}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
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
  const index = chapters.findIndex(c => c.number === number);
  const prev = index > 0 ? chapters[index - 1] : null;
  const next = index >= 0 && index < chapters.length - 1 ? chapters[index + 1] : null;

  if (!ready) {
    return <div className="text-center py-12 text-[var(--color-text-secondary)]">Загрузка...</div>;
  }

  if (!chapter) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12 w-full max-w-full">
        <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-[var(--p-labels-text)] mb-2">Глава не найдена</h2>
        <button onClick={() => navigate('/knowledge')}
          className="px-4 py-2 bg-[var(--p-circle)] text-[#000000] rounded-lg hover:bg-primary-700">
          К базе знаний
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 w-full max-w-full">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/knowledge')}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-dark-border">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-sm text-[var(--color-text-secondary)]">Глава {chapter.number}</span>
        <div className="w-9" />
      </div>

      <h1 className="text-2xl font-bold text-[var(--p-labels-text)]">{chapter.title}</h1>

      <div
        className="bg-[var(--p-labels)] rounded-xl border border-[var(--p-outline)] p-5 text-[var(--color-text-secondary)] leading-relaxed [&_p]:mb-2 [&_p]:last:mb-0"
        dangerouslySetInnerHTML={{ __html: knowledgeToHtml(chapter.content) }}
      />

      <div className="flex items-center justify-between gap-3 pt-2">
        {prev ? (
          <button onClick={() => navigate(`/knowledge/${prev.number}`)}
            className="flex-1 text-left p-3 rounded-lg border border-[var(--p-outline)] hover:bg-slate-50 dark:hover:bg-dark-border/50 min-w-0">
            <div className="text-xs text-[var(--color-text-secondary)]">← Предыдущая</div>
            <div className="text-sm font-medium text-[var(--p-labels-text)] truncate">{prev.title}</div>
          </button>
        ) : <div className="flex-1" />}

        {next ? (
          <button onClick={() => navigate(`/knowledge/${next.number}`)}
            className="flex-1 text-right p-3 rounded-lg border border-[var(--p-outline)] hover:bg-slate-50 dark:hover:bg-dark-border/50 min-w-0">
            <div className="text-xs text-[var(--color-text-secondary)]">Следующая →</div>
            <div className="text-sm font-medium text-[var(--p-labels-text)] truncate">{next.title}</div>
          </button>
        ) : <div className="flex-1" />}
      </div>
    </div>
  );
}
