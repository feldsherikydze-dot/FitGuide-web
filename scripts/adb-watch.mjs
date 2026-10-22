// Постоянное подключение к устройствам adb в сети: скан портов + автопереподключение.
// Бесконечный цикл: каждые 10 секунд ищет открытые порты adb на хостах подсети
// и подключается. Порт беспроводной отладки меняется — этот скрипт это переживает.
// Запуск: node scripts/adb-watch.mjs [подсеть] [интервал_мс]

import net from 'node:net';
import { execFile } from 'node:child_process';

const subnet = process.argv[2] || '192.168.0';
const interval = parseInt(process.argv[3] || '10000', 10);

function adb(args) {
  return new Promise((resolve) => {
    execFile('adb', args, { timeout: 30000 }, (err, stdout, stderr) => {
      resolve({ err, stdout: stdout || '', stderr: stderr || '' });
    });
  });
}

function check(ip, port) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    let done = false;
    const finish = (ok) => { if (!done) { done = true; s.destroy(); resolve(ok); } };
    s.setTimeout(2000);
    s.once('connect', () => finish(true));
    s.once('timeout', () => finish(false));
    s.once('error', () => finish(false));
    s.connect(port, ip);
  });
}

const hosts = [];
for (let h = 1; h <= 254; h++) hosts.push(`${subnet}.${h}`);

// Порты: 5555 (фиксированный после adb tcpip + режим часов) и диапазон беспроводной отладки
const ports = [5555];
for (let p = 37000; p <= 44000; p++) ports.push(p);

async function scan() {
  const found = [];
  const CONC = 400;
  for (let i = 0; i < ports.length; i += CONC) {
    const chunk = ports.slice(i, i + CONC);
    const tasks = [];
    for (const ip of hosts) for (const p of chunk) tasks.push(() => check(ip, p).then(ok => (ok ? `${ip}:${p}` : null)));
    const res = await Promise.all(tasks.map(t => t()));
    found.push(...res.filter(Boolean));
  }
  return found;
}

console.log(`[watch] подсеть ${subnet}.0/24, интервал ${interval} мс`);

let known = new Set();

while (true) {
  try {
    const devs = await adb(['devices']);
    const connected = new Set(
      devs.stdout.split('\n')
        .slice(1)
        .map(l => l.trim().split(/\s+/)[0])
        .filter(Boolean)
    );

    // Новые устройства — подключаем
    for (const host of await scan()) {
      if (known.has(host) && connected.has(host)) continue;
      console.log(`[watch] найден ${host}, подключаюсь...`);
      const r = await adb(['connect', host]);
      console.log(`[watch] ${r.stdout.trim()}${r.stderr.trim()}`);
      known.add(host);
    }

    // Отвалившиеся — переподключаем
    for (const host of [...known]) {
      if (!connected.has(host)) {
        console.log(`[watch] ${host} отвалился, переподключаюсь`);
        const r = await adb(['connect', host]);
        console.log(`[watch] ${r.stdout.trim()}${r.stderr.trim()}`);
      }
    }
  } catch (e) {
    console.error('[watch] ошибка:', e.message);
  }
  await new Promise(r => setTimeout(r, interval));
}
