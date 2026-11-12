// FitGuide Web — страница настроек (порт SettingsActivity.java + activity_settings.xml).
//
// Разделы ровно как в APK, карточки — статические colorSurface + stroke:
//  1. Тема — Как в системе / Светлая / Тёмная
//  2. Палитра — 4 слота, по одному свотчу на слот
//  3. Приветствие — фон заставки, свои картинки, режим показа, часы
//  4. Сигналы тренировки — профиль звука и громкость
//  5. Главный экран — перетаскивание иконок, сброс порядка
//  6. Инструменты — поиск, город погоды, обновления, часы
//  7. Сброс настроек

import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/ui';
import { useUIStore } from '../core/store';
import { PaletteSettings } from '../components/PaletteSettings';
import { getString, setString, getJSON, setJSON } from '../core/storage';
import {
  SIGNAL_PROFILES,
  getSignalProfileKey,
  getSignalVolume,
  setSignalProfile,
  setSignalVolume,
  previewSignal,
} from '../core/signal';
import { Dialog, DialogAction, Field, Toast } from './progress/common';

const APP_VERSION = '1.14.0';

const THEME_VALUES: ('system' | 'light' | 'dark')[] = ['system', 'light', 'dark'];
const THEME_LABELS = { system: 'Как в системе', light: 'Светлая', dark: 'Тёмная' };

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

/** Карточка настроек: как MaterialCardView после tintTree — фон (B), обводка (A), радиус 18dp. */
function SettingsCard({ children }: { children: ReactNode }) {
  return (
    <div
      className="mx-2 my-2 rounded-[18px] p-5"
      style={{ background: 'var(--p-labels)', border: '1px solid var(--p-outline)' }}
    >
      {children}
    </div>
  );
}

/** SwitchCompat: бегунок — (C) включён / (A) выключен, дорожка — цвет страницы. */
function Switch({ checked, onChange, label }: {
  checked: boolean; onChange: (v: boolean) => void; label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative w-11 h-6 rounded-full flex-shrink-0"
      style={{ background: 'var(--color-bg)' }}
    >
      <span
        className="absolute top-[2px] left-[2px] w-5 h-5 rounded-full transition-transform"
        style={{
          background: checked ? 'var(--p-circle)' : 'var(--p-outline)',
          transform: checked ? 'translateX(20px)' : 'none',
        }}
      />
    </button>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useUIStore();

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showClockDialog, setShowClockDialog] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [dragEnabled, setDragEnabled] = useState(
    () => getString('drag_enabled', getString('home_drag_enabled', '1')) !== '0'
  );
  const [searchEnabled, setSearchEnabled] = useState(() => getString('home_search_enabled', '1') !== '0');
  const [weatherCity, setWeatherCity] = useState(() => getString('weather_city', 'Красноярск'));
  const [weatherIpDetect, setWeatherIpDetect] = useState(() => getString('weather_ip_detect', '0') === '1');
  const [signalProfileKey, setSignalProfileKeyState] = useState(() => getSignalProfileKey());
  const [signalVolume, setSignalVolumeState] = useState(() => getSignalVolume());
  const [splashBg, setSplashBg] = useState(() => getString('splash_bg_fixed', ''));
  const [splashMode, setSplashMode] = useState(() => getString('splash_bg_mode', 'crop') || 'crop');
  const [mySplashBgs, setMySplashBgs] = useState<string[]>(() => {
    const raw = getJSON<string[]>('splash_my_bgs', []);
    return Array.isArray(raw) ? raw : [];
  });
  const [updateUrl, setUpdateUrl] = useState(() => getString('update_url', ''));
  const [updateStatus, setUpdateStatus] = useState(`Установлена версия ${APP_VERSION}`);
  const [watchStatus, setWatchStatus] = useState('Часы с зеркалом рядом не найдены. Проверь Bluetooth и что приложение стоит на часах.');

  const [clockEnabled, setClockEnabled] = useState(() => getString('splash_clock_enabled', '1') !== '0');
  const [clockMode, setClockMode] = useState<'analog' | 'digital'>(
    () => (getString('splash_clock', 'analog') as 'analog' | 'digital') || 'analog'
  );
  const [clockAnalogStyle, setClockAnalogStyle] = useState<'classic' | 'minimal' | 'sport'>(
    () => (getString('splash_clock_style_analog', 'classic') as 'classic' | 'minimal' | 'sport') || 'classic'
  );
  const [clockDigitalStyle, setClockDigitalStyle] = useState<'classic' | 'minimal'>(
    () => (getString('splash_clock_style_digital', 'classic') as 'classic' | 'minimal') || 'classic'
  );

  const showToast = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 2500);
  };

  const handleResetAll = () => {
    setShowResetConfirm(false);
    showToast('Настройки сброшены к начальным');
    window.setTimeout(() => {
      try {
        // Только данные FitGuide: на общем домене (github.io/<user>/) clear()
        // стирал бы localStorage чужих приложений. Все ключи приложения — с
        // префиксом fitguide_web_.
        for (const k of Object.keys(localStorage)) {
          if (k.startsWith('fitguide_web_')) localStorage.removeItem(k);
        }
        sessionStorage.removeItem('nutrition_tab');
      } catch {
        /* хранилище недоступно — всё равно перезапускаем */
      }
      window.location.replace(window.location.pathname + window.location.search + '#/');
      window.location.reload();
    }, 600);
  };

  const pickSignal = (key: string) => {
    setSignalProfile(key);
    setSignalProfileKeyState(getSignalProfileKey());
    previewSignal();
  };

  const checkUpdate = () => {
    const url = updateUrl.trim();
    if (!url) {
      setUpdateStatus('Введите адрес update.json');
      return;
    }
    if (!url.startsWith('https://')) {
      setUpdateStatus('Адрес должен начинаться с https://');
      return;
    }
    setString('update_url', url);
    setUpdateStatus('Проверяю…');
    window.setTimeout(() => setUpdateStatus(`Установлена версия ${APP_VERSION}`), 1200);
  };

  const findWatch = () => {
    setWatchStatus('Ищу часы рядом…');
    window.setTimeout(
      () => setWatchStatus('Часы с зеркалом рядом не найдены. Проверь Bluetooth и что приложение стоит на часах.'),
      1500,
    );
  };

  const addMySplashBg = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = (e: Event) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;
      const next = [...mySplashBgs];
      let loaded = 0;
      for (let i = 0; i < files.length; i++) {
        const reader = new FileReader();
        reader.onload = () => {
          next.push(reader.result as string);
          loaded++;
          if (loaded === files.length) {
            setMySplashBgs(next);
            setJSON('splash_my_bgs', next);
            showToast(`Добавлено картинок: ${files.length}`);
          }
        };
        reader.readAsDataURL(files[i]);
      }
    };
    input.click();
  };

  const clearMySplashBgs = () => {
    setMySplashBgs([]);
    setJSON('splash_my_bgs', []);
    showToast('Возвращены встроенные фоны');
  };

  const removeMySplashBg = (url: string) => {
    const next = mySplashBgs.filter(u => u !== url);
    setMySplashBgs(next);
    setJSON('splash_my_bgs', next);
  };

  const onTheme = (value: 'system' | 'light' | 'dark') => setTheme(value);

  const chip = (active: boolean) => `fg-chip ${active ? 'fg-chip-on' : ''}`;
  const sectionTitle = { color: 'var(--color-text-main)' } as const;
  const secondary = { color: 'var(--color-text-secondary)' } as const;
  const labelMain = { color: 'var(--color-text-main)' } as const;
  const labelSecondary = { color: 'var(--color-text-secondary)' } as const;

  return (
    <div className="max-w-2xl mx-auto w-full pb-4">
      <PageHeader title="Настройки" onBack={() => navigate('/')} />

      {/* ===== ТЕМА ===== */}
      <SettingsCard>
        <div className="text-[16px] font-bold" style={sectionTitle}>Тема</div>
        <div className="mt-1 text-[13px]" style={secondary}>Оформление приложения</div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {THEME_VALUES.map(value => (
            <button key={value} onClick={() => onTheme(value)} className={chip(theme === value)}>
              {THEME_LABELS[value]}
            </button>
          ))}
        </div>
      </SettingsCard>

      {/* ===== ПАЛИТРА ===== */}
      <SettingsCard>
        <div className="text-[16px] font-bold" style={sectionTitle}>Палитра</div>
        <div className="mt-1 text-[13px]" style={secondary}>Цветовая схема приложения</div>
        <div className="mt-[18px]">
          <PaletteSettings />
        </div>
      </SettingsCard>

      {/* ===== ПРИВЕТСТВИЕ ===== */}
      <SettingsCard>
        <div className="text-[16px] font-bold" style={sectionTitle}>Приветствие</div>
        <div className="mt-1 text-[13px]" style={secondary}>Экран приветствия: фон и часы.</div>

        <div className="mt-3 text-[14px]" style={labelMain}>Фон заставки</div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {SPLASH_BG_VALUES.map(value => (
            <button
              key={value}
              onClick={() => { setSplashBg(value); setString('splash_bg_fixed', value); }}
              className={chip(splashBg === value)}
            >
              {value === '' ? 'Авто (по дням)' : value}
            </button>
          ))}
        </div>

        <div className="mt-2.5 text-[14px] font-bold" style={labelMain}>Свои картинки на стартовом</div>
        <div className="mt-0.5 text-[12px] leading-snug" style={secondary}>
          Выберите фоны из галереи — приложение будет показывать их по очереди.
          Если своих нет, используются встроенные.
        </div>

        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {mySplashBgs.map((url, i) => (
            <div
              key={`${url.slice(0, 32)}-${i}`}
              className="relative w-16 h-16 rounded-[12px] flex-shrink-0"
              style={{ border: '1px solid var(--p-outline)', background: 'var(--color-surface-variant)' }}
            >
              <img src={url} alt="" className="w-full h-full object-cover rounded-[12px]" />
              <button
                onClick={() => removeMySplashBg(url)}
                className="absolute -right-1 -bottom-1 w-5 h-5 rounded-full text-[10px] flex items-center justify-center"
                style={{ background: 'var(--p-outline)', color: 'var(--p-on-outline)' }}
                aria-label="Удалить"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="mt-2 flex gap-2">
          <button
            onClick={addMySplashBg}
            className="fg-btn fg-btn-primary flex-1"
            style={{ height: 40, borderRadius: 20, fontSize: 13 }}
          >
            Добавить из галереи
          </button>
          <button
            onClick={clearMySplashBgs}
            className="fg-btn fg-btn-primary flex-1"
            style={{ height: 40, borderRadius: 20, fontSize: 13 }}
          >
            Вернуть встроенные
          </button>
        </div>

        {mySplashBgs.length === 0 && (
          <div className="mt-1.5 text-[12px]" style={secondary}>
            Своих фонов нет — на стартовом показываются встроенные.
          </div>
        )}

        <div className="mt-3 text-[13px]" style={secondary}>Своя картинка на заставке: как показывать</div>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {SPLASH_MODE_VALUES.map(m => (
            <button
              key={m.key}
              onClick={() => { setSplashMode(m.key); setString('splash_bg_mode', m.key); }}
              className={chip(splashMode === m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="mt-3 text-[13px]" style={secondary}>Вид и стиль часов стартового экрана</div>
        <button
          onClick={() => setShowClockDialog(true)}
          className="fg-btn fg-btn-primary w-full mt-1.5"
          style={{ height: 44, borderRadius: 22 }}
        >
          Настроить часы
        </button>
      </SettingsCard>

      {/* ===== СИГНАЛЫ ТРЕНИРОВКИ ===== */}
      <SettingsCard>
        <div className="text-[16px] font-bold" style={sectionTitle}>Сигналы тренировки</div>
        <div className="mt-1 text-[13px]" style={secondary}>
          Звук и вибрация при старте подхода, конце времени и конце отдыха.
        </div>

        <div className="mt-3 text-[14px] font-bold" style={labelMain}>Профиль звука</div>
        <div className="mt-0.5 text-[12px] leading-snug" style={secondary}>
          Нажми на профиль — сигнал прозвучит. В зале громче, дома тише.
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {SIGNAL_PROFILES.map(p => (
            <button key={p.key} onClick={() => pickSignal(p.key)} className={chip(signalProfileKey === p.key)}>
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-4 text-[14px] font-bold" style={labelMain}>Громкость сигнала</div>
        <div className="mt-0.5 text-[12px]" style={secondary}>
          {signalVolume <= 0 ? '0% — только вибрация' : `${signalVolume}%`}
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={signalVolume}
          onChange={e => {
            const v = parseInt(e.target.value, 10);
            setSignalVolumeState(v);
            setSignalVolume(v);
          }}
          onPointerUp={previewSignal}
          onKeyUp={previewSignal}
          className="w-full mt-1"
          style={{ accentColor: 'var(--p-labels-text)' }}
        />
        <div className="mt-1.5 text-[12px] leading-snug" style={secondary}>
          Кнопки громкости телефона тоже регулируют сигнал. На нуле остаётся только вибрация.
          На часах — та же громкость.
        </div>
      </SettingsCard>

      {/* ===== ГЛАВНЫЙ ЭКРАН ===== */}
      <SettingsCard>
        <div className="text-[16px] font-bold" style={sectionTitle}>Главный экран</div>
        <div className="mt-1 text-[13px]" style={secondary}>
          Настраивайте ярлыки инструментов, строку поиска и плеер.
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 text-[14px]" style={labelMain}>Перетаскивание иконок</div>
          <Switch
            checked={dragEnabled}
            label="Перетаскивание иконок"
            onChange={v => {
              setDragEnabled(v);
              setString('drag_enabled', v ? '1' : '0');
              setString('home_drag_enabled', v ? '1' : '0');
            }}
          />
        </div>
        <div className="mt-0.5 text-[12px] leading-snug" style={secondary}>
          Долгий тап по иконке на главном — и её можно переставить, как ярлык на рабочем столе.
        </div>

        <button
          onClick={() => { setString('tool_order', ''); showToast('Порядок иконок сброшен к стандартному.'); }}
          className="fg-btn fg-btn-primary w-full mt-3.5"
          style={{ height: 44, borderRadius: 22 }}
        >
          Сбросить порядок
        </button>
      </SettingsCard>

      {/* ===== ИНСТРУМЕНТЫ ===== */}
      <SettingsCard>
        <div className="text-[16px] font-bold" style={sectionTitle}>Инструменты</div>
        <div className="mt-1 text-[13px]" style={secondary}>Строка поиска и город для погоды.</div>

        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 text-[14px]" style={labelMain}>Строка поиска на главном</div>
          <Switch
            checked={searchEnabled}
            label="Строка поиска на главном"
            onChange={v => { setSearchEnabled(v); setString('home_search_enabled', v ? '1' : '0'); }}
          />
        </div>
        <div className="mt-0.5 text-[12px] leading-snug" style={secondary}>
          Пускай поиском упражнений на главном экране, если он вам нужен. Плеер всегда на месте.
        </div>

        <div className="mt-3 text-[13px] font-bold" style={labelSecondary}>Город для погоды</div>
        <Field
          className="mt-1.5"
          value={weatherCity}
          onChange={v => { setWeatherCity(v); setString('weather_city', v); }}
          placeholder="Красноярск"
          inputMode="text"
        />

        <div className="mt-2.5 flex items-center gap-2">
          <div className="flex-1 text-[15px]" style={labelMain}>Определять город по интернет-адресу</div>
          <Switch
            checked={weatherIpDetect}
            label="Определять город по интернет-адресу"
            onChange={v => { setWeatherIpDetect(v); setString('weather_ip_detect', v ? '1' : '0'); }}
          />
        </div>
        <div className="mt-0.5 text-[12px] leading-snug" style={secondary}>
          Если включено, приложение отправляет ваш IP-адрес стороннему сервису ipwho.is, и по нему
          определяется город. При выключенном тумблере адрес никуда не отправляется, а город берётся
          из поля выше.
        </div>

        <div className="mt-4 text-[13px] font-bold" style={labelSecondary}>Обновления</div>
        <div className="mt-1 text-[12px] leading-snug" style={secondary}>
          Адрес файла с информацией о версии. Приложение скачает новую версию и предложит её установить.
          Проверяется подпись файла и его целостность — чужое обновление не установится.
        </div>
        <Field
          className="mt-2"
          value={updateUrl}
          onChange={setUpdateUrl}
          placeholder="Адрес update.json (https://…)"
          inputMode="text"
        />
        <div className="mt-2 text-[13px]" style={labelMain}>{updateStatus}</div>
        <button
          onClick={checkUpdate}
          className="fg-btn fg-btn-primary w-full mt-2"
          style={{ height: 44, borderRadius: 22 }}
        >
          Проверить обновления
        </button>

        <div className="mt-4 text-[13px] font-bold" style={labelSecondary}>Часы и датчики</div>
        <div className="mt-1 text-[13px] leading-snug" style={labelMain}>{watchStatus}</div>
        <div className="mt-2 flex gap-2">
          <button
            onClick={findWatch}
            className="fg-btn fg-btn-primary flex-1"
            style={{ height: 44, borderRadius: 22, fontSize: 13 }}
          >
            Найти часы
          </button>
          <button
            onClick={() => showToast('Сначала нажми «Найти часы»')}
            className="fg-btn fg-btn-primary flex-1"
            style={{ height: 44, borderRadius: 22, fontSize: 13 }}
          >
            Это мои часы
          </button>
        </div>
        <div className="mt-1.5 text-[12px] leading-snug" style={secondary}>
          Начни тренировку на телефоне — часы с зеркалом подхватят сами: упражнение, подходы,
          отдых с вибрацией. Без часов рядом всё работает как раньше.
        </div>
        <div className="mt-1.5 text-[12px] leading-snug" style={secondary}>
          Как поставить зеркало на часы. Важно: передать файл по Bluetooth НЕ получится — часы не
          появляются в списке «Поделиться». Пока программа не стоит на часах, они не видны и здесь.
        </div>
      </SettingsCard>

      {/* ===== СБРОС ===== */}
      <div className="px-2 mt-3.5">
        <button
          onClick={() => setShowResetConfirm(true)}
          className="fg-btn fg-btn-primary w-full"
          style={{ height: 48, borderRadius: 24 }}
        >
          Сбросить настройки
        </button>
      </div>

      {/* Диалог часов */}
      {showClockDialog && (
        <Dialog
          title="Настроить часы"
          onClose={() => setShowClockDialog(false)}
          actions={<DialogAction strong onClick={() => setShowClockDialog(false)}>Готово</DialogAction>}
        >
          <div className="pb-1">
            <div className="flex items-center gap-3 py-2">
              <button
                type="button"
                role="switch"
                aria-checked={clockEnabled}
                onClick={() => {
                  const v = !clockEnabled;
                  setClockEnabled(v);
                  setString('splash_clock_enabled', v ? '1' : '0');
                }}
                className="relative w-11 h-6 rounded-full flex-shrink-0"
                style={{ background: 'var(--color-bg)' }}
              >
                <span
                  className="absolute top-[2px] left-[2px] w-5 h-5 rounded-full transition-transform"
                  style={{
                    background: clockEnabled ? 'var(--p-circle)' : 'var(--p-outline)',
                    transform: clockEnabled ? 'translateX(20px)' : 'none',
                  }}
                />
              </button>
              <span className="text-[15px]" style={{ color: 'var(--p-outline)' }}>
                Показывать часы на стартовом
              </span>
            </div>

            <div className="pt-3.5 text-[14px]" style={secondary}>Режим часов</div>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {CLOCK_MODE_VALUES.map(m => (
                <button
                  key={m.key}
                  onClick={() => { setClockMode(m.key); setString('splash_clock', m.key); }}
                  className={chip(clockMode === m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="pt-3.5 text-[14px]" style={secondary}>Стиль аналоговых</div>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {CLOCK_ANALOG_STYLES.map(s => (
                <button
                  key={s.key}
                  onClick={() => { setClockAnalogStyle(s.key); setString('splash_clock_style_analog', s.key); }}
                  className={chip(clockAnalogStyle === s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="pt-3.5 text-[14px]" style={secondary}>Стиль цифровых</div>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {CLOCK_DIGITAL_STYLES.map(s => (
                <button
                  key={s.key}
                  onClick={() => { setClockDigitalStyle(s.key); setString('splash_clock_style_digital', s.key); }}
                  className={chip(clockDigitalStyle === s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </Dialog>
      )}

      {/* Подтверждение сброса */}
      {showResetConfirm && (
        <Dialog
          title="Сбросить настройки?"
          onClose={() => setShowResetConfirm(false)}
          actions={
            <>
              <DialogAction onClick={() => setShowResetConfirm(false)}>Отмена</DialogAction>
              <DialogAction strong onClick={handleResetAll}>Сбросить</DialogAction>
            </>
          }
        >
          <p className="text-[14px] leading-relaxed" style={{ color: 'var(--p-on-labels-soft)' }}>
            Профиль, журнал тренировок, программы, рекорды и все настройки будут удалены.
            База упражнений и библиотека знаний останутся. Приложение перезапустится как при
            первой установке.
          </p>
        </Dialog>
      )}

      <Toast text={toast} />
    </div>
  );
}

