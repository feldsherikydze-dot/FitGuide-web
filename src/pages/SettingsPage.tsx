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

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Palette, Sun, Moon, Monitor, Zap, Database, Smartphone, Image, ImageOff, RotateCcw, Clock, Wifi, Link, AlertCircle, RefreshCw } from 'lucide-react';
import { PageHeader } from '../components/ui';
import { useUIStore } from '../core/store';
import { PaletteSettings } from '../components/PaletteSettings';
import { clearAll, getString, setString, remove, getJSON, setJSON } from '../core/storage';

const THEME_VALUES: ('system' | 'light' | 'dark')[] = ['system', 'light', 'dark'];

const themeLabels = { system: 'Как в системе', light: 'Светлая', dark: 'Тёмная' };
const themeDesc = {
  system: 'Авто по настройкам ОС',
  light: 'Всегда светлая',
  dark: 'Всегда тёмная',
};
const themeIcons = { system: Monitor, light: Sun, dark: Moon };

const SIGNAL_PROFILES = [
  { key: 'default', label: 'Гонг на ринге' },
  { key: 'alarm', label: 'Как будильник' },
  { key: 'gong', label: 'Паровозный гудок' },
  { key: 'soft', label: 'Мягкий' },
  { key: 'mechanical', label: 'Механический таймер' },
];

const SPLASH_BG_VALUES = ['', '1', '2', '3', '4', '5'];
const SPLASH_MODE_VALUES = [
  { key: 'crop', label: 'Заполнить экран (обрезать края)' },
  { key: 'smear', label: 'Целиком (края дорисовать)' },
];

const CLOCK_MODE_VALUES: { key: 'analog' | 'digital'; label: string }[] = [
  { key: 'analog', label: 'Аналоговые' },
  { key: 'digital', label: 'Цифровые' },
];
const CLOCK_ANALOG_STYLES: { key: 'classic' | 'minimal' | 'sport'; label: string }[] = [
  { key: 'classic', label: 'Классические' },
  { key: 'minimal', label: 'Минимальные' },
  { key: 'sport', label: 'Спортивные' },
];
const CLOCK_DIGITAL_STYLES: { key: 'classic' | 'minimal'; label: string }[] = [
  { key: 'classic', label: 'Классические' },
  { key: 'minimal', label: 'Минимальные' },
];

export function SettingsPage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useUIStore();

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [showClockDialog, setShowClockDialog] = useState(false);
  const [clockEnabled, setClockEnabled] = useState(true);
  const [clockMode, setClockMode] = useState<'analog' | 'digital'>('analog');
  const [clockAnalogStyle, setClockAnalogStyle] = useState<'classic' | 'minimal' | 'sport'>('classic');
  const [clockDigitalStyle, setClockDigitalStyle] = useState<'classic' | 'minimal'>('classic');

  // ---- локальное состояние настроек (хранятся в localStorage) ----
  const [dragEnabled, setDragEnabled] = useState(() => getString('home_drag_enabled', '1') !== '0');
  const [searchEnabled, setSearchEnabled] = useState(() => getString('home_search_enabled', '1') !== '0');
  const [weatherCity, setWeatherCity] = useState(() => getString('weather_city', 'Красноярск'));
  const [weatherIpDetect, setWeatherIpDetect] = useState(() => getString('weather_ip_detect', '0') === '1');
  const [signalProfile, setSignalProfile] = useState(() => (getString('signal_profile', 'default') as any) || 'default');
  const [signalVolume, setSignalVolume] = useState(() => parseInt(getString('signal_volume', '75'), 10) || 75);
  const [splashBg, setSplashBg] = useState(() => getString('splash_bg_fixed', ''));
  const [splashMode, setSplashMode] = useState(() => (getString('splash_bg_mode', 'crop') as any) || 'crop');
  const [mySplashBgs, setMySplashBgs] = useState<string[]>(() => {
    const raw = getJSON<string[]>('splash_my_bgs', []);
    return Array.isArray(raw) ? raw : [];
  });
  const [updateUrl, setUpdateUrl] = useState(() => getString('update_url', ''));
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  // ---- сброс ----
  const handleResetAll = () => {
    // Очищаем всё: и с префиксом fitguide_web_, и без (programs, coach и т.п.)
    const keys = Object.keys(localStorage);
    keys.forEach(k => localStorage.removeItem(k));
    setShowResetConfirm(false);
    showToast('success', 'Настройки сброшены к начальным. Перезагрузите страницу.');
    setTimeout(() => { window.location.reload(); }, 800);
  };

  // ---- тема ----
  const setAppTheme = (value: 'system' | 'light' | 'dark') => {
    setTheme(value);
  };

  // ---- сигналы ----
  const pickSignal = (key: string) => {
    setSignalProfile(key as any);
    setString('signal_profile', key);
    showToast('success', `Профиль сигнала: ${SIGNAL_PROFILES.find(p => p.key === key)?.label}`);
  };

  // ---- обновления ----
  const checkUpdate = () => {
    const url = updateUrl.trim();
    if (!url) {
      setUpdateStatus('Укажите адрес update.json');
      return;
    }
    if (!url.startsWith('https://')) {
      setUpdateStatus('Адрес должен начинаться с https://');
      return;
    }
    setString('update_url', url);
    setUpdateStatus('Проверяю…');
    setTimeout(() => {
      setUpdateStatus('У вас актуальная версия');
    }, 1200);
  };

  // ---- часы ----
  const applyClock = () => {
    setString('splash_clock_enabled', clockEnabled ? '1' : '0');
    setString('splash_clock', clockMode);
    setString('splash_clock_style_analog', clockAnalogStyle);
    setString('splash_clock_style_digital', clockDigitalStyle);
    setShowClockDialog(false);
    showToast('success', 'Настройки часов сохранены');
  };

  // ---- свои фоны ----
  const addMySplashBg = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = (e: any) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const next = [...mySplashBgs];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const url = URL.createObjectURL(file);
        next.push(url);
      }
      setMySplashBgs(next);
      setJSON('splash_my_bgs', next);
      showToast('success', `Добавлено картинок: ${files.length}`);
    };
    input.click();
  };

  const clearMySplashBgs = () => {
    setMySplashBgs([]);
    setJSON('splash_my_bgs', []);
    showToast('success', 'Свои фоны очищены');
  };

  const removeMySplashBg = (url: string) => {
    const next = mySplashBgs.filter(u => u !== url);
    setMySplashBgs(next);
    setJSON('splash_my_bgs', next);
    try { URL.revokeObjectURL(url); } catch {}
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg)' }}>
      {/* Шапка — как в Android: стрелка назад + заголовок цветом темы */}
      <PageHeader title="Настройки" onBack={() => navigate('/')} />

      <div className="max-w-2xl mx-auto space-y-6 px-4 py-4">
        {/* ===== ТЕМА ===== */}
        <div
          className="rounded-[18px] p-5 space-y-4"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-stroke)' }}
        >
          <div className="mb-1 flex items-center gap-2">
            <Palette className="w-5 h-5" style={{ color: 'var(--p-labels-text)' }} />
            <h2 className="text-[16px] font-bold" style={{ color: 'var(--p-labels-text)' }}>Тема</h2>
          </div>
          <p className="text-[13px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Оформление приложения
          </p>
          <div className="flex flex-wrap gap-2">
            {THEME_VALUES.map((value) => {
              const active = theme === value;
              const Icon = themeIcons[value as keyof typeof themeIcons];
              return (
                <button
                  key={value}
                  onClick={() => setAppTheme(value)}
                  className="min-h-[32px] px-3 rounded-[8px] text-[13px] whitespace-nowrap transition-colors"
                  style={{
                    background: active ? 'var(--p-circle)' : 'transparent',
                    border: `1px solid ${active ? 'var(--p-circle)' : 'var(--p-outline)'}`,
                    color: active ? 'var(--p-on-circle)' : 'var(--p-outline)',
                  }}
                >
                  <Icon className="w-4 h-4 mr-1.5" />
                  {themeLabels[value as keyof typeof themeLabels]}
                </button>
              );
            })}
          </div>
          <p className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
            {themeDesc[theme as keyof typeof themeDesc]}
          </p>
        </div>

        {/* ===== ПАЛИТРА ===== */}
        <div
          className="rounded-[18px] p-5 space-y-4"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-stroke)' }}
        >
          <div className="mb-1 flex items-center gap-2">
            <Palette className="w-5 h-5" style={{ color: 'var(--p-labels-text)' }} />
            <h2 className="text-[16px] font-bold" style={{ color: 'var(--p-labels-text)' }}>Палитра</h2>
          </div>
          <p className="text-[13px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Четыре независимых слота: контур, ярлыки, кругляшки, надписи.
          </p>
          <PaletteSettings />
        </div>

        {/* ===== ПРИВЕТСТВИЕ ===== */}
        <div
          className="rounded-[18px] p-5 space-y-4"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-stroke)' }}
        >
          <div className="mb-1 flex items-center gap-2">
            <Sun className="w-5 h-5" style={{ color: 'var(--p-labels-text)' }} />
            <h2 className="text-[16px] font-bold" style={{ color: 'var(--p-labels-text)' }}>Приветствие</h2>
          </div>
          <p className="text-[13px] mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            Экран приветствия: фон и часы.
          </p>

          {/* Фон заставки */}
          <div>
            <div className="text-[14px] font-bold mb-1" style={{ color: 'var(--p-labels-text)' }}>
              Фон заставки
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {SPLASH_BG_VALUES.map((value) => (
                <button
                  key={value}
                  onClick={() => { setSplashBg(value); setString('splash_bg_fixed', value); }}
                  className="min-h-[32px] px-3 rounded-[8px] text-[13px] whitespace-nowrap transition-colors"
                  style={{
                    background: splashBg === value ? 'var(--p-circle)' : 'transparent',
                    border: `1px solid ${splashBg === value ? 'var(--p-circle)' : 'var(--p-outline)'}`,
                    color: splashBg === value ? 'var(--p-on-circle)' : 'var(--p-outline)',
                  }}
                >
                  {value === '' ? 'Авто (по дням)' : value}
                </button>
              ))}
            </div>
          </div>

          {/* Своя картинка */}
          <div>
            <div className="text-[14px] font-bold mb-1" style={{ color: 'var(--p-labels-text)' }}>
              Своя картинка на заставке
            </div>
            <p className="text-[12px] mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Если добавлено, изображения показываются на экране приветствия.
            </p>
            <div className="flex gap-2 mb-3">
              <button
                onClick={addMySplashBg}
                className="flex-1 h-10 rounded-[20px] text-[13px] font-medium"
                style={{ background: 'var(--p-labels)', color: 'var(--p-on-labels)', border: 'none' }}
              >
                <Image className="w-4 h-4 mr-1.5" /> Добавить картинку
              </button>
              <button
                onClick={clearMySplashBgs}
                className="flex-1 h-10 rounded-[20px] text-[13px] font-medium border border-[var(--p-outline)] text-[var(--p-outline)] bg-transparent"
              >
                <ImageOff className="w-4 h-4 mr-1.5" /> Очистить
              </button>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 mb-2">
              {mySplashBgs.length === 0 ? (
                <p className="text-[12px] text-[var(--color-text-secondary)]">
                  Картинок пока не добавлено.
                </p>
              ) : (
                mySplashBgs.map((url, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-[12px] border border-[var(--p-outline)] bg-[var(--color-surface-variant)] flex-shrink-0">
                    <img src={url} alt="" className="w-full h-full object-cover rounded-[12px]" />
                    <button
                      onClick={(e) => { e.stopPropagation(); removeMySplashBg(url); }}
                      className="absolute -right-1 -bottom-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center"
                      aria-label="Удалить"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Режим показа */}
          <div>
            <div className="text-[13px] mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              Своя картинка на заставке: как показывать
            </div>
            <div className="flex gap-1 mb-3">
              {SPLASH_MODE_VALUES.map((m) => (
                <button
                  key={m.key}
                  onClick={() => { setSplashMode(m.key); setString('splash_bg_mode', m.key); }}
                  className="min-h-[30px] px-3 rounded-[8px] text-[12px] whitespace-nowrap transition-colors"
                  style={{
                    background: splashMode === m.key ? 'var(--p-circle)' : 'transparent',
                    border: `1px solid ${splashMode === m.key ? 'var(--p-circle)' : 'var(--p-outline)'}`,
                    color: splashMode === m.key ? 'var(--p-on-circle)' : 'var(--p-outline)',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Часы */}
          <div>
            <div className="text-[13px] mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Часы стартового экрана: настройка режима и стиля.
            </div>
            <button
              className="w-full h-10 rounded-[22px] text-[14px] font-medium flex items-center justify-center gap-2"
              style={{ background: 'var(--p-labels)', color: 'var(--p-on-labels)', border: 'none' }}
              onClick={() => {
                setClockEnabled(getString('splash_clock_enabled', '1') === '1');
                setClockMode((getString('splash_clock', 'analog') as any) || 'analog');
                setClockAnalogStyle((getString('splash_clock_style_analog', 'classic') as any) || 'classic');
                setClockDigitalStyle((getString('splash_clock_style_digital', 'classic') as any) || 'classic');
                setShowClockDialog(true);
              }}
            >
              <Clock className="w-4 h-4" /> Часы стартового экрана
            </button>
          </div>
        </div>

        {/* ===== СИГНАЛЫ ТРЕНИРОВКИ ===== */}
        <div
          className="rounded-[18px] p-5 space-y-4"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-stroke)' }}
        >
          <div className="mb-1 flex items-center gap-2">
            <Zap className="w-5 h-5" style={{ color: 'var(--p-labels-text)' }} />
            <h2 className="text-[16px] font-bold" style={{ color: 'var(--p-labels-text)' }}>Сигналы тренировки</h2>
          </div>
          <p className="text-[13px] mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            Звук и вибрация при старте подхода, конце времени и конце отдыха.
          </p>

          <div>
            <div className="text-[14px] font-bold mb-1" style={{ color: 'var(--p-labels-text)' }}>
              Профиль звука
            </div>
            <p className="text-[12px] mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Нажми на профиль — сигнал прозвучит. В зале громче, дома тише.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SIGNAL_PROFILES.map((p) => (
                <button
                  key={p.key}
                  onClick={() => pickSignal(p.key)}
                  className="min-h-[30px] px-3 rounded-[8px] text-[13px] whitespace-nowrap transition-colors"
                  style={{
                    background: signalProfile === p.key ? 'var(--p-circle)' : 'transparent',
                    border: `1px solid ${signalProfile === p.key ? 'var(--p-circle)' : 'var(--p-outline)'}`,
                    color: signalProfile === p.key ? 'var(--p-on-circle)' : 'var(--p-outline)',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between mb-1">
              <div className="text-[14px] font-bold" style={{ color: 'var(--p-labels-text)' }}>
                Громкость сигнала
              </div>
              <span className="text-[12px] font-medium" style={{ color: 'var(--p-labels-text)' }}>
                {signalVolume <= 0 ? '0% — только вибрация' : signalVolume + '%'}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={signalVolume}
              onChange={e => {
                const v = parseInt(e.target.value, 10);
                setSignalVolume(v);
                setString('signal_volume', String(v));
              }}
              className="w-full h-2 bg-[var(--color-stroke)] rounded-lg appearance-none cursor-pointer"
              style={{ accentColor: 'var(--p-labels)' }}
            />
            <p className="text-[12px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              Кнопки громкости телефона тоже регулируют сигнал. На нуле остаётся только вибрация.
            </p>
          </div>
        </div>

        {/* ===== ГЛАВНЫЙ ЭКРАН ===== */}
        <div
          className="rounded-[18px] p-5 space-y-4"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-stroke)' }}
        >
          <div className="mb-1 flex items-center gap-2">
            <Smartphone className="w-5 h-5" style={{ color: 'var(--p-labels-text)' }} />
            <h2 className="text-[16px] font-bold" style={{ color: 'var(--p-labels-text)' }}>Главный экран</h2>
          </div>
          <p className="text-[13px] mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            Настраивайте ярлыки инструментов, строку поиска и плеер.
          </p>

          <div className="flex items-center justify-between mb-1">
            <div>
              <div className="text-[14px] font-bold" style={{ color: 'var(--p-labels-text)' }}>
                Перетаскивание иконок
              </div>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                Долгий тап по иконке на главном — и её можно переставить, как ярлык на рабочем столе.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={dragEnabled}
                onChange={e => { setDragEnabled(e.target.checked); setString('home_drag_enabled', e.target.checked ? '1' : '0'); }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"
                style={{
                  background: dragEnabled ? 'var(--p-circle)' : 'var(--color-stroke)',
                  border: dragEnabled ? `1px solid var(--p-circle)` : '1px solid var(--color-stroke)',
                }}
              />
            </label>
          </div>

          <button
            className="w-full h-10 rounded-[22px] text-[14px] font-medium border border-[var(--p-labels)] text-[var(--p-labels)] bg-transparent mt-2"
            onClick={() => { setString('tool_order', ''); showToast('success', 'Порядок иконок сброшен к стандартному.'); }}
          >
            <RotateCcw className="w-4 h-4 mr-1.5" /> Сбросить порядок
          </button>
        </div>

        {/* ===== ИНСТРУМЕНТЫ ===== */}
        <div
          className="rounded-[18px] p-5 space-y-4"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-stroke)' }}
        >
          <div className="mb-1 flex items-center gap-2">
            <Database className="w-5 h-5" style={{ color: 'var(--p-labels-text)' }} />
            <h2 className="text-[16px] font-bold" style={{ color: 'var(--p-labels-text)' }}>Инструменты</h2>
          </div>
          <p className="text-[13px] mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            Поиск, погода, обновления и связь с часами.
          </p>

          <div className="flex items-center justify-between mb-1">
            <div>
              <div className="text-[14px] font-bold" style={{ color: 'var(--p-labels-text)' }}>
                Строка поиска на главном
              </div>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                Пускай поиском упражнений на главном экране, если он вам нужен. Плеер всегда на месте.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={searchEnabled}
                onChange={e => { setSearchEnabled(e.target.checked); setString('home_search_enabled', e.target.checked ? '1' : '0'); }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"
                style={{
                  background: searchEnabled ? 'var(--p-circle)' : 'var(--color-stroke)',
                  border: searchEnabled ? `1px solid var(--p-circle)` : '1px solid var(--color-stroke)',
                }}
              />
            </label>
          </div>

          <div className="space-y-2">
            <div className="text-[13px] font-bold mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              Город для погоды
            </div>
            <input
              type="text"
              value={weatherCity}
              onChange={e => { setWeatherCity(e.target.value); setString('weather_city', e.target.value); }}
              placeholder="Красноярск"
              className="w-full h-[46px] px-4 rounded-[10px] text-[15px] outline-none"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--p-outline)',
                color: 'var(--color-text-main)',
              }}
            />
          </div>

          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={weatherIpDetect}
              onChange={e => { setWeatherIpDetect(e.target.checked); setString('weather_ip_detect', e.target.checked ? '1' : '0'); }}
              className="w-4 h-4 rounded border-[var(--color-stroke)]"
              style={{ accentColor: 'var(--p-labels)' }}
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
              value={updateUrl}
              onChange={e => setUpdateUrl(e.target.value)}
              placeholder="https://.../update.json"
              className="w-full h-[46px] px-4 rounded-[10px] text-[14px] outline-none mb-2"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--p-outline)',
                color: 'var(--color-text-main)',
              }}
            />
            <button
              className="w-full h-10 rounded-[22px] text-[14px] font-medium"
              style={{ background: 'var(--p-labels)', color: 'var(--p-on-labels)', border: 'none' }}
              onClick={checkUpdate}
            >
              <RefreshCw className="w-4 h-4 mr-1.5" /> Проверить обновления
            </button>
            {updateStatus && (
              <p className="text-[12px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                {updateStatus}
              </p>
            )}
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
                onClick={() => showToast('info', 'Поиск часов — функция подключения Wear OS')}
              >
                <Wifi className="w-4 h-4 mr-1.5" /> Найти часы
              </button>
              <button
                className="flex-1 h-10 rounded-[22px] text-[13px] font-medium"
                style={{ background: 'var(--p-labels)', color: 'var(--p-on-labels)', border: 'none' }}
                onClick={() => showToast('info', 'Сопряжение часов — функция подключения Wear OS')}
              >
                <Link className="w-4 h-4 mr-1.5" /> Это мои часы
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
          <AlertCircle className="w-4 h-4 mr-1.5" /> Сбросить настройки
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

      {/* Диалог настроек часов */}
      {showClockDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={() => setShowClockDialog(false)}
        >
          <div
            className="w-full max-w-[340px] rounded-[20px] p-4"
            style={{ background: 'var(--p-labels)', border: '1px solid var(--p-outline)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-[17px] font-bold mb-3" style={{ color: 'var(--color-text-main)' }}>
              Часы стартового экрана
            </div>

            <label className="flex items-center gap-3 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={clockEnabled}
                onChange={e => setClockEnabled(e.target.checked)}
                className="w-4 h-4 rounded"
                style={{ accentColor: 'var(--p-circle)' }}
              />
              <div className="text-[15px] font-medium" style={{ color: 'var(--color-text-main)' }}>
                Показывать часы на стартовом
              </div>
            </label>

            <div className="text-[13px] font-bold mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              Режим
            </div>
            <div className="flex gap-1 mb-4">
              {CLOCK_MODE_VALUES.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setClockMode(m.key)}
                  className={`min-h-[28px] px-2.5 py-1 rounded-[6px] text-[12px] whitespace-nowrap transition-colors ${
                    clockMode === m.key
                      ? 'bg-[var(--p-circle)] text-[var(--p-on-circle)] border-[var(--p-circle)]'
                      : 'bg-transparent text-[var(--p-outline)] border-[var(--p-outline)]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {clockMode === 'analog' && (
              <div>
                <div className="text-[13px] font-bold mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Стиль аналоговых часов
                </div>
                <div className="flex gap-1 mb-4">
                  {CLOCK_ANALOG_STYLES.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setClockAnalogStyle(s.key)}
                      className={`min-h-[28px] px-2.5 py-1 rounded-[6px] text-[12px] whitespace-nowrap transition-colors ${
                        clockAnalogStyle === s.key
                          ? 'bg-[var(--p-labels)] text-[var(--p-on-labels)] border-[var(--p-labels)]'
                          : 'bg-[var(--color-surface-variant)] text-[var(--color-text-main)] border-[var(--color-stroke)]'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {clockMode === 'digital' && (
              <div>
                <div className="text-[13px] font-bold mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Стиль цифровых часов
                </div>
                <div className="flex gap-1 mb-4">
                  {CLOCK_DIGITAL_STYLES.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setClockDigitalStyle(s.key)}
                      className={`min-h-[28px] px-2.5 py-1 rounded-[6px] text-[12px] whitespace-nowrap transition-colors ${
                        clockDigitalStyle === s.key
                          ? 'bg-[var(--p-labels)] text-[var(--p-on-labels)] border-[var(--p-labels)]'
                          : 'bg-[var(--color-surface-variant)] text-[var(--color-text-main)] border-[var(--color-stroke)]'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowClockDialog(false)}
                className="px-4 py-2 rounded-full text-[14px] font-medium"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Отмена
              </button>
              <button
                onClick={applyClock}
                className="px-4 py-2 rounded-full text-[14px] font-medium"
                style={{ color: 'var(--p-labels-text)' }}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Подтверждение сброса */}
      {showResetConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={() => setShowResetConfirm(false)}
        >
          <div
            className="w-full max-w-[340px] rounded-[20px] p-5"
            style={{ background: 'var(--p-labels)', border: '1px solid var(--p-outline)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-[17px] font-bold mb-2" style={{ color: 'var(--color-text-main)' }}>
              Сбросить настройки?
            </div>
            <p className="text-[13px] mb-5" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              Будут удалены все программы, профиль, дневник, замеры тела, настройки палитры и темы.
              Действие нельзя отменить.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded-full text-[14px] font-medium"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Отмена
              </button>
              <button
                onClick={handleResetAll}
                className="px-4 py-2 rounded-full text-[14px] font-medium"
                style={{ color: '#C0392B' }}
              >
                Да, сбросить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
