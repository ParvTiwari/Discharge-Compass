import fs from 'fs';
import path from 'path';
import { safety } from './safety.js';
const MODEL = process.env.MODEL || 'openai/gpt-oss-120b';
export async function ask(system, user) {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is missing. Put it in .env.local (project root) and restart npm run dev.');
  const r = await fetch((process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1') + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.GROQ_API_KEY },
    signal: AbortSignal.timeout(45_000),
    body: JSON.stringify({ model: MODEL, temperature: 0.2, reasoning_effort: 'low', max_tokens: 4000, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
  });
  if (!r.ok) throw new Error('Groq API error ' + r.status + ': ' + (await r.text()).slice(0, 300));
  const j = await r.json();
  const c = j.choices?.[0]?.message?.content;
  if (!c) throw new Error('Model returned empty output (try again, or set MODEL=openai/gpt-oss-20b)');
  return JSON.parse(c.replace(/```json|```/g, '').trim());
}
const esc = w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function find(text, q) {
  const m = new RegExp(q.trim().split(/\s+/).map(esc).join('\\s+'), 'i').exec(text);
  return m ? { start: m.index, end: m.index + m[0].length } : null;
}
function ground(text, ex) {
  const spans = {}, review = [], out = {}; let n = 0;
  for (const k of ['meds', 'appointments', 'restrictions', 'redFlags']) {
    out[k] = [];
    for (const it of ex[k] || []) {
      const f = it.quote && find(text, it.quote);
      if (!f) { review.push({ id: 'R' + review.length, reason: 'ungrounded', detail: 'Dropped, not found in source: ' + JSON.stringify(it).slice(0, 110), status: 'open' }); continue; }
      const id = 'S' + (++n); spans[id] = f; out[k].push({ ...it, id });
    }
  }
  return { out, spans, review };
}
const EXTRACT = `Extract data from a hospital discharge summary. Return ONLY JSON: {"diagnosis":string,"meds":[{"name","dose","frequency","status":"new|changed|continued|stopped","quote"}],"appointments":[{"what","when","quote"}],"restrictions":[{"text","quote"}],"redFlags":[{"symptom","action":"call_clinic|call_911","quote"}]}. Every "quote" must be copied VERBATIM from the document (short, exact). Never infer anything that is not written.`;
const PLAN = lang => `You write patient recovery plans using ONLY the verified items provided. Return ONLY JSON: {"plan":[{"day":1-7,"type":"med|appointment|diet|activity|monitor","text":string,"sourceIds":[ids]}],"guide":[{"level":"amber|red","text":string,"sourceIds":[ids]}],"quiz":[{"q":string,"a":string,"sourceIds":[ids]}]}. Write in ${lang}, 6th-grade reading level, short sentences. Every entry MUST cite sourceIds from the items. Do NOT add medical advice that is not in the items. If a medicine appears in a safety flag, add a short note to ask the nurse before taking it. Quiz: exactly 3 questions with short correct answers.`;
async function enrich(flags) {
  const get = u => fetch(u, { signal: AbortSignal.timeout(4000) }).then(r => r.json());
  const memo = {};
  const info = d => (memo[d] ??= (async () => {
    let rx, txt = '';
    try { const a = await get(`https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(d)}&search=2`); rx = a.idGroup?.rxnormId?.[0]; } catch {}
    try { const b = await get(`https://api.fda.gov/drug/label.json?search=openfda.generic_name:%22${encodeURIComponent(d)}%22&limit=1`); txt = (b.results?.[0]?.drug_interactions || []).join(' '); } catch {}
    return { rx, txt };
  })());
  await Promise.all(flags.map(async f => {
    const rxcui = {}; let fda = '';
    for (const d of f.drugs) {
      const i = await info(d); if (i.rx) rxcui[d] = i.rx;
      if (!fda && f.kind === 'interaction') { const o = f.drugs.find(x => x !== d); const k = i.txt.toLowerCase().indexOf(o); if (k >= 0) fda = i.txt.slice(Math.max(0, k - 100), k + 220).replace(/\s+/g, ' '); }
    }
    if (Object.keys(rxcui).length) f.rxcui = rxcui;
    if (fda) f.fda = fda;
  }));
}
export async function analyze({ sample, text, lang }) {
  const dir = path.join(process.cwd(), 'data', 'cache'), file = path.join(dir, `${sample.id}-${lang}.json`);
  // Cache only bundled synthetic samples. Never persist a visitor's uploaded discharge text.
  const cacheable = sample.id !== 'custom';
  const cached = () => {
    if (!cacheable) return null;
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
  };
  if (process.env.DEMO_MODE === 'true' && cached()) return cached();
  try {
    const ex = await ask(EXTRACT, text);
    const { out, spans, review } = ground(text, ex);
    const flags = safety(sample, out.meds);
    try { await enrich(flags); } catch {}
    flags.filter(f => f.severity === 'high').forEach(f => review.push({ id: 'R' + review.length, reason: 'safety', detail: `${f.kind}: ${f.drugs.join(' + ')}. ${f.explanation}`, status: 'open' }));
    const p = await ask(PLAN(lang), JSON.stringify({ diagnosis: ex.diagnosis, items: out, safetyFlags: flags.map(f => ({ drugs: f.drugs, explanation: f.explanation })) }));
    const ok = a => a.sourceIds?.length && a.sourceIds.every(s => spans[s]);
    const keep = arr => (arr || []).filter(a => { if (ok(a)) return true; review.push({ id: 'R' + review.length, reason: 'ungrounded', detail: 'Plan line dropped (no valid source): ' + (a.text || a.q), status: 'open' }); return false; });
    const result = { diagnosis: ex.diagnosis, appointments: out.appointments, plan: keep(p.plan), guide: keep(p.guide), quiz: keep(p.quiz), flags, spans, review };
    if (cacheable) try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(result)); } catch {}
    return result;
  } catch (e) {
    const c = cached(); if (c) return c; throw e;
  }
}
