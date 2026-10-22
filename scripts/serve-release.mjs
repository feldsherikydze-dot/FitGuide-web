// Раздача папки «Релиз» по локальной сети: чтобы поставить APK на телефон
// без USB и без adb (Samsung с Автоблокировкой не даёт отладку).
// Запуск: node scripts/serve-release.mjs [папка] [порт]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2] || 'C:/Users/ikydz/Desktop/Телефон+Часы/Релиз';
const port = parseInt(process.argv[3] || '8080', 10);

const MIME = {
  '.apk': 'application/vnd.android.package-archive',
  '.txt': 'text/plain; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.bat': 'application/octet-stream',
  '.inf': 'text/plain; charset=utf-8',
};

function listPage() {
  const files = fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isFile());
  const rows = files
    .map((f) => {
      const size = (fs.statSync(path.join(dir, f)).size / 1048576).toFixed(2);
      return `<li><a href="/${encodeURIComponent(f)}">${f}</a> <small>${size} МБ</small></li>`;
    })
    .join('\n');
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>FitGuide — раздача APK</title>
<style>body{background:#0a0a0a;color:#fff;font:16px/1.5 sans-serif;padding:24px}
a{color:#7CFF00;text-decoration:none;font-weight:600}li{margin:14px 0}small{color:#888;font-weight:400}
h1{color:#7CFF00;font-size:20px}</style></head><body>
<h1>FitGuide — файлы</h1><ul>${rows}</ul></body></html>`;
}

http
  .createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(listPage());
      return;
    }
    const file = path.join(dir, path.basename(url));
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('нет такого файла');
      return;
    }
    const stat = fs.statSync(file);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Content-Disposition': `attachment; filename="${path.basename(file)}"`,
    });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, '0.0.0.0', () => {
    console.log(`Раздача: http://192.168.0.101:${port}/`);
    console.log(`Папка: ${dir}`);
  });
