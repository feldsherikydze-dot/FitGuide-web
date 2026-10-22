// Быстрый скан портов adb (5555 + диапазон беспроводной отладки 37000-44000)
// Запуск: node scripts/find-adb.mjs <ip> [ip2 ...]
import net from 'node:net';

const ips = process.argv.slice(2);
if (!ips.length) { console.error('Укажи IP: node scripts/find-adb.mjs 192.168.0.102'); process.exit(1); }

const ports = [5555];
for (let p = 37000; p <= 44000; p++) ports.push(p);

function check(ip, port) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    let done = false;
    const finish = (ok) => { if (!done) { done = true; s.destroy(); resolve(ok ? port : null); } };
    s.setTimeout(1200);
    s.once('connect', () => finish(true));
    s.once('timeout', () => finish(false));
    s.once('error', () => finish(false));
    s.connect(port, ip);
  });
}

for (const ip of ips) {
  const results = [];
  const CHUNK = 400;
  for (let i = 0; i < ports.length; i += CHUNK) {
    const chunk = ports.slice(i, i + CHUNK);
    const found = await Promise.all(chunk.map(p => check(ip, p)));
    results.push(...found.filter(Boolean));
  }
  console.log(`${ip} -> ${results.length ? 'ОТКРЫТЫ: ' + results.join(', ') : 'ничего не найдено'}`);
}
