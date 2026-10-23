import { authenticatedUser, corsHeaders, json } from '../_shared/http.ts';

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const AUDIO_EXTENSIONS: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/flac': 'flac',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/webm': 'webm',
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const KINDS: Record<string, { extensions: Record<string, string>; maxBytes: number; label: string }> = {
  image: { extensions: IMAGE_EXTENSIONS, maxBytes: MAX_IMAGE_BYTES, label: 'รูป JPG, PNG หรือ WebP ขนาดไม่เกิน 10 MB' },
  audio: { extensions: AUDIO_EXTENSIONS, maxBytes: MAX_AUDIO_BYTES, label: 'ไฟล์เสียงที่รองรับ ขนาดไม่เกิน 50 MB' },
};

const enc = new TextEncoder();

async function hmac(keyBytes: Uint8Array, value: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(value)));
}

async function sha256Hex(value: string): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function rfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, character => '%' + character.charCodeAt(0).toString(16).toUpperCase());
}

function encodeKey(key: string): string {
  return key.split('/').map(segment => rfc3986(segment)).join('/');
}

// AWS S3 (สำรอง): virtual-host style — https://<bucket>.s3.<region>.amazonaws.com/<key>
// Cloudflare R2 (หลัก): path style — https://<account>.r2.cloudflarestorage.com/<bucket>/<key>, region "auto"
type Target = { host: string; region: string; objectPathPrefix: string; accessKey: string; secretKey: string };

function targets(): { primary: Target; backup: Target } {
  const s3Bucket = Deno.env.get('S3_BUCKET') || '';
  const s3Region = Deno.env.get('S3_REGION') || '';
  const s3AccessKey = Deno.env.get('AWS_ACCESS_KEY_ID') || '';
  const s3SecretKey = Deno.env.get('AWS_SECRET_ACCESS_KEY') || '';
  const r2AccountId = Deno.env.get('R2_ACCOUNT_ID') || '';
  const r2Bucket = Deno.env.get('R2_BUCKET') || '';
  const r2AccessKey = Deno.env.get('R2_ACCESS_KEY_ID') || '';
  const r2SecretKey = Deno.env.get('R2_SECRET_ACCESS_KEY') || '';
  if (!s3Bucket || !s3Region || !s3AccessKey || !s3SecretKey || !r2AccountId || !r2Bucket || !r2AccessKey || !r2SecretKey) {
    throw new Error('ระบบอัปโหลดไฟล์ยังไม่พร้อมใช้งาน');
  }
  return {
    primary: {
      host: `${r2AccountId}.r2.cloudflarestorage.com`,
      region: 'auto',
      objectPathPrefix: `${r2Bucket}/`,
      accessKey: r2AccessKey,
      secretKey: r2SecretKey,
    },
    backup: {
      host: `${s3Bucket}.s3.${s3Region}.amazonaws.com`,
      region: s3Region,
      objectPathPrefix: '',
      accessKey: s3AccessKey,
      secretKey: s3SecretKey,
    },
  };
}

async function presign(target: Target, options: { method: string; key: string; expires: number; contentType?: string; contentLength?: number }): Promise<string> {
  const objectPath = `${target.objectPathPrefix}${options.key}`;
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const signed: Record<string, string> = { host: target.host };
  if (options.contentType) signed['content-type'] = options.contentType;
  if (options.contentLength !== undefined) signed['content-length'] = String(options.contentLength);
  const signedNames = Object.keys(signed).sort();
  const signedHeaders = signedNames.join(';');
  const canonicalHeaders = signedNames.map(name => `${name}:${signed[name].trim()}\n`).join('');

  const query: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${target.accessKey}/${dateStamp}/${target.region}/s3/aws4_request`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(options.expires),
    'X-Amz-SignedHeaders': signedHeaders,
  };
  const canonicalQuery = Object.keys(query).sort().map(name => `${rfc3986(name)}=${rfc3986(query[name])}`).join('&');

  const canonicalRequest = [
    options.method,
    `/${encodeKey(objectPath)}`,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const scope = `${dateStamp}/${target.region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256Hex(canonicalRequest)].join('\n');

  let signingKey = await hmac(enc.encode(`AWS4${target.secretKey}`), dateStamp);
  signingKey = await hmac(signingKey, target.region);
  signingKey = await hmac(signingKey, 's3');
  signingKey = await hmac(signingKey, 'aws4_request');
  const signature = [...(await hmac(signingKey, stringToSign))].map(byte => byte.toString(16).padStart(2, '0')).join('');

  return `https://${target.host}/${encodeKey(objectPath)}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

function assertOwnedKey(key: string, userId: string) {
  if (!key || key.length > 400 || key.includes('..') || !key.startsWith(`${userId}/`) || !/^[A-Za-z0-9!_.*'()/-]+$/.test(key)) {
    throw new Error('path ไฟล์ไม่ถูกต้อง');
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const user = await authenticatedUser(request);
    const body = await request.json();
    const action = String(body.action || '');
    const publicBase = Deno.env.get('MEDIA_PUBLIC_URL') || '';

    if (action === 'put') {
      const kind = KINDS[String(body.kind || '')];
      if (!kind) throw new Error('ประเภทไฟล์ไม่ถูกต้อง');
      const contentType = String(body.contentType || '');
      const extension = kind.extensions[contentType];
      if (!extension) throw new Error(`เลือก${kind.label}`);
      const size = Number(body.size);
      if (!Number.isInteger(size) || size < 1 || size > kind.maxBytes) throw new Error(`เลือก${kind.label}`);
      const key = String(body.key || '');
      assertOwnedKey(key, user.id);
      if (!key.toLowerCase().endsWith(`.${extension}`)) throw new Error('ชนิดไฟล์ไม่ตรงกับนามสกุลไฟล์');
      const { primary, backup } = targets();
      const [r2Url, s3Url] = [
        await presign(primary, { method: 'PUT', key, expires: 900, contentType, contentLength: size }),
        await presign(backup, { method: 'PUT', key, expires: 900, contentType, contentLength: size }),
      ];
      return json({ key, uploads: { r2: r2Url, s3: s3Url }, publicUrl: publicBase ? `${publicBase}/${key}` : '' });
    }

    if (action === 'delete') {
      const keys = Array.isArray(body.keys) ? body.keys : [];
      if (!keys.length || keys.length > 20) throw new Error('ไม่มีไฟล์ให้ลบ');
      const ownedKeys = keys.map(key => String(key));
      for (const key of ownedKeys) assertOwnedKey(key, user.id);
      const { primary, backup } = targets();
      const results = await Promise.allSettled(ownedKeys.map(async (key) => {
        const urls = [
          await presign(primary, { method: 'DELETE', key, expires: 600 }),
          await presign(backup, { method: 'DELETE', key, expires: 600 }),
        ];
        const responses = await Promise.all(urls.map(url => fetch(url, { method: 'DELETE' })));
        // 404 = ไม่มีไฟล์อยู่แล้ว ถือว่าลบสำเร็จ
        const failed = responses.filter(response => !response.ok && response.status !== 404);
        if (failed.length) throw new Error(`ลบไฟล์ ${key} ไม่สำเร็จ`);
      }));
      const failed = results.filter(result => result.status === 'rejected').length;
      return json({ deleted: ownedKeys.length - failed, failed });
    }

    throw new Error('คำสั่งไม่ถูกต้อง');
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด' }, 400);
  }
});
