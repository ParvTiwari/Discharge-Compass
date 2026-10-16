import test from 'node:test';
import assert from 'node:assert/strict';
import { find } from '../lib/pipeline.js';
import { safety } from '../lib/safety.js';
import { validateAnalysisRequest, validateGradeRequest } from '../lib/validation.js';

test('find locates a source quote despite whitespace differences', () => {
  assert.deepEqual(find('CONTINUE warfarin 5 mg PO daily.', 'warfarin  5 mg'), { start: 9, end: 22 });
  assert.equal(find('No matching text.', 'warfarin'), null);
});

test('safety detects planted interaction, allergy, and duplicate risks', () => {
  const patient = { allergies: ['penicillin'], homeMeds: ['warfarin 5 mg daily', 'albuterol inhaler'] };
  const meds = [{ id: 'S1', name: 'ibuprofen', status: 'new' }, { id: 'S2', name: 'amoxicillin', status: 'new' }, { id: 'S3', name: 'levalbuterol', status: 'new' }];
  const flags = safety(patient, meds);
  assert.ok(flags.some(flag => flag.kind === 'interaction' && flag.drugs.includes('warfarin') && flag.drugs.includes('ibuprofen')));
  assert.ok(flags.some(flag => flag.kind === 'allergy' && flag.drugs.includes('amoxicillin')));
  assert.ok(flags.some(flag => flag.kind === 'duplicate' && flag.drugs.includes('albuterol') && flag.drugs.includes('levalbuterol')));
});

test('analysis request validation accepts supported input and rejects unsafe input', () => {
  assert.deepEqual(validateAnalysisRequest({ sampleId: 'A', text: '  Summary text  ', lang: 'Hindi' }), { sampleId: 'A', text: 'Summary text', lang: 'Hindi' });
  assert.throws(() => validateAnalysisRequest({ text: 'x', lang: 'French' }), /Language must/);
  assert.throws(() => validateAnalysisRequest({ text: '   ' }), /cannot be empty/);
});

test('teach-back validation bounds untrusted request fields', () => {
  assert.deepEqual(validateGradeRequest({ question: 'What next?', expected: 'Call clinic', answer: 'Call clinic' }), { question: 'What next?', expected: 'Call clinic', answer: 'Call clinic' });
  assert.throws(() => validateGradeRequest({ question: 'x', expected: 'y', answer: 7 }), /must be text/);
});
