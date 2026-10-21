// FitGuide Web — оболочка приложения (порт BaseActivity + mini_player)
//
// В Android-приложении нет бокового сайдбара: главный экран — сетка ярлыков,
// навигация — через верхнюю панель. Мини-плеер висит снизу на всех экранах.

import { Outlet } from 'react-router-dom';
import { MiniPlayer } from './ui';
import { usePlayer } from '../core/player';
import { usePaletteVars } from './ui';

export function Layout() {
  usePaletteVars();
  const player = usePlayer();

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col min-h-0">
        <Outlet />
      </div>
      {player.visible && (
        <MiniPlayer
          state={{
            title: player.title,
            subtitle: player.subtitle,
            playing: player.playing,
            onToggle: player.toggle,
            onPrev: player.prev,
            onNext: player.next,
            onClose: player.close,
          }}
        />
      )}
    </div>
  );
}
