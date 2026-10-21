// FitGuide Web — экран первого запуска (порт OnboardingActivity.java)

import { useNavigate } from 'react-router-dom';
import { Zap, Dumbbell, ArrowRight } from 'lucide-react';
import { usePaletteVars, asset } from '../components/ui';
import { slotColor, contrastOn, circleGradient } from '../core/palette';

export function OnboardingPage() {
  const navigate = useNavigate();
  usePaletteVars();

  const grad = circleGradient();
  const btn = slotColor('labelsButtons');

  return (
    <div className="min-h-screen flex flex-col justify-center px-4 py-8"
      style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-md mx-auto w-full space-y-4">
        {/* Обложка */}
        <div
          className="rounded-3xl p-6 text-white"
          style={{ background: `linear-gradient(135deg, ${grad.from} 0%, ${grad.to} 100%)` }}
        >
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Zap className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[26px] font-bold leading-tight">
                Добро пожаловать в FitGuide
              </h1>
              <p className="text-[15px] text-white/90 mt-1">
                Твой карманный тренер для силовых тренировок
              </p>
            </div>
          </div>

          <p className="text-[15px] text-white/90 mt-5 leading-relaxed">
            Сначала — замеры и калибровка силы, потом тренер соберёт программу под
            тебя и будет вести прогрессию, разгрузки и чекпоинты.
          </p>

          <div className="mt-5 space-y-2.5">
            <button
              onClick={() => navigate('/assessment')}
              className="w-full py-3 rounded-lg text-[16px] font-bold transition-opacity active:opacity-90"
              style={{ background: '#fff', color: grad.to }}
            >
              Пройти замеры
            </button>
            <button
              onClick={() => navigate('/programs')}
              className="w-full py-3 rounded-lg text-[16px] font-bold border border-white/40 transition-opacity active:opacity-90"
              style={{ color: '#fff' }}
            >
              Своя программа
            </button>
          </div>
        </div>

        {/* Что внутри */}
        {[
          { icon: Dumbbell, title: 'Генератор программ', desc: 'Фулбоди, сплиты, периодизация под цели' },
          { icon: Zap, title: 'Карманный тренер', desc: 'Автопрогрессия весов, готовность, разгрузки' },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-2xl p-4 flex items-start gap-4"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-stroke)' }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--color-surface-variant)' }}>
              <Icon className="w-6 h-6" style={{ color: btn }} />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold" style={{ color: 'var(--color-text-main)' }}>{title}</h3>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* FAB */}
      <button
        onClick={() => navigate('/')}
        aria-label="Дальше"
        className="fixed bottom-6 right-5 w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
        style={{ background: btn, color: contrastOn(btn) }}
      >
        <ArrowRight className="w-6 h-6" />
      </button>
    </div>
  );
}
