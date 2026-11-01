// FitGuide Web — стартовый экран (порт SplashActivity.java 1:1)
//
// Соответствует activity_splash.xml + SplashActivity.java:
// - Фон: свои картинки (ротация по dayOfYear) > фиксированный > случайный день
// - Режим фона: crop (centerCrop) / smear (заливка краями CLAMP) — долгий тап переключает
// - Приветствие по времени суток + имя пользователя
// - Пожелание дня (индекс = dayOfYear % wishes.length, сохраняется day+index)
// - Часы: вкл/выкл, режим analog/digital, стили classic/minimal/sport
// - Прогресс-бар снизу + бегущий человечек (ValueAnimator 900мс + DecelerateInterpolator)
// - Кнопка СТАРТ: фон = C (circleIcons), текст = contrastOn(C), radius 27dp, анимация появления
// - Навигация: fresh → Onboarding, иначе MainActivity (или Settings если splash выключен)

import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfileStore } from '../core/store';
import { getJSON, setJSON, KEYS, getString, setString } from '../core/storage';
import { usePaletteVars, asset } from '../components/ui';
import { slotColor, contrastOn } from '../core/palette';

const WISHES = [
  'Желаю отличной тренировки!',
  'Пусть сегодня рекорды покоряются легко.',
  'Сегодня — лучший день стать сильнее.',
  'Движение — это жизнь. Живи на полную!',
  'Мышцы любят тех, кто не пропускает дни.',
  'Пусть заряд энергии хватит на весь день!',
  'Одна тренировка — и настроение гарантировано.',
  'Сегодня сделай чуть больше, чем вчера.',
  'Вода, белок и сон — твои союзники.',
  'Пусть каждый подход приближает к цели.',
  'Твоё тело скажет спасибо за сегодняшнюю заботу.',
  'Идея дня: начни с простого, закончи рекордом.',
  'Лёгкой разминки и честного упорства!',
  'Сегодня ты — амбассадор собственной силы.',
  'Не сравнивай себя с другими — сравнивай со вчерашним собой.',
];

function greetingFor(hour: number): string {
  if (hour < 6) return 'Доброй ночи';
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

// Аналоговые часы — 3 стиля как в SplashClockView Android
function AnalogClockSplash({ size = 170, style = 'classic' }: { size?: number; style?: string }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const h = now.getHours();
  const m = now.getMinutes();
  const s = now.getSeconds();
  const secAngle = s * 6;
  const minAngle = m * 6 + s * 0.1;
  const hourAngle = ((h % 12) + m / 60) * 30;

  const isMinimal = style === 'minimal';
  const isSport = style === 'sport';
  const center = size / 2;
  const radius = size * 0.48;
  const tickOuter = radius;
  const tickInnerHour = radius - (isMinimal ? 6 : 12);
  const tickInnerMin = radius - (isMinimal ? 4 : 5);
  const hourHandLen = radius * 0.45;
  const minHandLen = radius * 0.7;
  const secHandLen = radius * 0.78;

  const ticks = Array.from({ length: 60 }, (_, i) => {
    const isHour = i % 5 === 0;
    return { i, isHour };
  });

  const strokeColor = isSport ? 'rgba(255,138,61,0.9)' : 'rgba(255,255,255,0.95)';
  const handColor = isSport ? '#FF8A3D' : '#fff';
  const secColor = isSport ? 'rgba(255,138,61,0.6)' : 'rgba(255,255,255,0.6)';
  const centerColor = isSport ? '#FF8A3D' : '#fff';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      {!isMinimal && (
        <circle cx={center} cy={center} r={radius} fill="none" stroke={strokeColor} strokeWidth={isSport ? 3 : 2} />
      )}
      {ticks.map(t => {
        const a = (t.i * 6 - 90) * (Math.PI / 180);
        const r1 = tickOuter;
        const r2 = t.isHour ? tickInnerHour : tickInnerMin;
        const w = t.isHour ? (isMinimal ? 1.5 : 2) : 1;
        return (
          <line
            key={t.i}
            x1={center + r1 * Math.cos(a)} y1={center + r1 * Math.sin(a)}
            x2={center + r2 * Math.cos(a)} y2={center + r2 * Math.sin(a)}
            stroke={strokeColor} strokeWidth={w} strokeLinecap="round"
          />
        );
      })}
      <line x1={center} y1={center}
        x2={center + hourHandLen * Math.cos((hourAngle - 90) * (Math.PI / 180))}
        y2={center + hourHandLen * Math.sin((hourAngle - 90) * (Math.PI / 180))}
        stroke={handColor} strokeWidth={isSport ? 5 : 4} strokeLinecap="round" />
      <line x1={center} y1={center}
        x2={center + minHandLen * Math.cos((minAngle - 90) * (Math.PI / 180))}
        y2={center + minHandLen * Math.sin((minAngle - 90) * (Math.PI / 180))}
        stroke={handColor} strokeWidth={isSport ? 4 : 3} strokeLinecap="round" />
      {!isMinimal && (
        <line x1={center} y1={center}
          x2={center + secHandLen * Math.cos((secAngle - 90) * (Math.PI / 180))}
          y2={center + secHandLen * Math.sin((secAngle - 90) * (Math.PI / 180))}
          stroke={secColor} strokeWidth={2} strokeLinecap="round" />
      )}
      <circle cx={center} cy={center} r={isSport ? 6 : 4} fill={centerColor} />
    </svg>
  );
}

// Цифровые часы — 3 стиля как в Android applyDigitalClockStyle
function DigitalClockSplash({ style = 'classic' }: { style?: string }) {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })), 1000);
    return () => clearInterval(t);
  }, []);

  const isMinimal = style === 'minimal';
  const isSport = style === 'sport';
  const fontSize = isMinimal ? 48 : isSport ? 58 : 64;
  const fontWeight = isMinimal ? 'normal' : 'bold';
  const fontFamily = isMinimal ? 'sans-serif' : isSport ? 'sans-serif-medium' : 'sans-serif-light';
  const color = isMinimal ? 'rgba(255,255,255,0.8)' : isSport ? '#FF8A3D' : '#FFFFFF';

  return (
    <div
      style={{
        fontSize: `${fontSize}px`, fontWeight, fontFamily,
        color, textShadow: '0 2px 8px rgba(0,0,0,0.3)',
        letterSpacing: isSport ? '2px' : '0',
      }}
    >
      {time}
    </div>
  );
}

export function SplashPage({ onStart }: { onStart?: () => void }) {
  const navigate = useNavigate();
  const { profile } = useProfileStore();
  usePaletteVars();

  // Состояние
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [runnerPos, setRunnerPos] = useState(0);
  const [bgIndex, setBgIndex] = useState(1);
  const [quote, setQuote] = useState(WISHES[0]);
  const [now, setNow] = useState(new Date());
  const [mySplashBgs, setMySplashBgs] = useState<string[]>([]);
  const [smearMode, setSmearMode] = useState(false);
  const [showGreeting, setShowGreeting] = useState(false);
  const [startButtonVisible, setStartButtonVisible] = useState(false);
  const [started, setStarted] = useState(false);
  const animFrameRef = useRef<number | null>(null);

  // Настройки из storage
  const splashEnabled = getString('splash_enabled', '1') === '1';
  const clockEnabled = getString('splash_clock_enabled', '1') === '1';
  const clockMode = getString('splash_clock', 'analog'); // 'analog' | 'digital'
  const clockStyleAnalog = getString('splash_clock_style_analog', 'classic');
  const clockStyleDigital = getString('splash_clock_style_digital', 'classic');
  const fixedBg = getString('splash_bg_fixed', '');

  // Цвета
  const circleColor = slotColor('circleIcons');
  const onCircleColor = contrastOn(circleColor);

  // --- Загрузка своих фонов ---
  useEffect(() => {
    const raw = getJSON<string[]>('splash_my_bgs', []);
    setMySplashBgs(Array.isArray(raw) ? raw : []);
  }, []);

  // --- Режим фона (crop/smear) ---
  useEffect(() => {
    const mode = getString('splash_bg_mode', 'crop');
    setSmearMode(mode === 'smear');
  }, []);

  // --- Выбор фона: свои (ротация по дню) > фиксированный > случайный день ---
  const loadBackground = useCallback(() => {
    if (mySplashBgs.length > 0) {
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
      const idx = dayOfYear % mySplashBgs.length;
      setBgIndex(-1 - idx); // отрицательный = свои картинки
      return;
    }
    if (fixedBg && fixedBg !== '') {
      const idx = parseInt(fixedBg, 10);
      if (!isNaN(idx) && idx >= 1 && idx <= 5) {
        setBgIndex(idx);
        return;
      }
    }
    const dayKey = new Date().toDateString();
    const stored = getJSON<{ day: string; index: number }>(KEYS.SPLASH_BG, { day: '', index: 0 });
    if (stored.day === dayKey) {
      setBgIndex(stored.index);
    } else {
      const idx = Math.floor(Math.random() * 5) + 1;
      setBgIndex(idx);
      setJSON(KEYS.SPLASH_BG, { day: dayKey, index: idx });
    }
  }, [mySplashBgs, fixedBg]);

  // --- Режим фона (crop/smear) ---
  const toggleBgMode = useCallback(() => {
    const next = !smearMode;
    setSmearMode(next);
    setString('splash_bg_mode', next ? 'smear' : 'crop');
    loadBackground();
  }, [smearMode, loadBackground]);

  useEffect(() => { loadBackground(); }, [loadBackground]);

  // --- Пожелание дня: dayOfYear, сохраняем day+index ---
  useEffect(() => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const dayKey = new Date().toDateString();
    const stored = getJSON<{ day: string; index: number }>(KEYS.SPLASH_QUOTE, { day: '', index: 0 });
    let idx: number;
    if (stored.day === dayKey) {
      idx = stored.index % WISHES.length;
    } else {
      idx = dayOfYear % WISHES.length;
      setJSON(KEYS.SPLASH_QUOTE, { day: dayKey, index: idx });
    }
    setQuote(WISHES[idx]);
  }, []);

  // --- Время ---
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // --- Анимация прогресса + бегунка (900мс, DecelerateInterpolator) ---
  useEffect(() => {
    if (loaded || started) return;
    let start: number | null = null;
    const duration = 900;
    const animate = (ts: number) => {
      if (!start) start = ts;
      const elapsed = ts - start;
      const p = Math.min(elapsed / duration, 1);
      // DecelerateInterpolator: 1 - (1 - t)^2
      const eased = 1 - Math.pow(1 - p, 2);
      setProgress(eased * 100);
      setRunnerPos(eased * 100);
      if (p < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setLoaded(true);
        setShowGreeting(true);
        setStartButtonVisible(true); // Показываем кнопку Старт после завершения анимации
      }
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [loaded, started]);

  const userName = profile?.name || '';

  const handleStart = () => {
    if (started) return;
    setStarted(true);
    const root = document.getElementById('rootSplash');
    if (root) {
      root.style.transition = 'opacity 400ms ease-out';
      root.style.opacity = '0';
    }
    setTimeout(() => {
      if (onStart) { onStart(); return; }
      const onboardingDone = getJSON<boolean>('onboarding_done', false);
      const hasRequired = profile?.gender && profile?.age > 0 && profile?.heightCm > 0 && profile?.weightKg > 0;
      const fresh = !onboardingDone && !hasRequired;
      if (fresh) {
        navigate('/onboarding', { replace: true });
      } else if (!splashEnabled) {
        navigate('/settings', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }, 400);
  };

  // --- Рендер фона ---
  const renderBg = () => {
    const isOwn = bgIndex < 0;
    const idx = isOwn ? -bgIndex - 1 : bgIndex;
    const src = isOwn
      ? mySplashBgs[idx]
      : `${import.meta.env.BASE_URL}splash/splash_${idx}.jpg`;

    const bgStyle: React.CSSProperties = {
      position: 'absolute',
      inset: 0,
      backgroundImage: `url(${src})`,
      backgroundSize: smearMode ? 'contain' : 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      opacity: loaded || isOwn ? 1 : 0,
      transition: 'opacity 1600ms ease-out',
    };

    if (!smearMode) {
      return <img key={src} src={src} alt="" style={bgStyle} />;
    }

    // Smear режим: основной слой contain + растянутый слой с блюром (аппроксимация CLAMP)
    return (
      <div key={src} style={{ ...bgStyle, backgroundSize: 'cover' }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${src})`,
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${src})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(40px)',
          opacity: 0.3,
        }} />
      </div>
    );
  };

  if (!splashEnabled) {
    useEffect(() => {
      if (onStart) { onStart(); return; }
      const onboardingDone = getJSON<boolean>('onboarding_done', false);
      const hasRequired = profile?.gender && profile?.age > 0 && profile?.heightCm > 0 && profile?.weightKg > 0;
      const fresh = !onboardingDone && !hasRequired;
      navigate(fresh ? '/onboarding' : '/', { replace: true });
    }, []);
    return null;
  }

  const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div id="rootSplash" className="fixed inset-0 z-50 bg-black" onContextMenu={e => e.preventDefault()} onMouseDown={e => { if (e.button === 2) toggleBgMode(); }}>
      {/* Долгий тап / правый клик — переключение режима фона */}
      <div
        className="absolute inset-0"
        onMouseDown={e => { if (e.button === 2) e.preventDefault(); }}
        onContextMenu={e => { e.preventDefault(); toggleBgMode(); }}
        onTouchStart={e => {
          const touch = e.touches[0];
          (window as any).__longPressTimer = setTimeout(() => {
            toggleBgMode();
            navigator.vibrate?.(50);
          }, 500);
        }}
        onTouchEnd={e => { clearTimeout((window as any).__longPressTimer); }}
        onTouchMove={e => { clearTimeout((window as any).__longPressTimer); }}
      />

      {/* Фон */}
      {renderBg()}

      {/* Прогресс-бар + бегунок (снизу, margins как в XML: 48dp start/end, 124dp bottom) */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          paddingBottom: '124px',
          paddingLeft: '48px',
          paddingRight: '48px',
          pointerEvents: 'none',
        }}
      >
        <div className="w-full h-[5px] rounded-full bg-white/20 overflow-hidden">
          <div
            className="h-full bg-white transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        {/* Бегунок: 26px, позиции по progress, кадры 1-3 */}
        <div
          className="absolute -top-6 left-0 w-[24px] h-[24px]"
          style={{
            transform: `translateX(${Math.max(0, (progress / 100) * (window.innerWidth - 96 - 24))}px)`,
            filter: 'brightness(0) invert(1)',
          }}
        >
          <img
            src={asset(`icons/ic_runner_${Math.min(3, Math.max(1, Math.floor(runnerPos / 34) + 1))}.svg`)}
            alt=""
            className="w-full h-full"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>
      </div>

      {/* Приветствие + имя + пожелание + часы (появляются после завершения анимации прогресса) */}
      <div
        className="absolute top-0 left-0 right-0 flex flex-col items-center text-center"
        style={{
          paddingTop: '56px',
          paddingLeft: '32px',
          paddingRight: '32px',
          opacity: showGreeting ? 1 : 0,
          transition: 'opacity 400ms ease-out',
          pointerEvents: 'none',
        }}
      >
        <h1 className="text-[30px] font-bold text-white leading-tight">
          {greetingFor(now.getHours())}
        </h1>
        {userName && (
          <div className="mt-1 text-[18px] text-white/80">{userName}</div>
        )}
        <p className="mt-3 text-[15px] text-white/85 leading-snug max-w-[90%]">
          {quote}
        </p>
        {clockEnabled && (
          <div className="mt-4">
            {clockMode === 'digital' ? (
              <DigitalClockSplash style={clockStyleDigital} />
            ) : (
              <AnalogClockSplash size={170} style={clockStyleAnalog} />
            )}
          </div>
        )}
      </div>

      {/* Кнопка СТАРТ (появляется после завершения анимации прогресса) */}
      <button
        id="btnStartSplash"
        onClick={handleStart}
        className="absolute bottom-0 left-1/2 mb-[40px] w-[220px] h-[54px] rounded-[27px] text-[18px] font-bold"
        style={{
          transform: 'translateX(-50%)',
          background: circleColor,
          color: onCircleColor,
          opacity: (loaded && startButtonVisible) ? 1 : 0,
          scale: (loaded && startButtonVisible) ? 1 : 0.7,
          transition: 'opacity 350ms ease-out, transform 350ms ease-out',
          pointerEvents: (loaded && startButtonVisible) ? 'auto' : 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        }}
      >
        Старт
      </button>
    </div>
  );
}