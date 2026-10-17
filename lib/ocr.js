export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;
function invalid(message, status = 400) { const e = new Error(message); e.status = status; return e; }

export function validateOcrRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid('Request body must be a JSON object.');
  const m = typeof body.image === 'string' ? DATA_URL.exec(body.image) : null;
  if (!m) throw invalid('image must be a PNG, JPEG or WebP data URL.');
  const bytes = Math.floor(m[2].length * 0.75);
  if (bytes > MAX_IMAGE_BYTES) throw invalid('Image is too large. Please use a photo under 6 MB.', 413);
  return { mime: m[1], b64: m[2] };
}

export const visionConfigured = () => Boolean(process.env.GOOGLE_VISION_API_KEY);

export async function visionOcr(b64) {
  const base = process.env.GOOGLE_VISION_BASE_URL || 'https://vision.googleapis.com';
  const r = await fetch(`${base}/v1/images:annotate?key=${encodeURIComponent(process.env.GOOGLE_VISION_API_KEY)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({ requests: [{ image: { content: b64 }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }], imageContext: { languageHints: ['en', 'hi'] } }] })
  });
  if (!r.ok) throw new Error('Google Vision error ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  const resp = j.responses?.[0];
  if (resp?.error) throw new Error('Google Vision: ' + resp.error.message);
  const text = resp?.fullTextAnnotation?.text || '';
  const confs = (resp?.fullTextAnnotation?.pages || []).flatMap(p => (p.blocks || []).map(b => b.confidence)).filter(c => typeof c === 'number');
  const confidence = confs.length ? Math.round(100 * confs.reduce((a, c) => a + c, 0) / confs.length) : null;
  return { engine: 'google-vision', text: text.trim(), confidence };
}
