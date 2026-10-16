const LANGUAGES = new Set(['English', 'Spanish', 'Hindi']);
const MAX_SUMMARY_LENGTH = 50_000;
const MAX_ANSWER_LENGTH = 2_000;

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

export function validateAnalysisRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid('Request body must be a JSON object.');
  const { sampleId, text, lang } = body;
  if (sampleId !== undefined && (typeof sampleId !== 'string' || sampleId.length > 80)) throw invalid('sampleId is invalid.');
  if (text !== undefined && typeof text !== 'string') throw invalid('Discharge summary must be plain text.');
  if (typeof text === 'string' && text.length > MAX_SUMMARY_LENGTH) throw invalid(`Discharge summary must be ${MAX_SUMMARY_LENGTH.toLocaleString()} characters or fewer.`);
  if (lang !== undefined && !LANGUAGES.has(lang)) throw invalid('Language must be English, Spanish, or Hindi.');
  if (typeof text === 'string' && !text.trim()) throw invalid('Discharge summary cannot be empty.');
  return { sampleId: sampleId || '', text: text?.trim(), lang: lang || 'English' };
}

export function validateGradeRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid('Request body must be a JSON object.');
  const { question, expected, answer } = body;
  if (![question, expected, answer].every(value => typeof value === 'string')) throw invalid('question, expected, and answer must be text.');
  if (!question.trim() || !expected.trim()) throw invalid('question and expected answer cannot be empty.');
  if ([question, expected, answer].some(value => value.length > MAX_ANSWER_LENGTH)) throw invalid(`Teach-back fields must be ${MAX_ANSWER_LENGTH.toLocaleString()} characters or fewer.`);
  return { question: question.trim(), expected: expected.trim(), answer: answer.trim() };
}
