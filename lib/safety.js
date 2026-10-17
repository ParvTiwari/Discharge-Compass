// ILLUSTRATIVE demo rules only. A real product needs a licensed, clinically validated interaction database.
const DRUGS={warfarin:'anticoagulant',ibuprofen:'nsaid',naproxen:'nsaid',amoxicillin:'penicillin',ampicillin:'penicillin',lisinopril:'ace','potassium chloride':'potassium',spironolactone:'k-sparing',levalbuterol:'saba',albuterol:'saba',furosemide:'loop',metoprolol:'beta-blocker'};
const PAIRS=[['anticoagulant','nsaid','high','NSAIDs can raise bleeding risk in people taking warfarin.'],
['ace','k-sparing','high','Both raise potassium. Together they can cause dangerously high potassium.'],
['ace','potassium','moderate','An ACE inhibitor plus potassium can push potassium too high. Levels need monitoring.'],
['potassium','k-sparing','high','Both raise potassium. High potassium can affect the heart rhythm.']];
export const key=n=>{const l=n.toLowerCase();return Object.keys(DRUGS).find(k=>l.includes(k))||l.split(' ')[0]};
export function safety(patient,meds){
  const all=new Map();
  patient.homeMeds.forEach(m=>all.set(key(m),{name:m,ids:[]}));
  meds.filter(m=>m.status!=='stopped').forEach(m=>{const k=key(m.name);const o=all.get(k)||{name:m.name,ids:[]};o.ids.push(m.id);all.set(k,o)});
  const ks=[...all.keys()],flags=[];const add=(f)=>flags.push({id:'F'+flags.length,...f});
  for(let i=0;i<ks.length;i++)for(let j=i+1;j<ks.length;j++){
    const a=DRUGS[ks[i]],b=DRUGS[ks[j]];
    const p=PAIRS.find(([x,y])=>(x===a&&y===b)||(x===b&&y===a));
    if(p)add({severity:p[2],kind:'interaction',drugs:[ks[i],ks[j]],explanation:p[3],sourceIds:[...all.get(ks[i]).ids,...all.get(ks[j]).ids]});
    else if(a&&a===b)add({severity:'moderate',kind:'duplicate',drugs:[ks[i],ks[j]],explanation:`${ks[i]} and ${ks[j]} are the same type of medicine. You may not need both.`,sourceIds:[...all.get(ks[i]).ids,...all.get(ks[j]).ids]});
  }
  for(const k of ks)for(const al of patient.allergies)if(DRUGS[k]===al.toLowerCase())
    add({severity:'high',kind:'allergy',drugs:[k],explanation:`Patient is allergic to ${al}. ${k} is in that family.`,sourceIds:all.get(k).ids});
  return flags.map(flag => ({ ...flag, patientExplanation: plainWarning(flag) }));
}

function plainWarning(flag) {
  const names = flag.drugs.join(' and ');
  if (flag.kind === 'allergy') return `${names} may not be safe because of a recorded allergy. Ask the nurse or pharmacist before taking it.`;
  if (flag.kind === 'interaction') return `Taking ${names} together may be unsafe. Ask the nurse or pharmacist before taking either medicine.`;
  return `${names} may be medicines that do the same thing. Ask the nurse or pharmacist before taking both.`;
}
