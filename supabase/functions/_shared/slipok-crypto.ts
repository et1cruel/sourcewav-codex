const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const configured = Deno.env.get('SLIPOK_CREDENTIAL_ENCRYPTION_KEY') || '';
  if (!/^[0-9a-f]{64}$/i.test(configured)) {
    throw new Error('SLIPOK_CREDENTIAL_ENCRYPTION_KEY must be a 32-byte hex key');
  }
  const raw = Uint8Array.from(configured.match(/.{2}/g) || [], byte => Number.parseInt(byte, 16));
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptSlipOkApiKey(value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await getEncryptionKey(), encoder.encode(value));
  return JSON.stringify({ version: 1, iv: base64(iv), ciphertext: base64(new Uint8Array(encrypted)) });
}

export async function decryptSlipOkApiKey(value: string): Promise<string> {
  const record = JSON.parse(value);
  if (record?.version !== 1 || typeof record.iv !== 'string' || typeof record.ciphertext !== 'string') {
    throw new Error('Stored SlipOK API credential is invalid');
  }
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(record.iv) },
    await getEncryptionKey(),
    fromBase64(record.ciphertext),
  );
  return decoder.decode(plaintext);
}
