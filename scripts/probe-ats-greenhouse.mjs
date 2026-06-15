#!/usr/bin/env node
/** Probe Greenhouse API (fixture или --live). */
import { parseGreenhouseBoard } from '../lib/ats/parsers/greenhouse.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const live = process.argv.includes('--live');

async function main() {
  if (!live) {
    const fixture = {
      jobs: [
        {
          id: 1,
          title: 'DevOps Engineer',
          absolute_url: 'https://boards.greenhouse.io/example/jobs/1',
          content: 'Docker Kubernetes',
          location: { name: 'Remote' },
        },
      ],
    };
    const jobs = await parseGreenhouseBoard(
      { slug: 'example', company: 'Example' },
      {
        fetchImpl: async () => ({
          ok: true,
          json: async () => fixture,
        }),
      }
    );
    console.log('fixture jobs:', jobs.length, jobs[0]?.title);
    return;
  }
  const cfg = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'config', 'ats-companies.json'), 'utf8')
  )[0];
  const jobs = await parseGreenhouseBoard(cfg);
  console.log('live jobs:', jobs.length);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
