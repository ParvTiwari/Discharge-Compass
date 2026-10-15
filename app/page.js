'use client';
import { useState, useEffect } from 'react';
import samples from '../data/samples.json';
const LANGS = { English: 'en-US', Spanish: 'es-ES', Hindi: 'hi-IN' };
function Doc({ text, ranges }) {
  const rs = [...ranges].sort((a, b) => a.start - b.start); let pos = 0; const parts = [];
  rs.forEach((r, i) => { if (r.start < pos) return; parts.push(text.slice(pos, r.start)); parts.push(<mark key={i}>{text.slice(r.start, r.end)}</mark>); pos = r.end; });
  parts.push(text.slice(pos)); return <pre className="doc">{parts}</pre>;
}
export default function Home() {
  const [sid, setSid] = useState('A'), [lang, setLang] = useState('English'), [text, setText] = useState(samples[0].summary);
  const [data, setData] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const [active, setActive] = useState([]), [review, setReview] = useState([]), [ans, setAns] = useState({}), [fb, setFb] = useState({});
  useEffect(() => { document.querySelector('mark')?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, [active]);
  const pick = id => { setSid(id); setText(samples.find(s => s.id === id).summary); setData(null); };
  async function run() {
    setBusy(true); setErr(''); setActive([]);
    try {
      const r = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sampleId: sid, text, lang }) });
      const d = await r.json(); if (d.error) throw new Error(d.error);
      setData(d); setReview(d.review);
    } catch (e) { setErr(e.message); } setBusy(false);
  }
  async function check(i, q) {
    const r = await fetch('/api/grade', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q.q, expected: q.a, answer: ans[i] || '' }) });
    const g = await r.json(); setFb({ ...fb, [i]: g }); setActive(q.sourceIds);
    if (!g.understood) setReview(rv => [...rv, { id: 'T' + i, reason: 'teachback', detail: 'Patient may not understand: ' + q.q, status: 'open' }]);
  }
  const upload = async e => { const f = e.target.files[0]; if (!f) return; setText(await f.text()); setSid('custom'); setData(null); };
  function ics() {
    const ymd = d => d.toISOString().slice(0, 10).replace(/-/g, '');
    const ev = (data.appointments || []).map((a, i) => { const m = /(\d+)\s*(day|week)/i.exec(a.when || ''); const d = new Date(); if (m) d.setDate(d.getDate() + (+m[1]) * (/week/i.test(m[2]) ? 7 : 1)); return `BEGIN:VEVENT\nUID:dc${i}@compass\nDTSTAMP:${ymd(new Date())}T000000Z\nDTSTART;VALUE=DATE:${ymd(d)}\nSUMMARY:${(a.what || 'Follow-up').replace(/[,;\n]/g, ' ')}\nEND:VEVENT`; });
    const b = new Blob([`BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//DischargeCompass//EN\n${ev.join('\n')}\nEND:VCALENDAR`], { type: 'text/calendar' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'follow-ups.ics'; a.click();
  }
  const speak = t => { const u = new SpeechSynthesisUtterance(t); u.lang = LANGS[lang]; speechSynthesis.cancel(); speechSynthesis.speak(u); };
  const ranges = data ? active.map(id => data.spans[id]).filter(Boolean) : [];
  const days = data ? [...new Set(data.plan.map(p => p.day))].sort() : [];
  return (<>
    <header><h1>Discharge Compass</h1>verified, plain-language recovery plans</header>
    <div className="ban">Prototype with synthetic data. Not medical advice. Tap any line to see the exact source sentence.</div>
    <main>
      <div className="bar">
        <select value={sid} onChange={e => pick(e.target.value)}>{samples.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}{sid === 'custom' && <option value="custom">Custom uploaded text</option>}</select>
        <select value={lang} onChange={e => { setLang(e.target.value); setData(null); }}>{Object.keys(LANGS).map(l => <option key={l}>{l}</option>)}</select>
        <button onClick={run} disabled={busy}>{busy ? 'Analyzing…' : 'Build my plan'}</button>
        <label className="alt" style={{ padding: '8px 12px', border: '1px solid #0b6e6e', borderRadius: 8, cursor: 'pointer' }}>Upload .txt<input type="file" accept=".txt" onChange={upload} hidden /></label>
        {data && data.appointments?.length > 0 && <button className="alt" onClick={ics}>Add follow-ups to calendar</button>}
        {data && <button className="alt" onClick={() => speak(data.plan.map(p => p.text).join('. '))}>Read aloud</button>}
      </div>
      {err && <div className="card item red">{err}</div>}
      {!data && <textarea value={text} onChange={e => setText(e.target.value)} />}
      {data && <div className="grid"><div>
        {data.flags.length > 0 && <div className="card"><h3>Medicine safety checks</h3>
          {data.flags.map(f => <div key={f.id} className={'item ' + f.severity} onClick={() => setActive(f.sourceIds)}><span className="tag">{f.severity} · {f.kind}</span><br />{f.drugs.join(' + ')}: {f.explanation}{f.rxcui && <div style={{ fontSize: 13 }}>RxNorm IDs: {Object.entries(f.rxcui).map(([k, v]) => `${k} (${v})`).join(', ')}</div>}{f.fda && <div style={{ fontSize: 13, fontStyle: 'italic' }}>FDA label excerpt (openFDA): …{f.fda}…</div>}</div>)}</div>}
        <div className="card"><h3>Your plan: {data.diagnosis}</h3>
          {days.map(d => <div key={d}><div className="day">Day {d}</div>{data.plan.filter(p => p.day === d).map((p, i) => <div key={i} className="item" onClick={() => setActive(p.sourceIds)}>{p.text}</div>)}</div>)}</div>
        <div className="card"><h3>When to get help</h3>{data.guide.map((g, i) => <div key={i} className={'item ' + g.level} onClick={() => setActive(g.sourceIds)}><span className="tag">{g.level === 'red' ? 'Call 911' : 'Call the clinic'}</span><br />{g.text}</div>)}</div>
      </div><div>
        <div className="card"><h3>Original discharge summary</h3><Doc text={text} ranges={ranges} /></div>
        <div className="card"><h3>Teach-back: do you understand?</h3>
          {data.quiz.map((q, i) => <div key={i}><b>{q.q}</b><br /><input style={{ width: '70%', padding: 8 }} value={ans[i] || ''} onChange={e => setAns({ ...ans, [i]: e.target.value })} /> <button onClick={() => check(i, q)}>Check</button>
            {fb[i] && <div className={'item ' + (fb[i].understood ? '' : 'amber')}>{fb[i].feedback}</div>}</div>)}</div>
        <div className="card"><h3>Nurse review queue ({review.filter(r => r.status === 'open').length} open)</h3>
          {review.length === 0 && 'Nothing to review.'}
          {review.map(r => <div key={r.id} className={'item ' + (r.status === 'open' ? 'amber' : '')}><span className="tag">{r.reason}</span> {r.detail}{' '}
            {r.status === 'open' ? <button onClick={() => setReview(rv => rv.map(x => x.id === r.id ? { ...x, status: 'approved' } : x))}>Approve</button> : '✔ reviewed'}</div>)}</div>
      </div></div>}
    </main></>);
}
