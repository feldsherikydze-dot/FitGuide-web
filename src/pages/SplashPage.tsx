// FitGuide Web — стартовый экран (порт SplashActivity.java)
//
// Фон — картинка из public/splash (случайная из пяти, меняется по дням),
// приветствие по времени суток, имя пользователя, пожелание дня,
// аналоговые часы и кнопка СТАРТ цвета кругляшек.
//
// На десктопе экран упакован в блок с пропорциями телефона (9:16) по центру,
// чтобы картинка не обрезалась и элементы не разъезжались — как на Android.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfileStore } from '../core/store';
import { getJSON, setJSON, KEYS } from '../core/storage';
import { usePaletteVars, AnalogClock, asset } from '../components/ui';
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
  const [bgIndex, setBgIndex] = useState(1);
  const [quote, setQuote] = useState(WISHES[0]);
  const [now, setNow] = useState(new Date());
  const [runnerFrame, setRunnerFrame] = useState(1);

  // Бегущий человечек: три кадра по 130 мс (как animation-list в Android)
  useEffect(() => {
    const t = setInterval(() => {
      setRunnerFrame(f => (f % 3) + 1);
    }, 130);
    return () => clearInterval(t);
  }, []);

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
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      {/* Блок с пропорциями телефона 9:16 — картинка не обрезается, элементы компактны */}
      <div
        className="relative w-full max-w-[430px] aspect-[9/16] max-h-[94vh]"
        style={{ transform: 'scale(1)' }}
      >
        {/* Фон — относительный путь, приложение может лежать в подпапке */}
        <img
          src={`${import.meta.env.BASE_URL}splash/splash_${bgIndex}.jpg`}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
          style={{ opacity: loaded ? 1 : 0 }}
        />

        {/* Приветствие — упаковано компактно, как на телефоне */}
        <div className="absolute inset-0 z-10 flex flex-col items-center text-center pt-4 pb-2 gap-3 px-4">
          <h1 className="text-[24px] font-bold text-white leading-tight">
            {greetingFor(now.getHours())}
          </h1>
          {userName && (
            <div className="mt-0.5 text-[16px] text-white/90">{userName}</div>
          )}
          <p className="px-3 text-[13px] text-white/85 leading-snug max-w-[360px]">
            {quote}
          </p>
          <div className="mt-1">
            <AnalogClock size={130} />
          </div>
        </div>

        {/* Кнопка СТАРТ — внутри блока с картинкой, над контентом */}
        {loaded && (
          <button
            onClick={() => {
              if (onStart) { onStart(); return; }
              navigate(profile ? '/' : '/onboarding', { replace: true });
            }}
            className="absolute bottom-4 left-1/2 w-[200px] h-[48px] rounded-[24px] text-[17px] font-bold transition-all duration-300 z-20 pointer-events-auto"
            style={{
              background: btnColor,
              color: contrastOn(btnColor),
              transform: 'translateX(-50%) scale(1)',
            }}
          >
            Старт
          </button>
        )}

        {/* Прогресс — над кнопкой */}
        {!loaded && (
          <div className="absolute bottom-[70px] left-4 right-4 flex flex-col items-end gap-1">
            <div className="w-full h-[5px] rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
            <img
              src={asset(`icons/ic_runner_${runnerFrame}.svg`)}
              alt=""
              className="w-[24px] h-[24px] brightness-0 invert"
              style={{ transform: `translateX(${(progress / 100) * (360 - 32 - 24)}px)` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
