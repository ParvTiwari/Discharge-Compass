import { validateOcrRequest, visionConfigured, visionOcr } from '../../../lib/ocr.js';
export const maxDuration = 60;
// GET tells the browser whether server-side Google Vision (better for handwriting) is configured.
export async function GET() { return Response.json({ vision: visionConfigured() }); }
export async function POST(req) {
  try {
    if (!visionConfigured()) return Response.json({ error: 'not_configured' }, { status: 501 });
    const { b64 } = validateOcrRequest(await req.json());
    const out = await visionOcr(b64);
    if (!out.text) return Response.json({ error: 'No text found in the photo. Try a clearer, well-lit picture.' }, { status: 422 });
    return Response.json(out);
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error('OCR ERROR:', e);
    return Response.json({ error: status === 500 ? 'OCR failed: ' + e.message : e.message }, { status });
  }
}
