/**
 * Бесплатный прокси Bot API → api.telegram.org (Cloudflare Workers).
 * Локальный бот ходит сюда, Worker — в Telegram (обход блокировки на ПК).
 */

const TG_ORIGIN = 'https://api.telegram.org';

/**
 * @param {Request} request
 */
async function handleProfilePhotoUpload(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }
  const token = String(body?.token || '').trim();
  const image = String(body?.image || '').trim();
  if (!token || !image) {
    return new Response('Bad Request', { status: 400 });
  }
  const filename = String(body?.filename || 'avatar.jpg').trim() || 'avatar.jpg';
  const mime = String(body?.mime || 'image/jpeg').trim() || 'image/jpeg';
  const bytes = Uint8Array.from(atob(image), (c) => c.charCodeAt(0));
  const form = new FormData();
  form.append(
    'photo',
    new Blob([JSON.stringify({ type: 'static', photo: 'attach://avatar' })], {
      type: 'application/json',
    })
  );
  form.append('avatar', new Blob([bytes], { type: mime }), filename);
  return fetch(`${TG_ORIGIN}/bot${token}/setMyProfilePhoto`, { method: 'POST', body: form });
}

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

    if (url.pathname === '/upload/bot-profile-photo' && request.method === 'POST') {
      return handleProfilePhotoUpload(request);
    }

    if (!url.pathname.startsWith('/bot')) {
      return new Response('Not Found', { status: 404 });
    }

    const target = `${TG_ORIGIN}${url.pathname}${url.search}`;

    // Multipart (setMyProfilePhoto, sendPhoto): пересобираем FormData — иначе boundary ломается при прокси.
    const ct = request.headers.get('content-type') || '';
    if (request.method === 'POST' && ct.includes('multipart/form-data')) {
      const form = await request.formData();
      const out = new FormData();
      for (const [key, value] of form.entries()) {
        out.append(key, value);
      }
      return fetch(target, { method: 'POST', body: out });
    }

    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('X-Tg-Proxy-Secret');
    headers.delete('content-length');

    const init = { method: request.method, headers };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = request.body;
    }
    return fetch(target, init);
  },
};
