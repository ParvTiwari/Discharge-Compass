// Usage: with `npm run dev` running in another terminal: node scripts/eval.mjs
const base = process.env.BASE || 'http://localhost:3000';
const expected = {
  A: [['interaction', 'warfarin', 'ibuprofen'], ['allergy', 'amoxicillin']],
  B: [['interaction', 'lisinopril', 'spironolactone'], ['interaction', 'potassium', 'spironolactone'], ['duplicate', 'albuterol', 'levalbuterol']]
};
let hit = 0, tot = 0, kept = 0, dropped = 0;
for (const id of ['A', 'B']) {
  const t = Date.now();
  const r = await fetch(base + '/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sampleId: id, lang: 'English' }) });
  const d = await r.json(); const ms = Date.now() - t;
  if (d.error) { console.log(id, 'ERROR', d.error); continue; }
  const k = Object.keys(d.spans).length, x = d.review.filter(v => v.detail.startsWith('Dropped')).length;
  kept += k; dropped += x;
  for (const [kind, ...drugs] of expected[id]) { tot++; if (d.flags.some(f => f.kind === kind && drugs.every(z => f.drugs.includes(z)))) hit++; else console.log(`  MISSED ${id}: ${kind} ${drugs}`); }
  console.log(`Patient ${id}: ${ms} ms | verified items ${k} | dropped ${x} | flags ${d.flags.length} | review ${d.review.length}`);
  if (d.confidence) console.log(`  confidence: ${d.confidence.high} high, ${d.confidence.medium} medium, ${d.confidence.low} low | risk ${d.risk.score}/100 (${d.risk.level})`);
}
console.log(`\nGrounding rate: ${kept + dropped ? Math.round(100 * kept / (kept + dropped)) : 0}% (${kept}/${kept + dropped} extracted items verified in source)`);
console.log(`Conflict recall: ${hit}/${tot} planted conflicts detected`);
