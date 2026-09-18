// End-to-end test for Buster's v2 (reviewed build): load, set up, CPU plays itself.
const fs=require('fs');
const {JSDOM}=require('jsdom');
const FILE=process.argv[2]||'/root/.openclaw/workspace/lobster-pig/lobster-dice-v2.html';
const errors=[];
const dom=new JSDOM(fs.readFileSync(FILE,'utf8'),
  {runScripts:'dangerously',pretendToBeVisual:true,
   beforeParse(w){ w.addEventListener('error',e=>errors.push(e&&e.message||String(e))); }});
const {window}=dom,{document}=window;
const $=id=>document.getElementById(id);
const sleep=ms=>new Promise(r=>window.setTimeout(r,ms));
const until=async(fn,t=4000,s=40)=>{const t0=Date.now();while(Date.now()-t0<t){if(fn())return true;await sleep(s);}return false;};
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:(fail++,console.log('  FAIL:',m));};
const banner=()=>$('banner').textContent.replace(/\s+/g,' ').trim();
const logLen=()=>$('history').textContent.length;
const rows=()=>[...document.querySelectorAll('#plist .prow')];

(async()=>{
  await sleep(120);
  ok(errors.length===0,'loads with no JS errors: '+JSON.stringify(errors));
  ok(rows().length===3,'three default players');
  ok(!!document.querySelector('.who'),'human/CPU toggle present');
  ok(!!$('rollBtn')&&!!$('bankBtn')&&!!$('nextBtn'),'game controls present');

  // self-hosted font: no network font references, and the font data is inline
  const html=fs.readFileSync(FILE,'utf8');
  ok(!/fonts\.googleapis|fonts\.gstatic/.test(html),'no external font requests (offline-safe)');
  ok(/data:font\/woff2;base64/.test(html),'font is inlined in the file');

  // flip player 2 to the computer
  rows()[1].querySelector('.who').click();
  ok(rows()[1].querySelector('.who').className.indexOf('cpu')>=0,'player 2 toggled to CPU');

  $('btnStart').click();
  ok(await until(()=>$('game').classList.contains('active')),'game starts');
  ok(document.querySelectorAll('#board .pcard').length===3,'scoreboard shows 3 players');
  ok(await until(()=>!!banner()),'banner renders');

  // human: roll until the turn ends (bust) - cap it
  let ended=false;
  for(let i=0;i<15;i++){
    if($('nextbar').classList.contains('show')){ ended=true; break; }
    if($('rollBtn').disabled){ await sleep(700); continue; }
    $('rollBtn').click();
    await sleep(900);
  }
  ended = ended || $('nextbar').classList.contains('show');
  ok(ended,'human turn eventually ends');
  ok(errors.length===0,'no errors through rolls: '+JSON.stringify(errors));

  // hand over to the computer and DO NOT touch anything
  const before=logLen();
  $('nextBtn').click();
  ok(await until(()=>/thinking|CPU|Computer/i.test(banner())||$('rollBtn').classList.contains('ctrl-hide'),4000),
     'computer turn begins (human controls hidden)');
  ok(await until(()=>logLen()>before+8, 15000),'computer acted on its own (log grew)');
  ok(await until(()=>!$('rollBtn').classList.contains('ctrl-hide'), 20000),'control returns to a human');
  ok(errors.length===0,'no errors during CPU turn: '+JSON.stringify(errors));

  console.log('errors:',JSON.stringify(errors));
  console.log('\nV2 E2E: '+pass+' passed, '+fail+' failed');
  process.exit(fail||errors.length?1:0);
})().catch(e=>{console.error('FATAL',e&&e.stack||e);process.exit(1)});
