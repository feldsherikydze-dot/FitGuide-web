// Проверка PWA вживую: запускаем установленный Chrome в headless и смотрим
//  - зарегистрировался ли Service Worker
//  - что ответил сервис-воркер (контроллер страницы)
//  - доступен ли манифест и какие у него поля
//  - кэшируется ли офлайн-контент
// Запуск: node scripts/pwa-check.mjs <url>

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const URL_ = process.argv[2] || 'https://feldsherikydze-dot.github.io/FitGuide-web/';
const PORT = 9333;

function findChrome() {
  const cands = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  ];
  for (const c of cands) {
    if (existsSync(c)) return c;
  }
  return null;
}

const chrome = findChrome();
if (!chrome) { console.error('Chrome не найден'); process.exit(2); }
console.log('Chrome:', chrome);

// Каждый запуск — чистый профиль: иначе старый Service Worker отдаёт старый бандл
// и результаты проверки будут враньём.
const profileDir = `C:\\Users\\ikydz\\AppData\\Local\\Temp\\opencode\\pwa-profile-${Date.now()}`;
const proc = spawn(chrome, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profileDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  URL_,
], { stdio: 'ignore' });

async function getTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json`);
      const list = await r.json();
      const page = list.find(t => t.type === 'page' && t.url.includes('FitGuide')) || list.find(t => t.type === 'page');
      if (page) return page;
    } catch {}
    await sleep(500);
  }
  return null;
}

const target = await getTarget();
if (!target) { console.error('Вкладка не найдена'); proc.kill(); process.exit(2); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();

ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});

function send(method, params = {}) {
  return new Promise((resolve) => {
    const myId = ++id;
    pending.set(myId, resolve);
    ws.send(JSON.stringify({ id: myId, method, params }));
  });
}

await new Promise(r => ws.addEventListener('open', r));

// Ловим ошибки консоли и необработанные исключения
const logs = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Runtime.consoleAPICalled') {
    logs.push('[console.' + m.params.type + '] ' + (m.params.args || []).map(a => a.value ?? a.description ?? '').join(' '));
  }
  if (m.method === 'Runtime.exceptionThrown') {
    logs.push('[EXCEPTION] ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text));
  }
  if (m.method === 'Log.entryAdded') {
    logs.push('[log.' + m.params.entry.level + '] ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
  }
});
await send('Runtime.enable');
await send('Log.enable');

async function evaluate(expr) {
  const res = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (res.result?.exceptionDetails) return { error: res.result.exceptionDetails.text };
  return res.result?.result?.value;
}

await sleep(8000);

const report = await evaluate(`(async () => {
  const out = {};

  // 1. манифест в DOM
  const link = document.querySelector('link[rel=manifest]');
  out.manifestHref = link ? link.getAttribute('href') : null;

  // 2. сам манифест
  try {
    const r = await fetch(link.href);
    out.manifestStatus = r.status;
    const m = await r.json();
    out.manifest = {
      name: m.name, short_name: m.short_name, display: m.display,
      start_url: m.start_url, scope: m.scope, theme_color: m.theme_color,
      icons: (m.icons || []).map(i => i.src + ' ' + i.sizes + ' ' + i.type + ' ' + (i.purpose || '')),
    };
  } catch (e) { out.manifestError = String(e); }

  // 3. service worker
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    out.swCount = regs.length;
    out.swRegs = regs.map(r => ({
      scope: r.scope,
      installing: r.installing?.state, waiting: r.waiting?.state, active: r.active?.state,
    }));
    if (regs[0]?.active) {
      out.swActive = regs[0].active.state;
      out.swScriptURL = regs[0].active.scriptURL;
    }
    out.swController = !!navigator.serviceWorker.controller;
  } else { out.swUnsupported = true; }

  // 4. кэш
  try {
    const keys = await caches.keys();
    out.caches = keys;
    if (keys.length) {
      const c = await caches.open(keys[0]);
      const reqs = await c.keys();
      out.cached = reqs.map(r => new URL(r.url).pathname);
    }
  } catch (e) { out.cacheError = String(e); }

  // 5. приложение живо?
  out.rootHtml = document.getElementById('root')?.children.length > 0;
  out.title = document.title;

  // 6. доступ к данным
  try {
    const r = await fetch('exercises.json');
    out.exercisesStatus = r.status;
  } catch (e) { out.exercisesError = String(e); }

  return out;
})()`);

// Диагностика кэширования: каждый файл по отдельности, с замером
const diag = await evaluate(`(async () => {
  const assets = ['./','./index.html','./manifest.webmanifest','./icon-180.png','./icon-192.png',
    './icon-512.png','./icon-maskable-512.png','./knowledge.md','./exercises.json','./picker.json'];
  const c = await caches.open('diag-test');
  const out = [];
  for (const u of assets) {
    const t0 = performance.now();
    try {
      const r = await fetch(u, { cache: 'no-store' });
      out.push(u + ' -> HTTP ' + r.status + ' (' + Math.round(performance.now() - t0) + 'ms)');
    } catch (e) {
      out.push(u + ' -> ОШИБКА ' + e + ' (' + Math.round(performance.now() - t0) + 'ms)');
    }
  }
  await caches.delete('diag-test');
  return out;
})()`);
console.log('\n=== ДОСТУПНОСТЬ ФАЙЛОВ ===');
(diag || []).forEach(l => console.log('  ' + l));

// Следим за состоянием Service Worker 30 секунд
console.log('\n=== СОСТОЯНИЕ SW (опрос 30 с) ===');
for (let i = 0; i < 6; i++) {
  const st = await evaluate(`(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    const r = regs[0];
    return {
      n: regs.length,
      installing: r?.installing?.state || null,
      waiting: r?.waiting?.state || null,
      active: r?.active?.state || null,
      controller: !!navigator.serviceWorker.controller,
    };
  })()`);
  console.log(`  [${i * 5}s] ${JSON.stringify(st)}`);
  if (st.active === 'activated' && st.controller) break;
  await sleep(5000);
}

// Диагностика: повторяем ровно то, что делает SW при установке, но с таймаутом
const diag2 = await evaluate(`(async () => {
  const assets = ['./','./index.html','./manifest.webmanifest','./icon-180.png',
    './icon-192.png','./icon-512.png','./icon-maskable-512.png','./knowledge.md',
    './exercises.json','./picker.json'];
  const c = await caches.open('fitguide-v1.13');
  const out = [];
  for (const u of assets) {
    const t0 = performance.now();
    const race = await Promise.race([
      c.add(u).then(() => 'ok').catch(e => 'ERR ' + e),
      new Promise(res => setTimeout(() => res('HANG (>4s)'), 4000)),
    ]);
    out.push(u.padEnd(28) + race + '  ' + Math.round(performance.now() - t0) + 'ms');
  }
  return out;
})()`);
console.log('\n=== cache.add() ПО ФАЙЛАМ (как в SW) ===');
(diag2 || []).forEach(l => console.log('  ' + l));

console.log('\n=== PWA-ПРОВЕРКА ===');
console.log(JSON.stringify(report, null, 2));

// Второй визит: перезагружаем и смотрим, стал ли SW контроллером страницы.
// Только после этого Chrome считает приложение устанавливаемым и показывает
// иконку установки в адресной строке.
await send('Page.enable');
await send('Page.reload', { ignoreCache: false });
await sleep(4000);

// После перезагрузки ждём, пока SW возьмёт контроль над страницей
let after = null;
for (let i = 0; i < 6; i++) {
  after = await evaluate(`(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    const r = regs[0];
    return {
      regs: regs.length,
      installing: r?.installing?.state || null,
      active: r?.active?.state || null,
      controller: !!navigator.serviceWorker.controller,
      rootHtml: document.getElementById('root')?.children.length > 0,
      exercises: (await fetch('exercises.json')).status,
      knowledge: (await fetch('knowledge.md')).status,
    };
  })()`);
  if (after.controller) break;
  await sleep(4000);
}
console.log('\n=== ПОСЛЕ ПЕРЕЗАГРУЗКИ (второй визит) ===');
console.log(JSON.stringify(after, null, 2));

// Манифест: как его видит Chrome
const man = await send('Page.getAppManifest');
console.log('\n=== МАНИФЕСТ (Chrome) ===');
console.log('url:', man.result?.url);
console.log('errors:', JSON.stringify(man.result?.errors || []));
console.log('data:', (man.result?.data || '').slice(0, 400));

// Функциональная проверка: открываем раздел упражнений и считаем карточки
await evaluate(`(async () => { location.hash = '#/exercises'; await new Promise(r => setTimeout(r, 1500)); })()`);
await sleep(3500);
const app = await evaluate(`(() => {
  const text = document.body.innerText;
  const m = text.match(/(\\d+)\\s+упражнений/);
  const cards = document.querySelectorAll('button, div').length;
  return {
    hash: location.hash,
    headerFound: m ? m[0] : null,
    exercisesCount: m ? parseInt(m[1], 10) : null,
    hasRendered: text.includes('База упражнений'),
    textLen: text.length,
  };
})()`);
console.log('\n=== ПРИЛОЖЕНИЕ (раздел «Упражнения») ===');
console.log(JSON.stringify(app, null, 2));

// И раздел «Знания» — вторая база
await evaluate(`(async () => { location.hash = '#/knowledge'; await new Promise(r => setTimeout(r, 1500)); })()`);
await sleep(3500);
const kb = await evaluate(`(() => {
  const text = document.body.innerText;
  const m = text.match(/(\\d+)\\s+глав/);
  return {
    hash: location.hash,
    chaptersFound: m ? m[0] : null,
    hasRendered: text.includes('База знаний'),
  };
})()`);
console.log('\n=== ПРИЛОЖЕНИЕ (раздел «Знания») ===');
console.log(JSON.stringify(kb, null, 2));

// --- Скриншоты для визуальной сверки с Android-версией ---
async function shot(name, hash, waitMs = 3000) {
  await evaluate(`(async () => { location.hash = '${hash}'; await new Promise(r => setTimeout(r, 1200)); })()`);
  await sleep(waitMs);
  const res = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  if (res.result?.data) {
    const { writeFileSync } = await import('node:fs');
    const file = `C:\\Users\\ikydz\\AppData\\Local\\Temp\\opencode\\shot-${name}.png`;
    writeFileSync(file, Buffer.from(res.result.data, 'base64'));
    console.log(`SHOT: ${file}`);
  }
}

await send('Emulation.setDeviceMetricsOverride', {
  width: 412, height: 915, deviceScaleFactor: 2, mobile: true,
});

// Засеваем профиль (как у залогиненного пользователя) и проходим заставку
await evaluate(`(() => {
  localStorage.setItem('fitguide_web_user_profile', JSON.stringify({
    name: 'Алексей', gender: 'male', age: 35, heightCm: 180, weightKg: 82,
    activityLevel: 'moderate', goal: 'mass', trainStyle: 'any',
    bodyFatPercent: 14, workoutsPerWeek: 4, bio: '', country: 'Россия',
    city: 'Красноярск', level: 'intermediate', equipment: [], place: 'gym'
  }));
  localStorage.setItem('fitguide_web_splash_enabled', 'false');
  return true;
})()`);
await send('Page.reload', { ignoreCache: false });
await sleep(5000);

await shot('splash', '#/');
await shot('hub', '#/');
await shot('exercises', '#/exercises');
await shot('knowledge', '#/knowledge');
await shot('coach', '#/coach');

// Пробуем зарегистрировать SW вручную — смотрим точную ошибку
const manual = await evaluate(`(async () => {
  try {
    const r = await navigator.serviceWorker.register('./sw.js');
    return { ok: true, scope: r.scope, installing: r.installing?.state, active: r.active?.state };
  } catch (e) {
    return { ok: false, error: String(e), name: e?.name, message: e?.message };
  }
})()`);
console.log('\n=== РУЧНАЯ РЕГИСТРАЦИЯ SW ===');
console.log(JSON.stringify(manual, null, 2));

console.log('\n=== КОНСОЛЬ / ОШИБКИ ===');
if (!logs.length) console.log('(пусто)');
logs.slice(0, 30).forEach(l => console.log('  ' + l));

ws.close();
proc.kill();
process.exit(0);
