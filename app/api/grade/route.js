import { ask } from '../../../lib/pipeline';
export async function POST(req) {
  try {
    const b = await req.json();
    return Response.json(await ask('Grade a patient teach-back answer against the expected answer. Return ONLY JSON {"understood":boolean,"feedback":string}. Be kind and brief, in the same language as the question.', JSON.stringify(b)));
  } catch { return Response.json({ understood: false, feedback: 'Could not grade right now.' }); }
}
