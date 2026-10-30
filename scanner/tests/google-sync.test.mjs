import test from "node:test";
import assert from "node:assert/strict";
import {INTAKE_HEADERS,checkHeaders,sheetIdFromInput,rowsForBatch,remoteRowMap,pendingForBatch} from "../google-sync-core.mjs";
const example=()=>({
  id:"batch-123",createdAt:"2026-10-29T20:00:00Z",photoHash:"abc123",alsoDeck:true,
  cards:[{slot:1,name:"Sol Ring",review:"ACCEPT",ocr:"Sol Ring",confidence:95},
         {slot:4,name:"Vincent Valentine",review:"CONFIRMED",ocr:"Vincent Valentine",confidence:84}]
});
test("parse Google Sheets link and reject other URLs",()=>{
 const id="1HX0qF4aS_9JnUFvOpSb2VwPpqfycj0HDzuhjPs7WCYM";
 assert.equal(sheetIdFromInput("https://docs.google.com/spreadsheets/d/"+id+"/edit#gid=700111"),id);
 assert.equal(sheetIdFromInput(id),id);
 assert.throws(()=>sheetIdFromInput("https://evil.example/spreadsheets/d/"+id));
 assert.throws(()=>sheetIdFromInput("https://docs.google.com/document/d/"+id+"/edit"));
});
test("requires exact Scanner_Intake headers",()=>{
 assert.doesNotThrow(()=>checkHeaders([...INTAKE_HEADERS]));
 assert.throws(()=>checkHeaders([...INTAKE_HEADERS].reverse()));
});
test("one row per named reviewed physical card",()=>{
 const rows=rowsForBatch(example());
 assert.equal(rows.length,2);
 assert.equal(rows[0][0],"batch-123|01");
 assert.equal(rows[1][0],"batch-123|04");
 assert.equal(rows[0][6],"Vincent Valentine");
 assert.equal(rows[0][10],"");
 assert.equal(rows[0][14],"PENDING_RECONCILIATION");
 assert.throws(()=>rowsForBatch({...example(),cards:[{slot:3,name:"Sol Ring",review:"REVIEW"}]}));
 assert.throws(()=>rowsForBatch({...example(),cards:[{slot:1,name:"Sol Ring",review:"CONFIRMED"},{slot:1,name:"Island",review:"CONFIRMED"}]}));
});
test("retry skips already imported positions and detects conflicting edits",()=>{
 const batch=example();
 const expected=rowsForBatch(batch);
 const remote=remoteRowMap([INTAKE_HEADERS,expected[0]]);
 const r=pendingForBatch(batch,remote);
 assert.equal(r.skipped,1);
 assert.equal(r.fresh.length,1);
 assert.equal(r.fresh[0][4],"Vincent Valentine");
 const full=remoteRowMap([INTAKE_HEADERS,...expected]);
 assert.deepEqual(pendingForBatch(batch,full),{fresh:[],skipped:2});
 const corrupted=[...expected[0]];corrupted[4]="Lightning Bolt";
 assert.throws(()=>pendingForBatch(batch,remoteRowMap([INTAKE_HEADERS,corrupted])),/conflicts/);
 assert.throws(()=>remoteRowMap([INTAKE_HEADERS,expected[0],expected[0]]),/Duplicate Slot_Key/);
});
test("collection-only record cannot silently become Vincent deck record",()=>{
 const old=example();old.alsoDeck=false;
 const remote=remoteRowMap([INTAKE_HEADERS,...rowsForBatch(old)]);
 assert.throws(()=>pendingForBatch(example(),remote),/conflicts/);
});
