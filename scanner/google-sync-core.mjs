/* Google Sheets scanner intake contract; pure functions and explicit schema. */
export const INTAKE_TAB = "Scanner_Intake";
export const INTAKE_HEADERS = Object.freeze([
  "Slot_Key","Batch_ID","Slot","Captured_At","Card_Name","Quantity","Target",
  "OCR_Raw","OCR_Confidence","Name_Review","Set_Code","Collector_No",
  "Finish","Photo_Hash","Import_Status","Notes"
]);
const safe=(x)=>String(x??"").slice(0,4000);
export function sheetIdFromInput(value){
  const s=String(value||"").trim();
  const match=s.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})\b/);
  if(match) return match[1];
  if(/^[a-zA-Z0-9_-]{20,}$/.test(s))return s;
  throw new Error("Paste a valid Google Sheets link or spreadsheet ID.");
}
export function validateBatchForPush(batch){
  if(!batch||typeof batch.id!=="string"||!batch.id.trim()||
      typeof batch.photoHash!=="string"||!batch.photoHash||
      !Array.isArray(batch.cards)||!batch.cards.length||batch.cards.length>15)throw new Error("Invalid saved photo batch.");
  const slots=new Set();
  for(const card of batch.cards){
    if(!Number.isInteger(card.slot)||card.slot<1||card.slot>15||slots.has(card.slot))throw new Error("Duplicate/invalid photo position in batch "+batch.id);
    if(!card.name||typeof card.name!=="string"||!card.name.trim())throw new Error("Missing card name in batch "+batch.id);
    if(card.review!=="CONFIRMED"&&card.review!=="ACCEPT")throw new Error("Unreviewed slot in batch "+batch.id);
    slots.add(card.slot);
  }
}
export function rowsForBatch(batch){
  validateBatchForPush(batch);
  return batch.cards.map(card=>[
    safe(batch.id)+"|"+String(card.slot).padStart(2,"0"),
    safe(batch.id),card.slot,safe(batch.createdAt),safe(card.name),
    1,batch.alsoDeck?"Vincent Valentine":"Collection only",
    safe(card.ocr),Number.isFinite(Number(card.confidence))?Number(card.confidence):"",
    safe(card.review),safe(card.set),safe(card.collector_number),safe(card.finish),
    safe(batch.photoHash),"PENDING_RECONCILIATION",
    "Physical printing, finish, language, condition and ownership conflicts require review before promoting to Collection or Deck_Cards"
  ]);
}
export function checkHeaders(actual){
  if(!Array.isArray(actual)||actual.length!==INTAKE_HEADERS.length ||
     actual.some((x,i)=>String(x??"")!==INTAKE_HEADERS[i]))
     throw new Error("Google Sheet Scanner_Intake headers differ from this scanner version. No rows written.");
}
export function remoteRowMap(matrix){
  const m=new Map();
  for(const [i,row] of (matrix||[]).entries()){
    if(i===0) continue;
    const key=String(row?.[0]??"").trim();
    if(!key)continue;
    if(m.has(key))throw new Error("Duplicate Slot_Key already exists in Google Sheet: "+key);
    m.set(key,row);
  }
  return m;
}
export function pendingForBatch(batch,existing){
  const fresh=[];
  let skipped=0;
  for(const row of rowsForBatch(batch)){
    const prior=existing.get(row[0]);
    if(prior){
      if(String(prior[4]??"")!==String(row[4]) || String(prior[6]??"")!==String(row[6]) ||
         String(prior[13]??"")!==String(row[13]))
        throw new Error("Photo batch conflicts with Google row for "+row[0]+". Resolve manually before syncing.");
      skipped++;
    }else fresh.push(row);
  }
  return {fresh,skipped};
}
