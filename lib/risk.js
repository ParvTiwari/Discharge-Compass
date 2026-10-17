// Transparent, additive readmission-risk heuristic for the prototype.
// NOT a validated clinical score (such as LACE or HOSPITAL). It exists to show how flags, new medicines and missed teach-back answers add up.
export const RISK_NOTE = 'Prototype heuristic, not a validated clinical score.';
export const levelForRisk = s => (s < 35 ? 'Low' : s < 60 ? 'Moderate' : 'High');

export function riskScore({ flags = [], stats = {}, review = [] }) {
  const open = reason => review.filter(r => r.reason === reason && r.status === 'open').length;
  const factors = [];
  const add = (label, count, per, cap) => { if (count > 0) factors.push({ label, count, points: Math.min(cap, count * per) }); };
  add('Serious medicine problems waiting for a nurse', open('safety'), 15, 30);
  add('Medicine cautions to monitor', flags.filter(f => f.severity === 'moderate').length, 6, 12);
  add('New or changed medicines', stats.newMeds || 0, 3, 15);
  if ((stats.medCount || 0) >= 5) factors.push({ label: 'Five or more medicines at once', count: stats.medCount, points: 8 });
  add('Plan lines the system was unsure about', open('low-confidence'), 4, 12);
  add('Teach-back answers missed', open('teach-back'), 8, 24);
  add('Unverified lines held back', open('ungrounded'), 2, 6);
  const base = 10;
  const score = Math.min(100, base + factors.reduce((a, f) => a + f.points, 0));
  return { score, level: levelForRisk(score), base, factors };
}
