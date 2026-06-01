/**
 * Бесплатный прокси Bot API → api.telegram.org (Cloudflare Workers).
 * Локальный бот ходит сюда, Worker — в Telegram (обход блокировки на ПК).
 */

const TG_ORIGIN = 'https://api.telegram.org';

export default {
  /** @param {Request} request @param {{ PROXY_SECRET?: string }} env */
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response('hh-ai telegram proxy ok', { status: 200 });
    }

    if (env.PROXY_SECRET) {
      const got = request.headers.get('X-Tg-Proxy-Secret') || '';
      if (got !== env.PROXY_SECRET) {
        return new Response('Forbidden', { status: 403 });
      }
    }

    if (!url.pathname.startsWith('/bot')) {
      return new Response('Not Found', { status: 404 });
    }

    const target = `${TG_ORIGIN}${url.pathname}${url.search}`;
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('X-Tg-Proxy-Secret');

    return fetch(target, {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    });
  },
};
