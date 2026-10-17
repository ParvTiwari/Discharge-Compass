import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreLine, numbersIn, levelOf } from '../lib/confidence.js';
import { riskScore, levelForRisk } from '../lib/risk.js';
import { validateOcrRequest } from '../lib/ocr.js';
import { validateAnalysisRequest } from '../lib/validation.js';

test('numbers are compared across digit styles', () => {
  assert.deepEqual(numbersIn('Take 5 mg, 1,5 L'), ['5', '1.5']);
  assert.deepEqual(numbersIn('५ मिलीग्राम'), ['5']);
});

test('a faithful, high-rated line is High confidence', () => {
  const c = scoreLine({ text: 'Take warfarin 5 mg every day.', day: 1, sourceText: 'CONTINUE warfarin 5 mg PO daily', rating: 'high' });
  assert.equal(c.level, 'high'); assert.deepEqual(c.reasons, []);
});

test('a number that is not in the source forces Low confidence, even if the model is sure', () => {
  const c = scoreLine({ text: 'Take warfarin 7 mg every day.', day: 1, sourceText: 'CONTINUE warfarin 5 mg PO daily', rating: 'high' });
  assert.equal(c.level, 'low'); assert.match(c.reasons.join(), /number 7/);
});

test('day numbers and medium or low model ratings are handled', () => {
  assert.equal(scoreLine({ text: 'On day 3 rest.', day: 3, sourceText: 'Rest as needed this week', rating: 'high' }).level, 'high');
  assert.equal(scoreLine({ text: 'Rest.', day: 1, sourceText: 'Rest as needed', rating: 'medium' }).level, 'medium');
  assert.equal(scoreLine({ text: 'Rest.', day: 1, sourceText: 'Rest as needed', rating: 'low' }).level, 'low');
  assert.equal(levelOf(0.8), 'high'); assert.equal(levelOf(0.5), 'medium'); assert.equal(levelOf(0.49), 'low');
});

test('risk score adds up flags, new medicines and missed teach-back, and falls when a nurse approves', () => {
  const flags = [{ severity: 'high' }, { severity: 'high' }, { severity: 'moderate' }];
  const stats = { medCount: 6, newMeds: 3 };
  const open = [{ reason: 'safety', status: 'open' }, { reason: 'safety', status: 'open' }];
  const a = riskScore({ flags, stats, review: open });
  assert.equal(a.score, 10 + 30 + 6 + 9 + 8); assert.equal(a.level, 'High');
  const b = riskScore({ flags, stats, review: open.map(r => ({ ...r, status: 'approved' })) });
  assert.equal(b.score, 33); assert.equal(b.level, 'Low');
  const c = riskScore({ flags, stats, review: [...open, { reason: 'teach-back', status: 'open' }] });
  assert.equal(c.score, a.score + 8);
  assert.equal(levelForRisk(34), 'Low'); assert.equal(levelForRisk(35), 'Moderate'); assert.equal(levelForRisk(60), 'High');
});

test('risk is capped at 100 and has a floor of the base score', () => {
  assert.equal(riskScore({}).score, 10);
  const many = Array.from({ length: 20 }, () => ({ reason: 'teach-back', status: 'open' }));
  assert.ok(riskScore({ flags: Array(9).fill({ severity: 'moderate' }), stats: { medCount: 9, newMeds: 9 }, review: [...many, ...Array(5).fill({ reason: 'safety', status: 'open' })] }).score <= 100);
});

test('OCR request validation accepts small images and rejects everything else', () => {
  assert.equal(validateOcrRequest({ image: 'data:image/png;base64,iVBORw0KGgo=' }).mime, 'image/png');
  assert.throws(() => validateOcrRequest({ image: 'data:text/html;base64,PGI+' }), /PNG, JPEG or WebP/);
  assert.throws(() => validateOcrRequest({ image: 'hello' }), /data URL/);
  assert.throws(() => validateOcrRequest({ image: 'data:image/png;base64,' + 'A'.repeat(9 * 1024 * 1024) }), /too large/);
});

test('patient profile is validated and only returned when supplied', () => {
  assert.deepEqual(validateAnalysisRequest({ text: 'x', profile: { allergies: [' penicillin '], homeMeds: ['warfarin 5 mg'] } }).profile, { allergies: ['penicillin'], homeMeds: ['warfarin 5 mg'] });
  assert.equal('profile' in validateAnalysisRequest({ text: 'x' }), false);
  assert.throws(() => validateAnalysisRequest({ text: 'x', profile: { allergies: 'penicillin' } }), /short list/);
});
