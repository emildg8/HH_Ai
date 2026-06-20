/**
 * Склейка микросегментов Whisper в читаемые абзацы.
 */

function endsIncomplete(text) {
  const t = String(text || '').trim();
  if (!t) return true;
  return /[,;:—-]$/.test(t) || /\b(и|а|но|что|как|то|на|в|с|у|по|за|от|для|или|если|когда|потому)$/i.test(t);
}

/**
 * @param {{startSec:number,endSec:number,text:string}[]} segments
 * @param {{ maxGapSec?: number, maxChars?: number }} [opts]
 */
export function mergeTranscriptSegments(segments, opts = {}) {
  const maxGapSec = opts.maxGapSec ?? 1.2;
  const maxChars = opts.maxChars ?? 420;
  const out = [];

  let cur = null;
  for (const seg of segments) {
    const text = String(seg.text || '').trim();
    if (!text) continue;

    const shouldMerge =
      cur &&
      seg.startSec - cur.endSec <= maxGapSec &&
      (endsIncomplete(cur.text) || cur.text.length + text.length + 1 <= maxChars);

    if (shouldMerge) {
      cur.endSec = seg.endSec;
      cur.text = `${cur.text} ${text}`.replace(/\s+/g, ' ').trim();
    } else {
      if (cur) out.push(cur);
      cur = { startSec: seg.startSec, endSec: seg.endSec, text };
    }
  }
  if (cur) out.push(cur);
  return out;
}

export function segmentsToTimedText(segments) {
  return segments
    .map((s) => {
      const h = (n) => String(Math.floor(n / 3600)).padStart(2, '0');
      const m = (n) => String(Math.floor((n % 3600) / 60)).padStart(2, '0');
      const sec = (n) => String(Math.floor(n % 60)).padStart(2, '0');
      const ms = (n) => String(Math.round((n - Math.floor(n)) * 1000)).padStart(3, '0');
      const fmt = (n) => `${h(n)}:${m(n)}:${sec(n)},${ms(n)}`;
      return `[${fmt(s.startSec)} -> ${fmt(s.endSec)}] ${s.text}`;
    })
    .join('\n');
}

export function segmentsToPlainText(segments) {
  return segments.map((s) => s.text).join('\n\n');
}
