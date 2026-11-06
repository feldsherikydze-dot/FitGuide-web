// FitGuide Web — оболочка приложения (порт BaseActivity).
//
// В Android мини-плеер включён только в activity_main.xml, поэтому он
// живёт на главном экране (HubPage), а не на каждой странице. Музыка при
// этом продолжает играть при переходе между экранами — <audio> один на всё
// приложение (core/player.ts).

import { Outlet } from 'react-router-dom';
import { usePaletteVars } from './ui';

export function Layout() {
  usePaletteVars();

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col min-h-0">
        <Outlet />
      </div>
    </div>
  );
}
