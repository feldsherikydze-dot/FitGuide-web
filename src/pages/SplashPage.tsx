// FitGuide Web — стартовый экран (порт SplashActivity.java)
//
// Фон — картинка из assets/splash (случайная из пяти, меняется по дням),
// приветствие по времени суток, имя пользователя, пожелание дня,
// аналоговые часы и кнопка СТАРТ цвета кругляшек.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfileStore } from '../core/store';
import { getJSON, setJSON, KEYS } from '../core/storage';
import { usePaletteVars, AnalogClock } from '../components/ui';
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
  if (hour < 5) return 'Доброй ночи';
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

export function SplashPage({ onStart }: { onStart?: () => void }) {
  const navigate = useNavigate();
  const { profile } = useProfileStore();
  usePaletteVars();

  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [bgIndex, setBgIndex] = useState(0);
  const [quote, setQuote] = useState(WISHES[0]);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Фон: случайная картинка, запоминаем на день
  useEffect(() => {
    const dayKey = new Date().toDateString();
    const stored = getJSON<{ day: string; index: number }>(KEYS.SPLASH_BG, { day: '', index: 0 });
    if (stored.day === dayKey) {
      setBgIndex(stored.index);
    } else {
      const idx = Math.floor(Math.random() * 5) + 1;
      setBgIndex(idx);
      setJSON(KEYS.SPLASH_BG, { day: dayKey, index: idx });
    }
  }, []);

  // Пожелание дня — по индексу дня, не повторяется
  useEffect(() => {
    const dayKey = new Date().toDateString();
    const stored = getJSON<{ day: string; index: number }>(KEYS.SPLASH_QUOTE, { day: '', index: 0 });
    if (stored.day === dayKey) {
      setQuote(WISHES[stored.index % WISHES.length]);
    } else {
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
      const idx = dayOfYear % WISHES.length;
      setQuote(WISHES[idx]);
      setJSON(KEYS.SPLASH_QUOTE, { day: dayKey, index: idx });
    }
  }, []);

  // Имитация загрузки, затем показываем приветствие
  useEffect(() => {
    let p = 0;
    const t = setInterval(() => {
      p += 4;
      setProgress(p);
      if (p >= 100) {
        clearInterval(t);
        setLoaded(true);
      }
    }, 60);
    return () => clearInterval(t);
  }, []);

  const btnColor = slotColor('circleIcons');
  const userName = profile?.name || '';

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      {/* Фон */}
      <img
        src={`/splash/splash_${bgIndex}.jpg`}
        alt=""
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
        style={{ opacity: loaded ? 1 : 0 }}
      />

      {/* Приветствие */}
      <div
        className="absolute inset-x-0 top-0 flex flex-col items-center text-center transition-all duration-700"
        style={{ marginTop: 56, opacity: loaded ? 1 : 0, transform: loaded ? 'translateY(0)' : 'translateY(-20px)' }}
      >
        <h1 className="text-[30px] font-bold text-white leading-tight">
          {greetingFor(now.getHours())}
        </h1>
        {userName && (
          <div className="mt-1 text-[18px] text-white/80">{userName}</div>
        )}
        <p className="mt-2.5 px-8 text-[15px] text-white/80 leading-snug max-w-[420px]">
          {quote}
        </p>
        <div className="mt-2.5">
          <AnalogClock size={170} />
        </div>
      </div>

      {/* Кнопка СТАРТ */}
      {loaded && (
        <button
          onClick={() => {
            if (onStart) { onStart(); return; }
            navigate(profile ? '/' : '/onboarding', { replace: true });
          }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[220px] h-[54px] rounded-[27px] text-[18px] font-bold transition-all duration-500"
          style={{
            background: btnColor,
            color: contrastOn(btnColor),
            transform: 'translateX(-50%) scale(1)',
          }}
        >
          Старт
        </button>
      )}

      {/* Прогресс */}
      {!loaded && (
        <>
          <div className="absolute bottom-[124px] left-12 right-12 h-[5px] rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
          <img
            src="/icons/runner_run.svg"
            alt=""
            className="absolute bottom-[124px] left-12 w-[26px] h-[26px] brightness-0 invert"
            style={{ transform: `translateX(${(progress / 100) * (window.innerWidth - 96 - 26)}px)` }}
          />
        </>
      )}
    </div>
  );
}
