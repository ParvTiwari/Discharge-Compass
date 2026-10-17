'use client';
import { useState, useEffect } from 'react';
import samples from '../data/samples.json';
import { riskScore, RISK_NOTE } from '../lib/risk.js';
const LANGS = { English: 'en-US', Spanish: 'es-ES', Hindi: 'hi-IN' };
const TYPES = { med: 'Medicine', appointment: 'Visit', diet: 'Food and drink', activity: 'Activity', monitor: 'Check' };
const STAGES = ['Reading the discharge summary…', 'Pulling out every medicine and appointment…', 'Checking each line against the document…', 'Screening the medicines for conflicts…', 'Writing the plan in plain language…'];
const nice = d => {
  if (d.startsWith('Dropped, not found')) { const m = /"(?:name|text|what|symptom)":"([^"]+)"/.exec(d); return `Held back: “${m ? m[1] : 'an item'}” could not be found in the document.`; }
  if (d.startsWith('Plan line dropped')) return 'Held back, no source sentence: ' + d.replace(/^Plan line dropped \(no valid source\): /, '');
  return d;
};
const CF = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' };
const splitList = s => s.split(',').map(x => x.trim()).filter(Boolean);
function useCount(n) { const [v, setV] = useState(0); useEffect(() => { let i = 0; const t = setInterval(() => { i++; setV(Math.round(n * Math.min(i / 22, 1))); if (i >= 22) clearInterval(t); }, 30); return () => clearInterval(t); }, [n]); return v; }
function Kpi({ n, c, children }) { const v = useCount(n); return <div className="kpi" style={{ '--c': c }}><b>{v}</b><span>{children}</span></div>; }
const Tick = () => <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="#0D9488" /><path d="m7 12.5 3.2 3.2L17 9" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const Warn = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 2.5 20h19L12 3z" /><path d="M12 10v4.5M12 17.5v.01" /></svg>;
const DocIc = () => <svg viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></svg>;
function Compass({ busy, done }) {
  return (<svg className={'compass' + (busy ? ' spin' : '') + (done ? ' done' : '')} viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" fill="#F0FDFA" stroke="#0D9488" strokeWidth="4" />
    {[0, 90, 180, 270].map(a => <rect key={a} x="31" y="6" width="2.5" height="7" fill="#0D9488" transform={`rotate(${a} 32 32)`} />)}
    <g className="needle"><polygon points="32,11 38,32 26,32" fill="#0F172A" /><polygon points="32,53 38,32 26,32" fill="#0D9488" /></g><circle cx="32" cy="32" r="3.5" fill="#fff" stroke="#0F172A" strokeWidth="2" /></svg>);
}
function Doc({ text, ranges }) {
  const rs = [...ranges].sort((a, b) => a.start - b.start); let pos = 0; const parts = [];
  rs.forEach((r, i) => { if (r.start < pos) return; parts.push(text.slice(pos, r.start)); parts.push(<mark key={i}>{text.slice(r.start, r.end)}</mark>); pos = r.end; });
  parts.push(text.slice(pos)); return <pre className="doc">{parts}</pre>;
}
const PH = [{ plan: 'Take warfarin 5 mg every day.', src: 'CONTINUE warfarin 5 mg PO daily' }, { plan: 'Ask your nurse before taking ibuprofen.', src: 'START ibuprofen 400 mg PO q8h PRN for knee pain' }];
function Phone() {
  const [i, setI] = useState(0);
  return (<div className="phone"><div className="notch" /><div className="screen">
    <div className="file"><DocIc /><span><b>discharge_summary.txt</b><br />Checked against the source</span></div>
    <div className="mini"><div><b>2</b>plan lines verified</div><div><b>2</b>medicine alerts</div></div>
    <div className="sheet">…INR check in 3 days.<br /><mark style={{ opacity: i === 0 ? 1 : .35 }}>{PH[0].src}</mark>;<br /><mark style={{ opacity: i === 1 ? 1 : .35 }}>{PH[1].src}</mark>. START amoxicillin…</div>
    {PH.map((p, k) => <button key={k} className={'pl' + (k === 1 ? ' w' : '')} aria-pressed={i === k} onClick={() => setI(k)}>{p.plan}</button>)}
    <p className="cap">Tap a plan line to see its source sentence</p></div></div>);
}
const RQ = [{ c: '#EF4444', k: 'Allergy', t: 'Amoxicillin prescribed; patient is allergic to penicillin', q: 'START amoxicillin 500 mg PO TID x 7 days' },
  { c: '#EF4444', k: 'Interaction', t: 'Warfarin with ibuprofen raises bleeding risk', q: 'START ibuprofen 400 mg PO q8h PRN for knee pain' },
  { c: '#EAB308', k: 'Teach-back', t: 'Patient was unsure when to call 911', q: 'Call 911 for chest pain or syncope' },
  { c: '#EAB308', k: 'Held back', t: 'Plan line without a source sentence', q: 'No matching sentence found' }];
export default function Home() {
  const [sid, setSid] = useState('A'), [lang, setLang] = useState('English'), [text, setText] = useState(samples[0].summary);
  const [data, setData] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const [active, setActive] = useState([]), [review, setReview] = useState([]), [ans, setAns] = useState({}), [fb, setFb] = useState({}), [stage, setStage] = useState(0);
  const [g1, setG1] = useState(true), [rqDone, setRqDone] = useState([]);
  const [vision, setVision] = useState(false), [scanSt, setScanSt] = useState(null), [prof, setProf] = useState({ allergies: '', homeMeds: '' });
  useEffect(() => { fetch('/api/ocr').then(r => r.json()).then(j => setVision(!!j.vision)).catch(() => {}); }, []);
  const shrink = file => new Promise((res, rej) => {
    const img = new Image(), u = URL.createObjectURL(file);
    img.onload = () => { const s = Math.min(1, 1800 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c.toDataURL('image/jpeg', 0.85)); };
    img.onerror = () => rej(new Error('That file could not be read as an image.')); img.src = u;
  });
  async function scan(e) {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    setErr(''); setScanSt({ busy: true, pct: 0, label: 'Preparing the photo…' });
    try {
      const url = await shrink(f); let out = null;
      if (vision) {
        setScanSt({ busy: true, pct: 0, label: 'Reading the photo with Google Vision…' });
        const r = await fetch('/api/ocr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: url }) }); const j = await r.json();
        if (r.ok) out = j; else setErr(j.error + ' Switching to on-device reading.');
      }
      if (!out) {
        const { createWorker } = await import('tesseract.js');
        const w = await createWorker('eng', 1, { workerPath: '/tesseract/worker.min.js', corePath: '/tesseract/core', langPath: '/tesseract/lang', logger: m => { if (m.status === 'recognizing text') setScanSt({ busy: true, pct: Math.round(m.progress * 100), label: 'Reading the photo on this device…' }); } });
        const { data: d } = await w.recognize(url); await w.terminate();
        out = { engine: 'tesseract', text: d.text.trim(), confidence: Math.round(d.confidence) };
      }
      if (!out.text) throw new Error('No text was found. Try a clearer, well-lit photo.');
      setText(out.text); setSid('custom'); setData(null); setScanSt({ busy: false, engine: out.engine, conf: out.confidence });
    } catch (x) { setScanSt(null); setErr(x.message); }
  }
  useEffect(() => { if (!busy) { setStage(0); return; } const t = setInterval(() => setStage(s => Math.min(s + 1, STAGES.length - 1)), 1700); return () => clearInterval(t); }, [busy]);
  useEffect(() => { document.querySelector('.doc mark')?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, [active]);
  const pick = id => { setSid(id); setText(samples.find(s => s.id === id).summary); setData(null); };
  async function run(L = lang) {
    setBusy(true); setErr(''); setActive([]);
    try {
      const r = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sampleId: sid, text, lang: L, ...(sid === 'custom' ? { profile: { allergies: splitList(prof.allergies), homeMeds: splitList(prof.homeMeds) } } : {}) }) });
      const d = await r.json(); if (d.error) throw new Error(d.error);
      setData(d); setReview(d.review);
    } catch (e) { setErr(e.message); } setBusy(false);
  }
  async function check(i, q) {
    const r = await fetch('/api/grade', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q.q, expected: q.a, answer: ans[i] || '' }) });
    const g = await r.json(); setFb({ ...fb, [i]: g }); setActive(q.sourceIds);
    if (!g.understood) setReview(rv => [...rv, { id: 'T' + i, reason: 'teach-back', detail: 'Patient may not understand: ' + q.q, status: 'open' }]);
  }
  const upload = async e => { const f = e.target.files[0]; if (!f) return; setText(await f.text()); setSid('custom'); setData(null); };
  function ics() {
    const ymd = d => d.toISOString().slice(0, 10).replace(/-/g, '');
    const ev = (data.appointments || []).map((a, i) => { const m = /(\d+)\s*(day|week)/i.exec(a.when || ''); const d = new Date(); if (m) d.setDate(d.getDate() + (+m[1]) * (/week/i.test(m[2]) ? 7 : 1)); return `BEGIN:VEVENT\nUID:dc${i}@compass\nDTSTAMP:${ymd(new Date())}T000000Z\nDTSTART;VALUE=DATE:${ymd(d)}\nSUMMARY:${(a.what || 'Follow-up').replace(/[,;\n]/g, ' ')}\nEND:VEVENT`; });
    const b = new Blob([`BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//DischargeCompass//EN\n${ev.join('\n')}\nEND:VCALENDAR`], { type: 'text/calendar' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'follow-ups.ics'; a.click();
  }
  const speak = t => { const u = new SpeechSynthesisUtterance(t); u.lang = LANGS[lang]; speechSynthesis.cancel(); speechSynthesis.speak(u); };
  const key = ids => (ids || []).join();
  const ranges = data ? active.map(id => data.spans[id]).filter(Boolean) : [];
  const days = data ? [...new Set(data.plan.map(p => p.day))].sort() : [];
  const quotes = ids => (ids || []).map(id => data.spans[id]).filter(Boolean).map(s => text.slice(s.start, s.end));
  const high = data ? data.flags.filter(f => f.severity === 'high').length : 0;
  const open = review.filter(r => r.status === 'open').length;
  const held = data ? data.review.filter(r => r.detail.startsWith('Plan line dropped')).length : 0;
  const stats = data?.stats || {};
  const riskStart = data ? riskScore({ flags: data.flags, stats, review: data.review }) : null;
  const riskNow = data ? riskScore({ flags: data.flags, stats, review }) : null;
  const riskIfApproved = data ? riskScore({ flags: data.flags, stats, review: review.map(r => r.reason === 'safety' ? { ...r, status: 'approved' } : r) }) : null;
  const lv = l => data ? data.guide.filter(g => g.level === l) : [];
  return (<>
    <nav className="nav"><div className="in"><a className="brand" href="#top"><Compass busy={busy} done={!!data && !busy} />Discharge Compass</a><span className="nav-signal"><i />Safety-first prototype</span>
      <div className="links"><a href="#features">Features</a><a href="#stack">Technical stack</a><a href="#review">Nurse review</a><a href="#demo">Live demo</a></div>
      <a className="btn pri sm" href="#demo">Launch demo <span aria-hidden="true">-&gt;</span></a></div></nav>

    <header className="hero" id="top"><div className="hero-copy">
      <span className="eyebrow">DISCHARGE INTELLIGENCE / SYNTHETIC DEMO</span>
      <h1>Recovery clarity,<br />the moment it <em>matters most.</em></h1>
      <p className="lead">Discharge Compass turns dense hospital instructions into a recovery plan people can follow - with every action traced to the original document and risky medicines surfaced before the first dose.</p>
      <div className="cta"><a className="btn pri" href="#demo">See it in action <span aria-hidden="true">-&gt;</span></a><a className="btn alt" href="#features">How we earn trust</a></div>
      <div className="hero-flow" aria-label="How Discharge Compass works"><div><b>01</b><span>Read the<br />discharge note</span></div><i /><div><b>02</b><span>Verify every<br />instruction</span></div><i /><div><b>03</b><span>Guide recovery<br />with confidence</span></div></div>
      <div className="checks"><span><Tick />Plain language</span><span><Tick />Source verified</span><span><Tick />Nurse-ready</span></div>
    </div><div className="hero-visual"><span className="float-card fc-one"><i className="pulse" /> 100% source-linked</span><span className="float-card fc-two"><b>!</b> 2 risks caught</span><Phone /></div></header>

    <section className="strip"><div className="sec"><div className="cols">
      <div className="met" style={{ '--c': '#EF4444' }}><b>1 in 5</b><p>Medicare patients were rehospitalized within 30 days in a landmark study. Confusing instructions and medicine errors are among the avoidable causes.</p><small>Jencks et al., New England Journal of Medicine, 2009</small></div>
      <div className="met" style={{ '--c': '#0D9488' }}><b>100%</b><p>of plan lines shown to a patient are tied to a sentence in their own document. Anything unverified is held back for a nurse.</p><small>Enforced by the prototype's grounding check</small></div>
      <div className="met" style={{ '--c': '#EAB308' }}><b>3</b><p>languages at launch: English, Spanish and Hindi, with the plan read aloud for people who prefer to listen.</p><small>More languages are on the roadmap</small></div>
    </div></div></section>

    <section className="sec" id="features"><span className="eyebrow">What makes it different</span><h2>Seven ways it earns a family's trust</h2><p className="sub">Each feature below is part of the working prototype, except where it says roadmap.</p>
      <div className="bento">
        <div className="bc b7"><span className="tagc">Source-grounded output</span><h3>Every line points back to the doctor's own words</h3><p>Tap a plan sentence and the original sentence lights up. If the system can't find the source, it doesn't show the line.</p>
          <div className="tie"><div className="bubble mono">…weigh daily each morning.<br /><mark style={{ opacity: g1 ? 1 : .25 }}>CONTINUE warfarin 5 mg PO daily</mark>; INR check in 3 days…</div><div className="arrow" aria-hidden="true">←</div>
            <div className="bubble"><button onClick={() => setG1(!g1)} aria-pressed={g1}>“Take warfarin 5 mg every day.” <b style={{ color: '#0F766E' }}>{g1 ? 'Tap to unhighlight' : 'Tap to see source'}</b></button></div></div></div>
        <div className="bc b5"><span className="tagc">Medication safety check</span><h3>New medicines are checked against the home list</h3>
          <div className="al"><b>Ask your nurse first</b><div className="pills"><span className="pill">warfarin</span><span className="pill">ibuprofen</span></div><p style={{ marginTop: 8, fontSize: 17, color: '#0F172A' }}>Ibuprofen can raise bleeding risk in people taking warfarin.</p></div>
          <p style={{ fontSize: 16 }}>Names are normalized with RxNorm and label text comes from openFDA when online. Interaction rules in the prototype are illustrative and need clinical validation.</p></div>
        <div className="bc b5"><span className="tagc">Teach-back and read-aloud</span><h3>Hear it. Say it back. Be sure.</h3>
          <div className="wave" aria-hidden="true">{Array.from({ length: 26 }).map((_, k) => <i key={k} style={{ animationDelay: `${(k % 9) * 0.11}s` }} />)}</div>
          <p>The plan is read aloud in English, Spanish or Hindi, then three short questions confirm it landed. Missed answers go to the nurse. Voice answers are on the roadmap; today you type them.</p></div>
        <div className="bc b7"><span className="tagc">Traffic-light symptom guide</span><h3>Always know what is normal, what needs a call, what is an emergency</h3>
          <div className="tl"><div className="tr g"><i /><div><b>Green: keep going</b><span>No warning signs from your document. Follow the plan.</span></div></div>
            <div className="tr y"><i /><div><b>Amber: call the clinic</b><span>Signs your document says to report, like a fast weight gain.</span></div></div>
            <div className="tr r"><i /><div><b>Red: call 911</b><span>Emergency signs from your document, like chest pain.</span></div></div></div></div>
        <div className="bc b4"><span className="tagc">Scan paper slips</span><h3>Photo in, plan out</h3><div className="slip" aria-hidden="true" />
          <p>Snap a picture of a paper discharge slip. Printed text is read on the device, even offline. Handwriting uses Google Vision when you set it up.</p></div>
        <div className="bc b4"><span className="tagc">Confidence on every line</span><h3>Honest about what it is unsure of</h3>
          <div className="cfrow"><span className="cf high">High</span><span>Take warfarin 5 mg every day.</span></div><div className="cfrow"><span className="cf medium">Medium</span><span>Rest and walk short distances.</span></div><div className="cfrow"><span className="cf low">Low</span><span>A number that is not in the source. Sent to the nurse.</span></div></div>
        <div className="bc b4"><span className="tagc">Readmission risk</span><h3>From flags to the outcome that matters</h3>
          <div className="gauge" aria-hidden="true"><span className="mk" style={{ left: '57%' }} /></div>
          <p>Adds up serious medicine alerts, new medicines and missed teach-back answers. It falls live as the nurse resolves items. A transparent prototype score, not a validated clinical one.</p></div>
      </div></section>

    <section className="strip" id="stack"><div className="sec"><span className="eyebrow">For clinicians and engineers</span><h2>Technical stack blueprint</h2><p className="sub">What is built today, and what is still on the roadmap.</p>
      <div className="scroll"><table className="tbl"><thead><tr><th>Layer</th><th>Technology</th><th>Role</th><th>Status</th></tr></thead><tbody>
        <tr><td>Frontend</td><td>Next.js and React web app, Web Speech read-aloud</td><td>Responsive, large-text patient and caregiver interface</td><td><span className="st b">Built</span></td></tr>
        <tr><td>Extraction</td><td>LLM through the Groq API (openai/gpt-oss-120b)</td><td>Pulls medicines, visits and warning signs into JSON with verbatim quotes</td><td><span className="st b">Built</span></td></tr>
        <tr><td>Verification</td><td>Quote-grounding check, medicine rules, RxNorm and openFDA lookups</td><td>Drops unverifiable lines; flags interactions, allergies and duplicates</td><td><span className="st b">Built</span></td></tr>
        <tr><td>Paper intake</td><td>Tesseract.js in the browser (offline); optional Google Vision API</td><td>Turns a photo of a paper slip into editable text; handwriting needs Vision</td><td><span className="st b">Built</span></td></tr>
        <tr><td>Confidence and risk</td><td>Model self-rating plus rule checks; additive risk heuristic</td><td>Badges every line, routes Low to the nurse, updates a live risk score</td><td><span className="st b">Built</span></td></tr>
        <tr><td>Data and privacy</td><td>Stateless API routes, nothing stored</td><td>No patient data is kept by the prototype</td><td><span className="st b">Built</span></td></tr>
        <tr><td>Backend storage</td><td>Encrypted, session-only PostgreSQL</td><td>Optional short-lived storage for care teams</td><td><span className="st p">Roadmap</span></td></tr>
        <tr><td>Interoperability</td><td>FHIR mapping, EHR integration</td><td>Send plans and flags into hospital systems</td><td><span className="st p">Roadmap</span></td></tr>
      </tbody></table></div></div></section>

    <section className="sec" id="review"><span className="eyebrow">For nurses</span><h2>A review queue that takes seconds, not a second discharge talk</h2><p className="sub">The system only sends the nurse what it is unsure about. This is an example; your live queue appears in the demo below.</p>
      <div className="dash"><div className="dh"><b>Nurse desk · Patient A</b><span className="st p">{RQ.length - rqDone.length} need review</span></div>
        {RQ.map((r, k) => <div key={k} className={'rw' + (rqDone.includes(k) ? ' ok' : '')}><span className="kind" style={{ '--c': r.c }}><i />{r.k}</span><div>{r.t}<div className="q">“{r.q}”</div></div>
          {rqDone.includes(k) ? <b>Reviewed</b> : <button className="btn pri sm" onClick={() => setRqDone([...rqDone, k])}>Approve</button>}</div>)}</div></section>

    <section className="demo" id="demo"><div className="sec"><span className="eyebrow">Live demo</span><h2>Build a verified plan now</h2><p className="sub">Pick a synthetic patient and a language. Everything you see below is generated from the discharge text.</p>
      {err && <div className="err" role="alert">{err}</div>}
      {!data && <div className="dg"><div>
        <span className="lab">Whose discharge summary?</span><div className="seg">{samples.map(s => <button key={s.id} aria-pressed={sid === s.id} onClick={() => pick(s.id)}>{({ A: 'Heart failure', B: 'Pneumonia + COPD' })[s.id] || s.id}</button>)}</div>
        <span className="lab">Language for the patient</span><div className="seg">{Object.keys(LANGS).map(l => <button key={l} aria-pressed={lang === l} onClick={() => { setLang(l); setData(null); }}>{l}</button>)}</div>
        <div className="row"><button className="btn pri" onClick={() => run()} disabled={busy}>{busy ? 'Working…' : 'Build the recovery plan'}</button>
          <label className="btn alt" style={{ cursor: 'pointer' }}>Scan a paper slip<input type="file" accept="image/*" capture="environment" aria-label="Scan a paper discharge slip" onChange={scan} hidden /></label>
          <label className="btn alt" style={{ cursor: 'pointer' }}>Use your own .txt<input type="file" accept=".txt" onChange={upload} hidden /></label></div>
        {scanSt?.busy && <div className="sn" aria-live="polite">{scanSt.label}<div className="pbar"><i style={{ width: Math.max(4, scanSt.pct) + '%' }} /></div></div>}
        {scanSt && !scanSt.busy && <div className={'sn' + (scanSt.engine === 'tesseract' || (scanSt.conf ?? 100) < 75 ? ' warn' : '')}>Read with <b>{scanSt.engine === 'google-vision' ? 'Google Vision' : 'on-device OCR'}</b>{scanSt.conf != null ? ` (${scanSt.conf}% confident)` : ''}. Check the text on the right and fix any mistakes before building the plan.{scanSt.engine === 'tesseract' ? ' On-device reading is best for printed slips. For handwriting, set up Google Vision (see the README).' : ''}</div>}
        {sid === 'custom' && <div className="prof"><span className="lab">Allergies on the patient's chart (optional, comma-separated)</span><input value={prof.allergies} onChange={e => setProf({ ...prof, allergies: e.target.value })} placeholder="penicillin, sulfa" />
          <span className="lab">Medicines already at home (optional, comma-separated)</span><input value={prof.homeMeds} onChange={e => setProf({ ...prof, homeMeds: e.target.value })} placeholder="warfarin 5 mg daily, furosemide 40 mg" /></div>}
        {busy && <p className="stage" aria-live="polite">{STAGES[stage]}</p>}
      </div><div className="paper"><h3>The hospital's discharge summary</h3><textarea aria-label="Discharge summary text" value={text} onChange={e => setText(e.target.value)} /></div></div>}
      {data && <>
        <div className="kpis" aria-live="polite">
          <Kpi n={data.plan.length} c="#22C55E">plan lines, each tied to a sentence in the patient's own document{held > 0 ? `. ${held} unverified ${held === 1 ? 'line was' : 'lines were'} held back.` : ''}</Kpi>
          <Kpi n={high} c="#EF4444">serious medicine problems caught before the first dose</Kpi>
          <Kpi n={open} c="#EAB308">items waiting for a nurse instead of a full re-explanation</Kpi></div>
        <section className="risk" aria-live="polite" aria-label="Readmission risk"><div>
          <span className="rk-lab">Readmission risk · prototype score</span>
          <div className="rk-row"><b className={'rk-num ' + riskNow.level.toLowerCase()}>{riskNow.score}<small>/100</small></b><span className={'cf ' + ({ Low: 'high', Moderate: 'medium', High: 'low' })[riskNow.level]}>{riskNow.level} risk</span></div>
          <div className="gauge"><span className="mk" style={{ left: riskNow.score + '%' }} /></div><div className="ticks"><span>0 Low</span><span>35 Moderate</span><span>60 High</span><span>100</span></div>
          {riskStart.score !== riskNow.score && <p className="rk-delta">Started at <b>{riskStart.score}</b>. Now <b>{riskNow.score}</b> after nurse review and teach-back.</p>}
          {riskIfApproved.score < riskNow.score && <p className="rk-hint">If the nurse resolves the open medicine alerts, this drops to <b>{riskIfApproved.score}</b>.</p>}
          <p className="rk-note">{RISK_NOTE} It adds up transparent points and never replaces a clinician's judgment.</p></div>
          <div><span className="rk-lab">What is driving it</span><ul className="rkl"><li><span>Starting point</span><b>+{riskNow.base}</b></li>
            {riskNow.factors.map(f => <li key={f.label}><span>{f.label}{f.count > 1 ? ` (${f.count})` : ''}</span><b>+{f.points}</b></li>)}</ul></div></section>
        <div className="row" style={{ marginTop: 0, marginBottom: 26, alignItems: 'center' }}>
          <button className="btn alt sm" onClick={() => { setData(null); setActive([]); }}>Start over</button>
          <button className="btn alt sm" onClick={() => speak(data.plan.map(p => p.text).join('. '))}>Read the plan aloud</button>
          {data.appointments?.length > 0 && <button className="btn alt sm" onClick={ics}>Add follow-ups to my calendar</button>}
          <div className="seg" style={{ margin: 0 }}>{Object.keys(LANGS).map(l => <button key={l} aria-pressed={lang === l} onClick={() => { setLang(l); run(l); }}>{l}</button>)}</div></div>
        <div className="main"><div>
          {data.flags.length > 0 && <><h3 className="h">Ask your nurse before taking these</h3>
            {data.flags.map(f => <button key={f.id} className={'alert ' + f.severity} aria-pressed={key(active) === key(f.sourceIds)} onClick={() => setActive(f.sourceIds)}><span className="ico"><Warn /></span><div>
              <div className="pills" style={{ margin: '0 0 6px' }}>{f.drugs.map(d => <span className="pill" key={d}>{d}</span>)}</div>{f.explanation}
              {f.rxcui && <div className="rx">RxNorm: {Object.entries(f.rxcui).map(([k, v]) => `${k} ${v}`).join(', ')}</div>}
              {f.fda && <div className="fda">From the FDA label: …{f.fda}…</div>}</div></button>)}</>}
          <h3 className="h">Your plan for {data.diagnosis}</h3>
          {data.confidence && <p className="legend">Confidence on each line: <b>{data.confidence.high} high</b>, <b>{data.confidence.medium} medium</b>, <b>{data.confidence.low} low</b>. Low lines go to the nurse before the family relies on them.</p>}
          {days.map(d => <div className="day" key={d}><span className="dn">Day {d}</span><div className="items">
            {data.plan.filter(p => p.day === d).map((p, i) => { const on = key(active) === key(p.sourceIds); const c = p.conf; const rv = c && review.find(r => r.ref === p.id); const ck = rv && rv.status !== 'open'; return (
              <button key={i} className={'step t-' + p.type + (c?.level === 'low' && !ck ? ' lowc' : '')} aria-pressed={on} onClick={() => setActive(on ? [] : p.sourceIds)}><span className="tag">{TYPES[p.type] || 'Step'}</span>{p.text}
                {c && <span className="cfw">{ck ? <span className="cf checked">Checked by a nurse</span> : <span className={'cf ' + c.level}>{CF[c.level]}</span>}{c.level === 'low' && !ck && <span className="wait">Waiting for a nurse</span>}</span>}
                {on && quotes(p.sourceIds).map((q, j) => <div className="src" key={j}><small>From your document</small>“{q}”</div>)}
                {on && c && c.level !== 'high' && c.reasons.length > 0 && <div className="why">Why {c.level}: {c.reasons.join('; ')}.</div>}</button>); })}</div></div>)}
          <h3 className="h">When to get help</h3>
          <div className="lights"><div className="light g"><h5>Green: on track</h5><div>If none of the signs in the amber and red cards apply, keep following your plan.</div></div>
            {['y', 'r'].map(k => <div key={k} className={'light ' + k}><h5>{k === 'r' ? 'Red: call 911' : 'Amber: call the clinic'}</h5>
              {lv(k === 'r' ? 'red' : 'amber').map((g, i) => <div className="clk" key={i} onClick={() => setActive(g.sourceIds)}>{g.text} {g.conf && <span className={'cf ' + g.conf.level}>{g.conf.level}</span>}</div>)}
              {lv(k === 'r' ? 'red' : 'amber').length === 0 && <div>Nothing listed in the document.</div>}</div>)}</div>
        </div><div className="sticky">
          <div className="paper"><h3>The hospital's original words</h3><Doc text={text} ranges={ranges} /></div>
          <h3 className="h" style={{ marginTop: 28 }}>Did that make sense?</h3>
          <div className="card">{data.quiz.map((q, i) => <div key={i}><b>{q.q}</b>
            <input aria-label={q.q} placeholder="Type your answer" value={ans[i] || ''} onChange={e => setAns({ ...ans, [i]: e.target.value })} />
            <button className="btn pri sm" onClick={() => check(i, q)}>Check my answer</button>
            {fb[i] && <div className={'fb' + (fb[i].understood ? '' : ' no')}>{fb[i].feedback}</div>}<div style={{ height: 14 }} /></div>)}</div>
          <h3 className="h">Nurse desk ({open} open)</h3>
          <div className="card">{review.length === 0 && 'Nothing needs review.'}
            {review.map(r => <div key={r.id} className={'rv' + (r.status === 'open' ? '' : ' done')}><div><span className="tag">{r.reason}</span>{nice(r.detail)}</div>
              {r.status === 'open' ? <button className="btn pri sm" onClick={() => setReview(rv => rv.map(x => x.id === r.id ? { ...x, status: 'approved' } : x))}>Approve</button> : <b>Reviewed</b>}</div>)}</div>
        </div></div></>}
    </div></section>
    <footer className="foot">Prototype for the 2nd LaserHacks 2026 · Team The Legends · Synthetic data only. Not medical advice.</footer></>);
}
