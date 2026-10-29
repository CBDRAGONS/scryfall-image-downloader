/* CBDRAGONS 15-card photo scanner: pure helpers (testable in Node). */
export const COLS = 5;
export const ROWS = 3;
export const SLOT_COUNT = 15;

export function normalizeName(text) {
  return String(text || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'").replace(/[—–]/g, "-")
    .replace(/[^a-zA-Z0-9]+/g, " ").trim().replace(/\s+/g, " ").toLowerCase();
}
export function trigrams(text) {
  const v = " " + normalizeName(text) + " ";
  const out = new Set();
  for (let i = 0; i + 3 <= v.length; i++) out.add(v.slice(i, i + 3));
  return out;
}
export function levenshtein(a, b) {
  if (a === b) return 0;
  if (a.length > b.length) [a,b] = [b,a];
  const row = Array.from({length: a.length + 1}, (_,i) => i);
  for (let j=1; j<=b.length; j++) {
    let previous = row[0]; row[0] = j;
    for (let i=1; i<=a.length; i++) {
      const old = row[i];
      row[i] = Math.min(row[i]+1, row[i-1]+1, previous + (a[i-1]===b[j-1]?0:1));
      previous = old;
    }
  }
  return row[a.length];
}
export function buildNameIndex(names) {
  const exact = new Map(), grams = new Map(), normalized = new Map();
  for (const name of names) {
    if (typeof name !== "string" || !name.trim()) continue;
    const aliases = [name];
    if (name.includes(" // ")) aliases.push(name.split(" // ")[0]);
    for (const alias of aliases) {
      const n=normalizeName(alias);
      if (!n) continue;
      if (!exact.has(n)) exact.set(n, []);
      if (!exact.get(n).includes(name)) exact.get(n).push(name);
      if (normalized.has(name)) continue;
    }
    const n = normalizeName(name); normalized.set(name, n);
    for (const g of trigrams(n)) {
      if (!grams.has(g)) grams.set(g,new Set());
      grams.get(g).add(name);
    }
    // Also index front faces as candidate hints.
    if (aliases.length>1) for (const g of trigrams(aliases[1])) {
      if (!grams.has(g)) grams.set(g,new Set());
      grams.get(g).add(name);
    }
  }
  return { exact, grams, normalized };
}
export function candidates(index, raw, limit=3) {
  const q=normalizeName(raw);
  if (!q || !index) return [];
  const exact=index.exact.get(q);
  if (exact && exact.length) return exact.map(name=>({name,score:1,exact:true})).slice(0,limit);
  const counts=new Map();
  const qgrams=trigrams(q);
  for (const g of qgrams) for(const name of index.grams.get(g)||[]) {
    counts.set(name,(counts.get(name)||0)+1);
  }
  return [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,120)
    .map(([name,overlap])=>{
      const n=index.normalized.get(name) || normalizeName(name);
      const distance=levenshtein(q,n);
      const edit = 1-distance/Math.max(q.length,n.length,1);
      const dice = 2*overlap/(qgrams.size+trigrams(n).size);
      return {name,score:Math.max(0,0.8*edit+0.2*dice),exact:false};
    }).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name))
    .slice(0,limit);
}
export function project(u,v,corners) {
  if (!Array.isArray(corners) || corners.length!==4) throw Error("Four mat corners required");
  const [p0,p1,p2,p3]=corners;
  const dx1=p1.x-p2.x, dx2=p3.x-p2.x, dx3=p0.x-p1.x+p2.x-p3.x;
  const dy1=p1.y-p2.y, dy2=p3.y-p2.y, dy3=p0.y-p1.y+p2.y-p3.y;
  const denom=dx1*dy2-dx2*dy1;
  if (Math.abs(denom)<1e-12) throw Error("Invalid mat corners");
  const g=(dx3*dy2-dx2*dy3)/denom;
  const h=(dx1*dy3-dx3*dy1)/denom;
  const scale=g*u+h*v+1;
  return {
    x:((p1.x-p0.x+g*p1.x)*u+(p3.x-p0.x+h*p3.x)*v+p0.x)/scale,
    y:((p1.y-p0.y+g*p1.y)*u+(p3.y-p0.y+h*p3.y)*v+p0.y)/scale
  };
}
export function cellUV(slot,x,y,gap=0.015) {
  if (!Number.isInteger(slot)||slot<0||slot>=SLOT_COUNT) throw Error("Invalid slot");
  const row=Math.floor(slot/COLS), col=slot%COLS;
  const g=Math.max(0,Math.min(0.12,Number(gap)||0));
  return {u:(col+g+x*(1-2*g))/COLS, v:(row+g+y*(1-2*g))/ROWS};
}
export function isAccepted(result) {
  return Boolean(result && (result.status==="ACCEPT" || result.status==="CONFIRMED" || result.status==="EMPTY"));
}
export function csvEscape(value) {
  const v=String(value??"");
  return /[",\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;
}
export function toCSV(rows,fields) {
  return [fields.map(csvEscape).join(","),...rows.map(row=>fields.map(f=>csvEscape(row[f])).join(","))].join("\r\n")+"\r\n";
}
export function aggregateEntries(batches, scope="collection") {
  const quantities=new Map();
  for(const batch of batches) {
    if(scope==="deck" && !batch.alsoDeck) continue;
    for(const card of batch.cards||[]) {
      if(!card.name) continue;
      const key=card.name;
      quantities.set(key,(quantities.get(key)||0)+1);
    }
  }
  return [...quantities.entries()].sort(([a],[b])=>a.localeCompare(b))
    .map(([name,quantity])=>({name,quantity}));
}
export function validateBatch(batch) {
  if(!batch || !Array.isArray(batch.slots)||batch.slots.length!==SLOT_COUNT)
    throw Error("A batch requires exactly 15 slots");
  const errors=[];
  batch.slots.forEach((slot,i)=>{
    if (!isAccepted(slot)) errors.push("Position "+(i+1)+" needs review");
    if(slot.status!=="EMPTY" && !slot.name) errors.push("Position "+(i+1)+" has no card name");
  });
  return errors;
}
