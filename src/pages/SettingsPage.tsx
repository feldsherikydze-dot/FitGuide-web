// FitGuide Web — страница настроек

import { useState } from 'react';
import { Moon, Sun, Monitor, Bell, BellOff, Database, Download, Upload, RefreshCw, Shield, Info, Palette, Smartphone, Tablet, Laptop, Zap, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { useUIStore, useProfileStore, useCoachStore, useProgramsStore } from '../core/store';
import { PaletteSettings } from '../components/PaletteSettings';
import { KEYS, clearAll, getJSON, setJSON } from '../core/storage';

export function SettingsPage() {
  const { theme, setTheme, sidebarOpen, setSidebarOpen } = useUIStore();
  const { profile, clearProfile } = useProfileStore();
  const { resetCoach } = useCoachStore();
  const { programs, save: savePrograms } = useProgramsStore();

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const handleExport = () => {
    const data = {
      version: '1.13',
      exportDate: new Date().toISOString(),
      profile: getJSON(KEYS.PROFILE, null),
      programs: getJSON(KEYS.PROGRAMS, []),
      coach: getJSON(KEYS.COACH, null),
      settings: getJSON(KEYS.SETTINGS, null),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitguide-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('success', 'Данные экспортированы');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.profile) setJSON(KEYS.PROFILE, data.profile);
        if (data.programs) setJSON(KEYS.PROGRAMS, data.programs);
        if (data.coach) setJSON(KEYS.COACH, data.coach);
        if (data.settings) setJSON(KEYS.SETTINGS, data.settings);
        showToast('success', 'Данные импортированы. Перезагрузи страницу.');
      } catch {
        showToast('error', 'Ошибка чтения файла');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetAll = () => {
    clearAll();
    showToast('success', 'Все данные сброшены. Перезагрузи страницу.');
    setShowResetConfirm(false);
  };

  const getStorageSize = () => {
    let total = 0;
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('fitguide_web_')) {
        total += localStorage.getItem(key)?.length || 0;
      }
    });
    return (total / 1024).toFixed(1);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Настройки</h1>
        <p className="text-slate-500 dark:text-slate-400">Параметры приложения, данные и внешний вид</p>
      </div>

      {/* Палитры (порт ThemeManager) */}
      <PaletteSettings />

      {/* Appearance */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-6">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Palette className="w-5 h-5 text-primary-600" />
          Внешний вид
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Тема</label>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { value: 'light', label: 'Светлая', icon: Sun, desc: 'Всегда светлая' },
                { value: 'dark', label: 'Тёмная', icon: Moon, desc: 'Всегда тёмная' },
                { value: 'system', label: 'По системе', icon: Monitor, desc: 'Авто по настройкам ОС' },
              ].map(t => (
                <button
                  key={t.value}
                  onClick={() => setTheme(t.value as any)}
                  className={clsx(
                    'p-4 rounded-lg border text-left transition-colors flex items-center gap-3',
                    theme === t.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                      : 'border-slate-200 dark:border-dark-border hover:border-primary-300'
                  )}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={t.value}
                    checked={theme === t.value}
                    className="sr-only"
                  />
                  <t.icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                  <div>
                    <div className="font-medium text-slate-900 dark:text-white">{t.label}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">{t.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-dark-border">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={sidebarOpen}
                onChange={e => setSidebarOpen(e.target.checked)}
                className="w-4 h-4 text-primary-600 rounded border-slate-300"
              />
              <div>
                <div className="font-medium text-slate-900 dark:text-white">Показывать боковую панель на десктопе</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">На мобильных всегда скрыта до нажатия меню</div>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-6">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary-600" />
          Уведомления
        </h2>
        <div className="space-y-3">
          {[
            { id: 'workout_reminder', label: 'Напоминания о тренировке', desc: 'Уведомление за 30 мин до запланированной тренировки' },
            { id: 'progress_weekly', label: 'Еженедельный отчёт', desc: 'Сводка прогресса каждую неделю' },
            { id: 'checkin_daily', label: 'Ежедневный чек-ин', desc: 'Напоминание оценить готовность утром' },
            { id: 'rest_timer', label: 'Таймер отдыха', desc: 'Звук и вибрация когда отдых заканчивается' },
          ].map(n => (
            <label key={n.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-dark-border hover:bg-slate-50 dark:hover:bg-dark-bg/50">
              <div>
                <div className="font-medium text-slate-900 dark:text-white">{n.label}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">{n.desc}</div>
              </div>
              <input
                type="checkbox"
                defaultChecked
                className="w-4 h-4 text-primary-600 rounded border-slate-300"
              />
            </label>
          ))}
        </div>
      </div>

      {/* Data Management */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-6">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-primary-600" />
          Данные и резервные копии
        </h2>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-4 border border-slate-200 dark:border-dark-border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-slate-900 dark:text-white">Размер данных</h3>
                <span className="font-mono text-lg text-primary-600 dark:text-primary-400">{getStorageSize()} KB</span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Локальное хранилище браузера</p>
            </div>
            <div className="p-4 border border-slate-200 dark:border-dark-border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-slate-900 dark:text-white">Версия приложения</h3>
                <span className="font-mono text-lg text-primary-600 dark:text-primary-400">1.13</span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Веб-версия FitGuide</p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-dark-border flex flex-wrap gap-3">
            <button onClick={handleExport} className="px-4 py-2 border border-slate-200 dark:border-dark-border rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-border flex items-center gap-2">
              <Download className="w-4 h-4" />
              Экспорт данных (JSON)
            </button>
            <label className="px-4 py-2 border border-slate-200 dark:border-dark-border rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-border flex items-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" />
              Импорт данных
              <input type="file" accept=".json" onChange={handleImport} className="sr-only" />
            </label>
            <button onClick={() => setShowResetConfirm(true)} className="px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Сбросить всё
            </button>
          </div>
        </div>
      </div>

      {/* Privacy & Security */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-6">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary-600" />
          Приватность и безопасность
        </h2>
        <div className="space-y-3 text-sm">
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <div>
              <div className="font-medium text-green-800 dark:text-green-300">Данные хранятся локально</div>
              <div className="text-green-700 dark:text-green-400">Никакие данные не отправляются на серверы. Всё в localStorage твоего браузера.</div>
            </div>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div>
              <div className="font-medium text-blue-800 dark:text-blue-300">Полная работа офлайн</div>
              <div className="text-blue-700 dark:text-blue-400">После первой загрузки приложение работает без интернета (PWA).</div>
            </div>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <div>
              <div className="font-medium text-amber-800 dark:text-amber-300">Очистка кэша браузера</div>
              <div className="text-amber-700 dark:text-amber-400">При очистке «Cookies и данные сайтов» твои тренировки удалятся. Делай экспорт!</div>
            </div>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-6">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Info className="w-5 h-5 text-primary-600" />
          О приложении
        </h2>
        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
          <div className="flex justify-between">
            <span>Название</span>
            <span className="font-medium text-slate-900 dark:text-white">FitGuide Web</span>
          </div>
          <div className="flex justify-between">
            <span>Версия</span>
            <span className="font-medium text-slate-900 dark:text-white">1.13</span>
          </div>
          <div className="flex justify-between">
            <span>Платформа</span>
            <span className="font-medium text-slate-900 dark:text-white">PWA / React + TypeScript + Vite</span>
          </div>
          <div className="flex justify-between">
            <span>Данные</span>
            <span className="font-medium text-slate-900 dark:text-white">localStorage (IndexedDB для больших)</span>
          </div>
          <div className="pt-4 border-t border-slate-200 dark:border-dark-border">
            <p className="text-center">
              Порт Android-приложения FitGuide на веб.{' '}
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                Исходный код на GitHub
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* PWA Install hint */}
      <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl p-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary-600 rounded-xl">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-primary-800 dark:text-primary-300">Установи как приложение</h3>
            <p className="text-sm text-primary-700 dark:text-primary-400 mt-1">
              FitGuide работает как PWA. Нажми в меню браузера «Установить приложение» —
              будет работать офлайн, с иконкой на рабочем столе и в полноэкранном режиме.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}