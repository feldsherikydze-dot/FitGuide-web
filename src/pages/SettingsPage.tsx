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
import { getString, setString, getJSON, setJSON, trySetJSON } from '../core/storage';
import { compressSplashImage, SPLASH_IMAGES_BUDGET } from '../core/images';
import {
  exportDataJson,
  inspectBackup,
  importData,
  hasSafetyBackup,
  restoreSafetyBackup,
  backupFileName,
  MAX_BACKUP_BYTES,
} from '../core/dataPort';
import type { BackupInfo } from '../core/dataPort';
import {
  goldenTestCounts,
  goldenBackupKey,
  removeGoldenTestData,
  restoreCoachStateFromGoldenBackup,
} from '../core/goldenTest';
import {
  SIGNAL_PROFILES,
  getSignalProfileKey,
  getSignalVolume,
  setSignalProfile,
  setSignalVolume,
  previewSignal,
} from '../core/signal';
import { Dialog, DialogAction, Field, Toast } from './progress/common';

const APP_VERSION = __APP_VERSION__;

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
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [hasBackup, setHasBackup] = useState(() => hasSafetyBackup());
  const [goldenCounts, setGoldenCounts] = useState(() => goldenTestCounts());
  const [goldenBackup, setGoldenBackup] = useState(() => goldenBackupKey());
  const [showGoldenCleanConfirm, setShowGoldenCleanConfirm] = useState(false);
  const [showGoldenRestoreConfirm, setShowGoldenRestoreConfirm] = useState(false);
  const [pendingImport, setPendingImport] = useState<
    { text: string; name: string; info: BackupInfo } | null
  >(null);
  const [transferReport, setTransferReport] = useState<
    { keys: number; lines: string[] } | null
  >(null);
  const [showClockDialog, setShowClockDialog] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [dragEnabled, setDragEnabled] = useState(
    () => getString('drag_enabled', getString('home_drag_enabled', '1')) !== '0'
  );
  const [searchEnabled, setSearchEnabled] = useState(() => getString('home_search_enabled', '0') !== '0');
  const [waterEnabled, setWaterEnabled] = useState(() => getString('home_water_enabled', '1') !== '0');
  const [playerEnabled, setPlayerEnabled] = useState(() => getString('home_player_enabled', '1') !== '0');
  const [watchEnabled, setWatchEnabled] = useState(() => getString('watch_enabled', '1') !== '0');
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
  const [updateStatus, setUpdateStatus] = useState(
    () => `Версия ${APP_VERSION}. Проверю, нет ли на сайте свежей сборки.`
  );
  const [forceReset, setForceReset] = useState(false);
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

  const handleExportData = () => {
    try {
      const json = exportDataJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('Файл сохранён');
    } catch {
      showToast('Не удалось сохранить файл');
    }
  };

  const handlePickImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json,text/plain';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return;
      if (file.size > MAX_BACKUP_BYTES) {
        showToast('Файл слишком большой — резервная копия не больше 20 МБ');
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => showToast('Не удалось прочитать файл');
      reader.onload = () => {
        const text = String(reader.result || '');
        try {
          const info = inspectBackup(text);
          setPendingImport({ text, name: file.name, info });
        } catch (e) {
          const msg = e instanceof Error ? e.message : '';
          showToast(msg === 'too-big' ? 'Файл слишком большой'
            : msg === 'platform' ? 'Файл от другой платформы'
              : 'Это не файл FitGuide');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleApplyImport = () => {
    if (!pendingImport) return;
    try {
      const res = importData(pendingImport.text);
      setPendingImport(null);
      setHasBackup(true);
      setTransferReport({ keys: res.keys, lines: res.report });
    } catch (e) {
      setPendingImport(null);
      const msg = e instanceof Error ? e.message : '';
      showToast(msg === 'quota'
        ? 'Не хватило места в браузере — данные возвращены к прежним'
        : 'Не удалось импортировать: ' + (msg || '?'));
    }
  };

  const handleRestoreBackup = () => {
    setShowRestoreConfirm(false);
    try {
      restoreSafetyBackup();
      showToast('Данные восстановлены. Перезапуск…');
      window.setTimeout(() => window.location.reload(), 700);
    } catch {
      showToast('Копии для отката нет');
    }
  };

  // «Золотая эра»: удалить только синтетику теста, остальное не трогать.
  const handleCleanGolden = () => {
    setShowGoldenCleanConfirm(false);
    const res = removeGoldenTestData();
    setGoldenCounts(goldenTestCounts());
    showToast(`Удалено: тренировок ${res.sessions}, программ ${res.programs}. Перезапуск…`);
    window.setTimeout(() => window.location.reload(), 800);
  };

  // «Золотая эра»: вернуть состояние тренера из копии до теста.
  const handleRestoreGolden = () => {
    setShowGoldenRestoreConfirm(false);
    const res = restoreCoachStateFromGoldenBackup();
    if (!res.ok) {
      showToast(res.reason === 'no-backup' ? 'Копия не найдена' : 'Копия повреждена');
      setGoldenBackup(goldenBackupKey());
      return;
    }
    showToast(`Состояние тренера восстановлено: тренировок ${res.sessions}. Перезапуск…`);
    window.setTimeout(() => window.location.reload(), 800);
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

  // Сброс кеша веб-версии: снимаем service worker, чистим CacheStorage
  // (localStorage с данными не трогаем) и открываем страницу заново.
  const hardReload = async () => {
    setUpdateStatus('Сбрасываю кеш и перезагружаю…');
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch {
      // Не смогли почистить — всё равно перезагружаемся, это лучше, чем застрять.
    }
    const url = new URL(window.location.href);
    url.searchParams.set('v', String(Date.now()));
    window.location.replace(url.toString());
  };

  // «Проверить обновления» для веба: сначала штатное обновление service worker
  // (без потери офлайн-кеша), а если его нет — предлагаем принудительный сброс.
  const checkUpdate = async () => {
    setForceReset(false);
    if (!('serviceWorker' in navigator)) {
      setUpdateStatus('Браузер не умеет офлайн-обновление. Перезагружаю без кеша…');
      await hardReload();
      return;
    }
    setUpdateStatus('Проверяю обновления…');
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        setUpdateStatus(`Страница открыта напрямую, кеша нет. Версия ${APP_VERSION}.`);
        return;
      }
      let applied = false;
      const applyWaiting = () => {
        if (applied) return;
        applied = true;
        const worker = reg.waiting || reg.installing;
        if (worker) worker.postMessage('skipWaiting');
        setUpdateStatus('Найдено обновление — применяю и перезагружаю…');
      };
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            applyWaiting();
          }
        });
      });
      const onController = () => window.location.reload();
      navigator.serviceWorker.addEventListener('controllerchange', onController, { once: true });
      await reg.update();
      if (reg.waiting) {
        applyWaiting();
      }
      await new Promise(r => window.setTimeout(r, 1200));
      if (!applied) {
        navigator.serviceWorker.removeEventListener('controllerchange', onController);
        setUpdateStatus(`Обновлений нет: ${APP_VERSION} — последняя версия.`);
        setForceReset(true);
      }
    } catch {
      setUpdateStatus('Не удалось проверить обновления. Можно сбросить кеш принудительно.');
      setForceReset(true);
    }
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
    // Держим в DOM: часть браузеров не открывает пикер для отвязанного input,
    // а после выбора (или отмены) убираем, чтобы не копить мусор.
    input.style.display = 'none';
    input.setAttribute('data-fg', 'splash-input');
    document.body.appendChild(input);
    const dropInput = () => window.setTimeout(() => input.remove(), 500);
    window.addEventListener('focus', dropInput, { once: true });

    input.onchange = async (e: Event) => {
      const files = (e.target as HTMLInputElement).files;
      dropInput();
      if (!files || files.length === 0) return;

      const prev = mySplashBgs;
      const next = [...prev];
      let added = 0;
      let tooBig = 0;
      let broken = 0;
      for (const file of Array.from(files)) {
        let url: string;
        try {
          url = await compressSplashImage(file);
        } catch {
          broken++;
          continue;
        }
        const used = next.reduce((sum, u) => sum + u.length, 0);
        if (used + url.length > SPLASH_IMAGES_BUDGET) {
          tooBig++;
          continue;
        }
        next.push(url);
        added++;
      }

      if (added === 0) {
        showToast(tooBig
          ? 'Не хватило места в браузере: удалите пару своих фонов и попробуйте снова.'
          : 'Эти файлы не удалось прочитать как картинки.');
        return;
      }
      if (!trySetJSON('splash_my_bgs', next)) {
        setMySplashBgs(prev);
        showToast('Не хватило места в браузере. Удалите лишние свои фоны и повторите.');
        return;
      }
      setMySplashBgs(next);
      const tail = [tooBig ? `не влезли: ${tooBig}` : '', broken ? `не прочитаны: ${broken}` : '']
        .filter(Boolean).join(', ');
      showToast(`Добавлено картинок: ${added}${tail ? ` (${tail})` : ''}`);
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
          Что показывать на главном: ярлыки, поиск, воду и плеер.
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 text-[14px]" style={labelMain}>Строка поиска на главном</div>
          <Switch
            checked={searchEnabled}
            label="Строка поиска на главном"
            onChange={v => { setSearchEnabled(v); setString('home_search_enabled', v ? '1' : '0'); }}
          />
        </div>
        <div className="mt-0.5 text-[12px] leading-snug" style={secondary}>
          По умолчанию скрыта, чтобы главный экран не был завален. Понадобится — включите.
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 text-[14px]" style={labelMain}>Счётчик воды на главном</div>
          <Switch
            checked={waterEnabled}
            label="Счётчик воды на главном"
            onChange={v => { setWaterEnabled(v); setString('home_water_enabled', v ? '1' : '0'); }}
          />
        </div>
        <div className="mt-0.5 text-[12px] leading-snug" style={secondary}>
          Строка «Вода сегодня» с кнопками +250 и +500. По умолчанию включена.
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 text-[14px]" style={labelMain}>Мини-плеер на главном</div>
          <Switch
            checked={playerEnabled}
            label="Мини-плеер на главном"
            onChange={v => { setPlayerEnabled(v); setString('home_player_enabled', v ? '1' : '0'); }}
          />
        </div>
        <div className="mt-0.5 text-[12px] leading-snug" style={secondary}>
          Полоса музыки внизу главного экрана. Выключите — останется только раздел «Музыка».
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
        <div className="mt-1 text-[13px]" style={secondary}>Город для погоды, обновления и часы.</div>

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
          Веб-версия обновляется сама, но если что-то залипло — проверьте вручную. Кнопка
          переустановит свежую сборку, не трогая ваши данные.
        </div>
        <div className="mt-2 text-[13px]" style={labelMain}>{updateStatus}</div>
        <button
          onClick={checkUpdate}
          className="fg-btn fg-btn-primary w-full mt-2"
          style={{ height: 44, borderRadius: 22 }}
        >
          Проверить обновления
        </button>
        {forceReset && (
          <button
            onClick={hardReload}
            className="fg-btn fg-btn-ghost w-full mt-2"
            style={{ height: 44, borderRadius: 22, fontSize: 13 }}
          >
            Сбросить кеш и перезагрузить
          </button>
        )}

        <div className="mt-4 text-[13px] font-bold" style={labelSecondary}>Часы и датчики</div>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 text-[14px]" style={labelMain}>Зеркало на часах</div>
          <Switch
            checked={watchEnabled}
            label="Зеркало на часах"
            onChange={v => { setWatchEnabled(v); setString('watch_enabled', v ? '1' : '0'); }}
          />
        </div>
        <div className="mt-0.5 text-[12px] leading-snug" style={secondary}>
          Показывать блок часов и искать их. Нет часов — выключите, лишние строки исчезнут.
        </div>

        {watchEnabled && (
          <>
            <div className="mt-2 text-[13px] leading-snug" style={labelMain}>{watchStatus}</div>
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
          </>
        )}

        <div className="mt-4 text-[13px] font-bold" style={labelSecondary}>Напоминания</div>
        <div className="mt-1 text-[12px] leading-snug" style={secondary}>
          В веб-версии напоминаний нет: браузер не даёт приложению проснуться и напомнить о
          тренировке, пока оно закрыто. В Android-версии напоминания работают — поставьте её, если
          они нужны.
        </div>
      </SettingsCard>

      {/* ===== ДАННЫЕ ===== */}
      <SettingsCard>
        <div className="text-[16px] font-bold" style={sectionTitle}>Данные</div>
        <div className="mt-1 text-[13px]" style={secondary}>
          Резервная копия: профиль, программы, тренировки, замеры, рекорды и настройки.
        </div>

        <button
          onClick={handleExportData}
          className="fg-btn fg-btn-ghost w-full mt-3"
          style={{ height: 48 }}
        >
          Экспорт данных
        </button>
        <button
          onClick={handlePickImport}
          className="fg-btn fg-btn-ghost w-full mt-2"
          style={{ height: 48 }}
        >
          Импорт данных
        </button>
        {hasBackup && (
          <button
            onClick={() => setShowRestoreConfirm(true)}
            className="fg-btn fg-btn-ghost w-full mt-1.5"
            style={{ height: 44, fontSize: 13 }}
          >
            Вернуть данные до импорта
          </button>
        )}

        <div className="mt-1.5 text-[12px] leading-snug" style={secondary}>
          Импорт заменяет текущие данные. Перед заменой автоматически сохраняется копия для отката.
          <br />
          Файл Android-версии обычно лежит в Download/FitGuide — в списке файлов зайдите в папку FitGuide.
        </div>

        {(goldenCounts.sessions > 0 || goldenCounts.programs > 0 || goldenBackup) && (
          <div className="mt-4 pt-3.5" style={{ borderTop: '1px solid var(--p-outline)' }}>
            <div className="text-[14px] font-bold" style={sectionTitle}>
              Тестовые данные «Золотой эры»
            </div>
            <div className="mt-1 text-[12px] leading-snug" style={secondary}>
              Прогон «Анализа» от 12.11.2026 — это не ваши тренировки.
              {(goldenCounts.sessions > 0 || goldenCounts.programs > 0)
                ? ` Осталось: тренировок ${goldenCounts.sessions}, программ ${goldenCounts.programs}.`
                : ' Тренировок и программ не осталось.'}
            </div>
            {(goldenCounts.sessions > 0 || goldenCounts.programs > 0) && (
              <button
                onClick={() => setShowGoldenCleanConfirm(true)}
                className="fg-btn fg-btn-ghost w-full mt-2"
                style={{ height: 44 }}
              >
                Удалить тестовые тренировки
              </button>
            )}
            {goldenBackup && (
              <button
                onClick={() => setShowGoldenRestoreConfirm(true)}
                className="w-full mt-1.5 text-[13px]"
                style={{ height: 40, color: 'var(--p-outline)' }}
              >
                Вернуть состояние тренера до теста
              </button>
            )}
          </div>
        )}
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

      {/* Подтверждение импорта */}
      {pendingImport && (
        <Dialog
          title="Импортировать данные?"
          onClose={() => setPendingImport(null)}
          actions={
            <>
              <DialogAction onClick={() => setPendingImport(null)}>Отмена</DialogAction>
              <DialogAction strong onClick={handleApplyImport}>Импортировать</DialogAction>
            </>
          }
        >
          <p className="text-[14px] leading-relaxed" style={{ color: 'var(--p-on-labels-soft)' }}>
            Файл: {pendingImport.name}
            <br />
            Версия: {pendingImport.info.appVersion} ·{' '}
            {new Date(pendingImport.info.exportedAt).toLocaleString('ru-RU')}
            <br />
            Ключей: {pendingImport.info.keys}
            {pendingImport.info.platform === 'android' && (
              <>
                <br />
                <br />
                Файл создан в Android-версии. Профиль, программы, тренировки, замеры, рекорды
                и дневник будут сконвертированы под веб. Плеер, погода и вода есть только
                в Android; палитра и заставка вернутся к стандартным.
              </>
            )}
            <br />
            <br />
            Текущие данные будут заменены. Перед заменой сохранится копия — её можно вернуть
            кнопкой «Вернуть данные до импорта».
          </p>
        </Dialog>
      )}

      {/* Отчёт после импорта: что перенесено, что осталось на платформе */}
      {transferReport && (
        <Dialog
          title="Перенос данных"
          onClose={() => window.location.reload()}
          actions={
            <DialogAction strong onClick={() => window.location.reload()}>
              Перезапустить
            </DialogAction>
          }
        >
          <p className="text-[14px] leading-relaxed" style={{ color: 'var(--p-on-labels-soft)' }}>
            Импортировано ключей: {transferReport.keys}
            {transferReport.lines.length > 0 && (
              <>
                <br />
                <br />
                <span style={{ whiteSpace: 'pre-line' }}>{transferReport.lines.join('\n')}</span>
              </>
            )}
            <br />
            <br />
            Перезапустите приложение, чтобы все экраны показали новые данные.
          </p>
        </Dialog>
      )}

      {/* Подтверждение отката */}
      {showRestoreConfirm && (
        <Dialog
          title="Вернуть данные до импорта?"
          onClose={() => setShowRestoreConfirm(false)}
          actions={
            <>
              <DialogAction onClick={() => setShowRestoreConfirm(false)}>Отмена</DialogAction>
              <DialogAction strong onClick={handleRestoreBackup}>Вернуть</DialogAction>
            </>
          }
        >
          <p className="text-[14px] leading-relaxed" style={{ color: 'var(--p-on-labels-soft)' }}>
            Текущие изменения будут потеряны. Вернётся состояние, сохранённое перед последним
            импортом.
          </p>
        </Dialog>
      )}

      {/* Подтверждение уборки «Золотой эры» */}
      {showGoldenCleanConfirm && (
        <Dialog
          title="Удалить тестовые тренировки?"
          onClose={() => setShowGoldenCleanConfirm(false)}
          actions={
            <>
              <DialogAction onClick={() => setShowGoldenCleanConfirm(false)}>Отмена</DialogAction>
              <DialogAction strong onClick={handleCleanGolden}>Удалить</DialogAction>
            </>
          }
        >
          <p className="text-[14px] leading-relaxed" style={{ color: 'var(--p-on-labels-soft)' }}>
            Из журнала и «Моих программ» исчезнут тренировки «Золотой эры»
            (тренировок: {goldenCounts.sessions}, программ: {goldenCounts.programs}).
            Ваши собственные тренировки, замеры и записи останутся.
          </p>
        </Dialog>
      )}

      {/* Подтверждение отката на копию до теста */}
      {showGoldenRestoreConfirm && (
        <Dialog
          title="Вернуть состояние до теста?"
          onClose={() => setShowGoldenRestoreConfirm(false)}
          actions={
            <>
              <DialogAction onClick={() => setShowGoldenRestoreConfirm(false)}>Отмена</DialogAction>
              <DialogAction strong onClick={handleRestoreGolden}>Вернуть</DialogAction>
            </>
          }
        >
          <p className="text-[14px] leading-relaxed" style={{ color: 'var(--p-on-labels-soft)' }}>
            Вернётся состояние тренера из копии, снятой 12.11.2026 перед прогоном «Золотой
            эры». Всё, что записано после этой копии, пропадёт.
          </p>
        </Dialog>
      )}

      <Toast text={toast} />

      {/* Версия и сборка — чтобы на глаз отличать новую версию от старой из кэша */}
      <div className="mt-6 mb-2 text-center text-[12px] leading-snug" style={secondary}>
        FitGuide (веб) · версия {APP_VERSION}
        <br />
        сборка {__BUILD_STAMP__}
      </div>
    </div>
  );
}

