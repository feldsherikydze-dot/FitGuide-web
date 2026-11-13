import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Service Worker — только в собранном приложении.
//
// В dev-режиме SW кэширует модули (/src/*.tsx) и отдаёт их из кэша, поэтому
// телефон/браузер показывает старую версию страницы даже после правок.
// Проверено 13.11.2026: сплеш на телефоне был из кэша, кода в репозитории уже нет.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Путь относительный: приложение может лежать в подпапке (GitHub Pages /repo/)
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swUrl).then((registration) => {
      // Раз в сессию проверяем, не вышла ли новая версия.
      registration.update().catch(() => {});
    }).catch((error) => {
      console.log('SW registration failed:', error);
    });
  });

  // Новая версия встала — один раз перезагружаем страницу, чтобы человек
  // не сидел на старом бандле до следующего запуска.
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
