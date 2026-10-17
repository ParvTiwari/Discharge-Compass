// Confidence for each plan line = model self-rating, capped by deterministic checks that work in any language.
const DEVA = '०१२३४५६७८९';
export const normDigits = s => s.replace(/[०-९]/g, d => DEVA.indexOf(d)).replace(/(\d),(\d)/g, '$1.$2');
export const numbersIn = s => normDigits(s || '').match(/\d+(?:\.\d+)?/g) || [];
const BASE = { high: 0.92, medium: 0.65, low: 0.35 };
export const levelOf = score => (score >= 0.8 ? 'high' : score >= 0.5 ? 'medium' : 'low');

export function scoreLine({ text, day, sourceText, rating }) {
  const reasons = [];
  let score = BASE[rating] ?? 0.65;
  if (rating === 'low') reasons.push('the model was unsure');
  if (rating === 'medium' || !BASE[rating]) reasons.push('the model was only moderately sure');
  const known = new Set(numbersIn(sourceText));
  const bad = [...new Set(numbersIn(text).filter(n => !known.has(n) && Number(n) !== Number(day)))];
  if (bad.length) { score = Math.min(score, 0.3); reasons.push(`the number ${bad.join(', ')} does not appear in the source`); }
  if ((sourceText || '').trim().length < 6) { score -= 0.15; reasons.push('the source sentence is very short'); }
  score = Math.max(0, Math.round(score * 100) / 100);
  const level = levelOf(score);
  return { level, score, reasons: level === 'high' ? [] : reasons };
}
