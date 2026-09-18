// Unit tests for the LobsterPig pure engine — proves every rule.
const LP = require('./engine.js');
let pass=0, fail=0;
function assert(cond,msg){ if(cond){pass++;} else {fail++; console.log('FAIL: '+msg);} }
function names(){ return ['Alice','Bob','Cara']; }

// ---- 1. Safe rolls accumulate; doubles add and force a reroll; safe clears ----
{
  const g=LP.newGame({names:names(), target:100, entry:21});
  const e1=LP.roll(g,3,5);            // 8 safe
  assert(e1.type==='safe' && g.pile===8,'safe 3+5 -> pile 8');
  const e3=LP.roll(g,5,5);            // doubles +10
  assert(e3.type==='doubles' && g.forced===true && g.pile===18,'doubles 5+5 adds 10, forced');
  const refused=LP.bank(g);
  assert(refused.type==='refused' && /must roll again/.test(refused.message),'bank refused while forced');
  const e4=LP.roll(g,2,3);            // +5 safe -> 23, forced clears
  assert(e4.type==='safe' && g.forced===false && g.pile===23,'safe roll clears forced; pile 23');
}

// ---- 2. Single lobster loses only unbanked pile ----
{
  const g=LP.newGame({names:names(),target:100,entry:21});
  LP.roll(g,3,5);            // 8
  g.ps[0].gotIn=false; g.ps[0].score=0;
  const e=LP.roll(g,1,4);    // lobster
  assert(e.type==='lob' && g.pile===0 && g.mode==='over','single lob clears pile & ends turn');
  assert(g.ps[0].score===0 && !g.ps[0].gotIn,'unentered stays 0');
}
{
  // banked player keeps score
  const g=LP.newGame({names:names(),target:100,entry:21});
  g.ps[0].gotIn=true; g.ps[0].score=40;
  LP.roll(g,2,4);            // 6
  LP.roll(g,3,3);            // doubles +6 ->12 forced
  LP.roll(g,1,6);            // lobster (safe check: 1+6 non-dbl) -> lose pile
  assert(g.ps[0].score===40 && g.mode==='over','banked 40 survives a lobster; turn over');
  assert(g.pile===0,'lobster cleared the pile');
}

// ---- 3. Double lobster wipes banked score & kicks out, turn over ----
{
  const g=LP.newGame({names:names(),target:100,entry:21});
  g.ps[0].gotIn=true; g.ps[0].score=55; g.pile=0;
  const e=LP.roll(g,1,1);
  assert(e.type==='doubleLob' && e.wipesGame===true,'double lob event flagged');
  assert(g.ps[0].score===0 && g.ps[0].gotIn===false,'score wiped to 0 AND kicked out');
  assert(g.mode==='over','turn over after double lob');
}

// ---- 4. Entry gate: pile under 21 cannot bank/get in; reaching 21 banks & gets in ----
{
  const g=LP.newGame({names:names(),target:100,entry:21});
  // try to bank at 15 -> refused
  LP.roll(g,6,6); LP.roll(g,3,2);  // doubles 12 forced, then safe 5 -> pile 17
  const r=LP.bank(g);
  assert(r.type==='refused' && /Need 21/.test(r.message),'bank under entry refused');
  assert(g.ps[0].score===0 && !g.ps[0].gotIn,'nothing banked yet');
  // now take pile to exactly 21 via safe rolls
  LP.roll(g,1,3); // LOBSTER -> wipes pile back to 0, avoids the doubles-forced lock
  assert(g.pile===0 && g.mode==='over','lobster clears sub-entry pile');
  // new turn, reach >=21 then bank
  LP.endTurn(g); LP.endTurn(g); LP.endTurn(g); // Alice again
  LP.roll(g,6,5);            // 11 (safe)
  LP.roll(g,5,5);            // doubles +10 forced =>21
  assert(g.pile===21 && g.forced===true,'pile 21 but forced (doubles)');
  // can't bank while forced even at 21
  const r2=LP.bank(g);
  assert(r2.type==='refused','can\'t bank 21 yet — must clear the forced reroll');
  LP.roll(g,2,1);            // lobster drops the 21 (stacked risk of doubles!)
  assert(g.pile===0,'...and lobster wiped the 21 before it could bank');
  // one more clean run to actually get in:
  // Alice cleared, next is Bob (cur 0->1)
  LP.endTurn(g);           // now Bob
  LP.roll(g,4,4); LP.roll(g,2,2);  // 8 + 4? both doubles: 8(forced) then... doubles again 4 forced
  // careful: 4+4=8 forced; then 2+2=4 forced -> pile12; then safe 6,5=11 ->23
  LP.roll(g,6,5);           // +11 safe ->23
  const e=LP.bank(g);
  assert(e.type==='bank' && e.gotIn===true && g.ps[1].gotIn && g.ps[1].score===23,'Bob banks 23 & gets IN');
}

// ---- 5. Prize/Bank under target continues; reaching target wins ----
{
  const g=LP.newGame({names:names(),target:100,entry:21});
  g.ps[0].gotIn=true; g.ps[0].score=0;
  LP.roll(g,6,3); // 9
  const e=LP.bank(g);
  assert(e.type==='bank' && g.ps[0].score===9 && g.winner===null,'bank 9 continues (no win)');
}
{
  const g=LP.newGame({names:names(),target:100,entry:21});
  g.ps[0].gotIn=true; g.ps[0].score=90;
  LP.roll(g,6,6);    // doubles +12 => pile12 forced
  LP.roll(g,3,2);    // +5 =>17 safe
  const e=LP.bank(g); // 90+17=107
  assert(e.type==='win','reaches/passes target -> win');
  assert(g.winner===g.ps[0] && g.mode==='over','winner set, game over');
}

// ---- 6. Turn rotation wraps ----
{
  const g=LP.newGame({names:names(),target:100,entry:21});
  g.cur=2;
  const nx=LP.endTurn(g);
  assert(nx.name==='Alice' && g.cur===0 && g.mode==='turn','turn wraps + resets pile/mode');
}

// ---- 7. canBank ok/refusal reasons ----
{
  const g=LP.newGame({names:names(),target:100,entry:21});
  assert(LP.canBank(g).reason==='empty','empty-pile refusal reason');
  assert(LP.canBank(g).ok===false,'cannot bank with nothing');
}

console.log('\nRESULT: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
