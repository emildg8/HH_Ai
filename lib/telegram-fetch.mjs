/**
 * fetch к Telegram Bot API с опциональным SOCKS5 и секретом CF Worker.
 */

import http from 'node:http';
import https from 'node:https';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { telegramApiHeaders } from './telegram-api-base.mjs';

/** @type {import('socks-proxy-agent').SocksProxyAgent | undefined | null} */
let agent = null;

function resolveProxyUrl() {
  return String(
    process.env.TELEGRAM_PROXY ||
      process.env.ALL_PROXY ||
      process.env.HTTPS_PROXY ||
      process.env.HTTP_PROXY ||
      ''
  ).trim();
}

/** @returns {import('socks-proxy-agent').SocksProxyAgent | undefined} */
function getAgent() {
  if (agent !== null) return agent || undefined;
  const raw = resolveProxyUrl();
  if (!raw) {
    agent = undefined;
    return undefined;
  }
  const url = /^socks/i.test(raw) || /^https?:/i.test(raw) ? raw : `socks5://${raw}`;
  agent = new SocksProxyAgent(url);
  return agent;
}

/**
 * @param {string} urlStr
 * @param {RequestInit} [init]
 * @returns {Promise<Response>}
 */
export async function telegramFetch(urlStr, init = {}) {
  const socksAgent = getAgent();
  const headers = telegramApiHeaders(init.headers || {});

  if (!socksAgent) {
    return fetch(urlStr, { ...init, headers });
  }

  const url = new URL(urlStr);
  const method = init.method || 'GET';
  const body = init.body != null ? String(init.body) : undefined;

  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      url,
      { method, headers, agent: socksAgent },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          resolve(
            new Response(buf, {
              status: res.statusCode || 0,
              statusText: res.statusMessage || '',
              headers: res.headers,
            })
          );
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/** @deprecated use telegramAccessHint from telegram-api-base.mjs */
export function telegramProxyHint() {
  const url = resolveProxyUrl();
  if (!url) return '';
  const safe = url.replace(/\/\/([^:@/]+):([^@/]+)@/, '//$1:***@');
  return `proxy: ${safe}`;
}

/** Сброс кэша (setup меняет TELEGRAM_PROXY на лету). */
export function resetTelegramFetchCache() {
  agent = null;
}
