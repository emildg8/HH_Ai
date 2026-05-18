/**
 * Создать профиль под другую вакансию.
 *   npm run profile:init -- --id=backend --title="Backend" --keywords=./config/search-keywords.txt
 */

import fs from 'fs';
import path from 'path';
import { ROOT } from '../lib/paths.mjs';
import { listProfiles } from '../lib/load-profile.mjs';

function arg(name) {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3).trim() : '';
}

function main() {
  const id = arg('id') || arg('profile');
  if (!id || !/^[a-z0-9][a-z0-9_-]{0,31}$/i.test(id)) {
    console.log('Профили:', listProfiles().map((p) => `  - ${p.id}`).join('\n') || '  (нет)');
    console.error('\nИспользование: npm run profile:init -- --id=backend --title=Backend');
    process.exit(1);
  }

  const profilesDir = path.join(ROOT, 'config', 'profiles');
  fs.mkdirSync(profilesDir, { recursive: true });
  const envPath = path.join(profilesDir, `${id}.env`);
  if (fs.existsSync(envPath) && !process.argv.includes('--force')) {
    console.error(`Уже есть ${envPath}. Добавьте --force для перезаписи.`);
    process.exit(1);
  }

  const title = arg('title') || id;
  const keywords = arg('keywords') || './config/search-keywords.txt';
  const queue = arg('queue') || `./data/vacancies-${id}.json`;

  const template = `# Профиль: ${title}
HH_PROFILE=${id}
HH_KEYWORDS_FILE=${keywords}
HH_VACANCIES_QUEUE_FILE=${queue}
HH_AREA=113
HH_SEARCH_PERIOD=7
HH_SEARCH_ORDER_BY=publication_time
HH_SESSION_LIMIT=50
HH_PER_KEYWORD_LIMIT=20
HH_LLM_MAX_PER_RUN=25
HH_PROFILE_RESUME_TITLE=${title}
# HH_PROFILE_RESUME_HASH=
`;

  fs.writeFileSync(envPath, template, 'utf8');
  const kwPath = path.isAbsolute(keywords) ? keywords : path.join(ROOT, keywords.replace(/^\.\//, ''));
  const queuePath = path.isAbsolute(queue) ? queue : path.join(ROOT, queue.replace(/^\.\//, ''));
  if (!fs.existsSync(kwPath)) {
    fs.mkdirSync(path.dirname(kwPath), { recursive: true });
    fs.writeFileSync(kwPath, `${title}\n${title} engineer\n`, 'utf8');
  }
  if (!fs.existsSync(queuePath)) {
    fs.mkdirSync(path.dirname(queuePath), { recursive: true });
    fs.writeFileSync(queuePath, '[]\n', 'utf8');
  }

  console.log(`[profile-init] Создан ${envPath}`);
  console.log(`  HH_PROFILE=${id} npm run harvest`);
  console.log(`  HH_PROFILE=${id} npm run dashboard`);
}

main();
