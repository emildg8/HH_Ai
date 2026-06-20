import fs from 'fs';
import path from 'path';
import { callMeetingLlm, chunkText } from './meeting-llm.mjs';
import { writeDocxFromMarkdown } from './md-export.mjs';

export const SUMMARY_SIZES = [
  {
    id: 'brief',
    label: 'Краткая выжимка',
    factInstruction:
      '8–12 буллетов: тема, участники, ключевые решения, цифры, сроки, открытые вопросы. Только факты.',
    expertInstruction:
      '5–8 пунктов: главные выводы, риски для сотрудника, что уточнить у руководителя, противоречия в ответах компании.',
    maxTokens: 1200,
    expertMaxTokens: 900,
  },
  {
    id: 'medium',
    label: 'Средняя выжимка',
    factInstruction:
      '1–2 страницы: контекст → блоки обсуждения → важное → что делать дальше. Только факты.',
    expertInstruction:
      '3–5 подразделов: контекст рынка, логика компании, риски (мотивация, отток, субъективность оценок), несостыковки, практические шаги.',
    maxTokens: 2200,
    expertMaxTokens: 1600,
  },
  {
    id: 'full',
    label: 'Полная выжимка',
    factInstruction:
      'Полный протокол по фактам: хронология по блокам, имена, цифры, договорённости, открытые вопросы.',
    expertInstruction:
      'Развёрнутая экспертиза: что обещали vs что уклонились, системные риски, сравнение с практикой IT-рынка РФ, сценарии на 6–12 мес., чеклист действий сотрудника.',
    maxTokens: 4000,
    expertMaxTokens: 2800,
  },
];

export const SUMMARY_STYLES = [
  {
    id: 'plain',
    label: 'понятный',
    tone: 'Пиши простым русским языком, как объяснение близкому человеку. Без канцелярита.',
  },
  {
    id: 'formal',
    label: 'официальный',
    tone: 'Деловой протокол, нейтральный официальный тон, структурированные разделы.',
  },
  {
    id: 'casual',
    label: 'свободный',
    tone: 'Живой разговорный пересказ, прямо и по существу, без бюрократического языка.',
  },
];

const EXPERT_DISCLAIMER =
  '*Мнение аналитика (не официальная позиция компании). Субъективная интерпретация на основе транскрипта.*';

async function mapReduceFacts(title, transcript, size, style) {
  const chunks = chunkText(transcript, 14000);
  let partials = [];
  if (chunks.length === 1) {
    partials = [
      await callMeetingLlm({
        system: `Ты протоколист. ${style.tone} Только факты из транскрипта.`,
        user: `Встреча «${title}». ${size.factInstruction}\n\nТранскрипт:\n${chunks[0]}`,
        maxTokens: size.maxTokens,
        temperature: 0.2,
      }),
    ];
  } else {
    for (let i = 0; i < chunks.length; i++) {
      const part = await callMeetingLlm({
        system: 'Ты протоколист. Только факты. Краткие буллеты по фрагменту.',
        user: `Фрагмент ${i + 1}/${chunks.length} встречи «${title}»:\n${chunks[i]}\n\nВыдели факты буллетами.`,
        maxTokens: 1500,
        temperature: 0.2,
      });
      partials.push(part);
    }
    partials = [
      await callMeetingLlm({
        system: `Ты протоколист. ${style.tone} Объедини фрагменты в одну выжимку. Только факты.`,
        user: `Встреча «${title}». ${size.factInstruction}\n\nФрагменты:\n${partials.join('\n\n---\n\n')}`,
        maxTokens: size.maxTokens,
        temperature: 0.2,
      }),
    ];
  }
  return partials[0];
}

async function generateExpertBlock(title, transcript, factsSummary, size, style) {
  return callMeetingLlm({
    system: `Ты эксперт по HR, компенсациям и рынку труда IT в России. ${style.tone}
Дай глубокую аналитику: интерпретации, риски, что сказано прямо vs уклончиво, практические рекомендации.
Опирайся на транскрипт и фактическую выжимку. Явно отделяй мнение от фактов.`,
    user: `Встреча «${title}».

Фактическая выжимка:
${factsSummary}

Исходный транскрипт (фрагмент):
${transcript.slice(0, 20000)}

${size.expertInstruction}

Заголовок блока: «Экспертная аналитика».`,
    maxTokens: size.expertMaxTokens,
    temperature: 0.45,
  });
}

/**
 * @returns {Promise<string>} full markdown document
 */
export async function generateSummaryDocument(title, transcript, size, style, log = console.log) {
  const id = `${size.id}-${style.id}`;
  log(`[summary] ${id} facts...`);
  const facts = await mapReduceFacts(title, transcript, size, style);
  log(`[summary] ${id} expert...`);
  const expert = await generateExpertBlock(title, transcript, facts, size, style);

  return `# ${size.label} (${style.label} стиль)

## Выжимка

${facts.trim()}

---

## Экспертная аналитика

${EXPERT_DISCLAIMER}

${expert.trim()}
`;
}

export async function exportSummaryBundle(summariesDir, size, style, markdown) {
  const id = `${size.id}-${style.id}`;
  fs.mkdirSync(summariesDir, { recursive: true });
  const base = path.join(summariesDir, id);
  fs.writeFileSync(`${base}.md`, `${markdown.trim()}\n`, 'utf8');
  fs.writeFileSync(
    `${base}.txt`,
    `${markdown.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').trim()}\n`,
    'utf8'
  );
  await writeDocxFromMarkdown(markdown, `${base}.docx`);
  return { id, md: `${base}.md`, txt: `${base}.txt`, docx: `${base}.docx` };
}

export async function generateAllSummaries(title, transcript, summariesDir, log = console.log) {
  const manifest = [];
  for (const size of SUMMARY_SIZES) {
    for (const style of SUMMARY_STYLES) {
      const id = `${size.id}-${style.id}`;
      const mdPath = path.join(summariesDir, `${id}.md`);
      if (fs.existsSync(mdPath) && fs.statSync(mdPath).size > 200) {
        log(`[summary] skip existing ${id}`);
        manifest.push({ id, md: mdPath, skipped: true });
        continue;
      }
      try {
        const md = await generateSummaryDocument(title, transcript, size, style, log);
        const files = await exportSummaryBundle(summariesDir, size, style, md);
        manifest.push(files);
        log(`[summary] done ${files.id}`);
      } catch (e) {
        log(`[summary] ERROR ${id}: ${e.message}`);
        const errMd = `# ${size.label} (${style.label} стиль)\n\n## Выжимка\n\n_Ошибка: ${e.message}_\n\n---\n\n## Экспертная аналитика\n\n_Не сгенерировано._\n`;
        const files = await exportSummaryBundle(summariesDir, size, style, errMd);
        manifest.push({ ...files, error: e.message });
      }
    }
  }
  return manifest;
}
