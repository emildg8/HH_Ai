import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx';

function mdToHtml(md) {
  const lines = md.split(/\r?\n/);
  const parts = [
    '<!DOCTYPE html><html><head><meta charset="utf-8"><style>',
    'body{font-family:Segoe UI,Arial,sans-serif;font-size:11pt;line-height:1.45;margin:2cm;color:#111}',
    'h1{font-size:18pt}h2{font-size:13pt;margin-top:1em}ul{margin:0.3em 0}',
    '</style></head><body>',
  ];
  let inUl = false;
  for (const line of lines) {
    const t = line.trimEnd();
    if (!t.trim()) {
      if (inUl) {
        parts.push('</ul>');
        inUl = false;
      }
      parts.push('<p>&nbsp;</p>');
      continue;
    }
    if (t.startsWith('# ')) {
      if (inUl) {
        parts.push('</ul>');
        inUl = false;
      }
      parts.push(`<h1>${escapeHtml(t.slice(2))}</h1>`);
    } else if (t.startsWith('## ')) {
      if (inUl) {
        parts.push('</ul>');
        inUl = false;
      }
      parts.push(`<h2>${escapeHtml(t.slice(3))}</h2>`);
    } else if (t.startsWith('### ')) {
      if (inUl) {
        parts.push('</ul>');
        inUl = false;
      }
      parts.push(`<h2>${escapeHtml(t.slice(4))}</h2>`);
    } else if (t.startsWith('- ')) {
      if (!inUl) {
        parts.push('<ul>');
        inUl = true;
      }
      parts.push(`<li>${inlineFormat(t.slice(2))}</li>`);
    } else {
      if (inUl) {
        parts.push('</ul>');
        inUl = false;
      }
      parts.push(`<p>${inlineFormat(t)}</p>`);
    }
  }
  if (inUl) parts.push('</ul>');
  parts.push('</body></html>');
  return parts.join('\n');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function inlineFormat(s) {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function mdToDocxParagraphs(md) {
  const out = [];
  for (const line of md.split(/\r?\n/)) {
    const t = line.trimEnd();
    if (!t.trim()) {
      out.push(new Paragraph({ children: [new TextRun('')] }));
      continue;
    }
    if (t.startsWith('# ')) {
      out.push(new Paragraph({ text: t.slice(2), heading: HeadingLevel.HEADING_1 }));
    } else if (t.startsWith('## ')) {
      out.push(new Paragraph({ text: t.slice(3), heading: HeadingLevel.HEADING_2 }));
    } else if (t.startsWith('### ')) {
      out.push(new Paragraph({ text: t.slice(4), heading: HeadingLevel.HEADING_2 }));
    } else if (t.startsWith('- ')) {
      out.push(new Paragraph({ text: `• ${t.slice(2).replace(/\*\*/g, '')}`, bullet: { level: 0 } }));
    } else {
      out.push(new Paragraph({ children: [new TextRun(t.replace(/\*\*/g, ''))] }));
    }
  }
  return out;
}

export async function writePdfFromMarkdown(md, outPath) {
  const html = mdToHtml(md);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    await page.pdf({
      path: outPath,
      format: 'A4',
      margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
      printBackground: true,
    });
  } finally {
    await browser.close();
  }
}

export async function writeDocxFromMarkdown(md, outPath) {
  const doc = new Document({
    sections: [{ properties: {}, children: mdToDocxParagraphs(md) }],
  });
  const buf = await Packer.toBuffer(doc);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buf);
}

export async function exportMarkdownFile(mdPath, outBasePath) {
  const md = fs.readFileSync(mdPath, 'utf8');
  const pdfPath = `${outBasePath}.pdf`;
  const docxPath = `${outBasePath}.docx`;
  await writePdfFromMarkdown(md, pdfPath);
  await writeDocxFromMarkdown(md, docxPath);
  return { pdfPath, docxPath };
}
