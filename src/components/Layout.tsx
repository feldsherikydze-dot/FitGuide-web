// FitGuide Web — основной лейаут

import { useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { Dumbbell, Menu, X, User, Settings, BookOpen, Timer, Music, Zap, HeartPulse } from 'lucide-react';
import { useUIStore } from '../core/store';

const NAV_ITEMS = [
  { path: '/', label: 'Тренер', icon: Zap },
  { path: '/programs', label: 'Программы', icon: BookOpen },
  { path: '/workout', label: 'Тренировка', icon: Dumbbell },
  { path: '/progress', label: 'Прогресс', icon: HeartPulse },
  { path: '/exercises', label: 'Упражнения', icon: Dumbbell },
  { path: '/timer', label: 'Таймер', icon: Timer },
  { path: '/music', label: 'Музыка', icon: Music },
  { path: '/profile', label: 'Профиль', icon: User },
  { path: '/settings', label: 'Настройки', icon: Settings },
] as const;

export function Layout() {
  const { sidebarOpen, theme, toggleSidebar } = useUIStore();
  useLocation();

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-bg flex">
      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-dark-card border-r border-slate-200 dark:border-dark-border',
          'transform transition-transform duration-300 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        aria-label="Навигация"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200 dark:border-dark-border">
            <NavLink to="/" className="flex items-center gap-2 text-xl font-bold text-primary-600 dark:text-primary-400">
              <Dumbbell className="w-6 h-6" />
              FitGuide
            </NavLink>
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-border"
              onClick={toggleSidebar}
              aria-label="Закрыть меню"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto" role="navigation" aria-label="Основная навигация">
            {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) => clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-border'
                )}
                onClick={() => toggleSidebar()}
              >
                <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-dark-border">
            <div className="text-xs text-slate-500 dark:text-slate-400 text-center">
              FitGuide Web v1.13
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay для мобильных */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}

      {/* Main content */}
      <main className="flex-1 lg:ml-64 min-w-0">
        <div className="p-4 lg:p-6 pt-16 lg:pt-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile menu toggle */}
      <button
        className="lg:hidden fixed bottom-4 right-4 z-50 p-3 rounded-full bg-primary-600 text-white shadow-lg"
        onClick={toggleSidebar}
        aria-label={sidebarOpen ? 'Закрыть меню' : 'Открыть меню'}
      >
        {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>
    </div>
  );
}