import { analyze } from '../../../lib/pipeline';
import samples from '../../../data/samples.json';
import { validateAnalysisRequest } from '../../../lib/validation';
export const maxDuration = 60;
export async function POST(req) {
  try {
    const { sampleId, text, lang, profile } = validateAnalysisRequest(await req.json());
    const sample = samples.find(s => s.id === sampleId) || { id: 'custom', allergies: profile?.allergies || [], homeMeds: profile?.homeMeds || [] };
    return Response.json(await analyze({ sample, text: text || sample.summary, lang }));
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error('ANALYZE ERROR:', e);
    return Response.json({ error: status === 400 ? e.message : 'Analysis failed: ' + e.message }, { status });
  }
}
