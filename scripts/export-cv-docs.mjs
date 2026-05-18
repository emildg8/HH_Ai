/**
 * PDF + DOCX из CV/*.md для загрузки на hh.ru
 *   npm run cv:export
 */
import fs from 'fs';
import path from 'path';
import { CV_DIR } from '../lib/paths.mjs';
import { exportMarkdownFile } from '../lib/md-export.mjs';

const OUT_DIR = path.join(CV_DIR, 'exports');

async function main() {
  if (!fs.existsSync(CV_DIR)) {
    console.error('Нет папки CV/');
    process.exit(1);
  }
  const files = fs
    .readdirSync(CV_DIR)
    .filter((n) => n.endsWith('.md') && !n.startsWith('_'))
    .sort();
  if (!files.length) {
    console.error('Нет CV/*.md');
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const name of files) {
    const base = path.join(OUT_DIR, path.basename(name, '.md'));
    console.log('Экспорт', name, '…');
    const { pdfPath, docxPath } = await exportMarkdownFile(path.join(CV_DIR, name), base);
    console.log('  PDF:', pdfPath);
    console.log('  DOCX:', docxPath);
  }
  console.log('\nГотово. Загрузите файлы из', OUT_DIR, 'на hh.ru');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
