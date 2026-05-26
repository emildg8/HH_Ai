/**
 * Анализ транскриптов собеседований → data/interview-notes.json (для подготовки и LLM).
 *   npm run devops:analyze-interviews
 */

import fs from 'fs';
import path from 'path';
import { loadEnv } from '../lib/load-env.mjs';
loadEnv();

import { DATA_DIR, INTERVIEW_NOTES_FILE } from '../lib/paths.mjs';
import { importInterviewNotesFromDir } from '../lib/interview-notes.mjs';
import { extractJsonObject, getOpenRouterApiKey, resolveOpenRouterModelForRequest } from '../lib/openrouter-score.mjs';

const TRANSCRIPT_DIR = path.join(DATA_DIR, 'interview-transcripts');

async function analyzeChunk(title, text) {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    return {
      title,
      excerpt: text.slice(0, 1500),
      lessons: ['LLM не настроен — только сырой транскрипт'],
      mistakes: [],
      strongAnswers: [],
    };
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'http://localhost',
    },
    body: JSON.stringify({
      model: resolveOpenRouterModelForRequest(),
      messages: [
        {
          role: 'system',
          content:
            'Ты ментор по собеседованиям DevOps/поддержка. Ответ только JSON.',
        },
        {
          role: 'user',
          content: `Проанализируй транскрипт собеседования «${title}».

Текст:
${text.slice(0, 12000)}

JSON:
{
  "companyGuess": "",
  "roleGuess": "",
  "lessons": ["урок 1"],
  "mistakes": ["ошибка кандидата"],
  "strongAnswers": ["удачный ответ"],
  "typicalQuestions": ["вопрос работодателя"],
  "prepTips": ["совет перед следующим собесом"]
}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 900,
      response_format: { type: 'json_object' },
    }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`LLM ${res.status}`);
  const data = JSON.parse(raw);
  const parsed = extractJsonObject(data?.choices?.[0]?.message?.content || '{}');
  return { title, excerpt: text.slice(0, 800), ...parsed };
}

async function main() {
  importInterviewNotesFromDir(process.env.HH_INTERVIEW_DIR);

  if (!fs.existsSync(TRANSCRIPT_DIR)) {
    console.error('Сначала: npm run devops:transcribe-interviews');
    process.exit(1);
  }

  const txts = fs.readdirSync(TRANSCRIPT_DIR).filter((n) => n.endsWith('.txt'));
  if (!txts.length) {
    console.error('Нет .txt в', TRANSCRIPT_DIR);
    process.exit(1);
  }

  const topics = [];
  for (const name of txts) {
    const text = fs.readFileSync(path.join(TRANSCRIPT_DIR, name), 'utf8');
    if (text.trim().length < 80) continue;
    const title = name.replace(/\.txt$/i, '');
    console.log('[analyze]', title);
    try {
      topics.push(await analyzeChunk(title, text));
    } catch (e) {
      topics.push({ title, excerpt: text.slice(0, 500), error: e.message });
    }
  }

  const aggregated = {
    topics,
    importedAt: new Date().toISOString(),
    sourceDir: process.env.HH_INTERVIEW_DIR,
    transcriptDir: TRANSCRIPT_DIR,
    globalPrep: [
      'Держать ответы STAR: ситуация → действие → результат с цифрами',
      'DevOps: Kubernetes, CI/CD, мониторинг, инциденты — с примерами из банка/прода',
      'Поддержка L2: эскалации, SLA, коммуникация с разработкой',
      'Честно про уровень junior+/middle, не приукрашивать senior-опыт',
    ],
  };

  fs.writeFileSync(INTERVIEW_NOTES_FILE, `${JSON.stringify(aggregated, null, 2)}\n`, 'utf8');
  console.log('[analyze] Записано:', INTERVIEW_NOTES_FILE, 'тем:', topics.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
