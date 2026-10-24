const mediaKey = request => {
  const raw = new URL(request.url).pathname.slice('/media/'.length);
  try {
    const key = decodeURIComponent(raw);
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(?:[A-Za-z0-9!_.*'()-]+\/)*[A-Za-z0-9!_.*'()-]+$/i.test(key) && !key.includes('..') ? key : null;
  } catch { return null; }
};

const mediaHeaders = object => {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, ETag');
  headers.set('Cache-Control', 'public, max-age=86400, immutable');
  return headers;
};

export async function onRequestGet({ request, env }) {
  const key = mediaKey(request);
  if (!key) return new Response('Not found', { status: 404 });
  const requestedRange = request.headers.get('Range');
  if (requestedRange && !/^bytes=(?:\d+-\d*|-\d+)$/.test(requestedRange)) {
    return new Response('Invalid range', { status: 416 });
  }
  const object = await env.MEDIA.get(key, { range: request.headers });
  if (!object) return new Response('Not found', { status: 404 });
  if (!('body' in object)) return new Response(null, { status: 412 });
  const headers = mediaHeaders(object);
  const range = object.range;
  if (requestedRange && (!range || range.offset === undefined || range.length === undefined)) {
    await object.body.cancel();
    return new Response('Range not satisfiable', { status: 416, headers: { 'Content-Range': `bytes */${object.size}` } });
  }
  if (requestedRange) {
    headers.set('Content-Range', `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`);
    headers.set('Content-Length', String(range.length));
  } else {
    headers.set('Content-Length', String(object.size));
  }
  return new Response(object.body, { status: requestedRange ? 206 : 200, headers });
}

export async function onRequestHead({ request, env }) {
  const key = mediaKey(request);
  if (!key) return new Response(null, { status: 404 });
  const object = await env.MEDIA.head(key);
  if (!object) return new Response(null, { status: 404 });
  const headers = mediaHeaders(object);
  headers.set('Content-Length', String(object.size));
  return new Response(null, { status: 200, headers });
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range',
    'Access-Control-Max-Age': '86400'
  } });
}
