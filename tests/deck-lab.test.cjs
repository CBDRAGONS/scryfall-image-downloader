// Node built-ins only: commander-first Deck Lab regression tests.
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','deck-lab.js'),'utf8');
const context={window:{}};
vm.runInNewContext(source,context,{filename:'deck-lab.js'});
const lib=context.window.DeckLabCore;
const sample=fs.readFileSync(path.join(__dirname,'..','decks','the-mimeoplasm.txt'),'utf8');
const commander={
 name:'The Mimeoplasm', type_line:'Legendary Creature — Ooze',
 color_identity:['B','G','U'],
 oracle_text:'As The Mimeoplasm enters the battlefield, you may exile two creature cards from graveyards. If you do, it enters the battlefield as a copy of one of those cards with a number of additional +1/+1 counters on it equal to the power of the other card.'
};
function card(name,oracle_text,identity,kind){
 return {name,oracle_text,color_identity:identity||['G'],cmc:2,type_line:kind||'Creature — Human',legalities:{commander:'legal'}};
}
test('saved Mimeoplasm import is 100 cards, commander separated, with no line errors',()=>{
 const parsed=lib.parseDeck(sample,'The Mimeoplasm');
 assert.equal(parsed.total,100);
 assert.equal(parsed.cards.length,87);
 assert.equal(parsed.main.length,86);
 assert.equal(parsed.issues.length,0);
 assert.equal(parsed.cards.find(c=>c.name==='The Mimeoplasm').section,'commander');
 assert.equal(parsed.cards.find(c=>c.name==='Forest').quantity,5);
 assert.equal(parsed.cards.find(c=>c.name==='Swamp').quantity,7);
});
test('Moxfield foil/set notation is parsed, creature-type header is not a card',()=>{
 const parsed=lib.parseDeck('[COMMANDER]\n1 The Mimeoplasm\n[MAINBOARD]\n1 Sol Ring (CMM) 390 *F*\n1 Arcane Signet (CMM) 356','The Mimeoplasm');
 assert.equal(parsed.total,3);
 assert.equal(parsed.cards[1].name,'Sol Ring');
 assert.equal(parsed.cards[2].name,'Arcane Signet');
});
test('commander mechanics determine offered directions',()=>{
 const p=lib.priorities(commander);
 assert.equal(p.find(x=>x.id==='graveyard').w,3);
 assert.equal(p.find(x=>x.id==='copy').w,3);
 assert.equal(p.find(x=>x.id==='counters').w,3);
 assert.equal(p.find(x=>x.id==='selfmill').inferred,true);
 assert.equal(p.some(x=>x.id==='blink'&&x.w===3),false);
});
test('color identity and Commander legality filter suggestions',()=>{
 const deck=lib.parseDeck(sample,'The Mimeoplasm');
 const fixtures=[
  card("Stitcher's Supplier",'When this creature enters the battlefield or dies, mill three cards.',['B']),
  card('White Gravekeeper','Mill two cards, then return a card from your graveyard.',['W']),
  card('Banned Gravekeeper','Mill three cards.',['U']),
  card('Merfolk Navigator','This Merfolk has islandwalk.',['U'],'Creature — Merfolk'),
  card('Merfolk Warleader','Other Merfolk you control get +1/+1.',['U'],'Creature — Merfolk'),
 ];
 fixtures[2].legalities.commander='banned';
 const by_name={},cards={};
 fixtures.forEach((c,i)=>{by_name[c.name.toLowerCase()]=String(i);cards[i]=c});
 const db={by_name,cards};
 const added=lib.recommend(db,commander,deck,'selfmill',null).add;
 assert.deepEqual(Array.from(added,x=>x.card.name),["Stitcher's Supplier"]);
 const tribal=lib.recommend(db,commander,deck,'tribal','Merfolk').add;
 assert.equal(tribal.length,2);
 assert.equal(tribal.every(x=>x.score.focusFit===100),true);
});
test('scores are deterministic and expose commander/request/need inputs',()=>{
 const p=lib.priorities(commander);
 const candidate=card("Stitcher's Supplier",'When this creature dies, mill three cards.',['B']);
 const x=lib.score(candidate,p,'selfmill',100,null);
 assert.equal(x.focusFit,100);
 assert.equal(x.deckNeed,100);
 assert.equal(x.total,Math.round(x.commanderFit*.55+x.focusFit*.35+x.deckNeed*.10));
 assert.deepEqual(x,lib.score(candidate,p,'selfmill',100,null));
});
