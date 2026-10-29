import test from "node:test";
import assert from "node:assert/strict";
import {normalizeName,buildNameIndex,candidates,project,cellUV,aggregateEntries,validateBatch,toCSV,SLOT_COUNT} from "../core.mjs";
test("normalizes card names without conflating distinct words",()=>{
 assert.equal(normalizeName("  Étali, Primal Storm  "),"etali primal storm");
 assert.equal(normalizeName("Fire // Ice"),"fire ice");
});
test("Scryfall candidate lookup resolves exact and near OCR matches",()=>{
 const ix=buildNameIndex(["Sol Ring","Lightning Bolt","Arcane Signet","Vincent Valentine","Fire // Ice"]);
 assert.deepEqual(candidates(ix,"Sol Ring").map(x=>x.name),["Sol Ring"]);
 assert.equal(candidates(ix,"Lightnig Bolt")[0].name,"Lightning Bolt");
 assert.equal(candidates(ix,"Fire")[0].name,"Fire // Ice");
 assert.equal(candidates(ix,""),[]);
});
test("rectangular and tilted photo geometry preserves every cell",()=>{
 const rect=[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];
 assert.deepEqual(project(.5,.5,rect),{x:.5,y:.5});
 for(let i=0;i<SLOT_COUNT;i++){
  const {u,v}=cellUV(i,.5,.5,.02);
  assert.ok(u>0&&u<1&&v>0&&v<1);
  const p=project(u,v,rect);
  assert.equal(p.x,u);assert.equal(p.y,v);
 }
 const tilted=[{x:.1,y:.08},{x:.95,y:.03},{x:.86,y:.93},{x:.03,y:.96}];
 assert.ok(Math.abs(project(1,1,tilted).x-.86)<1e-9);
 assert.throws(()=>cellUV(15,.2,.3));
});
test("requires explicit review of every slot",()=>{
 const slots=Array.from({length:15},(_,i)=>({status:"CONFIRMED",name:"Sol Ring"}));
 assert.deepEqual(validateBatch({slots}),[]);
 slots[5]={status:"REVIEW",name:"Sol Ring"};
 assert.equal(validateBatch({slots})[0],"Position 6 needs review");
 slots[5]={status:"EMPTY",name:""};
 assert.deepEqual(validateBatch({slots}),[]);
});
test("keeps collection and deck counts separate; repeated copies are counted",()=>{
 const batches=[
 {alsoDeck:true,cards:[{name:"Sol Ring"},{name:"Lightning Bolt"}]},
 {alsoDeck:false,cards:[{name:"Sol Ring"}]}
 ];
 assert.deepEqual(aggregateEntries(batches),[{name:"Lightning Bolt",quantity:1},{name:"Sol Ring",quantity:2}]);
 assert.deepEqual(aggregateEntries(batches,"deck"),[{name:"Lightning Bolt",quantity:1},{name:"Sol Ring",quantity:1}]);
});
test("CSV escapes punctuation, quotes and newlines",()=>{
 assert.equal(toCSV([{Name:'Jace, "the Mind Sculptor"',Notes:"two\nlines"}],["Name","Notes"]),
 'Name,Notes\r\n"Jace, ""the Mind Sculptor""","two\nlines"\r\n');
});
