#!/usr/bin/env node
import { parseDiceHtml } from '../lib/jobboards/parsers/dice.mjs';

const html =
  '<a href="https://www.dice.com/job-detail/abc-123-def">DevOps</a>' +
  '<a href="https://www.dice.com/job-detail/abc-123-def">dup</a>';
const items = parseDiceHtml(html);
if (items.length !== 1) {
  console.error('expected 1 item, got', items.length);
  process.exit(1);
}
console.log('probe-dice-search: OK', items[0].externalKey);
