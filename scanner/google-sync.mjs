import {INTAKE_HEADERS,INTAKE_TAB,sheetIdFromInput,checkHeaders,remoteRowMap,pendingForBatch} from "./google-sync-core.mjs";
const storeKey="cbdragons-google-settings-v1";
const $=id=>document.getElementById(id);
let token=null,expiresAt=0,working=false,config={clientId:"",sheetId:""};
const status=(text)=>{$("googleStatus").textContent=text};
const setWorking=(yes)=>{
 working=yes;
 ["googleConnect","googleTest","googlePush","googleSaveSettings"].forEach(id=>{const e=$(id);if(e)e.disabled=yes});
 if(!yes) updateButtons();
};
function updateButtons(){
 $("googlePush").disabled=working||!token;
 $("googleTest").disabled=working||!token;
 $("googleConnect").disabled=working;
}
function readSettings(){
 try{
   const s=JSON.parse(localStorage.getItem(storeKey)||"{}");
   config={clientId:s.clientId||"",sheetId:s.sheetId||""};
 }catch{}
 $("googleClientId").value=config.clientId;
 $("googleSheetId").value=config.sheetId;
}
function saveSettings(){
 const clientId=$("googleClientId").value.trim();
 if(!/^[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId))throw new Error("Paste your Google Cloud Web OAuth client ID (ends in .apps.googleusercontent.com).");
 const sheetId=sheetIdFromInput($("googleSheetId").value);
 if(clientId!==config.clientId || sheetId!==config.sheetId) {
   token=null;expiresAt=0;
 }
 config={clientId,sheetId};
 try{localStorage.setItem(storeKey,JSON.stringify(config))}
 catch{status("Browser couldn't save these settings; keep a copy before leaving.");}
 updateButtons();
 return config;
}
function requireToken(){
 if(!token||Date.now()>expiresAt-30000)throw new Error("Google sign-in expired. Tap Connect to Google again.");
 return token;
}
async function api(path,options={}){
 const access=requireToken();
 const response=await fetch("https://sheets.googleapis.com/v4/spreadsheets/"+config.sheetId+path,{
   ...options,
   headers:{"Authorization":"Bearer "+access,"Accept":"application/json",...(options.body?{"Content-Type":"application/json"}:{}),...(options.headers||{})}
 });
 const data=await response.json().catch(()=>({}));
 if(!response.ok){
   const reason=String(data?.error?.message||"Google Sheets error");
   if(response.status===401) {token=null;expiresAt=0;updateButtons()}
   throw new Error("Google Sheets "+response.status+": "+reason.slice(0,350));
 }
 return data;
}
const rangePath=(range)=>"/values/"+encodeURIComponent("'"+INTAKE_TAB+"'!"+range);
async function inspectSheet(){
 const metadata=await api("?fields=spreadsheetId,properties(title),sheets(properties(title,sheetId))");
 const tab=(metadata.sheets||[]).some(s=>s.properties?.title===INTAKE_TAB);
 if(!tab)throw new Error("This workbook has no Scanner_Intake tab. Open the master MTG Commander Database linked in the setup guide.");
 const data=await api(rangePath("A1:P1"));
 checkHeaders(data.values?.[0]);
 return metadata.properties?.title||"Google spreadsheet";
}
async function readRows(){
 const data=await api(rangePath("A1:P"));
 checkHeaders(data.values?.[0]);
 return remoteRowMap(data.values||[]);
}
async function appendRows(rows){
 if(!rows.length)return;
 const endpoint=rangePath("A:P")+":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS";
 // Never retry POST automatically if its outcome is ambiguous. Retrying the button
 // first fetches remote keys and sends only missing positions.
 const response=await api(endpoint,{method:"POST",body:JSON.stringify({majorDimension:"ROWS",values:rows})});
 if(Number(response.updates?.updatedRows)!==rows.length)throw new Error("Google did not confirm the full append. Recheck with Push again; it will inspect remote slot keys.");
}
async function authorizedConnect(){
 if(!window.google?.accounts?.oauth2?.initTokenClient)throw new Error("Google Identity Services did not load. Enable internet access or refresh the page.");
 const settings=saveSettings();
 const currentId=settings.clientId;
 const t=window.google.accounts.oauth2.initTokenClient({
   client_id:currentId,
   scope:"https://www.googleapis.com/auth/spreadsheets",
   callback:(response)=>{
     if(response.error||!response.access_token){status("Google authorization failed: "+String(response.error||"no token"));return}
     if(config.clientId!==currentId){status("Google settings changed; reconnect.");return}
     token=response.access_token;
     expiresAt=Date.now()+Math.max(60,Number(response.expires_in)||3600)*1000;
     status("Google connected for this browser session. Test the destination, then push saved batches.");
     updateButtons();
   },
   error_callback:(response)=>status("Google sign-in interrupted: "+String(response.type||"popup closed"))
 });
 t.requestAccessToken({prompt:"consent"});
}
function safeA(text){return String(text).replace(/[<>"'&]/g,"")}
function sheetLink(){
 return "https://docs.google.com/spreadsheets/d/"+encodeURIComponent(config.sheetId)+"/edit";
}
function updateLink(){
 const a=$("googleTargetLink");
 if(!config.sheetId){a.removeAttribute("href");a.textContent="No target configured";return}
 a.href=sheetLink()+"#gid=700111";
 a.textContent="Open Scanner_Intake in Google Sheets ↗";
}
export function initializeGoogleSync(getSavedBatches){
 readSettings();updateButtons();updateLink();
 $("googleSaveSettings").addEventListener("click",()=>{
   try{saveSettings();updateLink();status("Settings saved in this browser. Use Connect to Google to authorize writes.")}
   catch(err){status(err.message)}
 });
 $("googleConnect").addEventListener("click",async()=>{
   try{await authorizedConnect()}catch(err){status(err.message)}
 });
 $("googleTest").addEventListener("click",async()=>{
   try{
     saveSettings();setWorking(true);status("Checking Google Sheets permissions and intake headers…");
     const name=await inspectSheet();
     status("Verified destination: "+name+" → Scanner_Intake. No cards were written.");
     updateLink();
   }catch(err){status(err.message)}
   finally{setWorking(false)}
 });
 $("googlePush").addEventListener("click",async()=>{
   if(working)return;
   try{
     saveSettings();setWorking(true);
     const batches=getSavedBatches();
     if(!batches.length)throw new Error("No locally saved batches. Scan, confirm, and save a photo first.");
     const n=batches.reduce((sum,b)=>sum+(b.cards?.length||0),0);
     const decision=window.confirm("Push "+n+" saved card slots from "+batches.length+" batch(es) to the Scanner_Intake tab? This does not modify authoritative Collection or Deck_Cards.");
     if(!decision)return;
     status("Checking destination…");
     await inspectSheet();
     let existing=await readRows();
     let pushed=0,skipped=0;
     for(let i=0;i<batches.length;i++){
       const b=batches[i];
       const pending=pendingForBatch(b,existing);
       skipped+=pending.skipped;
       if(pending.fresh.length){
         status("Uploading batch "+(i+1)+"/"+batches.length+" ("+pending.fresh.length+" new slots)…");
         await appendRows(pending.fresh);
         for(const row of pending.fresh)existing.set(row[0],row);
         pushed+=pending.fresh.length;
       }
     }
     // Read Google back; don't report success on HTTP 200 alone.
     status("Verifying saved positions in Google Sheets…");
     const verified=await readRows();
     for(const b of batches){
       const p=pendingForBatch(b,verified);
       if(p.fresh.length)throw new Error("Google readback is missing "+p.fresh.length+" expected card positions. Retry to reconcile.");
     }
     status("Verified: "+pushed+" new card positions saved to Scanner_Intake; "+skipped+" previously imported positions skipped. Open the Sheet to review and promote them.");
     updateLink();
   }catch(err){status("Push stopped: "+err.message+". Existing rows are not rolled back; retry safely after resolving the issue.")}
   finally{setWorking(false)}
 });
}
