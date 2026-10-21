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

const profileDir = 'C:\\Users\\ikydz\\AppData\\Local\\Temp\\opencode\\pwa-profile';
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

console.log('\n=== PWA-ПРОВЕРКА ===');
console.log(JSON.stringify(report, null, 2));

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
