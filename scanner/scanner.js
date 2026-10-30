import {COLS,ROWS,SLOT_COUNT,buildNameIndex,candidates,normalizeName,project,cellUV,aggregateEntries,toCSV,validateBatch} from "./core.mjs";
import {initializeGoogleSync} from "./google-sync.mjs";
const el=id=>document.getElementById(id);
const STORAGE="cbdragons-scanner-v1";
const CATALOG="cbdragons-scryfall-cardnames-v1";
const state={
  source:null, corners:null, slots:[],photoHash:null,nameIndex:null,names:[],
  batches:[], worker:null, run:0, dragging:-1, busy:false
};
function notice(id,text){el(id).textContent=text}
function setBusy(busy){state.busy=busy; el("photoInput").disabled=busy;el("cropButton").disabled=busy||!state.source;el("scanButton").disabled=busy||state.slots.length!==SLOT_COUNT;el("resetCorners").disabled=busy||!state.source;el("gap").disabled=busy;updateReview();}
function storageRead(){try{const data=JSON.parse(localStorage.getItem(STORAGE)||"{}");state.batches=Array.isArray(data.batches)?data.batches:[]}catch{state.batches=[]}}
function storageWrite(){
  try{localStorage.setItem(STORAGE,JSON.stringify({version:1,batches:state.batches}))}
  catch(e){throw Error("Browser storage is full or unavailable. Export a JSON backup before leaving; save was not completed: "+e.message)}
}
function bytesToHex(bytes){return [...bytes].map(b=>b.toString(16).padStart(2,"0")).join("")}
async function fingerprint(file){
  const bytes=await file.arrayBuffer();
  if(globalThis.crypto?.subtle) return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)));
  const a=new Uint8Array(bytes);let n=2166136261;
  for(let i=0;i<a.length;i++)n=Math.imul(n^a[i],16777619);
  return "fnv1a-"+(n>>>0).toString(16)+"-"+a.length;
}
function download(filename,content,type){
  const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
async function loadCatalog(){
  try{
    const cached=JSON.parse(localStorage.getItem(CATALOG)||"null");
    if(cached?.names?.length>20000 && Date.now()-cached.at<7*24*3600*1000) {
      state.names=cached.names;state.nameIndex=buildNameIndex(cached.names);
      return;
    }
  }catch{}
  const reply=await fetch("https://api.scryfall.com/catalog/card-names",{headers:{"Accept":"application/json"}});
  if(!reply.ok)throw Error("Scryfall name catalog HTTP "+reply.status);
  const json=await reply.json();
  if(!Array.isArray(json.data)||json.data.length<20000)throw Error("Unexpected Scryfall name catalog");
  state.names=json.data;state.nameIndex=buildNameIndex(json.data);
  try{localStorage.setItem(CATALOG,JSON.stringify({at:Date.now(),names:json.data}))}catch{}
}
function resizeImage(img){
  const scale=Math.min(1,4800/Math.max(img.naturalWidth,img.naturalHeight),Math.sqrt(20000000/(img.naturalWidth*img.naturalHeight)));
  const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  canvas.getContext("2d",{willReadFrequently:true}).drawImage(img,0,0,canvas.width,canvas.height);
  return canvas;
}
function defaultCorners(){return [{x:.055,y:.075},{x:.945,y:.075},{x:.945,y:.925},{x:.055,y:.925}]}
function invalidateCrops(){
  if(state.slots.length){
    state.slots=[];renderCards();
    notice("workStatus","Alignment changed. Crop again before scanning or saving.");
  }
}
function drawPreview(){
  const p=el("preview"),c=state.source;
  if(!c)return;
  const w=Math.min(950,c.width);p.width=w;p.height=Math.round(w*c.height/c.width);
  const ctx=p.getContext("2d");ctx.drawImage(c,0,0,p.width,p.height);
  const pt=(u,v)=>{let r=project(u,v,state.corners);return {x:r.x*p.width,y:r.y*p.height}};
  ctx.strokeStyle="#ffcb73";ctx.lineWidth=2;ctx.shadowColor="#130a1e";ctx.shadowBlur=3;
  for(let row=0;row<=ROWS;row++){ctx.beginPath();for(let col=0;col<=COLS;col++){const q=pt(col/COLS,row/ROWS);if(col===0)ctx.moveTo(q.x,q.y);else ctx.lineTo(q.x,q.y)}ctx.stroke()}
  for(let col=0;col<=COLS;col++){ctx.beginPath();for(let row=0;row<=ROWS;row++){const q=pt(col/COLS,row/ROWS);if(row===0)ctx.moveTo(q.x,q.y);else ctx.lineTo(q.x,q.y)}ctx.stroke()}
  ctx.shadowBlur=0;
  state.corners.forEach((q,i)=>{ctx.fillStyle="#ffcb73";ctx.strokeStyle="#17121f";ctx.lineWidth=3;ctx.beginPath();ctx.arc(q.x*p.width,q.y*p.height,9,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.font="bold 13px system-ui";ctx.fillStyle="#17121f";ctx.textAlign="center";ctx.fillText(String(i+1),q.x*p.width,q.y*p.height+4)});
  for(let i=0;i<SLOT_COUNT;i++){const row=Math.floor(i/COLS),col=i%COLS,q=pt((col+.5)/COLS,(row+.5)/ROWS);ctx.font="bold 17px system-ui";ctx.fillStyle="#ffdfac";ctx.strokeStyle="#251224";ctx.lineWidth=3;ctx.strokeText(String(i+1),q.x,q.y);ctx.fillText(String(i+1),q.x,q.y)}
}
function pointerPos(e){const p=el("preview"),r=p.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height}}
el("preview").addEventListener("pointerdown",e=>{
  if(!state.source||state.busy)return;
  const p=pointerPos(e),r=el("preview").getBoundingClientRect();
  let best=-1,dist=Infinity;
  state.corners.forEach((q,i)=>{const d=Math.hypot((q.x-p.x)*r.width,(q.y-p.y)*r.height);if(d<dist){dist=d;best=i}});
  if(dist>72)return;
  state.dragging=best;e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();
});
el("preview").addEventListener("pointermove",e=>{
  if(state.dragging<0)return;
  const p=pointerPos(e);
  state.corners[state.dragging]={x:Math.max(.001,Math.min(.999,p.x)),y:Math.max(.001,Math.min(.999,p.y))};
  invalidateCrops();
  try{drawPreview()}catch{}
  e.preventDefault();
});
function finishDrag(){state.dragging=-1}
el("preview").addEventListener("pointerup",finishDrag);
el("preview").addEventListener("pointercancel",finishDrag);
el("resetCorners").addEventListener("click",()=>{state.corners=defaultCorners();invalidateCrops();drawPreview()});
el("gap").addEventListener("input",()=>{el("gapValue").textContent=el("gap").value+"%";invalidateCrops()});

el("photoInput").addEventListener("change",async e=>{
  const file=e.target.files?.[0];if(!file)return;
  state.run++;const run=state.run;
  notice("photoStatus","Opening "+file.name+"…");state.slots=[];renderCards();
  setBusy(true);
  try{
    if(!file.type.startsWith("image/"))throw Error("Please choose a photo image.");
    const url=URL.createObjectURL(file);
    let img;
    try{
      img=new Image();img.src=url;await img.decode();
      if(run!==state.run)return;
      state.source=resizeImage(img);
    }finally{URL.revokeObjectURL(url)}
    state.photoHash=await fingerprint(file);
    state.corners=defaultCorners();
    notice("photoStatus",state.source.width+" × "+state.source.height+" px · "+file.name);
    notice("workStatus",state.batches.some(b=>b.photoHash===state.photoHash)?"This photo was already saved. Reimport will be blocked.":"Drag corners, then crop.");
    drawPreview();
  }catch(err){notice("photoStatus","Could not open photo: "+err.message);state.source=null;state.photoHash=null}
  finally{setBusy(false)}
});

function cropOne(srcPixels,slot,gap){
  const w=480,h=670,cv=document.createElement("canvas");cv.width=w;cv.height=h;
  const ctx=cv.getContext("2d",{willReadFrequently:true}),dst=ctx.createImageData(w,h);
  const sw=srcPixels.width,sh=srcPixels.height,source=srcPixels.data,out=dst.data;
  let o=0;
  for(let y=0;y<h;y++){
    const fy=(y+.5)/h;
    for(let x=0;x<w;x++){
      const {u,v}=cellUV(slot,(x+.5)/w,fy,gap);
      const q=project(u,v,state.corners);
      const ix=Math.round(q.x*sw),iy=Math.round(q.y*sh);
      if(ix>=0&&ix<sw&&iy>=0&&iy<sh){
        const k=(iy*sw+ix)*4;out[o]=source[k];out[o+1]=source[k+1];out[o+2]=source[k+2];out[o+3]=255;
      }else{out[o]=25;out[o+1]=19;out[o+2]=29;out[o+3]=255}
      o+=4;
    }
  }
  ctx.putImageData(dst,0,0);
  return cv;
}
el("cropButton").addEventListener("click",async ()=>{
  if(!state.source||state.busy)return;setBusy(true);
  const gap=Number(el("gap").value)/100;
  try{
    const context=state.source.getContext("2d",{willReadFrequently:true});
    const pixels=context.getImageData(0,0,state.source.width,state.source.height);
    const entries=[];
    for(let i=0;i<SLOT_COUNT;i++){
      entries.push({slot:i+1,crop:cropOne(pixels,i,gap),name:"",raw:"",confidence:0,status:"REVIEW",options:[]});
      if(i%3===2){notice("workStatus","Cropping "+(i+1)+"/15…");await new Promise(r=>setTimeout(r,0))}
    }
    state.slots=entries;renderCards();
    notice("workStatus","15 crops ready. Inspect each crop, adjust corners if needed, then run OCR.");
  }catch(err){notice("workStatus","Crop failed: "+err.message)}
  finally{setBusy(false)}
});
function makeTitleCrop(card){
  const cv=document.createElement("canvas");cv.width=960;cv.height=210;
  const ctx=cv.getContext("2d");ctx.fillStyle="#ffffff";ctx.fillRect(0,0,cv.width,cv.height);
  ctx.imageSmoothingEnabled=true;ctx.drawImage(card,22,16,436,112,0,0,960,210);
  return cv;
}
async function makeWorker(){
  if(state.worker)return state.worker;
  if(!window.Tesseract?.createWorker)throw Error("OCR library could not load (internet connection required). You can still confirm names manually.");
  state.worker=await window.Tesseract.createWorker("eng",1);
  await state.worker.setParameters({tessedit_pageseg_mode:"7",preserve_interword_spaces:"1"});
  return state.worker;
}
el("scanButton").addEventListener("click",async ()=>{
  if(state.slots.length!==SLOT_COUNT||state.busy)return;
  setBusy(true);const current=++state.run;
  try{
    notice("workStatus","Loading Scryfall card names…");
    try{if(!state.nameIndex)await loadCatalog()}catch(err){notice("workStatus","Name catalog unavailable: "+err.message+". Manual review still possible after catalog loads.");}
    notice("workStatus","Loading OCR worker…");
    const worker=await makeWorker();
    for(let i=0;i<SLOT_COUNT;i++){
      if(current!==state.run)break;
      const slot=state.slots[i];notice("workStatus","Reading title "+(i+1)+"/15…");
      try{
        const result=await worker.recognize(makeTitleCrop(slot.crop));
        slot.raw=String(result.data.text||"").replace(/\s+/g," ").trim();
        slot.confidence=Number(result.data.confidence)||0;
        slot.options=candidates(state.nameIndex,slot.raw,3);
        const first=slot.options[0];
        slot.name=first?.name||"";
        slot.status=first?.exact && slot.options.length===1 && normalizeName(first.name)===normalizeName(slot.raw) && slot.confidence>=90 ? "ACCEPT" : "REVIEW";
      }catch(err){slot.raw="OCR error: "+err.message;slot.status="REVIEW";}
      renderCards();await new Promise(r=>setTimeout(r,0));
    }
    notice("workStatus","OCR completed. Confirm uncertain slots, then save the batch.");
  }catch(err){notice("workStatus","OCR unavailable: "+err.message+" Fill and verify names manually if the Scryfall catalog loaded.");renderCards()}
  finally{setBusy(false)}
});
function applyManual(slot,text){
  if(!state.nameIndex){notice("saveStatus","Scryfall names not loaded yet. Retry 'Read 15 titles' while connected.");return;}
  const result=state.nameIndex.exact.get(normalizeName(text))||[];
  const canonical=result.find(n=>normalizeName(n)===normalizeName(text));
  if(!canonical){slot.status="REVIEW";slot.name=text;notice("saveStatus","No exact Scryfall card name matched. Pick a suggested name or correct the spelling.");renderCards();return}
  slot.name=canonical;slot.status="CONFIRMED";notice("saveStatus","Confirmed "+canonical);renderCards();
}
function renderCards(){
  const root=el("cardGrid");root.replaceChildren();
  if(state.slots.length!==SLOT_COUNT){const p=document.createElement("p");p.className="muted";p.textContent="Upload and crop a photograph to show the 15 slots.";root.append(p);updateReview();return}
  state.slots.forEach((slot,i)=>{
    const tile=document.createElement("article");tile.className="card-tile status-"+slot.status;
    tile.innerHTML='<div class="slot-head"><b>POSITION '+(i+1)+'</b><span class="state"></span></div><canvas width="240" height="335"></canvas><label>Card name</label><input type="text" placeholder="Exact Scryfall card name"><div class="ocr-note"></div><div class="suggestions"></div><div class="row"><button type="button" class="small-action confirm">Confirm name</button><button type="button" class="small-action secondary empty">Empty slot</button></div><div class="row"><a class="scryfall" target="_blank" rel="noopener noreferrer">Verify on Scryfall ↗</a></div>';
    tile.querySelector(".state").textContent=slot.status;
    tile.querySelector("canvas").getContext("2d").drawImage(slot.crop,0,0,240,335);
    const input=tile.querySelector("input");input.value=slot.name;
    if(slot.status==="EMPTY")input.disabled=true;
    tile.querySelector(".ocr-note").textContent=slot.raw ? 'OCR: "'+slot.raw+'" ('+Math.round(slot.confidence)+'%)' : "OCR not run / no title read";
    const suggestions=tile.querySelector(".suggestions");
    for(const candidate of slot.options){
      const b=document.createElement("button");b.type="button";b.textContent=candidate.name;b.title="Choose this Scryfall catalog name";
      b.addEventListener("click",()=>applyManual(slot,candidate.name));suggestions.append(b);
    }
    tile.querySelector(".confirm").addEventListener("click",()=>applyManual(slot,input.value));
    tile.querySelector(".empty").textContent=slot.status==="EMPTY"?"Restore slot":"Empty slot";
    tile.querySelector(".empty").addEventListener("click",()=>{slot.status=slot.status==="EMPTY"?"REVIEW":"EMPTY";if(slot.status==="EMPTY")slot.name="";renderCards()});
    const link=tile.querySelector(".scryfall");
    const name=slot.name||slot.raw;
    if(name)link.href="https://scryfall.com/search?q="+encodeURIComponent("!"+'"'+name+'"');else{link.removeAttribute("href");link.textContent="No name yet";}
    root.append(tile);
  });
  updateReview();
}
function updateReview(){
  const count=state.slots.filter(s=>s.status==="ACCEPT"||s.status==="CONFIRMED"||s.status==="EMPTY").length;
  notice("reviewCount",count+" / 15 reviewed");
  el("saveBatch").disabled=state.busy||state.slots.length!==SLOT_COUNT||count!==SLOT_COUNT||state.slots.every(s=>s.status==="EMPTY");
}
el("saveBatch").addEventListener("click",()=>{
  if(state.busy)return;
  const checks=validateBatch({slots:state.slots});if(checks.length){notice("saveStatus",checks[0]);return}
  if(!state.nameIndex){notice("saveStatus","Scryfall catalog is required before saving verified names.");return}
  if(state.batches.some(b=>b.photoHash===state.photoHash)){notice("saveStatus","Already saved this exact photograph. Duplicate import blocked.");return}
  const alsoDeck=el("alsoDeck").checked;
  const cards=state.slots.filter(s=>s.status!=="EMPTY").map(s=>({name:s.name,slot:s.slot,ocr:s.raw,confidence:s.confidence,review:s.status,set:null,collector_number:null,finish:null}));
  const batch={id:globalThis.crypto?.randomUUID?.()||"batch-"+Date.now()+"-"+Math.random().toString(36).slice(2),photoHash:state.photoHash,createdAt:new Date().toISOString(),alsoDeck,cards};
  state.batches.push(batch);
  try{storageWrite()}catch(e){state.batches.pop();notice("saveStatus",e.message);return}
  notice("saveStatus","Saved "+cards.length+" physical cards. "+(alsoDeck?"Included in the Vincent deck.":"Collection only.")+" Export a backup to preserve the data.");
  showInventory();
});
function showInventory(){
  const all=aggregateEntries(state.batches),deck=aggregateEntries(state.batches,"deck");
  notice("inventoryStats",all.reduce((n,r)=>n+r.quantity,0)+" physical cards · "+deck.reduce((n,r)=>n+r.quantity,0)+" deck entries · "+state.batches.length+" batches");
  const list=el("inventoryList");list.replaceChildren();
  if(!all.length)list.textContent="No cards saved yet.";
  for(const row of all){const p=document.createElement("div");p.className="inventory-row";const name=document.createElement("span");name.textContent=row.name;const qty=document.createElement("b");qty.textContent="×"+row.quantity;p.append(name,qty);list.append(p)}
  const history=el("batchHistory");history.replaceChildren();if(!state.batches.length)history.textContent="No saved batches.";
  for(const b of [...state.batches].reverse().slice(0,20)){
    const p=document.createElement("div");p.className="inventory-row";
    const label=document.createElement("span");label.textContent=new Date(b.createdAt).toLocaleString()+" · "+b.cards.length+" cards";
    const type=document.createElement("span");type.textContent=b.alsoDeck?"Deck + collection":"Collection";
    p.append(label,type);history.append(p);
  }
}
el("exportCollection").addEventListener("click",()=>{
  const rows=aggregateEntries(state.batches).map(r=>({"Name":r.name,"Set code":"","Collector number":"","Quantity":r.quantity,"Foil":"","Condition":"","Language":"","Location":"Unsorted","Notes":"Printing/finish/condition unverified; reconcile before importing to master collection"}));
  download("cbdragons-collection-names.csv",toCSV(rows,["Name","Set code","Collector number","Quantity","Foil","Condition","Language","Location","Notes"]),"text/csv;charset=utf-8");
});
el("exportDeck").addEventListener("click",()=>{
  const rows=aggregateEntries(state.batches,"deck");
  const others=rows.filter(r=>!(r.name==="Vincent Valentine"||r.name.startsWith("Vincent Valentine //")));
  download("vincent-valentine-scanned-deck.txt","# Planned commander (physical ownership not verified)\n1 Vincent Valentine\n\n# Scanned deck entries\n"+others.map(r=>r.quantity+" "+r.name).join("\n")+"\n","text/plain;charset=utf-8");
});
el("exportBackup").addEventListener("click",()=>download("cbdragons-scanner-backup-"+new Date().toISOString().slice(0,10)+".json",JSON.stringify({format:"cbdragons-scanner-backup",version:1,commander:"Vincent Valentine",batches:state.batches},null,2),"application/json"));
el("importBackup").addEventListener("change",async e=>{
  const f=e.target.files?.[0];if(!f)return;
  try{
    const backup=JSON.parse(await f.text());
    if(backup.format!=="cbdragons-scanner-backup"||backup.version!==1||!Array.isArray(backup.batches))throw Error("Not a CBDRAGONS v1 scanner backup");
    const batches=backup.batches;
    for(const b of batches){
      if(typeof b.id!=="string"||typeof b.photoHash!=="string"||!Array.isArray(b.cards)||b.cards.length>SLOT_COUNT)throw Error("Invalid batch structure");
      for(const card of b.cards)if(typeof card.name!=="string"||!card.name.trim()||card.name.length>180)throw Error("Invalid saved card");
    }
    const ids=new Set(),hashes=new Set();
    for(const b of batches){if(ids.has(b.id)||hashes.has(b.photoHash))throw Error("Duplicate batch in backup");ids.add(b.id);hashes.add(b.photoHash)}
    if(!window.confirm("Replace all "+state.batches.length+" locally saved batches with "+batches.length+" from this backup? Download your current backup first."))return;
    const previous=state.batches;state.batches=batches;
    try{storageWrite()}catch(err){state.batches=previous;throw err}
    showInventory();notice("saveStatus","Imported "+batches.length+" saved batches.");
  }catch(err){notice("saveStatus","Import failed: "+err.message)}
  finally{e.target.value=""}
});
storageRead();showInventory();renderCards();
initializeGoogleSync(()=>state.batches.map(b=>({...b,cards:b.cards.map(c=>({...c}))})));
notice("workStatus","Scryfall names will load when you scan. Photos remain on your device.");
// Preload names quietly; the app remains usable for cropping when offline.
loadCatalog().then(()=>notice("workStatus","Scryfall name index ready. Choose a photograph.")).catch(()=>notice("workStatus","Scryfall names unavailable. Cropping still works; saving requires the catalog."));
