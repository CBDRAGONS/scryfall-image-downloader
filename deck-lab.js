/* Commander-first Deck Lab. All scoring is a disclosed heuristic, not a win rate. */
(function(root){
'use strict';
const RULES=[
 ['graveyard','Graveyard value',/graveyard|\bdies\b|\bdied\b/i],
 ['selfmill','Fill graveyards',/\bmill\b|cards? from (the top of )?(your |a )?library (into|to) (a |your )?graveyard/i],
 ['counters','+1/+1 counters',/\+1\/\+1 counter|\bevolve\b|\badapt \d|\bgraft\b/i],
 ['proliferate','Proliferate',/\bproliferate\b/i],
 ['copy','Copy effects',/\bcopy of\b|\bcopies\b|\bcopy target\b|\bbecome a copy\b/i],
 ['reanimation','Reanimate creatures',/return.{0,100}(creature|permanent|card).{0,100}(graveyard.{0,100}battlefield|to the battlefield)|put.{0,90}from (a|your|their) graveyard onto the battlefield/i],
 ['sacrifice','Sacrifice engines',/\bsacrifice\b|whenever (a|another) creature (you control )?dies/i],
 ['draw','Card draw',/\bdraw (a|two|three|four|x|that many|\d+) cards?\b|draw cards equal/i],
 ['ramp','Mana acceleration',/add \{|add (one|two|three) mana|search your library for.{0,60}land|create (a|two|three|x) treasure tokens?|mana of any color/i],
 ['removal','Interaction',/destroy target|exile target|counter target spell|deals? \d+ damage to any target/i],
 ['tokens','Token engines',/create (a|two|three|x|that many|one or more).{0,80}tokens?|tokens? you control/i],
 ['lifegain','Life gain',/gain \d+ life|gain that much life|whenever you gain life|\blifelink\b/i],
 ['blink','Blink / ETB',/exile.{0,80}return.{0,90}battlefield|enters the battlefield|when(ever)? .{0,45}enters/i],
 ['artifacts','Artifact synergy',/artifact(s)? (you control|spell|card|creature)|equipped creature|whenever you cast an artifact/i],
 ['lands','Landfall / lands',/landfall|land enters the battlefield|play an additional land|lands? from (your|a) graveyard/i],
 ['spells','Spellslinger',/whenever you cast (an? )?(instant|sorcery|noncreature) spell|copy target (instant|sorcery) spell/i],
 ['attack','Attack triggers',/whenever .{0,60}attacks?\b|\bhaste\b/i],
 ['discard','Discard payoffs',/discard (a|two|three|that many|x) cards?|whenever .{0,40}discards? a card/i],
 ['tribal','Creature-type support',/choose a creature type|creatures? (of the chosen type|that share a creature type)|other .{1,30} you control get \+/i]
];
const LINK={graveyard:{selfmill:2,reanimation:2,sacrifice:1},selfmill:{graveyard:2,reanimation:1},
 counters:{proliferate:2,tokens:1},copy:{graveyard:1,blink:1},reanimation:{graveyard:2,selfmill:1},
 sacrifice:{tokens:2,graveyard:1},tokens:{sacrifice:1,counters:1},artifacts:{ramp:1,tokens:1},
 lands:{ramp:2},spells:{draw:1},attack:{tokens:1},discard:{graveyard:1}};
const TRIBES=['Merfolk','Elf','Goblin','Zombie','Vampire','Dragon','Ooze','Faerie','Dwarf','Sliver','Human','Angel','Demon','Knight','Soldier','Cat','Elemental','Rat','Pirate'];
const BASICS=new Set(['forest','island','swamp','mountain','plains','wastes','snow-covered forest','snow-covered island','snow-covered swamp','snow-covered mountain','snow-covered plains']);
const normalize=s=>String(s||'').trim().toLowerCase();
const textOf=c=>[c.oracle_text||'',...(c.card_faces||[]).map(f=>f.oracle_text||'')].join('\n');
const tags=c=>RULES.filter(t=>t[2].test(textOf(c))).map(t=>t[0]);
const title=id=>(RULES.find(x=>x[0]===id)||[id,id])[1];
function priorities(commander){
 const direct=tags(commander), weight={};
 direct.forEach(id=>weight[id]=3);
 direct.forEach(id=>Object.entries(LINK[id]||{}).forEach(([key,value])=>weight[key]=Math.max(weight[key]||0,value)));
 return Object.entries(weight).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([id,w])=>({id,w,inferred:!direct.includes(id)}));
}
function parseDeck(text,commander){
 const cards=[],issues=[];
 let section='main';
 const sectionRe=/^(deck|main|mainboard|main deck|commander|sideboard|side board|maybeboard|considering|companion|lands|creatures|instants|sorceries|artifacts|enchantments|planeswalkers|spells)$/i;
 String(text||'').split(/\r?\n/).forEach((raw,i)=>{
  let line=raw.trim();if(!line||/^#|^\/\//.test(line))return;
  let header=line.replace(/^\[|\]$/g,'').replace(/:$/,'').trim();
  if(sectionRe.test(header)){section=/^(sideboard|side board|maybeboard|considering|companion)$/i.test(header)?'ignore':normalize(header)==='commander'?'commander':'main';return}
  if(/^\[.+\]$/.test(line)||section==='ignore')return;
  const m=line.match(/^(\d+)\s*[xX×]?\s+(.+)$/);
  if(!m){issues.push('Line '+(i+1)+' was not a quantity and card name: '+line.slice(0,55));return}
  const count=Number(m[1]);
  const name=m[2].replace(/\s+\([A-Za-z0-9]{2,6}\)(?:\s+[0-9A-Za-z★]+)?\s*$/,'').replace(/\s+\*[^*]+\*\s*$/,'').trim();
  if(!name||count<1||count>500){issues.push('Line '+(i+1)+' invalid name or quantity');return}
  cards.push({name,quantity:count,section:section==='commander'||normalize(name)===normalize(commander)?'commander':'main'});
 });
 return {cards,main:cards.filter(x=>x.section==='main'),total:cards.reduce((a,x)=>a+x.quantity,0),issues};
}
function tribeOf(c){
 const p=(c.type_line||'').split('—')[1]||'';
 return TRIBES.find(x=>p.split(/\W+/).some(y=>normalize(x)===normalize(y)))||null;
}
function matches(c,focus,tribe){
 if(focus!=='tribal')return tags(c).includes(focus);
 if(!tribe)return false;
 const needle=normalize(tribe);
 return ((c.type_line||'').split('—').slice(1).join('—').toLowerCase().split(/\W+/).includes(needle))||
   textOf(c).toLowerCase().split(/\W+/).includes(needle);
}
function allowed(card,commander){
 return card.legalities?.commander==='legal' &&
 Array.isArray(commander.color_identity) &&
 (card.color_identity||[]).every(x=>commander.color_identity.includes(x));
}
function score(card,priority,focus,need,tribe){
 const cardTags=tags(card),top=priority.slice(0,5),denom=Math.min(9,top.reduce((a,x)=>a+x.w,0))||1;
 const overlap=top.filter(x=>cardTags.includes(x.id));
 const commanderFit=Math.min(100,Math.round(100*overlap.reduce((a,x)=>a+x.w,0)/denom));
 const focusFit=matches(card,focus,tribe)?100:0;
 const deckNeed=Math.max(0,Math.min(100,need));
 return {total:Math.round(commanderFit*.55+focusFit*.35+deckNeed*.1),
  commanderFit,focusFit,deckNeed,overlap:overlap.map(x=>x.id)};
}
function recommend(db,commander,deck,focus,tribe){
 const byName=db.by_name||{},ids=new Set(),names=new Set();
 const owned=[],misses=[];
 for(const c of deck.cards){
  names.add(normalize(c.name));
  const id=byName[normalize(c.name)];
  if(id)ids.add(id);
  if(c.section!=='main')continue;
  const card=db.cards?.[id];
  if(card)owned.push({...c,card});else misses.push(c.name);
 }
 const present=owned.reduce((a,x)=>a+(matches(x.card,focus,tribe)?x.quantity:0),0);
 const need=Math.max(20,100-present*12),prio=priorities(commander),add=[];
 for(const [id,card] of Object.entries(db.cards||{})){
  if(!card.name||ids.has(id)||names.has(normalize(card.name))||!allowed(card,commander)||!matches(card,focus,tribe))continue;
  if((card.type_line||'').startsWith('Basic Land'))continue;
  add.push({card,score:score(card,prio,focus,need,tribe)});
 }
 add.sort((a,b)=>b.score.total-a.score.total||(a.card.cmc||0)-(b.card.cmc||0)||a.card.name.localeCompare(b.card.name));
 const review=owned.filter(x=>!BASICS.has(normalize(x.name))&&!matches(x.card,focus,tribe))
  .map(x=>({...x,score:score(x.card,prio,focus,need,tribe)}))
  .sort((a,b)=>a.score.total-b.score.total||a.name.localeCompare(b.name));
 return {add:add.slice(0,8),review:review.slice(0,4),present,need,matched:owned.length,total:deck.main.length,misses};
}
root.DeckLabCore={RULES,TRIBES,normalize,textOf,tags,title,priorities,parseDeck,tribeOf,matches,allowed,score,recommend};
if(typeof document==='undefined')return;
const el=id=>document.getElementById(id),message=t=>el('lab-status').textContent=t;
let dbPromise=null,db=null,commander=null,deck=null,priority=[],focus='draw',tribe=null,epoch=0;
function look(name){const id=db?.by_name?.[normalize(name)];return db?.cards?.[id]||null}
function mk(parent,tag,cls,str){const e=document.createElement(tag);if(cls)e.className=cls;if(str!==undefined)e.textContent=str;parent.appendChild(e);return e}
function chip(name,selected,help,func){
 const b=document.createElement('button');b.type='button';b.className='lab-chip'+(selected?' active':'');b.textContent=name;b.title=help;b.addEventListener('click',func);return b;
}
function choices(){
 const node=el('lab-themes');node.replaceChildren();
 priority.slice(0,9).forEach(p=>node.appendChild(chip(title(p.id)+(p.inferred?' · support':''),focus===p.id&&!tribe,
  p.inferred?'Mechanically related to commander text':'Directly matches commander Oracle text',()=>{focus=p.id;tribe=null;render()})));
 ['draw','ramp','removal'].filter(id=>!priority.some(p=>p.id===id)).forEach(id=>node.appendChild(
  chip(title(id)+' · utility',focus===id&&!tribe,'General deck role',()=>{focus=id;tribe=null;render()})));
 const native=tribeOf(commander);
 if(native)node.appendChild(chip(native+' typal',focus==='tribal'&&tribe===native,'Creature-type direction, not necessarily a payoff',
  ()=>{focus='tribal';tribe=native;render()}));
 if(tribe&&normalize(tribe)!==normalize(native))node.appendChild(chip(tribe+' typal',focus==='tribal','User-defined creature type',
  ()=>{focus='tribal';render()}));
}
function display(items,id,isReview){
 const list=el(id);list.replaceChildren();
 if(!items.length){mk(list,'p','lab-muted',isReview?'No nonbasic review candidates found.':'No matching legal additions found.');return}
 for(const item of items){
  const c=item.card,s=item.score,row=mk(list,'article','lab-result'),top=mk(row,'div','lab-result-top');
  const left=mk(top,'div','');
  const a=mk(left,'a','lab-card-link',c.name);
  a.href=c.scryfall_uri||'https://scryfall.com/search?q='+encodeURIComponent('!"'+c.name+'"');
  a.rel='noopener noreferrer';a.target='_blank';
  mk(left,'p','lab-muted',isReview?'Review only — low fit for this selected goal.':
    'Commander overlap: '+(s.overlap.map(title).join(', ')||'none; focus-match still applies'));
  mk(top,'strong','lab-score',s.total+'/100');
  mk(row,'div','lab-score-detail','Commander '+s.commanderFit+'/100 ×55%  ·  Focus '+s.focusFit+'/100 ×35%  ·  Deck need '+s.deckNeed+'/100 ×10%');
 }
}
function render(){
 choices();
 el('lab-focus-label').textContent=focus==='tribal'?(tribe||'Creature type')+' typal':title(focus);
 if(!db){
  el('lab-results').hidden=true;
  const query='id:'+(commander.color_identity||[]).join('').toLowerCase()+' legal:commander '+(focus==='tribal'&&tribe?'t:'+tribe:'o:'+focus);
  const a=el('lab-scryfall-search');a.href='https://scryfall.com/search?q='+encodeURIComponent(query);a.hidden=false;
  message('Commander identified. Deck-wide scores need the generated Oracle index. You can still explore this focus on Scryfall.');
  return;
 }
 el('lab-results').hidden=false;el('lab-scryfall-search').hidden=true;
 const d=recommend(db,commander,deck,focus,tribe);
 el('lab-coverage').textContent='Verified '+d.matched+' of '+d.total+' main-deck entries in Scryfall data; '+d.present+' copies match this focus.';
 el('lab-missing').textContent=d.misses.length?'Unmatched card names (not scored): '+d.misses.slice(0,18).join(', '):'All main-deck names matched.';
 display(d.add,'lab-additions',false);display(d.review,'lab-review',true);
 message('Commander-weighted suggestions ready. Scores are heuristics, not win-rate probabilities.');
}
async function analyze(){
 const run=++epoch,name=el('lab-commander').value.trim(),raw=el('lab-deck').value;
 if(!name){message('Enter a commander name first.');return}
 deck=parseDeck(raw,name);
 if(!deck.cards.length){message('Paste or load a decklist first.');return}
 el('lab-total').textContent=deck.total+' / 100 cards'+(deck.total!==100?' · Count needs review':'');
 el('lab-import-issues').textContent=deck.issues.slice(0,10).join('; ');
 el('lab-analyze').disabled=true;message('Reading commander text and checking the local card index…');
 try{
  if(!dbPromise)dbPromise=fetch('./data/oracle_index.json').then(r=>r.ok?r.json():null).catch(()=>null);
  db=await dbPromise;
  commander=look(name);
  if(!commander){
   const response=await fetch('https://api.scryfall.com/cards/named?exact='+encodeURIComponent(name));
   if(!response.ok)throw Error('Cannot verify '+name+' (Scryfall HTTP '+response.status+').');
   commander=await response.json();
  }
  if(run!==epoch)return;
  priority=priorities(commander);
  focus=priority[0]?.id||'draw';tribe=null;
  el('lab-commander-info').textContent='Commander: '+commander.name+' · Color identity: '+(commander.color_identity||[]).join('/')+' · '+(db?'local Oracle index loaded':'live Scryfall commander only');
  const direct=priority.filter(p=>!p.inferred).slice(0,5).map(p=>title(p.id));
  el('lab-commander-reason').textContent='Detected from commander text: '+(direct.length?direct.join(', '):'No obvious mechanical theme; choose a utility focus below')+'.';
  el('lab-workbench').hidden=false;render();
 }catch(e){if(run===epoch){el('lab-workbench').hidden=true;message('Commander lookup unavailable: '+e.message)}}
 finally{if(run===epoch)el('lab-analyze').disabled=false}
}
el('lab-analyze').addEventListener('click',analyze);
el('lab-sample').addEventListener('click',async()=>{
 message('Loading the saved Mimeoplasm deck…');
 try{const r=await fetch('./decks/the-mimeoplasm.txt');if(!r.ok)throw Error('HTTP '+r.status);
  el('lab-deck').value=await r.text();el('lab-commander').value='The Mimeoplasm';await analyze();
 }catch(e){message('Sample deck unavailable: '+e.message)}
});
el('lab-file').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;el('lab-deck').value=await file.text();
 message('Decklist imported. Confirm the commander, then click Analyze.');
});
el('lab-custom').addEventListener('submit',e=>{
 e.preventDefault();if(!commander)return;
 const typed=normalize(el('lab-trait-input').value);
 const known=RULES.find(t=>normalize(t[1])===typed||t[0]===typed);
 const species=TRIBES.find(t=>normalize(t)===typed);
 if(known){focus=known[0];tribe=null}
 else if(species){focus='tribal';tribe=species}
 else{message('Select a suggested synergy or enter a creature type such as Merfolk, Elf or Ooze.');return}
 render();
});
})(typeof window!=='undefined'?window:globalThis);
