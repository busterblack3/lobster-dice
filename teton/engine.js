/* ============================================================
 * Lobster Dice — pure game-state engine (no DOM).
 * The browser file includes this logic so UI and rules can't drift.
 * Exported for Node testing & also usable directly in the browser.
 * ============================================================ */
(function(root){
  'use strict';

  function newGame(opts){
    opts = opts || {};
    var names = (opts.names||[]).slice();
    return {
      target: opts.target || 100,
      entry:  opts.entry  || 21,
      ps: names.map(function(n,i){ return {
        name:n, color:(opts.colors||['#c0392b','#2e6b34'])[i % 10] || '#888',
        score:0, gotIn:false, justBanked:false
      };}),
      // 'turn' | 'over'
      mode:'turn',
      cur: 0,
      pile:0,
      // forced re-roll (doubles) -> banking disabled
      forced:false,
      winner: null,
      log:[]
    };
  }

  // Pure step: given game + (die) tuple, mutate & return a summary event
  // with {type, message, sub} describing what happened so the UI can announce it.
  function roll(g, a, b){
    g.forced = false;
    var p = g.ps[g.cur];
    var sum = a+b;
    var bothLob = (a===1 && b===1);
    var oneLob  = (a===1 || b===1) && !bothLob;
    var isDbl   = (a===b) && !bothLob;

    if(bothLob){
      // DOUBLE LOBSTER: wipe banked score to 0, kick out of game (needs re-entry), turn over
      var lostScore = p.score;
      p.score = 0; p.gotIn = false; g.pile = 0;
      g.mode='over';
      return {
        type:'doubleLob',
        message:'🦞🦞 1+1 DOUBLE LOBSTER! '+p.name+'\'s '+lostScore+' points are GONE — back to 0!',
        sub:'roll over — next player',
        lost:lostScore, wipesGame:true
      };
    }
    if(oneLob){
      // SINGLE LOBSTER: lose the turn pile (bank survives), turn over
      var lostPile = g.pile;
      g.pile=0;
      g.mode='over';
      var lmsg;
      if(p.gotIn) lmsg = '🦞 LOBSTER! '+p.name+' rolled a 1 and lost '+lostPile+' unbanked pt'+(lostPile===1?'':'s')+' (banked '+p.score+' is safe).';
      else        lmsg = '🦞 LOBSTER! '+p.name+' rolled a 1 and lost '+lostPile+' — still haven\'t gotten in.';
      return { type:'lob', message:lmsg, sub:'turn over', lost:lostPile };
    }
    if(isDbl){
      // DOUBLES (non-lob): points count but must roll again; can't bank
      g.pile += sum;
      g.forced = true;
      return {
        type:'doubles',
        message:'Doubles '+a+'+'+b+'! +'+sum+' (pile '+g.pile+')',
        sub:'double — must roll again (banking locked)',
        added:sum, mustReroll:true
      };
    }
    // SAFE non-double
    g.pile += sum;
    return {
      type:'safe',
      message:'Safe! '+a+'+'+b+' = +'+sum+' (turn pile '+g.pile+')',
      sub:(p.gotIn?'':'score still locked at 0 until you bank '+g.entry+' on one turn'),
      added:sum
    };
  }

  // Try to bank the current pile. Returns event; may refuse (different reasons).
  function canBank(g){
    if(g.forced) return {ok:false, reason:'forced'};
    if(g.pile<=0) return {ok:false, reason:'empty'};
    var p=g.ps[g.cur];
    if(!p.gotIn && g.pile < g.entry) {
      return {ok:false, reason:'entry', message:'Need '+g.entry+' on ONE turn to get in — you have '+g.pile+'. Keep rolling or pass.'};
    }
    return {ok:true};
  }
  function bank(g){
    var c = canBank(g);
    if(!c.ok){
      if(c.reason==='forced') return {type:'refused', message:'Doubles — you must roll again before banking.'};
      if(c.reason==='empty') return {type:'refused', message:'Nothing to bank yet — roll first!'};
      return {type:'refused', message:c.message};
    }
    var p=g.ps[g.cur];
    var wasIn=p.gotIn;
    p.gotIn=true;
    var gained=g.pile; p.score+=gained;
    g.pile=0; g.forced=false;
    var ev={ type:'bank', gained:gained, score:p.score, gotIn:!wasIn };
    if(p.score>=g.target){
      ev.type='win'; ev.message=p.name+' crosses '+g.target+' with '+p.score+'! 🏆';
      g.winner=p; g.mode='over';
    } else {
      if(!wasIn) ev.message=p.name+' is IN the game (banked '+gained+' ≥ '+g.entry+')! Score '+p.score+'.';
      else       ev.message=p.name+' banks '+gained+' → total '+p.score+'.';
    }
    return ev;
  }

  function endTurn(g){
    // move to next player
    g.cur=(g.cur+1)%g.ps.length;
    g.pile=0; g.forced=false; g.mode='turn';
    return g.ps[g.cur];
  }

  // Reusable across browser & CommonJS(Node)
  root.LobsterPig = { newGame, roll, bank, canBank, endTurn };
  if (typeof module!=='undefined' && module.exports) module.exports = root.LobsterPig;

})(typeof self!=='undefined'?self:this);
