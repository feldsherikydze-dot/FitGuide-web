// Скан всей подсети на конкретный порт (без ICMP-фильтра)
// Запуск: node scripts/scan-port.mjs <подсеть> <порт> [порт...]
import net from 'node:net';

const subnet = process.argv[2] || '192.168.0';
const ports = process.argv.slice(3).map(Number);
const CONCURRENCY = 250;

function check(ip, port) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    let done = false;
    const finish = (ok) => { if (!done) { done = true; s.destroy(); resolve(ok ? `${ip}:${port}` : null); } };
    s.setTimeout(2500);
    s.once('connect', () => finish(true));
    s.once('timeout', () => finish(false));
    s.once('error', () => finish(false));
    s.connect(port, ip);
  });
}

const hosts = [];
for (let h = 1; h <= 254; h++) hosts.push(`${subnet}.${h}`);

const tasks = [];
for (const ip of hosts) for (const p of ports) tasks.push(() => check(ip, p));

const found = [];
let idx = 0;
const workers = Array.from({ length: CONCURRENCY }, async () => {
  while (idx < tasks.length) {
    const t = tasks[idx++];
    const r = await t();
    if (r) { found.push(r); console.log('  НАЙДЕН: ' + r); }
  }
});
await Promise.all(workers);
console.log('--- ИТОГ ---');
found.forEach(f => console.log('  ' + f));
if (!found.length) console.log('  ничего не найдено');
