'use client';
import { useState, useEffect } from 'react';
import samples from '../data/samples.json';
const LANGS = { English: 'en-US', Spanish: 'es-ES', Hindi: 'hi-IN' };
const TYPES = { med: 'Medicine', appointment: 'Visit', diet: 'Food and drink', activity: 'Activity', monitor: 'Check' };
function useCount(n) {
  const [v, setV] = useState(0);
  useEffect(() => { let i = 0; const t = setInterval(() => { i++; setV(Math.round(n * Math.min(i / 22, 1))); if (i >= 22) clearInterval(t); }, 30); return () => clearInterval(t); }, [n]);
  return v;
}
function Stat({ n, cls, children }) { const v = useCount(n); return <div className={'stat ' + cls}><b>{v}</b><span>{children}</span></div>; }
function Compass({ busy, done }) {
  return (<svg className={'compass' + (busy ? ' spin' : '') + (done ? ' done' : '')} viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="29" fill="none" stroke="#C99A2E" strokeWidth="3" /><circle cx="32" cy="32" r="22" fill="#163A43" />
    {[0, 90, 180, 270].map(a => <rect key={a} x="31" y="5" width="2" height="7" fill="#C99A2E" transform={`rotate(${a} 32 32)`} />)}
    <g className="needle"><polygon points="32,10 37,32 27,32" fill="#E4E9E9" /><polygon points="32,54 37,32 27,32" fill="#C99A2E" /></g><circle cx="32" cy="32" r="3" fill="#10282F" /></svg>);
}
const Warn = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 2.5 20h19L12 3z" /><path d="M12 10v4.5M12 17.5v.01" /></svg>;
const Tick = () => <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="#0D7377" /><path d="m7 12.5 3.2 3.2L17 9" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const Rose = () => <svg className="rose" viewBox="0 0 200 200" fill="none" stroke="#10282F" strokeWidth=".7" aria-hidden="true"><circle cx="100" cy="100" r="96" /><circle cx="100" cy="100" r="78" /><circle cx="100" cy="100" r="50" />{[0, 45, 90, 135].map(a => <line key={a} x1="100" y1="4" x2="100" y2="196" transform={`rotate(${a} 100 100)`} />)}<polygon points="100,8 108,100 100,192 92,100" fill="#10282F" /><polygon points="8,100 100,92 192,100 100,108" /></svg>;
const STAGES = ['Reading the discharge summary…', 'Pulling out every medicine and appointment…', 'Checking each line against the document…', 'Screening the medicines for conflicts…', 'Writing the plan in plain language…'];
const nice = d => {
  if (d.startsWith('Dropped, not found')) { const m = /"(?:name|text|what|symptom)":"([^"]+)"/.exec(d); return `Held back: “${m ? m[1] : 'an item'}” could not be found in the document.`; }
  if (d.startsWith('Plan line dropped')) return 'Held back, no source sentence: ' + d.replace(/^Plan line dropped \(no valid source\): /, '');
  return d;
};
function Doc({ text, ranges }) {
  const rs = [...ranges].sort((a, b) => a.start - b.start); let pos = 0; const parts = [];
  rs.forEach((r, i) => { if (r.start < pos) return; parts.push(text.slice(pos, r.start)); parts.push(<mark key={i}>{text.slice(r.start, r.end)}</mark>); pos = r.end; });
  parts.push(text.slice(pos)); return <pre className="doc">{parts}</pre>;
}
export default function Home() {
  const [sid, setSid] = useState('A'), [lang, setLang] = useState('English'), [text, setText] = useState(samples[0].summary);
  const [data, setData] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const [active, setActive] = useState([]), [review, setReview] = useState([]), [ans, setAns] = useState({}), [fb, setFb] = useState({});
  const [stage, setStage] = useState(0);
  useEffect(() => { if (!busy) { setStage(0); return; } const t = setInterval(() => setStage(s => Math.min(s + 1, STAGES.length - 1)), 1700); return () => clearInterval(t); }, [busy]);
  useEffect(() => { document.querySelector('mark')?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, [active]);
  const pick = id => { setSid(id); setText(samples.find(s => s.id === id).summary); setData(null); };
  async function run(L = lang) {
    setBusy(true); setErr(''); setActive([]);
    try {
      const r = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sampleId: sid, text, lang: L }) });
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
  const controls = (<>
    <span className="lab">Whose discharge summary?</span>
    <div className="seg">{samples.map(s => <button key={s.id} aria-pressed={sid === s.id} onClick={() => pick(s.id)}>{({ A: 'Heart failure', B: 'Pneumonia + COPD' })[s.id] || s.id}</button>)}</div>
    <span className="lab">Language for the patient</span>
    <div className="seg">{Object.keys(LANGS).map(l => <button key={l} aria-pressed={lang === l} onClick={() => { setLang(l); setData(null); }}>{l}</button>)}</div>
  </>);
  return (<>
    <header className="top"><Compass busy={busy} done={!!data && !busy} /><div><h1>Discharge Compass</h1><p>Verified, plain-language recovery plans</p></div><div className="chip">Synthetic patients · Not medical advice</div></header>
    <main className="wrap">
      {err && <div className="err" role="alert">{err}</div>}
      {!data && <section className="hero"><Rose />
        <div className="hl">
          <h2>Every instruction, traced to its source.</h2>
          <p className="lead">Hospital discharge papers are dense and easy to misread. Discharge Compass rewrites them in plain language, checks the medicines, and shows the exact sentence behind every line it tells the patient.</p>
          {controls}
          <button className="go" onClick={() => run()} disabled={busy}>{busy ? 'Working…' : 'Build the recovery plan'}</button>
          {busy && <p className="stage" aria-live="polite">{STAGES[stage]}</p>}
          <div style={{ marginTop: 14 }}><label className="ghost" style={{ display: 'inline-block' }}>Use your own .txt<input type="file" accept=".txt" onChange={upload} hidden /></label></div>
          <div className="pr"><span><Tick />Plain language</span><span><Tick />Traced to the source sentence</span><span><Tick />Reviewed by a nurse</span></div>
        </div>
        <div className="paper"><h3>The hospital's discharge summary</h3><textarea aria-label="Discharge summary text" value={text} onChange={e => setText(e.target.value)} /></div>
      </section>}
      {data && <>
        <div className="trust" aria-live="polite">
          <Stat n={data.plan.length} cls="s1">plan lines, each tied to a sentence in the patient's own document{held > 0 ? `. ${held} unverified ${held === 1 ? 'line was' : 'lines were'} held back.` : ''}</Stat>
          <Stat n={high} cls="s2">serious medicine problems caught before the first dose</Stat>
          <Stat n={open} cls="s3">items waiting for a nurse, instead of re-explaining the whole discharge</Stat>
        </div>
        <div className="bar">
          <button className="ghost" onClick={() => { setData(null); setActive([]); }}>Start over</button>
          <button className="ghost" onClick={() => speak(data.plan.map(p => p.text).join('. '))}>Read the plan aloud</button>
          {data.appointments?.length > 0 && <button className="ghost" onClick={ics}>Add follow-ups to my calendar</button>}
          <span className="seg" style={{ marginBottom: 0 }}>{Object.keys(LANGS).map(l => <button key={l} aria-pressed={lang === l} onClick={() => { setLang(l); run(l); }}>{l}</button>)}</span>
        </div>
        <div className="main"><div>
          {data.flags.length > 0 && <><h3 className="sec">Ask your nurse before taking these</h3>
            {data.flags.map(f => <button key={f.id} className={'alert ' + f.severity} aria-pressed={key(active) === key(f.sourceIds)} onClick={() => setActive(f.sourceIds)}>
              <span className="ico"><Warn /></span><div><div className="pills">{f.drugs.map(d => <span className="pill" key={d}>{d}</span>)}</div>{f.explanation}
              {f.rxcui && <div className="rx">RxNorm: {Object.entries(f.rxcui).map(([k, v]) => `${k} ${v}`).join(', ')}</div>}
              {f.fda && <div className="fda">From the FDA label: …{f.fda}…</div>}</div></button>)}</>}
          <h3 className="sec">Your plan for {data.diagnosis}</h3>
          <div className="days">{days.map(d => <div className="day" key={d}><h4><span className="dn">Day {d}</span></h4><div className="items">
            {data.plan.filter(p => p.day === d).map((p, i) => { const on = key(active) === key(p.sourceIds); return (
              <button key={i} className={'step t-' + p.type} aria-pressed={on} onClick={() => setActive(on ? [] : p.sourceIds)}>
                <span className="tag">{TYPES[p.type] || 'Step'}</span>{p.text}
                {on && quotes(p.sourceIds).map((q, j) => <div className="src" key={j}><small>From your document</small>“{q}”</div>)}</button>); })}</div></div>)}</div>
          <h3 className="sec">When to get help</h3>
          <div className="lights">{['amber', 'red'].map(lv => <div key={lv} className={'light ' + lv}><h5>{lv === 'red' ? 'Call 911 now' : 'Call the clinic'}</h5>
            {data.guide.filter(g => g.level === lv).map((g, i) => <div key={i} onClick={() => setActive(g.sourceIds)}>{g.text}</div>)}{!data.guide.some(g => g.level === lv) && <div className="none">Nothing listed in the document</div>}</div>)}</div>
        </div><div className="sticky">
          <div className="paper"><h3>The hospital's original words</h3><Doc text={text} ranges={ranges} /></div>
          <h3 className="sec" style={{ marginTop: 24 }}>Did that make sense?</h3>
          <div className="card">{data.quiz.map((q, i) => <div className="q" key={i}><b>{q.q}</b>
            <input aria-label={q.q} placeholder="Type your answer" value={ans[i] || ''} onChange={e => setAns({ ...ans, [i]: e.target.value })} />
            <button className="mini" onClick={() => check(i, q)}>Check my answer</button>
            {fb[i] && <div className={'fb' + (fb[i].understood ? '' : ' no')}>{fb[i].feedback}</div>}</div>)}</div>
          <h3 className="sec">Nurse desk ({open} open)</h3>
          <div className="card">{review.length === 0 && 'Nothing needs review.'}
            {review.map(r => <div key={r.id} className={'rv' + (r.status === 'open' ? '' : ' done')}><div><span className="tag">{r.reason}</span>{nice(r.detail)}</div>
              {r.status === 'open' ? <button className="mini" onClick={() => setReview(rv => rv.map(x => x.id === r.id ? { ...x, status: 'approved' } : x))}>Approve</button> : <span>Reviewed</span>}</div>)}</div>
        </div></div></>}
    </main>
    <footer className="foot">Built for the 2nd LaserHacks 2026 · Team The Legends</footer></>);
}
