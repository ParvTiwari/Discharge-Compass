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

## Medication evidence

Medication names are normalized through RxNorm and the prototype can retrieve current `drug_interactions` excerpts from official openFDA Structured Product Labels. The screen labels whether a particular safety alert received a live label match; an unmatched screening alert remains in clinician review. These public sources support the demo but are not a clinically validated interaction database and must not be used for medical decisions without clinical oversight.

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
## Not included
Photo/PDF OCR, SMS/push reminders, caregiver accounts, live ABHA/EHR integration (roadmap).
