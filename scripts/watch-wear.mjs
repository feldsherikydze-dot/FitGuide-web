// Сторож ТОЛЬКО для часов: ждёт открытия adb-порта на конкретном IP,
// проверяет, что это действительно часы (а не телефон), и заливает wear-APK.
// Запуск: node scripts/watch-wear.mjs [apk] [ip]
import net from 'node:net';
import { execFile } from 'node:child_process';

const apk =
  process.argv[2] || 'C:/Users/ikydz/Desktop/Телефон+Часы/Релиз/FitGuide-wear-1.14.apk';
const ip = process.argv[3] || '192.168.0.103';

function adb(args, timeout = 180000) {
  return new Promise((resolve) => {
    execFile('adb', args, { timeout, maxBuffer: 1024 * 1024 * 8 }, (err, stdout, stderr) =>
      resolve({ err, out: `${stdout || ''}${stderr || ''}`.trim() })
    );
  });
}

function probe(host, port, ms = 1500) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    let done = false;
    const fin = (ok) => {
      if (!done) {
        done = true;
        s.destroy();
        resolve(ok);
      }
    };
    s.setTimeout(ms);
    s.once('connect', () => fin(true));
    s.once('timeout', () => fin(false));
    s.once('error', () => fin(false));
    s.connect(port, host);
  });
}

// 5555 — классический порт Wear OS. Плюс диапазон wireless debugging.
const ports = [5555];
for (let p = 30000; p <= 50000; p += 1) ports.push(p);

console.log(`[watch] цель: ${ip}, порты 5555 + 30000-50000`);
console.log(`[watch] APK: ${apk}`);
console.log('[watch] жду, пока часы проснутся и откроют порт...');

let tries = 0;
while (true) {
  tries++;
  const open = [];
  // сначала быстрая проверка 5555, потом широкий диапазон раз в 5 кругов
  if (await probe(ip, 5555)) open.push(5555);
  if (!open.length && tries % 5 === 0) {
    const batch = [];
    for (let p = 30000; p <= 50000; p += 1) batch.push(p);
    const C = 400;
    for (let i = 0; i < batch.length; i += C) {
      const r = await Promise.all(batch.slice(i, i + C).map((p) => probe(ip, p, 600)));
      r.forEach((ok, idx) => ok && open.push(batch[i + idx]));
    }
  }

  for (const port of open) {
    const addr = `${ip}:${port}`;
    console.log(`[watch] порт открыт: ${addr}`);
    const c = await adb(['connect', addr], 30000);
    console.log(`[watch] connect: ${c.out}`);
    if (!/connected to/i.test(c.out)) continue;

    const ident = await adb(
      ['-s', addr, 'shell', 'getprop ro.product.model; getprop ro.product.name; getprop ro.build.characteristics'],
      30000
    );
    const info = ident.out.replace(/\r/g, ' ').trim();
    console.log(`[watch] устройство: ${info}`);

    // Защита от повторной заливки на телефон.
    if (/SM-S\d|pa1q/i.test(info)) {
      console.log('[watch] ЭТО ТЕЛЕФОН, не часы. Пропускаю этот адрес.');
      continue;
    }

    console.log('[watch] ставлю wear-APK...');
    const inst = await adb(['-s', addr, 'install', '-r', apk], 900000);
    console.log(`[watch] install: ${inst.out}`);

    if (/Success/i.test(inst.out)) {
      const ver = await adb(
        ['-s', addr, 'shell', 'dumpsys package com.fitguide.app | grep -E "versionName|versionCode"'],
        60000
      );
      console.log(`[watch] версия: ${ver.out}`);
      console.log('[watch] ГОТОВО');
      process.exit(0);
    }
  }

  await new Promise((r) => setTimeout(r, 4000));
}
