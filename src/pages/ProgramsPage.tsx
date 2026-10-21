// FitGuide Web — страница программ

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Edit, Copy, Play, Dumbbell, Zap, Settings, X, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { useProgramsStore } from '../core/store';
import { useProfileStore } from '../core/store';
import { generateProgram, type GeneratorInput } from '../core/generator';
import { useExercises } from '../hooks/useExercises';
import type { Program } from '../data/types';

const GOAL_OPTIONS = [
  { value: 'strength', label: 'Сила', desc: 'Низкие повторы, большие веса, длинный отдых' },
  { value: 'hypertrophy', label: 'Масса/Гипертрофия', desc: '8-12 повторений, умеренный отдых' },
  { value: 'endurance', label: 'Выносливость', desc: '15+ повторений, короткий отдых' },
  { value: 'fat_loss', label: 'Похудение/Сушка', desc: 'Смешанный режим, высокий темп' },
] as const;

const LEVEL_OPTIONS = [
  { value: 'beginner', label: 'Новичок (0-1 год)', desc: 'Меньше объём, больше отдых, безопасные упражнения' },
  { value: 'intermediate', label: 'Средний (1-3 года)', desc: 'Стандартные объёмы и интенсивность' },
  { value: 'advanced', label: 'Продвинутый (3+ года)', desc: 'Высокие объёмы, продвинутая периодизация' },
] as const;

const TYPE_OPTIONS = [
  { value: 'auto', label: 'Авто (подбор под дни)', desc: 'Система сама выберет оптимальный сплит' },
  { value: 'fullbody', label: 'Фулбоди', desc: 'Все тело за тренировку, 2-3 раза в неделю' },
  { value: 'split', label: 'Сплит', desc: 'Разделение по группам мышц (Push/Pull/Legs и др.)' },
  { value: 'circuit', label: 'Круговая', desc: 'Минимальный отдых, кардионагрузка' },
] as const;

const PERIOD_OPTIONS = [
  { value: 'none', label: 'Без периодизации', desc: 'Одинаковая нагрузка все недели' },
  { value: 'linear', label: 'Линейная', desc: 'Накопление → Интенсификация → Реализация' },
  { value: 'wave', label: 'Волновая (DUP)', desc: 'Чередование объёма и интенсивности' },
] as const;

export function ProgramsPage() {
  const navigate = useNavigate();
  const { programs, add, update, remove, getById, load } = useProgramsStore();
  const { profile } = useProfileStore();
  const { db } = useExercises();

  const [showGenerator, setShowGenerator] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [genForm, setGenForm] = useState<GeneratorInput>({
    goals: ['hypertrophy'],
    level: 'intermediate',
    direction: 'any',
    type: 'auto',
    daysPerWeek: 3,
    weeks: 8,
    periodization: 'linear',
    location: 'gym',
    age: profile ? Math.floor((Date.now() - new Date(profile.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : undefined,
    gender: profile?.gender,
    equipment: profile?.equipment,
  });

  const handleGenerate = () => {
    if (!db) return;
    const program = generateProgram(genForm, db);
    add(program);
    setShowGenerator(false);
    navigate(`/programs/${program.id}`);
  };

  const handleDuplicate = (program: Program) => {
    const copy: Program = {
      ...program,
      id: crypto.randomUUID(),
      name: program.name + ' (копия)',
      createdAt: Date.now(),
    };
    add(copy);
  };

  const handleDelete = (id: string) => {
    if (confirm('Удалить программу? Это действие нельзя отменить.')) {
      remove(id);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Программы</h1>
          <p className="text-slate-500 dark:text-slate-400">
            {programs.length} сохранено · Создай новую или отредактируй существующую
          </p>
        </div>
        <button
          onClick={() => setShowGenerator(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Новая программа
        </button>
      </div>

      {/* Generator Modal */}
      {showGenerator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-dark-card rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-dark-card border-b border-slate-200 dark:border-dark-border p-4 rounded-t-2xl flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Генератор программ</h2>
              <button onClick={() => setShowGenerator(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-dark-border rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Goals */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Цели (ведущая первая)</label>
                <div className="flex flex-wrap gap-2">
                  {GOAL_OPTIONS.map(g => (
                    <label key={g.value} className={clsx(
                      'px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors',
                      genForm.goals.includes(g.value)
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'border-slate-200 dark:border-dark-border hover:border-primary-300'
                    )}>
                      <input
                        type="checkbox"
                        checked={genForm.goals.includes(g.value)}
                        onChange={e => setGenForm(f => ({
                          ...f,
                          goals: e.target.checked
                            ? [g.value, ...f.goals.filter(x => x !== g.value)]
                            : f.goals.filter(x => x !== g.value)
                        }))}
                        className="sr-only"
                      />
                      <div className="font-medium">{g.label}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{g.desc}</div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Level, Direction, Type */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Уровень</label>
                  <select
                    value={genForm.level}
                    onChange={e => setGenForm(f => ({ ...f, level: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  >
                    {LEVEL_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Направление</label>
                  <select
                    value={genForm.direction}
                    onChange={e => setGenForm(f => ({ ...f, direction: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  >
                    {[
                      { value: 'any', label: 'Любое' },
                      { value: 'powerlifting', label: 'Пауэрлифтинг' },
                      { value: 'bodybuilding', label: 'Бодибилдинг' },
                    ].map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Тип программы</label>
                  <select
                    value={genForm.type}
                    onChange={e => setGenForm(f => ({ ...f, type: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  >
                    {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Days, Weeks, Periodization */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Дней в неделю</label>
                  <select
                    value={genForm.daysPerWeek}
                    onChange={e => setGenForm(f => ({ ...f, daysPerWeek: parseInt(e.target.value) as 2 | 3 | 4 | 5 | 6 }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  >
                    {[2,3,4,5,6].map(d => <option key={d} value={d}>{d} дня</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Недель (мезоцикл)</label>
                  <input
                    type="number"
                    value={genForm.weeks}
                    onChange={e => setGenForm(f => ({ ...f, weeks: parseInt(e.target.value) }))}
                    min={4}
                    max={24}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Периодизация</label>
                  <select
                    value={genForm.periodization}
                    onChange={e => setGenForm(f => ({ ...f, periodization: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  >
                    {PERIOD_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Location, Equipment */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Место тренировок</label>
                  <select
                    value={genForm.location}
                    onChange={e => setGenForm(f => ({ ...f, location: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="gym">Зал (полное оборудование)</option>
                    <option value="home">Дом (минимальное оборудование)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Доступное оборудование</label>
                  <div className="flex flex-wrap gap-2">
                    {['barbell', 'dumbbell', 'cable', 'smith', 'machine'].map(eq => (
                      <label key={eq} className={clsx(
                        'px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors',
                        genForm.equipment?.includes(eq)
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'border-slate-200 dark:border-dark-border hover:border-primary-300'
                      )}>
                        <input
                          type="checkbox"
                          checked={genForm.equipment?.includes(eq)}
                          onChange={ev => setGenForm(f => ({
                            ...f,
                            equipment: ev.target.checked
                              ? [...(f.equipment || []), eq]
                              : (f.equipment || []).filter(x => x !== eq)
                          }))}
                          className="sr-only"
                        />
                        {eq.charAt(0).toUpperCase() + eq.slice(1)}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-dark-border">
                <button
                  onClick={() => setShowGenerator(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-dark-border rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-border"
                >
                  Отмена
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={!db}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  <Zap className="w-4 h-4 inline mr-1" />
                  Сгенерировать
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Programs List */}
      {programs.length === 0 && !showGenerator ? (
        <div className="text-center py-12 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border">
          <Dumbbell className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Программ пока нет</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6">Создай свою первую тренировочную программу</p>
          <button
            onClick={() => setShowGenerator(true)}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Создать программу
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map(program => (
            <div key={program.id} className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border overflow-hidden hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 dark:text-white truncate">{program.name}</h3>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mt-1">
                      <span>{program.daysPerWeek} дн/нед</span>
                      <span>·</span>
                      <span>{program.weeks} нед</span>
                      <span>·</span>
                      <span className="capitalize">{program.level}</span>
                    </div>
                  </div>
                  {editingId === program.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditingId(null)} className="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg" title="Сохранить">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-dark-border rounded-lg" title="Отмена">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button onClick={() => navigate(`/programs/${program.id}`)} className="p-2 text-primary-600 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-lg" title="Открыть">
                        <Play className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingId(program.id)} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-dark-border rounded-lg" title="Редактировать">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDuplicate(program)} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-dark-border rounded-lg" title="Дублировать">
                        <Copy className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(program.id)} className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg" title="Удалить">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {program.goal && <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">{program.goal}</span>}
                  {program.template && <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded text-xs">{program.template}</span>}
                  {program.phases.some(p => p.deload) && <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded text-xs">Есть разгрузка</span>}
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Создана: {new Date(program.createdAt).toLocaleDateString('ru-RU')}
                </div>
              </div>

              {/* Phases preview */}
              <div className="border-t border-slate-200 dark:border-dark-border p-4 bg-slate-50 dark:bg-dark-bg/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Фазы</span>
                  <button
                    onClick={() => setEditingId(editingId === program.id ? null : program.id)}
                    className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                  >
                    {editingId === program.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {editingId === program.id ? 'Скрыть' : 'Показать'}
                  </button>
                </div>
                {editingId === program.id && (
                  <div className="space-y-2">
                    {program.phases.map((phase, i) => (
                      <div key={i} className="bg-white dark:bg-dark-card rounded-lg border border-slate-200 dark:border-dark-border p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm text-slate-900 dark:text-white">{phase.label}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">Недели {phase.weekStart}–{phase.weekEnd}</span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Схема: {phase.scheme} {phase.deload ? '· 🔄 Разгрузочная' : ''}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {phase.days.map((day, di) => (
                            <span key={di} className="px-2 py-0.5 bg-slate-100 dark:bg-dark-border rounded text-xs text-slate-600 dark:text-slate-400">
                              {day.title} ({day.slots.length} упр.)
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}