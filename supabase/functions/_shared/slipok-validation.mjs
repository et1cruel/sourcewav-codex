const mimeExtensions = new Map([
  ['image/jpeg', 'jpg'],
  ['image/jfif', 'jfif'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

export function detectSlipImage(bytes, contentType) {
  const mime = String(contentType || '').toLowerCase().split(';')[0].trim();
  const extension = mimeExtensions.get(mime);
  if (!extension || !(bytes instanceof Uint8Array)) return null;
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  const isWebp = bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  const matches = mime === 'image/jpeg' || mime === 'image/jfif' ? isJpeg
    : mime === 'image/png' ? isPng : isWebp;
  return matches ? { mime: mime === 'image/jfif' ? 'image/jpeg' : mime, extension } : null;
}

function receiverValues(receiver) {
  if (!receiver || typeof receiver !== 'object') return [];
  return ['account', 'proxy'].flatMap((kind) => {
    const value = receiver[kind]?.value;
    return typeof value === 'string' && value.trim() ? [{ kind, value: value.trim() }] : [];
  });
}

export function evaluateSlipOk({ responseOk, responseStatus, result, expectedAmountMinor, expectedAccountLast4 = '' }) {
  const data = result?.data && typeof result.data === 'object' ? result.data : {};
  const values = receiverValues(data.receiver);
  const observedMinor = Number.isFinite(Number(data.amount)) ? Math.round(Number(data.amount) * 100) : null;
  const transRef = typeof data.transRef === 'string' && data.transRef.length > 0 && data.transRef.length <= 100 ? data.transRef : null;
  const accountValue = values.find(({ kind }) => kind === 'account')?.value;
  const accountDigits = accountValue?.replace(/\D/g, '') || '';
  const last4Matches = !expectedAccountLast4 || !accountDigits || accountDigits.slice(-4) === expectedAccountLast4;
  const receiverVerified = result?.success === true && data.success === true && values.length > 0 && last4Matches;
  const verified = responseOk === true && result?.success === true && data.success === true
    && observedMinor === Number(expectedAmountMinor) && data.countryCode === 'TH'
    && receiverVerified && transRef !== null;
  const code = Number.isInteger(Number(result?.code)) ? Number(result.code) : null;
  const failureReason = verified ? ''
    : observedMinor !== null && observedMinor !== Number(expectedAmountMinor) ? 'amount_mismatch'
      : values.length === 0 ? 'receiver_not_verified'
        : !last4Matches ? 'receiver_mismatch'
          : data.countryCode !== 'TH' ? 'unsupported_country'
            : !transRef ? 'transaction_reference_missing' : 'slip_rejected';
  return {
    verified, observedMinor, transRef, receiverVerified, code, failureReason,
    safeResult: {
      success: result?.success === true,
      slipSuccess: data.success === true,
      transRef,
      amount: observedMinor,
      countryCode: typeof data.countryCode === 'string' ? data.countryCode.slice(0, 2) : null,
    },
  };
}

export function attemptStatusForHttp(status) {
  return status === 429 ? 'quota_exhausted' : 'error';
}
