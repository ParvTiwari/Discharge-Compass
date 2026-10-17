# Discharge Compass (MVP)
Verified, plain-language, multilingual discharge plans. Synthetic data only. Not medical advice.

## Run
1. `npm install`
2. Copy `.env.example` to `.env.local` and add your `GROQ_API_KEY`
3. `npm run dev` then open http://localhost:3000
4. Deploy: push to GitHub, import into Vercel, add the same env vars.

## Verify before deployment

Run these commands from the project root:

```bash
npm test
npm run build
```

`npm test` covers source-quote matching, the seeded safety-conflict rules, and API input validation. `npm run eval` additionally exercises the two synthetic patient scenarios against a running local server; it requires a Groq key or warmed demo cache.

## API limits

The API accepts only English, Spanish, or Hindi and caps a submitted text summary at 50,000 characters. This is a demo protection against accidental oversized submissions, not a substitute for authentication or clinical privacy controls.

Only the bundled synthetic samples may be cached for demo mode. Uploaded summaries are never written to `data/cache`.

## Demo safety net
Each successful run caches to `data/cache/`. Run both samples in all 3 languages once, then set `DEMO_MODE=true` to serve cached results with no network. (On Vercel the cache is not writable, so warm it locally, remove `data/cache` from .gitignore and commit it.)

## How it works
Extract (Groq openai/gpt-oss-120b, verbatim quotes) -> ground (drop anything not found in the source) -> safety rules (interaction, allergy, duplicate) -> plan (Groq, every line cites sources) -> teach-back + nurse review queue.
Interaction rules in `lib/safety.js` are ILLUSTRATIVE and need clinical validation. Libraries: Next.js, React, Groq API.

## Model note
Groq retired its Llama models for free accounts. Default is `openai/gpt-oss-120b`; fallback `openai/gpt-oss-20b`. Free tier is limited to roughly 8,000 tokens/min, so wait ~1 minute between full runs or use the cache (DEMO_MODE).

## Extras
- RxNorm ID lookup and openFDA label excerpts enrich each safety flag (best effort, 4s timeout, silently skipped if offline).
- `Upload .txt` for your own discharge text; `Add follow-ups to calendar` exports an .ics file.
- `npm run eval` (with dev server running) prints grounding rate and planted-conflict recall for your slides.
## Scan paper slips (OCR)
`Scan a paper slip` takes a photo (or camera capture on a phone) and turns it into editable text.
- **Default: on-device.** Tesseract.js runs in the browser using files copied to `public/tesseract` by `npm install` (postinstall), so it works offline and the photo never leaves the device. Best for printed or clearly typed slips. English only.
- **Handwriting: Google Vision.** Set `GOOGLE_VISION_API_KEY` in `.env.local`. The photo is then sent to Google Cloud Vision (DOCUMENT_TEXT_DETECTION) through `/api/ocr`; if that call fails the app falls back to on-device reading.
- OCR can misread doses (for example `q8h` as `g8h`). The UI shows OCR confidence and asks the user to check the text before building a plan. For a scanned slip you can also type allergies and home medicines so the safety check has the full picture.

## Confidence on every plan line
Each plan and guide line gets High, Medium or Low. The model rates itself, then deterministic checks cap it: any number in the line that is not in the cited source sentence forces Low (works in English, Spanish and Hindi digits), and very short sources are penalised. Low lines are shown with a dashed border, marked "Waiting for a nurse", and queued on the nurse desk (reason `low-confidence`). When the nurse approves, the line shows "Checked by a nurse".

## Readmission risk score
`lib/risk.js` adds transparent points: serious medicine alerts waiting for a nurse (+15 each, max 30), cautions (+6 each, max 12), new or changed medicines (+3 each, max 15), five or more medicines (+8), low-confidence lines (+4 each, max 12), missed teach-back answers (+8 each, max 24), held-back lines (+2 each, max 6), on a base of 10. Levels: Low under 35, Moderate 35 to 59, High 60 and above. It recalculates live as the nurse approves items and as teach-back answers are missed. **It is a prototype heuristic, not a validated clinical score** (it is not LACE or HOSPITAL).

## Tests
`npm test` runs 12 unit tests (quote matching, safety rules, validation, confidence, risk, OCR request validation). The browser flows (photo to OCR to plan to nurse approval) were verified end to end with Playwright against a mocked model.

## Not included
SMS/push reminders, caregiver accounts, live ABHA/EHR integration, Hindi OCR, voice answers (roadmap).
