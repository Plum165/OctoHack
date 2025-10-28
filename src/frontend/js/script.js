/* OctoMatch script.js
   Full client-side functionality: participants, import, bracket generation (single/double/round-robin),
   interactive match scoring, themes, simple announcements and exports.
*/

(() => {
  // app state
  let participants = []; // {id, name, score}
  let bracket = null; // {format, rounds: [ [{match}] ] }
  const uid = (() => {
    let i=1; return ()=>('p'+(i++));
  })();

  // DOM refs
  const nameInput = document.getElementById('nameInput');
  const scoreInput = document.getElementById('scoreInput');
  const addParticipantBtn = document.getElementById('addParticipantBtn');
  const clearParticipantsBtn = document.getElementById('clearParticipantsBtn');
  const importArea = document.getElementById('importArea');
  const importBtn = document.getElementById('importBtn');
  const participantsList = document.getElementById('participantsList');
  const participantsTable = document.getElementById('participantsTable');
  const participantsTbody = document.getElementById('participantsTbody');
  const generateBtn = document.getElementById('generateBtn');
  const resetBtn = document.getElementById('resetBtn');
  const formatSelect = document.getElementById('formatSelect');
  const bracketRoot = document.getElementById('bracketRoot');
  const bracketEmpty = document.getElementById('bracketEmpty');
  const themeSelect = document.getElementById('themeSelect');
  const compName = document.getElementById('compName');
  const scoreTbody = document.getElementById('scoreTbody');
  const autoSeedBtn = document.getElementById('autoSeedBtn');
  const rulesArea = document.getElementById('rulesArea');
  const announcementInput = document.getElementById('announcementInput');
  const announceBtn = document.getElementById('announceBtn');
  const announcements = document.getElementById('announcements');
  const clearBtn = clearParticipantsBtn;
  const addBtn = addParticipantBtn;
  const groupBtn = document.getElementById('groupBtn');
  const rrBtn = document.getElementById('rrBtn');
  const exportBtn = document.getElementById('exportBtn');
  const copyShare = document.getElementById('copyShare');

  // -------------------------
  // helpers
  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
  function byScoreDesc(a,b){ return (b.score||0) - (a.score||0); }
  function nextPowerOfTwo(n){ let p=1; while(p<n) p*=2; return p;}
  function uidMatch(){ return 'm'+Math.random().toString(36).slice(2,9); }

  // -------------------------
  // participant management
  function renderParticipants(){
    if(participants.length === 0){
      participantsList.style.display = 'block';
      participantsList.textContent = 'No participants yet.';
      participantsTable.style.display = 'none';
      return;
    }
    participantsList.style.display = 'none';
    participantsTable.style.display = 'table';
    participantsTbody.innerHTML = '';
    for(const p of participants){
      const tr = document.createElement('tr');
      tr.innerHTML = `<td style="width:60%"><strong>${escapeHtml(p.name)}</strong></td>
                      <td style="width:20%">${p.score == null ? '' : escapeHtml(String(p.score))}</td>
                      <td style="width:20%"><button data-id="${p.id}" class="deleteBtn ghost">Delete</button></td>`;
      participantsTbody.appendChild(tr);
    }
    // attach deletes
    Array.from(participantsTbody.querySelectorAll('.deleteBtn')).forEach(btn=>{
      btn.addEventListener('click', ()=> {
        const id = btn.dataset.id;
        participants = participants.filter(x=>x.id !== id);
        renderParticipants();
        renderScoreTable();
      });
    });
    renderScoreTable();
  }

  function escapeHtml(str){
    return (''+str).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  }

  function addParticipantFromInputs(){
    const name = nameInput.value && nameInput.value.trim();
    const scoreRaw = scoreInput.value && scoreInput.value.trim();
    if(!name) return alert('Please enter a participant name.');
    const score = scoreRaw === '' ? null : Number(scoreRaw);
    participants.push({id: uid(), name, score});
    nameInput.value=''; scoreInput.value='';
    renderParticipants();
  }

  function clearParticipants(){
    if(!confirm('Clear all participants?')) return;
    participants = [];
    bracket = null;
    renderParticipants();
    renderBracketEmpty();
  }

  function parseImportText(text){
    // Accept lines with: Name [tab/comma/space] Score OR just Name
    const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    const out = [];
    for(const ln of lines){
      // attempt tab, comma, or multiple spaces
      let parts = ln.split('\t');
      if(parts.length === 1) parts = ln.split(',');
      if(parts.length === 1) parts = ln.split(/\s{2,}/); // two+ spaces
      if(parts.length === 1) {
        // try last space split
        const idx = ln.lastIndexOf(' ');
        if(idx>0){
          parts = [ln.slice(0,idx).trim(), ln.slice(idx+1).trim()];
        } else {
          parts = [ln];
        }
      }
      const name = (parts[0] || '').trim();
      const scoreRaw = (parts[1] || '').trim();
      const score = scoreRaw === '' ? null : Number(scoreRaw);
      if(name) out.push({id:uid(), name, score});
    }
    return out;
  }

  // -------------------------
  // scoring table
  function renderScoreTable(){
    scoreTbody.innerHTML = '';
    if(participants.length === 0){
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="2" class="muted">No participants</td>';
      scoreTbody.appendChild(tr);
      return;
    }
    for(const p of participants){
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHtml(p.name)}</td>
                      <td style="text-align:right">
                        <input data-id="${p.id}" class="scoreInput" type="number" value="${p.score==null?'':p.score}" style="width:88px;padding:6px;border-radius:6px;background:transparent;border:1px solid rgba(255,255,255,0.03);color:var(--text)"/>
                      </td>`;
      scoreTbody.appendChild(tr);
    }
    Array.from(scoreTbody.querySelectorAll('.scoreInput')).forEach(inp=>{
      inp.addEventListener('change', (e)=>{
        const id = inp.dataset.id;
        const v = inp.value;
        const p = participants.find(x=>x.id===id);
        if(p) p.score = v==='' ? null : Number(v);
        renderParticipants();
      });
    });
  }

  // -------------------------
  // seeding & grouping
  function smartSeed(){
    // seed by score desc; highest seed #1
    participants.sort(byScoreDesc);
    // no further action, but re-render participants
    renderParticipants();
    alert('Smart seed applied: participants sorted by score (descending). Generate bracket to use seeding.');
  }

  function formTeamsPairing(){
    // pair top with bottom (1vN, 2vN-1 etc) return pairs
    if(participants.length < 2) return alert('Need at least 2 participants to form teams.');
    const seeded = [...participants].sort(byScoreDesc);
    const pairs = [];
    while(seeded.length) {
      const a = seeded.shift();
      const b = seeded.pop();
      if(b) pairs.push([a,b]);
      else pairs.push([a,null]);
    }
    // show a quick modal
    const text = pairs.map((p,i)=>`Team ${i+1}: ${p[0].name}${p[1]?(' + '+p[1].name):' (bye)'}`).join('\n');
    alert('Teams created:\n\n' + text);
  }

  // -------------------------
  // bracket generation
  function generateBracket(){
    if(participants.length < 2) return alert('Add at least 2 participants to create a bracket.');
    const format = formatSelect.value;
    if(format === 'single'){
      bracket = generateSingleElim();
    } else if(format === 'roundrobin'){
      bracket = generateRoundRobin();
    } else if(format === 'double'){
      bracket = generateDoubleElim();
    } else {
      bracket = generateSingleElim();
    }
    renderBracket();
  }

  function generateSingleElim(){
    // Seeding: use participants sorted by score desc (if scores present), else input order
    const seeds = [...participants].sort(byScoreDesc);
    const n = seeds.length;
    const bracketSize = nextPowerOfTwo(n);
    // create initial pairings using standard seeding algorithm for 1..N
    // create an array of positions length = bracketSize filled with null or participant
    const positions = new Array(bracketSize).fill(null);
    // fill positions by simple seeding mapping (1 vs N, 2 vs N-1 etc)
    // we'll seed positions by the "snake" seeding for better balance
    // simple approach: top-down assign seeds to bracket positions using bracket pairing algorithm
    const seedOrder = buildSeedOrder(bracketSize);
    for(let i=0;i<seeds.length;i++){
      const pos = seedOrder[i] - 1; // seedOrder = [1, bracketSize, 2, bracketSize-1, ...]
      positions[pos] = seeds[i];
    }
    // Build rounds: round 0 matches are adjacent pairs
    const rounds = [];
    const round0 = [];
    for(let i=0;i<positions.length;i+=2){
      const a = positions[i];
      const b = positions[i+1];
      round0.push({id: uidMatch(), p1:a, p2:b, score1:null, score2:null, winner:null});
    }
    rounds.push(round0);
    // subsequent rounds
    let prev = round0;
    while(prev.length > 1){
      const next = [];
      for(let i=0;i<prev.length;i+=2){
        next.push({id:uidMatch(), p1:null, p2:null, score1:null, score2:null, winner:null});
      }
      rounds.push(next);
      prev = next;
    }
    return {format:'single', rounds};
  }

  function buildSeedOrder(size){
    // produce seed order for bracket of 'size' where seeds array index -> position
    // simple recursive seeding for power of two: [1, size, 2, size-1, 3, size-2, ...]
    const order = [];
    const helper = (arrSize, offset=0) => {
      if(arrSize === 1){ order.push(1+offset); return; }
      const half = arrSize/2;
      // build for half
      const top = [];
      for(let i=0;i<half;i++){
        top.push(i+1+offset);
      }
      const bottom = [];
      for(let i=0;i<half;i++){
        bottom.push(arrSize-i+offset);
      }
      // interleave top then bottom in pairs
      for(let i=0;i<half;i++){
        order.push(top[i]);
        order.push(bottom[i]);
      }
    };
    // above handles a single level, but for seeding fairness we can do:
    // naive approach (common) is: recursive folding; but simple pairing is ok for demo
    helper(size,0);
    return order;
  }

  function generateRoundRobin(){
    const seeds = [...participants].sort(byScoreDesc);
    // round-robin representation: rounds is array of rounds with matches
    const n = seeds.length;
    const isOdd = n % 2 === 1;
    const players = seeds.slice();
    if(isOdd) players.push(null); // bye
    const rounds = [];
    const m = players.length;
    // scheduling by circle method
    for(let r=0;r<m-1;r++){
      const matches = [];
      for(let i=0;i<m/2;i++){
        const a = players[i];
        const b = players[m-1-i];
        if(a || b){
          matches.push({id:uidMatch(), p1:a, p2:b, score1:null, score2:null, winner:null});
        }
      }
      rounds.push(matches);
      // rotate
      players.splice(1,0,players.pop());
    }
    return {format:'roundrobin', rounds};
  }

  function generateDoubleElim(){
    // Implement a basic double-elim structure: winners bracket like single-elim,
    // plus a placeholder losers bracket which will be populated as matches complete.
    const single = generateSingleElim();
    const winners = single.rounds;
    const losers = []; // build placeholder levels (same depth as winners)
    for(let i=0;i<winners.length;i++){
      const matchesCount = winners.length - i - 1 >= 0 ? Math.max(1, Math.ceil((winners[0].length) / Math.pow(2,i+1))) : 1;
      // create that many empty matches
      const arr = [];
      for(let j=0;j<matchesCount;j++){
        arr.push({id:uidMatch(), p1:null, p2:null, score1:null, score2:null, winner:null});
      }
      losers.push(arr);
    }
    return {format:'double', roundsWinners:winners, roundsLosers:losers};
  }

  // -------------------------
  // render bracket
  function renderBracket(){
    if(!bracket){
      renderBracketEmpty();
      return;
    }
    bracketEmpty.style.display = 'none';
    bracketRoot.style.display = 'block';
    bracketRoot.innerHTML = '';

    if(bracket.format === 'single'){
      const rounds = bracket.rounds;
      const roundsWrap = document.createElement('div');
      roundsWrap.className = 'rounds';
      rounds.forEach((r,ri)=>{
        const col = document.createElement('div');
        col.className = 'round';
        col.innerHTML = `<h3>Round ${ri+1}</h3>`;
        r.forEach((m,mi)=>{
          const matchEl = renderMatchCard(m, ri, mi);
          col.appendChild(matchEl);
        });
        roundsWrap.appendChild(col);
      });
      bracketRoot.appendChild(roundsWrap);
    } else if(bracket.format === 'roundrobin'){
      const rounds = bracket.rounds;
      const roundsWrap = document.createElement('div');
      roundsWrap.className = 'rounds';
      rounds.forEach((r,ri)=>{
        const col = document.createElement('div');
        col.className = 'round';
        col.innerHTML = `<h3>RR Round ${ri+1}</h3>`;
        r.forEach((m,mi)=>{
          const matchEl = renderMatchCard(m, ri, mi);
          col.appendChild(matchEl);
        });
        roundsWrap.appendChild(col);
      });
      bracketRoot.appendChild(roundsWrap);
    } else if(bracket.format === 'double'){
      const root = document.createElement('div');
      root.style.display='flex';root.style.gap='18px';
      // winners column group
      const winnersCol = document.createElement('div');
      winnersCol.style.flex='1';
      winnersCol.innerHTML = '<h3 style="margin-top:0">Winners Bracket</h3>';
      const wRoundWrap = document.createElement('div'); wRoundWrap.className='rounds';
      bracket.roundsWinners.forEach((r,ri)=>{
        const col = document.createElement('div'); col.className='round';
        col.innerHTML=`<h3>W${ri+1}</h3>`;
        r.forEach((m,mi)=> col.appendChild(renderMatchCard(m, ri, mi, 'winners')));
        wRoundWrap.appendChild(col);
      });
      winnersCol.appendChild(wRoundWrap);
      // losers column group
      const losersCol = document.createElement('div'); losersCol.style.flex='1';
      losersCol.innerHTML = '<h3 style="margin-top:0">Losers Bracket</h3>';
      const lRoundWrap = document.createElement('div'); lRoundWrap.className='rounds';
      bracket.roundsLosers.forEach((r,ri)=>{
        const col = document.createElement('div'); col.className='round';
        col.innerHTML = `<h3>L${ri+1}</h3>`;
        r.forEach((m,mi)=> col.appendChild(renderMatchCard(m, ri, mi, 'losers')));
        lRoundWrap.appendChild(col);
      });
      losersCol.appendChild(lRoundWrap);

      root.appendChild(winnersCol);
      root.appendChild(losersCol);
      bracketRoot.appendChild(root);
    }

    // after rendering attach click handlers embedded in renderMatchCard
  }

  function renderMatchCard(m, roundIndex, matchIndex, bracketType='winners'){
    const div = document.createElement('div');
    div.className = 'match';
    // show player names or byes
    const p1 = m.p1;
    const p2 = m.p2;
    const p1Html = p1 ? `<div class="player"><div class="name">${escapeHtml(p1.name)}</div><div class="score">${m.score1==null?'':escapeHtml(String(m.score1))}</div></div>` : `<div class="player bye">BYE</div>`;
    const p2Html = p2 ? `<div class="player"><div class="name">${escapeHtml(p2.name)}</div><div class="score">${m.score2==null?'':escapeHtml(String(m.score2))}</div></div>` : `<div class="player bye">BYE</div>`;
    const winnerCls = m.winner ? 'winner' : '';
    div.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><div style="font-size:12px;color:var(--muted)">Match</div><div style="font-size:12px;color:var(--muted)">ID:${m.id.slice(0,6)}</div></div>
                     <div class="${winnerCls}">${p1Html}${p2Html}</div>
                     <div style="display:flex;gap:8px;margin-top:8px">
                       <button class="enterScoreBtn" style="flex:1">Enter Scores</button>
                       <button class="autoWinBtn ghost" style="flex:1">Auto Decide</button>
                     </div>`;
    // events:
    div.querySelector('.enterScoreBtn').addEventListener('click', ()=> openScoreEditor(m, roundIndex, matchIndex, bracketType));
    div.querySelector('.autoWinBtn').addEventListener('click', ()=>{
      autoDecide(m, roundIndex, matchIndex, bracketType);
      renderBracket();
    });
    return div;
  }

  // -------------------------
  // scoring & propagation
  function openScoreEditor(match, roundIndex, matchIndex, bracketType='winners'){
    // simple prompts for scores (for demo). Could be upgraded to modal UI.
    const p1Name = match.p1 ? match.p1.name : 'BYE';
    const p2Name = match.p2 ? match.p2.name : 'BYE';
    if(!match.p1 && !match.p2) { alert('Empty match'); return; }
    const s1 = match.p1 ? prompt(`Enter score for ${p1Name}`, match.score1==null?'':String(match.score1)) : null;
    const s2 = match.p2 ? prompt(`Enter score for ${p2Name}`, match.score2==null?'':String(match.score2)) : null;
    // parse
    match.score1 = s1 === null ? match.score1 : (s1 === '' ? null : Number(s1));
    match.score2 = s2 === null ? match.score2 : (s2 === '' ? null : Number(s2));
    decideMatchWinner(match);
    propagateWinner(match, roundIndex, matchIndex, bracketType);
    renderParticipants(); renderBracket(); renderScoreTable();
  }

  function autoDecide(match, roundIndex, matchIndex, bracketType='winners'){
    // choose based on higher score if present, else prefer non-null, else random
    if(match.p1 && !match.p2){ match.winner = match.p1; return; }
    if(!match.p1 && match.p2){ match.winner = match.p2; return; }
    if(match.score1 != null && match.score2 != null){
      match.winner = match.score1 >= match.score2 ? match.p1 : match.p2;
      return;
    }
    // fallback: if both participants exist pick random
    if(match.p1 && match.p2){
      match.winner = Math.random() < 0.5 ? match.p1 : match.p2;
    }
  }

  function decideMatchWinner(match){
    if(match.p1 && !match.p2){ match.winner = match.p1; return; }
    if(!match.p1 && match.p2){ match.winner = match.p2; return; }
    if(match.score1 == null && match.score2 == null) { match.winner = null; return; }
    if(match.score1 != null && match.score2 != null){
      match.winner = match.score1 >= match.score2 ? match.p1 : match.p2;
    } else if(match.score1 != null && match.score2 == null){
      match.winner = match.p1;
    } else if(match.score2 != null && match.score1 == null){
      match.winner = match.p2;
    }
  }

  function propagateWinner(match, roundIndex, matchIndex, bracketType='winners'){
    // only implemented for single-elim & winners of double-elim basic propagation
    if(!match.winner) return;
    if(bracket.format === 'single'){
      const rounds = bracket.rounds;
      if(roundIndex+1 >= rounds.length) return;
      const nextMatchIndex = Math.floor(matchIndex/2);
      const slot = (matchIndex % 2 === 0) ? 'p1' : 'p2';
      rounds[roundIndex+1][nextMatchIndex][slot] = match.winner;
      // clear downstream scores/winners if overwritten
      rounds[roundIndex+1][nextMatchIndex].score1 = null;
      rounds[roundIndex+1][nextMatchIndex].score2 = null;
      rounds[roundIndex+1][nextMatchIndex].winner = null;
    } else if(bracket.format === 'roundrobin'){
      // no propagation — round robin accumulates matches
      return;
    } else if(bracket.format === 'double'){
      // place winner in next winners round
      const w = bracket.roundsWinners;
      if(roundIndex+1 < w.length){
        const nextMatchIndex = Math.floor(matchIndex/2);
        const slot = (matchIndex % 2 === 0) ? 'p1' : 'p2';
        w[roundIndex+1][nextMatchIndex][slot] = match.winner;
        w[roundIndex+1][nextMatchIndex].score1 = null; w[roundIndex+1][nextMatchIndex].score2 = null; w[roundIndex+1][nextMatchIndex].winner = null;
      }
      // loser goes to losers bracket — basic behaviour: not fully fleshed
      // find loser
      const loser = (match.p1 && match.p2 && match.winner && match.winner.id === match.p1.id) ? match.p2 : (match.p1 && match.p2 ? match.p1 : null);
      if(loser){
        // naive: push into first empty slot of losers[0]
        const l0 = bracket.roundsLosers[0];
        for(const m of l0){
          if(!m.p1){ m.p1 = loser; break;}
          else if(!m.p2){ m.p2 = loser; break;}
        }
      }
    }
  }

  // -------------------------
  // helpers & UI small functions
  function renderBracketEmpty(){
    bracketRoot.style.display='none';
    bracketEmpty.style.display='flex';
  }

  // announcements
  function sendAnnouncement(){
    const txt = announcementInput.value && announcementInput.value.trim();
    if(!txt) return;
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.textContent = `[${time}] ${txt}`;
    announcements.prepend(entry);
    announcementInput.value='';
  }

  // export
  function exportJSON(){
    const out = {participants, bracket, rules: rulesArea.value, compName: compName.value};
    const blob = new Blob([JSON.stringify(out, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'octomatch_export.json'; a.click();
    URL.revokeObjectURL(url);
  }

  function copyShareData(){
    const out = {participants, bracket};
    const txt = JSON.stringify(out);
    navigator.clipboard?.writeText(txt).then(()=> alert('Bracket data copied to clipboard.'));
  }

  // -------------------------
  // theme switcher
  const themes = {
    default: { '--bg':'#061022', '--panel':'#071224', '--text':'#e6eef8', '--muted':'#9aa7b8', '--accent':'#2dd4bf', '--accent-2':'#60a5fa', '--card':'#071426' },
    redblue: { '--bg':'#08030a','--panel':'#0f0810','--text':'#fff1f1','--muted':'#f8cbd0','--accent':'#f43f5e','--accent-2':'#3b82f6','--card':'#140913' },
    purpleblack: { '--bg':'#09060d','--panel':'#0e0913','--text':'#efe6ff','--muted':'#bfb3df','--accent':'#7c3aed','--accent-2':'#1f2937','--card':'#0b0410' },
    spiderman: { '--bg':'#0b1015','--panel':'#11171c','--text':'#ffdede','--muted':'#f6c6c6','--accent':'#e22d2d','--accent-2':'#1e40af','--card':'#0a0f13' },
    blood: { '--bg':'#120204','--panel':'#1c0808','--text':'#ffecec','--muted':'#f0b5b5','--accent':'#b91c1c','--accent-2':'#6b021d','--card':'#180303' },
    sapphire: { '--bg':'#071225','--panel':'#0a1b2a','--text':'#eaf6ff','--muted':'#b5d5ff','--accent':'#0ea5b9','--accent-2':'#64748b','--card':'#061422' },
    emerald: { '--bg':'#07120a','--panel':'#0b1a12','--text':'#eafbf0','--muted':'#bfe6c9','--accent':'#10b981','--accent-2':'#334155','--card':'#07160f' },
    digital: { '--bg':'#02020a','--panel':'#071026','--text':'#dbeafe','--muted':'#9fb7d9','--accent':'#7c3aed','--accent-2':'#22c1c3','--card':'#02011a' },
    coral: { '--bg':'#07121a','--panel':'#0b151b','--text':'#fff7f5','--muted':'#ffdcd4','--accent':'#ff7b6b','--accent-2':'#2dd4bf','--card':'#07121a' },
    citrus: { '--bg':'#07110b','--panel':'#0b1410','--text':'#fffdf2','--muted':'#fff2d6','--accent':'#f97316','--accent-2':'#84cc16','--card':'#08130a' },
    artisan: { '--bg':'#0c0a07','--panel':'#1a120e','--text':'#fff7f1','--muted':'#dccbbd','--accent':'#c2410c','--accent-2':'#b5835a','--card':'#0b0a07' },
    forest: { '--bg':'#07160d','--panel':'#0b2413','--text':'#eaffeb','--muted':'#bfe1c6','--accent':'#16a34a','--accent-2':'#065f46','--card':'#07160d' },
    ocean: { '--bg':'#021224','--panel':'#0a2230','--text':'#e6fbff','--muted':'#bfeaf6','--accent':'#0284c7','--accent-2':'#0ea5b9','--card':'#031522' },
    desert: { '--bg':'#1b0f05','--panel':'#281609','--text':'#fff7ef','--muted':'#f0d6c4','--accent':'#f59e0b','--accent-2':'#f97316','--card':'#1a0e05' },
    mono: { '--bg':'#050506','--panel':'#0b0b0c','--text':'#f6f6f7','--muted':'#bdbdbf','--accent':'#9ca3af','--accent-2':'#4b5563','--card':'#060607' },
    nordic: { '--bg':'#eff6ff','--panel':'#f8fafc','--text':'#0b1220','--muted':'#64748b','--accent':'#60a5fa','--accent-2':'#a78bfa','--card':'#ffffff' },
    peach: { '--bg':'#fffaf9','--panel':'#fff5f2','--text':'#201a19','--muted':'#8b6f69','--accent':'#ffb4a2','--accent-2':'#f59e0b','--card':'#fff6f4' },
    retro: { '--bg':'#0f1724','--panel':'#111827','--text':'#fff1e6','--muted':'#f7d6b7','--accent':'#ff6b6b','--accent-2':'#ffd166','--card':'#0b1220' },
    cyber: { '--bg':'#020617','--panel':'#061022','--text':'#e6f7ff','--muted':'#9fb7d9','--accent':'#7c3aed','--accent-2':'#06b6d4','--card':'#020a1a' },
    plumgold: { '--bg':'#09030a','--panel':'#140a13','--text':'#fff8fb','--muted':'#e7dbe9','--accent':'#7c3aed','--accent-2':'#d4af37','--card':'#10060f' }
  };

  function applyTheme(name){
    const t = themes[name] || themes['default'];
    for(const k in t) document.documentElement.style.setProperty(k, t[k]);
  }

  // -------------------------
  // UI wiring
  addBtn.addEventListener('click', addParticipantFromInputs);
  clearBtn.addEventListener('click', clearParticipants);
  importBtn.addEventListener('click', ()=>{
    const text = importArea.value;
    if(!text.trim()) return alert('Paste data into the import area first.');
    const parsed = parseImportText(text);
    participants = participants.concat(parsed);
    renderParticipants();
    importArea.value = '';
  });
  generateBtn.addEventListener('click', generateBracket);
  resetBtn.addEventListener('click', ()=>{
    bracket = null; renderBracketEmpty();
  });
  autoSeedBtn.addEventListener('click', smartSeed);
  announceBtn.addEventListener('click', sendAnnouncement);
  groupBtn.addEventListener('click', formTeamsPairing);
  rrBtn.addEventListener('click', ()=>{
    alert('Previewing round-robin: generate bracket with "Round Robin" format for full preview.');
  });
  exportBtn.addEventListener('click', exportJSON);
  copyShare.addEventListener('click', copyShareData);

  themeSelect.addEventListener('change', ()=>applyTheme(themeSelect.value));
  // default theme:
  applyTheme('default');

  // handy: when format changes hide/show options (placeholder)
  formatSelect.addEventListener('change', ()=> {
    // could show/hide custom options; left empty for now
  });

  // keyboard shortcuts
  document.addEventListener('keydown', (e)=>{
    if(e.ctrlKey && e.key==='Enter'){ generateBracket(); }
  });

  // initial render
  renderParticipants();
  renderScoreTable();
  renderBracketEmpty();

  // small helper: preload example participants for dev
  // (commented out by default)
  /*
  participants.push({id:uid(),name:'Paige',score:220});
  participants.push({id:uid(),name:'John',score:200});
  participants.push({id:uid(),name:'Ava',score:180});
  renderParticipants();
  */

  // expose for debugging (optional)
  window.OctoMatch = {
    getState: ()=>({participants, bracket})
  };

})();
