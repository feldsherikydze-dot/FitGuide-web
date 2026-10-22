// Скан подсети на порты adb: 5555 (часы) и 37000-44000 (беспроводная отладка)
// Сначала отсеиваем живые хосты по ping, потом сканируем порты с лимитом параллелизма.
// Запуск: node scripts/scan-adb-subnet.mjs [подсеть]
import net from 'node:net';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const subnet = process.argv[2] || '192.168.0';
const CONCURRENCY = 300;

function ping(ip) {
  // ICMP через .NET Ping — без учётных записей
  return new Promise((resolve) => {
    const { execFile } = require('node:child_process');
    execFile('ping', ['-n', '1', '-w', '400', ip], { timeout: 1500 }, (err, stdout) => {
      resolve(!err && /TTL=/.test(stdout) ? ip : null);
    });
  });
}

function check(ip, port) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    let done = false;
    const finish = (ok) => { if (!done) { done = true; s.destroy(); resolve(ok ? `${ip}:${port}` : null); } };
    s.setTimeout(2000);
    s.once('connect', () => finish(true));
    s.once('timeout', () => finish(false));
    s.once('error', () => finish(false));
    s.connect(port, ip);
  });
}

async function runPool(tasks) {
  const out = [];
  let idx = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (idx < tasks.length) {
      const t = tasks[idx++];
      const r = await t();
      if (r) out.push(r);
    }
  });
  await Promise.all(workers);
  return out;
}

// 1) живые хосты
const hosts = [];
for (let h = 1; h <= 254; h++) hosts.push(`${subnet}.${h}`);
console.log('Ищу живые хосты...');
const alive = await runPool(hosts.map(ip => () => ping(ip).then(ok => (ok ? ip : null))));
const live = alive.filter(Boolean);
console.log('Живые:', live.join(', ') || '(нет)');

// 2) порты adb на живых хостах
const ports = [5555];
for (let p = 37000; p <= 44000; p++) ports.push(p);

const tasks = [];
for (const ip of live) for (const p of ports) tasks.push(() => check(ip, p));

console.log(`Сканирую ${tasks.length} комбинаций (${live.length} хостов x ${ports.length} портов)...`);
const found = await runPool(tasks);
console.log('--- НАЙДЕНО ---');
found.forEach(f => console.log('  ' + f));
if (!found.length) console.log('  (пусто)');
