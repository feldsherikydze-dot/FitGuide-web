// Копирует собранный dist/ в папку web/ (её GitHub Pages отдаёт как корень сайта)
// Запуск: node scripts/copy-to-web.mjs
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dist = join(root, 'dist');
const web = join(root, 'web');

if (!existsSync(dist)) {
  console.error('Нет папки dist/. Сначала выполни: npm run build');
  process.exit(1);
}

rmSync(web, { recursive: true, force: true });
mkdirSync(web, { recursive: true });
cpSync(dist, web, { recursive: true });

console.log('OK: dist/ скопирован в web/');
