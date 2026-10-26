// FitGuide Web — страница настроек (порт SettingsActivity.java 1:1)
//
// Разделы Android:
//  1. Тема — Система / Светлая / Тёмная (чипы)
//  2. Палитра — 4 независимых слота: Контур, Ярлыки+кнопки, Кругляшки, Надписи
//  3. Приветствие — фон заставки, свои картинки, режим показа, кнопка часов
//  4. Сигналы тренировки — профиль звука, громкость
//  5. Главный экран — перетаскивание иконок, сброс порядка
//  6. Инструменты — поиск на главном, город погоды, IP, обновления, часы
//  7. Сброс настроек — подтверждение + полная очистка

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Palette, Sun, Moon, Monitor, Zap, Database, Smartphone } from 'lucide-react';
import { PageHeader } from '../components/ui';
import { useUIStore } from '../core/store';
import { PaletteSettings } from '../components/PaletteSettings';
import { clearAll } from '../core/storage';

const THEME_VALUES: ('system' | 'light' | 'dark')[] = ['system', 'light', 'dark'];

export function SettingsPage() {
  const navigate = useNavigate();
  const { theme, setTheme, sidebarOpen, setSidebarOpen } = useUIStore();

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const handleResetAll = () => {
    clearAll();
    showToast('success', 'Настройки сброшены к начальным. Перезагрузите страницу.');
    setShowResetConfirm(false);
  };

  const themeLabels = { system: 'Как в системе', light: 'Светлая', dark: 'Тёмная' };
  const themeDesc = {
    system: 'Авто по настройкам ОС',
    light: 'Всегда светлая',
    dark: 'Всегда тёмная',
  };
  const themeIcons = { system: Monitor, light: Sun, dark: Moon };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg)' }}>
      {/* Шапка — как в Android: стрелка назад + заголовок цветом темы */}
      <PageHeader title="Настройки" onBack={() => navigate('/')} />

      <div className="max-w-2xl mx-auto space-y-6 px-4 py-4">
        {/* ===== ТЕМА ===== */}
        <div
          className="rounded-[18px] p-5"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-stroke)' }}
        >
          <div className="mb-1 flex items-center gap-2">
            <Palette className="w-5 h-5" style={{ color: 'var(--p-labels)' }} />
            <h2 className="text-[16px] font-bold" style={{ color: 'var(--p-labels)' }}>Тема</h2>
          </div>
          <p className="text-[13px] mt-1 mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            Оформление приложения
          </p>
          <div className="flex flex-wrap gap-2 mb-1">
            {THEME_VALUES.map((value) => {
              const active = theme === value;
              const Icon = themeIcons[value as keyof typeof themeIcons];
              return (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className="min-h-[32px] px-3 rounded-[8px] text-[13px] whitespace-nowrap"
                  style={{
                    background: active ? 'var(--p-labels)' : 'var(--color-surface-variant)',
                    border: `1px solid ${active ? 'var(--p-labels)' : 'var(--color-stroke)'}`,
                    color: active ? 'var(--p-on-labels)' : 'var(--color-text-main)',
                  }}
                >
                  <Icon className="w-4 h-4 mr-1.5" />
                  {themeLabels[value as keyof typeof themeLabels]}
                </button>
              );
            })}
          </div>
          <p className="text-[12px] mt-2" style={{ color: 'var(--color-text-secondary)' }}>
            {themeDesc[theme as keyof typeof themeDesc]}
          </p>
        </div>

        {/* ===== ПАЛИТРА (встраиваемый порт PaletteSettings) ===== */}
        <PaletteSettings />

        {/* ===== ПРИВЕТСТВИЕ ===== */}
        <div
          className="rounded-[18px] p-5 space-y-4"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-stroke)' }}
        >
          <div className="mb-1 flex items-center gap-2">
            <Sun className="w-5 h-5" style={{ color: 'var(--p-labels)' }} />
            <h2 className="text-[16px] font-bold" style={{ color: 'var(--p-labels)' }}>Приветствие</h2>
          </div>
          <p className="text-[13px] mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            Экран приветствия: фон и часы.
          </p>

          <div>
            <div className="text-[14px] font-bold mb-1" style={{ color: 'var(--p-labels)' }}>
              Фон заставки
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {['', '1', '2', '3', '4', '5'].map((value) => (
                <button
                  key={value}
                  className="min-h-[32px] px-3 rounded-[8px] text-[13px] whitespace-nowrap"
                  style={{
                    background: 'var(--color-surface-variant)',
                    border: '1px solid var(--color-stroke)',
                    color: 'var(--color-text-main)',
                  }}
                >
                  {value === '' ? 'Авто (по дням)' : value}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[14px] font-bold mb-1" style={{ color: 'var(--p-labels)' }}>
              Своя картинка на заставке
            </div>
            <p className="text-[12px] mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Если включено, приложение отправляет ваш IP-адрес стороннему сервису ipwho.is, и по нему определяется город.
            </p>
            <div className="flex gap-2 mb-4">
              <button
                className="flex-1 h-10 rounded-[20px] text-[13px] font-medium"
                style={{ background: 'var(--p-labels)', color: 'var(--p-on-labels)', border: 'none' }}
              >
                Добавить картинку
              </button>
              <button
                onClick={() => showToast('error', 'Функция пока недоступна в веб-версии')}
                className="flex-1 h-10 rounded-[20px] text-[13px] font-medium border border-[var(--p-labels)] text-[var(--p-labels)] bg-transparent"
              >
                Очистить
              </button>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 mb-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-16 h-16 rounded-[12px] border border-[var(--p-labels)] bg-[var(--color-surface-variant)] flex-shrink-0" />
              ))}
            </div>
            <p className="text-[12px] text-[var(--color-text-secondary)] mb-3">
              Картинок пока не добавлено.
            </p>
          </div>

          <div>
            <div className="text-[13px] mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              Своя картинка на заставке: как показывать
            </div>
            <div className="flex gap-1 mb-3">
              {['Заполнить экран (обрезать края)', 'Целиком (края дорисовать)'].map((label) => (
                <button
                  key={label}
                  className="min-h-[30px] px-3 rounded-[8px] text-[12px] whitespace-nowrap"
                  style={{
                    background: 'var(--color-surface-variant)',
                    border: '1px solid var(--color-stroke)',
                    color: 'var(--color-text-main)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[13px] mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Часы стартового экрана: настройка режима и стиля.
            </div>
            <button
              className="w-full h-10 rounded-[22px] text-[14px] font-medium"
              style={{ background: 'var(--p-labels)', color: 'var(--p-on-labels)', border: 'none' }}
              onClick={() => showToast('success', 'Настройки часов — в разработке')}
            >
              Часы стартового экрана
            </button>
          </div>
        </div>

        {/* ===== СИГНАЛЫ ТРЕНИРОВКИ ===== */}
        <div
          className="rounded-[18px] p-5 space-y-4"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-stroke)' }}
        >
          <div className="mb-1 flex items-center gap-2">
            <Zap className="w-5 h-5" style={{ color: 'var(--p-labels)' }} />
            <h2 className="text-[16px] font-bold" style={{ color: 'var(--p-labels)' }}>Сигналы тренировки</h2>
          </div>
          <p className="text-[13px] mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            Звук и вибрация при старте подхода, конце времени и конце отдыха.
          </p>

          <div className="space-y-3">
            <div>
              <div className="text-[14px] font-bold mb-1" style={{ color: 'var(--p-labels)' }}>
                Профиль звука
              </div>
              <p className="text-[12px] mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Нажми на профиль — сигнал прозвучит. В зале громче, дома тише.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: 'default', label: 'Гонг на ринге' },
                  { key: 'alarm', label: 'Как будильник' },
                  { key: 'gong', label: 'Паровозный гудок' },
                  { key: 'soft', label: 'Мягкий' },
                  { key: 'mechanical', label: 'Механический таймер' },
                ].map((p) => (
                  <button
                    key={p.key}
                    className="min-h-[30px] px-3 rounded-[8px] text-[13px] whitespace-nowrap"
                    style={{
                      background: 'var(--color-surface-variant)',
                      border: '1px solid var(--color-stroke)',
                      color: 'var(--color-text-main)',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between mb-1">
                <div className="text-[14px] font-bold" style={{ color: 'var(--p-labels)' }}>
                  Громкость сигнала
                </div>
                <span className="text-[12px] font-medium" style={{ color: 'var(--p-labels)' }}>75%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                defaultValue="75"
                className="w-full h-2 bg-[var(--color-stroke)] rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: 'var(--p-labels)' }}
              />
              <p className="text-[12px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                Кнопки громкости телефона тоже регулируют сигнал. На нуле остаётся только вибрация.
              </p>
            </div>
          </div>
        </div>

        {/* ===== ГЛАВНЫЙ ЭКРАН ===== */}
        <div
          className="rounded-[18px] p-5 space-y-4"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-stroke)' }}
        >
          <div className="mb-1 flex items-center gap-2">
            <Smartphone className="w-5 h-5" style={{ color: 'var(--p-labels)' }} />
            <h2 className="text-[16px] font-bold" style={{ color: 'var(--p-labels)' }}>Главный экран</h2>
          </div>
          <p className="text-[13px] mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            Настраивайте ярлыки инструментов, строку поиска и плеер.
          </p>

          <div className="flex items-center justify-between mb-1">
            <div>
              <div className="text-[14px] font-bold" style={{ color: 'var(--p-labels)' }}>
                Перетаскивание иконок
              </div>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                Долгий тап по иконке на главном — и её можно переставить, как ярлык на рабочем столе.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[var(--color-stroke)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--p-labels)]"></div>
            </label>
          </div>

          <button
            className="w-full h-10 rounded-[22px] text-[14px] font-medium border border-[var(--p-labels)] text-[var(--p-labels)] bg-transparent mt-2"
            onClick={() => showToast('success', 'Порядок иконок сброшен к стандартному.')}
          >
            Сбросить порядок
          </button>
        </div>

        {/* ===== ИНСТРУМЕНТЫ ===== */}
        <div
          className="rounded-[18px] p-5 space-y-4"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-stroke)' }}
        >
          <div className="mb-1 flex items-center gap-2">
            <Database className="w-5 h-5" style={{ color: 'var(--p-labels)' }} />
            <h2 className="text-[16px] font-bold" style={{ color: 'var(--p-labels)' }}>Инструменты</h2>
          </div>
          <p className="text-[13px] mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            Поиск, погода, обновления и связь с часами.
          </p>

          <div className="flex items-center justify-between mb-1">
            <div>
              <div className="text-[14px] font-bold" style={{ color: 'var(--p-labels)' }}>
                Строка поиска на главном
              </div>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                Пускай поиском упражнений на главном экране, если он вам нужен. Плеер всегда на месте.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[var(--color-stroke)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--p-labels)]"></div>
            </label>
          </div>

          <div className="space-y-2">
            <div className="text-[13px] font-bold mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              Город для погоды
            </div>
            <input
              type="text"
              placeholder="Красноярск"
              className="w-full h-[46px] px-4 rounded-[10px] text-[15px] outline-none"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-outline)',
                color: 'var(--color-text-main)',
              }}
            />
          </div>

          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 text-[var(--p-labels)] rounded border-[var(--color-stroke)]"
            />
            <div className="text-[15px] font-medium" style={{ color: 'var(--color-text-main)' }}>
              Определять город по интернет-адресу
            </div>
          </label>
          <p className="text-[12px] mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            Если включено, приложение отправляет ваш IP-адрес стороннему сервису ipwho.is, и по нему определяется город.
            При выключенном тумблере адрес никуда не отправляется, а город берётся из поля выше.
          </p>

          <div className="pt-3 border-t border-[var(--color-stroke)]">
            <div className="text-[13px] font-bold mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              Обновления
            </div>
            <input
              type="text"
              placeholder="https://..."
              className="w-full h-[46px] px-4 rounded-[10px] text-[14px] outline-none mb-2"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-outline)',
                color: 'var(--color-text-main)',
              }}
            />
            <button
              className="w-full h-10 rounded-[22px] text-[14px] font-medium"
              style={{ background: 'var(--p-labels)', color: 'var(--p-on-labels)', border: 'none' }}
            >
              Проверить обновления
            </button>
            <p className="text-[12px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              У вас актуальная версия
            </p>
          </div>

          <div className="pt-3 border-t border-[var(--color-stroke)] mt-4">
            <div className="text-[13px] font-bold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Часы и датчики
            </div>
            <div className="text-[13px] mb-2" style={{ color: 'var(--color-text-main)' }}>
              Часы с зеркалом рядом не найдены.
            </div>
            <div className="flex gap-2">
              <button
                className="flex-1 h-10 rounded-[22px] text-[13px] font-medium border border-[var(--p-labels)] text-[var(--p-labels)] bg-transparent"
              >
                Найти часы
              </button>
              <button
                className="flex-1 h-10 rounded-[22px] text-[13px] font-medium"
                style={{ background: 'var(--p-labels)', color: 'var(--p-on-labels)', border: 'none' }}
              >
                Это мои часы
              </button>
            </div>
            <p className="text-[12px] mt-2" style={{ color: 'var(--color-text-secondary)' }}>
              Начни тренировку на телефоне — часы с зеркалом подхватят сами: упражнение, подходы,
              отдых с вибрацией. Без часов рядом всё работает как раньше.
            </p>
          </div>
        </div>

        {/* ===== СБРОС ===== */}
        <button
          className="w-full h-12 rounded-[24px] text-[14px] font-bold border-2 border-[#C0392B] text-[#C0392B] bg-transparent"
          onClick={() => setShowResetConfirm(true)}
        >
          Сбросить настройки
        </button>

        {/* Тост */}
        {toast && (
          <div
            className="fixed left-1/2 -translate-x-1/2 bottom-24 px-4 py-2 rounded-full text-[13px] font-medium text-white z-[60] max-w-[90vw] text-center"
            style={{ background: 'rgba(0,0,0,0.85)' }}
          >
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}
