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
  const attach = String(body?.attach || 'avatar').trim() || 'avatar';
  const bytes = Uint8Array.from(atob(image), (c) => c.charCodeAt(0));

  const attempts = [
    () => buildProfilePhotoFormAttach(attach, bytes, filename, mime),
    () => buildProfilePhotoFormDirect(bytes, filename, mime),
  ];
  let last;
  for (const build of attempts) {
    const payload = build();
    const res = await fetch(`${TG_ORIGIN}/bot${token}/setMyProfilePhoto`, {
      method: 'POST',
      headers: { 'Content-Type': payload.contentType },
      body: payload.body,
    });
    last = res;
    if (res.ok) return res;
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return new Response(text, { status: res.status });
    }
    if (data.description !== "Bad Request: photo isn't specified") {
      return new Response(text, { status: res.status, headers: { 'Content-Type': 'application/json' } });
    }
  }
  return last || new Response('Bad Request', { status: 400 });
}

/** @param {string} attach @param {Uint8Array} bytes @param {string} filename @param {string} mime */
function buildProfilePhotoFormAttach(attach, bytes, filename, mime) {
  return buildMultipart([
    {
      name: 'photo',
      contentType: 'application/json',
      body: textEncoder.encode(JSON.stringify({ type: 'static', photo: `attach://${attach}` })),
    },
    {
      name: attach,
      filename,
      contentType: mime,
      body: bytes,
    },
  ]);
}

/** @param {Uint8Array} bytes @param {string} filename @param {string} mime */
function buildProfilePhotoFormDirect(bytes, filename, mime) {
  return buildMultipart([
    {
      name: 'photo',
      filename,
      contentType: mime,
      body: bytes,
    },
  ]);
}

const textEncoder = new TextEncoder();

/**
 * @param {{ name: string, body: Uint8Array, filename?: string, contentType?: string }[]} parts
 */
function buildMultipart(parts) {
  const boundary = `hhAi${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  const chunks = [];
  for (const part of parts) {
    chunks.push(textEncoder.encode(`--${boundary}\r\n`));
    const disp = part.filename
      ? `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n`
      : `Content-Disposition: form-data; name="${part.name}"\r\n`;
    chunks.push(textEncoder.encode(disp));
    if (part.contentType) {
      chunks.push(textEncoder.encode(`Content-Type: ${part.contentType}\r\n`));
    }
    chunks.push(textEncoder.encode('\r\n'));
    chunks.push(part.body);
    chunks.push(textEncoder.encode('\r\n'));
  }
  chunks.push(textEncoder.encode(`--${boundary}--\r\n`));
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
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
