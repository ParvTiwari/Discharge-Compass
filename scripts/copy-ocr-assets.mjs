// Copies Tesseract.js worker, WASM core and English data into public/tesseract so OCR works offline (no CDN).
import fs from 'node:fs'; import path from 'node:path';
const root = process.cwd(), out = path.join(root, 'public', 'tesseract');
const nm = p => path.join(root, 'node_modules', p);
try {
  fs.mkdirSync(path.join(out, 'core'), { recursive: true }); fs.mkdirSync(path.join(out, 'lang'), { recursive: true });
  fs.copyFileSync(nm('tesseract.js/dist/worker.min.js'), path.join(out, 'worker.min.js'));
  for (const f of fs.readdirSync(nm('tesseract.js-core'))) if (/\.(js|wasm)$/.test(f)) fs.copyFileSync(nm('tesseract.js-core/' + f), path.join(out, 'core', f));
  const dataDir = nm('@tesseract.js-data/eng/4.0.0_best_int');
  fs.copyFileSync(path.join(dataDir, 'eng.traineddata.gz'), path.join(out, 'lang', 'eng.traineddata.gz'));
  console.log('OCR assets copied to public/tesseract');
} catch (e) { console.warn('OCR asset copy skipped:', e.message); }
