import { analyze } from '../../../lib/pipeline';
import samples from '../../../data/samples.json';
export const maxDuration = 60;
export async function POST(req) {
  try {
    const { sampleId, text, lang } = await req.json();
    const sample = samples.find(s => s.id === sampleId) || { id: 'custom', allergies: [], homeMeds: [] };
    return Response.json(await analyze({ sample, text: text || sample.summary, lang: lang || 'English' }));
  } catch (e) { console.error('ANALYZE ERROR:', e); return Response.json({ error: 'Analysis failed: ' + e.message }, { status: 500 }); }
}
