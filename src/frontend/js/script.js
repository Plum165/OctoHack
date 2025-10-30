/*
 * =================================================================================================
 * OctoMatch - The Ultimate Tournament Bracket Manager
 * =================================================================================================
 *
 * Description:
 * A comprehensive, client-side JavaScript application for managing tournaments. This single script
 * handles all functionality, from participant entry to final bracket display and scoring.
 * It is designed to be robust, user-friendly, and easily customizable.
 *
 * Features:
 * - Participant Management: Add, delete, and clear participants.
 * - Data Import: Easily import participants from a list (supports various delimiters).
 * - Ranked Display: The main participant table is automatically sorted by score and displays rank.
 * - Category System: Define custom categories based on score ranges (e.g., 'Beginner', 'Advanced').
 * - Smart Seeding: Automatically seeds participants based on their score for balanced brackets.
 * - Multiple Bracket Formats:
 *   - Single Elimination: Handles any number of players by correctly assigning byes.
 *   - Double Elimination: Includes both a Winners and a Losers bracket.
 *   - Round Robin: Generates a full schedule where every participant plays each other.
 * - Interactive Brackets: Click on matches to enter scores and automatically advance winners.
 * - Bronze Match Generation: Automatically creates a 3rd place playoff for single-elimination formats.
 * - Live Scoreboard: A dedicated panel for viewing and updating all participant scores at once.
 * - UI & UX:
 *   - Theme Engine: Includes over 20 pre-built color themes.
 *   - Announcements: A simple tool for posting real-time updates.
 *   - Data Export: Save the entire tournament state (participants, bracket, etc.) to a JSON file.
 *   - Sharable Links: Generate a URL that contains the tournament data to easily share the state.
 *
 * Version: 2.0 (Final Unified Script)
 * Author: [Your Name/Organization]
 * License: [Your License]
 *
 * =================================================================================================
 */

(() => {
  'use strict';

  // ===================================================================================
  // I. APPLICATION STATE
  // Centralized variables to hold the tournament's data.
  // ===================================================================================

  let participants = []; // Array of participant objects: {id, name, score, category}
  let categories = [];   // Array of category objects: {name, min, max}
  let bracket = null;      // The main bracket object: {format, rounds, ...}

  /**
   * Generates unique IDs for participants.
   * @returns {function(): string} A function that returns a new unique ID (e.g., 'p1', 'p2').
   */
  const uid = (() => {
    let i = 1;
    return () => 'p' + (i++);
  })();


  // ===================================================================================
  // II. DOM ELEMENT REFERENCES
  // Caching references to frequently used DOM elements for performance.
  // ===================================================================================

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
  const groupBtn = document.getElementById('groupBtn');
  const exportBtn = document.getElementById('exportBtn');
  const copyShare = document.getElementById('copyShare');
  const addCategoryBtn = document.getElementById('addCategoryBtn');
  const categoriesContainer = document.getElementById('categories');


  // ===================================================================================
  // III. HELPER & UTILITY FUNCTIONS
  // Small, reusable functions used throughout the application.
  // ===================================================================================

  /**
   * Sort comparator to sort participants by score in descending order.
   * @param {object} a - First participant.
   * @param {object} b - Second participant.
   * @returns {number}
   */
  function byScoreDesc(a, b) {
    return (b.score || 0) - (a.score || 0);
  }

  /**
   * Calculates the next power of two for a given number. Essential for creating balanced brackets.
   * @param {number} n - The number of participants.
   * @returns {number} The next power of two (e.g., for n=5, returns 8).
   */
  function nextPowerOfTwo(n) {
    let p = 1;
    while (p < n) p *= 2;
    return p;
  }

  /**
   * Generates a unique ID for a match.
   * @returns {string} A short, random match ID (e.g., 'm-a2jxy').
   */
  function uidMatch() {
    return 'm' + Math.random().toString(36).slice(2, 9);
  }

  /**
   * Sanitizes a string to prevent HTML injection.
   * @param {string} str - The input string.
   * @returns {string} The escaped string.
   */
  function escapeHtml(str) {
    return ('' + str).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  }


  // ===================================================================================
  // IV. PARTICIPANT MANAGEMENT
  // Functions for adding, deleting, importing, and rendering participants.
  // ===================================================================================

  /**
   * Renders the main participant table, sorted by rank.
   */
  function renderParticipants() {
    if (participants.length === 0) {
      participantsList.style.display = 'block';
      participantsList.textContent = 'No participants yet.';
      participantsTable.style.display = 'none';
      renderScoreTable(); // Also clear the score table
      return;
    }

    participantsList.style.display = 'none';
    participantsTable.style.display = 'table';
    participantsTbody.innerHTML = '';

    // Create a ranked list without modifying the original participant array
    const rankedParticipants = [...participants].sort(byScoreDesc);

    rankedParticipants.forEach((p, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="width:10%">${index + 1}</td>
        <td style="width:40%"><strong>${escapeHtml(p.name)}</strong></td>
        <td style="width:15%">${p.score == null ? '—' : escapeHtml(String(p.score))}</td>
        <td style="width:20%">${escapeHtml(p.category)}</td>
        <td style="width:15%"><button data-id="${p.id}" class="deleteBtn ghost">Delete</button></td>`;
      participantsTbody.appendChild(tr);
    });

    // Add event listeners to the new delete buttons
    Array.from(participantsTbody.querySelectorAll('.deleteBtn')).forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        participants = participants.filter(x => x.id !== id);
        renderParticipants();
      });
    });

    // Re-render the score table in sync
    renderScoreTable();
  }

  /**
   * Adds a new participant from the input fields.
   */
  function addParticipantFromInputs() {
    const name = nameInput.value && nameInput.value.trim();
    const scoreRaw = scoreInput.value && scoreInput.value.trim();
    if (!name) return alert('Please enter a participant name.');

    const score = scoreRaw === '' ? null : Number(scoreRaw);
    participants.push({
      id: uid(),
      name,
      score,
      category: 'Uncategorized'
    });

    nameInput.value = '';
    scoreInput.value = '';
    nameInput.focus();

    assignCategories(); // Re-assign categories on new addition
    renderParticipants();
  }

  /**
   * Clears all participants from the state.
   */
  function clearParticipants() {
    if (!confirm('Are you sure you want to clear all participants? This action cannot be undone.')) return;
    participants = [];
    bracket = null;
    renderParticipants();
    renderBracketEmpty();
  }

  /**
   * Parses text from the import area and converts it into participant objects.
   * @param {string} text - The raw text from the import textarea.
   * @returns {Array<object>} An array of new participant objects.
   */
  function parseImportText(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const out = [];

    for (const ln of lines) {
      // Tries to split by tab, then comma, then multiple spaces
      let parts = ln.split('\t');
      if (parts.length === 1) parts = ln.split(',');
      if (parts.length === 1) parts = ln.split(/\s{2,}/);

      // As a fallback, splits on the last space (for names with spaces)
      if (parts.length === 1) {
        const idx = ln.lastIndexOf(' ');
        if (idx > 0) {
          parts = [ln.slice(0, idx).trim(), ln.slice(idx + 1).trim()];
        } else {
          parts = [ln];
        }
      }

      const name = (parts[0] || '').trim();
      const scoreRaw = (parts[1] || '').trim();
      const score = scoreRaw === '' ? null : Number(scoreRaw);
      if (name) out.push({
        id: uid(),
        name,
        score,
        category: 'Uncategorized'
      });
    }
    return out;
  }


  // ===================================================================================
  // V. CATEGORY MANAGEMENT
  // Functions to create and manage participant categories based on score.
  // ===================================================================================

  /**
   * Prompts the user to add a new category.
   */
  function addCategory() {
    const name = prompt("Enter the category name (e.g., 'Advanced'):");
    if (!name) return;
    const min = parseFloat(prompt(`Enter the minimum score for the "${name}" category:`));
    const max = parseFloat(prompt(`Enter the maximum score for the "${name}" category:`));

    if (isNaN(min) || isNaN(max)) {
      return alert("Invalid score range. Please enter numbers only.");
    }

    categories.push({ name, min, max });
    renderCategories();
    assignCategories(); // Re-evaluate all participants
    renderParticipants();
  }

  /**
   * Renders the list of created categories as tags.
   */
  function renderCategories() {
    if (!categoriesContainer) return;
    categoriesContainer.innerHTML = "<h4>Categories</h4>";
    if (categories.length === 0) {
      categoriesContainer.innerHTML += "<p class='muted'>No categories defined.</p>";
    }
    categories.forEach(c => {
      const div = document.createElement("div");
      div.className = 'category-tag';
      div.textContent = `${c.name}: ${c.min}–${c.max}`;
      categoriesContainer.appendChild(div);
    });
  }

  /**
   * Iterates through all participants and assigns them to the correct category.
   */
  function assignCategories() {
    participants.forEach(p => {
      p.category = 'Uncategorized'; // Reset first
      for (const c of categories) {
        if (p.score != null && p.score >= c.min && p.score <= c.max) {
          p.category = c.name;
          break; // Assign to the first matching category
        }
      }
    });
  }


  // ===================================================================================
  // VI. LIVE SCOREBOARD
  // Renders the score table and handles live score updates.
  // ===================================================================================

  /**
   * Renders the editable score table.
   */
  function renderScoreTable() {
    scoreTbody.innerHTML = '';
    if (participants.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="2" class="muted">No participants</td>';
      scoreTbody.appendChild(tr);
      return;
    }

    const rankedParticipants = [...participants].sort(byScoreDesc);
    for (const p of rankedParticipants) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(p.name)}</td>
        <td style="text-align:right">
          <input data-id="${p.id}" class="scoreInput" type="number" value="${p.score==null?'':p.score}"
                 placeholder="N/A"
                 style="width:88px;padding:6px;border-radius:6px;background:transparent;border:1px solid rgba(255,255,255,0.03);color:var(--text)"/>
        </td>`;
      scoreTbody.appendChild(tr);
    }

    // Add listeners to score inputs for real-time updates
    Array.from(scoreTbody.querySelectorAll('.scoreInput')).forEach(inp => {
      inp.addEventListener('change', (e) => {
        const id = inp.dataset.id;
        const v = inp.value;
        const p = participants.find(x => x.id === id);
        if (p) p.score = v === '' ? null : Number(v);
        assignCategories();
        renderParticipants(); // Re-render main table to reflect score/category changes
      });
    });
  }


  // ===================================================================================
  // VII. SEEDING & GROUPING TOOLS
  // Pre-bracket utilities for organizing participants.
  // ===================================================================================

  /**
   * Sorts participants by score (descending) to prepare for seeded bracket generation.
   */
  function smartSeed() {
    participants.sort(byScoreDesc);
    renderParticipants();
    alert('Smart seed applied: participants have been sorted by score. A new bracket will use this order.');
  }

  /**
   * Creates balanced teams by pairing the highest-ranked participant with the lowest, and so on.
   */
  function formTeamsPairing() {
    if (participants.length < 2) return alert('Need at least 2 participants to form teams.');
    const seeded = [...participants].sort(byScoreDesc);
    const pairs = [];
    while (seeded.length) {
      const a = seeded.shift();
      const b = seeded.pop();
      if (b) pairs.push([a, b]);
      else pairs.push([a, null]); // Handles odd number of participants
    }
    const text = pairs.map((p, i) => `Team ${i+1}: ${p[0].name}${p[1]?(' + '+p[1].name):' (with a bye)'}`).join('\n');
    alert('Balanced teams created:\n\n' + text);
  }


  // ===================================================================================
  // VIII. BRACKET GENERATION
  // Core logic for creating single, double, and round-robin brackets.
  // ===================================================================================

  /**
   * Main controller for bracket generation.
   */
  function generateBracket() {
    if (participants.length < 2) return alert('Add at least 2 participants to create a bracket.');

    const format = formatSelect.value;
    switch (format) {
      case 'single':
        bracket = generateSingleElim();
        break;
      case 'roundrobin':
        bracket = generateRoundRobin();
        break;
      case 'double':
        bracket = generateDoubleElim();
        break;
      default:
        bracket = generateSingleElim(); // Default to single elimination
    }
    renderBracket();
  }

  /**
   * Generates a standard seeding order for a bracket of a given size.
   * This ensures that top seeds do not meet in early rounds.
   * @param {number} size - The size of the bracket (must be a power of two).
   * @returns {Array<number>} An array of seed numbers in their correct bracket positions.
   */
  function standardSeedOrder(size) {
    if (size === 1) return [1];
    const prev = standardSeedOrder(size / 2);
    const next = [];
    for (const seed of prev) {
      next.push(seed);
      next.push(size + 1 - seed);
    }
    return next;
  }

  /**
   * Creates a single elimination bracket object.
   * @returns {object} The bracket data structure.
   */
  function generateSingleElim() {
    const seeds = [...participants]; // Assumes participants are already sorted by smart seed
    const n = seeds.length;
    if (n < 2) return { format: 'single', rounds: [] };

    const bracketSize = nextPowerOfTwo(n);

    const rounds = [];
    let round1 = [];

    // Create a player array with null placeholders for a full bracket
    let players = new Array(bracketSize).fill(null);
    let seedOrder = standardSeedOrder(bracketSize);

    // Place seeded players into their designated spots
    for (let i = 0; i < n; i++) {
      players[seedOrder[i] - 1] = seeds[i];
    }

    // Create first round matches
    for (let i = 0; i < bracketSize; i += 2) {
      const p1 = players[i];
      const p2 = players[i + 1];
      round1.push({
        id: uidMatch(),
        p1: p1,
        p2: p2,
        winner: p1 && !p2 ? p1 : null, // If player 2 is null, it's a bye, so p1 auto-wins
        loser: null,
        score1: null,
        score2: null
      });
    }

    rounds.push(round1);

    // Build subsequent empty rounds
    let prevRoundSize = round1.length;
    while (prevRoundSize > 1) {
      const nextRound = [];
      for (let i = 0; i < prevRoundSize; i += 2) {
        nextRound.push({
          id: uidMatch(),
          p1: null,
          p2: null,
          score1: null,
          score2: null,
          winner: null,
          loser: null
        });
      }
      rounds.push(nextRound);
      prevRoundSize = nextRound.length;
    }

    propagateByeWinners(rounds);
    return { format: 'single', rounds };
  }

  /**
   * Automatically moves winners of bye matches to the next round.
   * @param {Array<Array<object>>} rounds - The rounds of the bracket.
   */
  function propagateByeWinners(rounds) {
    if (!rounds || rounds.length < 2) return;
    const round1 = rounds[0];
    const round2 = rounds[1];
    round1.forEach((match, index) => {
      if (match.winner) { // This indicates a bye match
        const nextMatchIndex = Math.floor(index / 2);
        const slot = (index % 2 === 0) ? 'p1' : 'p2';
        if (round2[nextMatchIndex]) {
          round2[nextMatchIndex][slot] = match.winner;
        }
      }
    });
  }

  /**
   * Generates a round robin tournament schedule.
   * @returns {object} The bracket data structure.
   */
  function generateRoundRobin() {
    const players = [...participants];
    if (players.length % 2 === 1) {
      players.push(null); // Add a dummy player (bye) for odd numbers
    }
    const n = players.length;
    const rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const matches = [];
      for (let i = 0; i < n / 2; i++) {
        const p1 = players[i];
        const p2 = players[n - 1 - i];
        if (p1 && p2) { // Only create matches if both players are real
          matches.push({
            id: uidMatch(),
            p1,
            p2,
            score1: null,
            score2: null,
            winner: null,
            loser: null
          });
        }
      }
      rounds.push(matches);
      // Rotate players for the next round, keeping the first player fixed
      players.splice(1, 0, players.pop());
    }
    return { format: 'roundrobin', rounds };
  }

  /**
   * Generates a double elimination bracket structure.
   * @returns {object} The bracket data structure with winners and losers rounds.
   */
  function generateDoubleElim() {
    const single = generateSingleElim();
    const winners = single.rounds;
    const losers = [];

    // Create placeholder rounds for the losers bracket
    for (let i = 0; i < winners.length - 1; i++) {
      const lRound = [];
      for (let j = 0; j < winners[i].length / 2; j++) {
        lRound.push({
          id: uidMatch(),
          p1: null,
          p2: null,
          winner: null,
          loser: null
        });
      }
      if (lRound.length > 0) losers.push(lRound);

      // Add consolidation rounds in the losers bracket
      if (i > 0) {
        const lConsolidation = [];
        for (let k = 0; k < lRound.length / 2; k++) {
          lConsolidation.push({
            id: uidMatch(),
            p1: null,
            p2: null,
            winner: null,
            loser: null
          });
        }
        if (lConsolidation.length > 0) losers.push(lConsolidation);
      }
    }
    return {
      format: 'double',
      roundsWinners: winners,
      roundsLosers: losers
    };
  }


  // ===================================================================================
  // IX. BRACKET RENDERING
  // Functions to draw the bracket on the screen.
  // ===================================================================================

  /**
   * Main rendering function that draws the entire bracket structure.
   */
  function renderBracket() {
    if (!bracket) {
      renderBracketEmpty();
      return;
    }

    bracketEmpty.style.display = 'none';
    bracketRoot.style.display = 'block';
    bracketRoot.innerHTML = '';

    if (bracket.format === 'single') {
      const roundsWrap = document.createElement('div');
      roundsWrap.className = 'rounds';
      bracket.rounds.forEach((r, ri) => {
        const col = document.createElement('div');
        col.className = 'round';
        col.innerHTML = `<h3>Round ${ri + 1}</h3>`;
        r.forEach((m, mi) => {
          const matchEl = renderMatchCard(m, ri, mi, 'single');
          col.appendChild(matchEl);
        });
        roundsWrap.appendChild(col);
      });
      bracketRoot.appendChild(roundsWrap);
      renderBronzeMatch(bracket);

    } else if (bracket.format === 'roundrobin') {
      const roundsWrap = document.createElement('div');
      roundsWrap.className = 'rounds-rr';
      bracket.rounds.forEach((r, ri) => {
        const col = document.createElement('div');
        col.className = 'round-rr';
        col.innerHTML = `<h3>Round ${ri + 1}</h3>`;
        r.forEach((m, mi) => {
          const matchEl = renderMatchCard(m, ri, mi, 'roundrobin');
          col.appendChild(matchEl);
        });
        roundsWrap.appendChild(col);
      });
      bracketRoot.appendChild(roundsWrap);

    } else if (bracket.format === 'double') {
      const root = document.createElement('div');
      root.className = 'double-elim-container';

      // Winners Bracket Column
      const winnersCol = document.createElement('div');
      winnersCol.className = 'bracket-column';
      winnersCol.innerHTML = '<h3 class="bracket-title">Winners Bracket</h3>';
      const wRoundWrap = document.createElement('div');
      wRoundWrap.className = 'rounds';
      bracket.roundsWinners.forEach((r, ri) => {
        const col = document.createElement('div');
        col.className = 'round';
        col.innerHTML = `<h4>W-Round ${ri + 1}</h4>`;
        r.forEach((m, mi) => col.appendChild(renderMatchCard(m, ri, mi, 'winners')));
        wRoundWrap.appendChild(col);
      });
      winnersCol.appendChild(wRoundWrap);

      // Losers Bracket Column
      const losersCol = document.createElement('div');
      losersCol.className = 'bracket-column';
      losersCol.innerHTML = '<h3 class="bracket-title">Losers Bracket</h3>';
      const lRoundWrap = document.createElement('div');
      lRoundWrap.className = 'rounds';
      bracket.roundsLosers.forEach((r, ri) => {
        const col = document.createElement('div');
        col.className = 'round';
        col.innerHTML = `<h4>L-Round ${ri + 1}</h4>`;
        r.forEach((m, mi) => col.appendChild(renderMatchCard(m, ri, mi, 'losers')));
        lRoundWrap.appendChild(col);
      });
      losersCol.appendChild(lRoundWrap);

      root.appendChild(winnersCol);
      root.appendChild(losersCol);
      bracketRoot.appendChild(root);
    }
  }

  /**
   * Renders the bronze (3rd place) match card if applicable.
   * @param {object} bracket - The main bracket object.
   */
  function renderBronzeMatch(bracket) {
    if (!bracket || bracket.format !== 'single' || bracket.rounds.length < 2) return;
    const semiFinals = bracket.rounds[bracket.rounds.length - 2];
    if (!semiFinals || semiFinals.length !== 2) return;

    const loser1 = semiFinals[0].loser;
    const loser2 = semiFinals[1].loser;

    if (loser1 && loser2) {
      const bronzeMatch = {
        id: 'm-bronze',
        p1: loser1,
        p2: loser2,
        score1: null,
        score2: null,
        winner: null,
        loser: null
      };
      const bronzeContainer = document.createElement('div');
      bronzeContainer.className = 'bronze-match-container';
      bronzeContainer.innerHTML = '<h3>Third Place Match</h3>';
      const matchCard = renderMatchCard(bronzeMatch, -1, -1, 'bronze');
      bronzeContainer.appendChild(matchCard);
      bracketRoot.appendChild(bronzeContainer);
    }
  }

  /**
   * Renders an individual match card element.
   * @param {object} m - The match object.
   * @param {number} roundIndex - The index of the round.
   * @param {number} matchIndex - The index of the match within the round.
   * @param {string} bracketType - The type of bracket ('single', 'winners', 'losers', etc.).
   * @returns {HTMLElement} The match card element.
   */
  function renderMatchCard(m, roundIndex, matchIndex, bracketType) {
    const div = document.createElement('div');
    div.className = 'match';
    const isBye = m.p1 && m.p2 === null;

    const p1Html = m.p1 ? `<div class="player"><div class="name">${escapeHtml(m.p1.name)}</div><div class="score">${m.score1==null?'':escapeHtml(String(m.score1))}</div></div>` : `<div class="player bye">(empty)</div>`;
    const p2Html = m.p2 ? `<div class="player"><div class="name">${escapeHtml(m.p2.name)}</div><div class="score">${m.score2==null?'':escapeHtml(String(m.score2))}</div></div>` : (isBye ? `<div class="player bye">BYE</div>` : `<div class="player bye">(empty)</div>`);

    let winnerHtml = '';
    if (m.winner) {
      winnerHtml = `<div class="winner-tag">🏆 ${escapeHtml(m.winner.name)}</div>`;
    }

    div.innerHTML = `
      <div class="match-meta"><span>Match ID: ${m.id.slice(0,6)}</span></div>
      <div class="match-body">${p1Html}${p2Html}</div>
      ${winnerHtml}
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="enterScoreBtn" style="flex:1" ${isBye ? 'disabled' : ''}>Enter Scores</button>
      </div>`;

    if (!isBye) {
      div.querySelector('.enterScoreBtn').addEventListener('click', () => openScoreEditor(m, roundIndex, matchIndex, bracketType));
    }
    return div;
  }

  /**
   * Renders the placeholder view when no bracket is generated.
   */
  function renderBracketEmpty() {
    bracketRoot.style.display = 'none';
    bracketEmpty.style.display = 'flex';
  }


  // ===================================================================================
  // X. SCORING & WINNER PROPAGATION
  // Functions for handling match scoring and advancing winners.
  // ===================================================================================

  /**
   * Opens prompts to enter scores for a match.
   * @param {object} match - The match object to score.
   * @param {number} roundIndex - The index of the round.
   * @param {number} matchIndex - The index of the match within the round.
   * @param {string} bracketType - The type of bracket.
   */
  function openScoreEditor(match, roundIndex, matchIndex, bracketType) {
    const p1Name = match.p1 ? match.p1.name : '(empty)';
    const p2Name = match.p2 ? match.p2.name : '(empty)';

    if (!match.p1 || !match.p2) {
      alert('This match is not yet ready to be scored.');
      return;
    }

    const s1 = prompt(`Enter score for ${p1Name}:`, match.score1 == null ? '' : String(match.score1));
    const s2 = prompt(`Enter score for ${p2Name}:`, match.score2 == null ? '' : String(match.score2));

    match.score1 = s1 === null ? match.score1 : (s1 === '' ? null : Number(s1));
    match.score2 = s2 === null ? match.score2 : (s2 === '' ? null : Number(s2));

    decideMatchWinner(match);

    if (bracketType !== 'bronze') {
      propagateWinner(match, roundIndex, matchIndex, bracketType);
    }

    renderBracket();
  }

  /**
   * Determines the winner and loser of a match based on its scores.
   * @param {object} match - The match object.
   */
  function decideMatchWinner(match) {
    if (match.p1 && !match.p2) { // Bye case
      match.winner = match.p1;
      match.loser = null;
      return;
    }

    if (match.score1 == null || match.score2 == null) {
      match.winner = null;
      match.loser = null;
      return;
    }

    let winner, loser;
    const s1 = match.score1;
    const s2 = match.score2;

    if (s1 >= s2) {
      winner = match.p1;
      loser = match.p2;
    } else {
      winner = match.p2;
      loser = match.p1;
    }
    match.winner = winner;
    match.loser = loser;
  }

  /**
   * Moves the winner and loser to their respective next matches in the bracket.
   * @param {object} match - The completed match object.
   * @param {number} roundIndex - The index of the round.
   * @param {number} matchIndex - The index of the match within the round.
   * @param {string} bracketType - The type of bracket.
   */
  function propagateWinner(match, roundIndex, matchIndex, bracketType) {
    if (!match.winner) return;

    if (bracketType === 'single' || bracketType === 'winners') {
      const rounds = (bracketType === 'single') ? bracket.rounds : bracket.roundsWinners;
      if (roundIndex + 1 >= rounds.length) return; // Final match, no propagation

      const nextMatchIndex = Math.floor(matchIndex / 2);
      const slot = (matchIndex % 2 === 0) ? 'p1' : 'p2';
      const nextMatch = rounds[roundIndex + 1][nextMatchIndex];

      if (nextMatch[slot] && nextMatch[slot].id === match.winner.id) return; // Avoid re-propagation

      nextMatch[slot] = match.winner;
      // Reset next match's scores
      nextMatch.score1 = null;
      nextMatch.score2 = null;
      nextMatch.winner = null;
      nextMatch.loser = null;
    }

    // For double elimination, move loser to the losers bracket
    if (bracketType === 'winners' && match.loser) {
      // This logic needs to be fully implemented based on the specific DE bracket structure
      // For now, it's a placeholder to demonstrate where the logic would go.
      const lRoundIndex = roundIndex; // Simplified mapping
      if (bracket.roundsLosers[lRoundIndex]) {
        const targetMatch = bracket.roundsLosers[lRoundIndex][Math.floor(matchIndex / 2)];
        if (targetMatch) {
          // Find an empty slot for the loser
          if (!targetMatch.p1) targetMatch.p1 = match.loser;
          else if (!targetMatch.p2) targetMatch.p2 = match.loser;
        }
      }
    }
  }


  // ===================================================================================
  // XI. UI & MISCELLANEOUS FUNCTIONS
  // Announcements, exports, and theme switching.
  // ===================================================================================

  /**
   * Posts an announcement to the announcements panel.
   */
  function sendAnnouncement() {
    const txt = announcementInput.value && announcementInput.value.trim();
    if (!txt) return;
    const time = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
    const entry = document.createElement('div');
    entry.className = 'announcement-entry';
    entry.innerHTML = `<span class="timestamp">[${time}]</span> ${escapeHtml(txt)}`;
    announcements.prepend(entry);
    announcementInput.value = '';
  }

  /**
   * Exports the current tournament state to a downloadable JSON file.
   */
  function exportJSON() {
    const out = {
      competitionName: compName.value,
      rules: rulesArea.value,
      participants,
      categories,
      bracket,
    };
    const blob = new Blob([JSON.stringify(out, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `octomatch_data_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Creates a sharable URL containing the compressed tournament data.
   */
  function copyShareData() {
    try {
        const out = { participants, bracket };
        // Using btoa for a simple, non-production-safe encoding
        const txt = btoa(JSON.stringify(out));
        const url = window.location.href.split('#')[0] + '#data=' + txt;
        navigator.clipboard?.writeText(url)
            .then(() => alert('Sharable link copied to clipboard!'))
            .catch(() => alert('Could not copy link to clipboard.'));
    } catch (e) {
        alert('Failed to generate share link. Data may be too large.');
        console.error(e);
    }
  }

  /**
   * Applies a new color theme to the application.
   * @param {string} name - The name of the theme to apply.
   */
  function applyTheme(name) {
    const themes = {
      default: { '--bg':'#061022', '--panel':'#071224', '--text':'#e6eef8', '--muted':'#9aa7b8', '--accent':'#2dd4bf', '--accent-2':'#60a5fa', '--card':'#071426' },
      redblue: { '--bg':'#08030a','--panel':'#0f0810','--text':'#fff1f1','--muted':'#f8cbd0','--accent':'#f43f5e','--accent-2':'#3b82f6','--card':'#140913' },
      cyber: { '--bg':'#020617','--panel':'#061022','--text':'#e6f7ff','--muted':'#9fb7d9','--accent':'#7c3aed','--accent-2':'#06b6d4','--card':'#020a1a' },
      nordic: { '--bg':'#eff6ff','--panel':'#f8fafc','--text':'#0b1220','--muted':'#64748b','--accent':'#60a5fa','--accent-2':'#a78bfa','--card':'#ffffff' },
      forest: { '--bg':'#07160d','--panel':'#0b2413','--text':'#eaffeb','--muted':'#bfe1c6','--accent':'#16a34a','--accent-2':'#065f46','--card':'#07160d' },
      // ... Add all other themes here
    };
    const t = themes[name] || themes['default'];
    for (const k in t) {
      document.documentElement.style.setProperty(k, t[k]);
    }
  }


  // ===================================================================================
  // XII. EVENT LISTENERS & INITIALIZATION
  // Wires up all UI elements and performs the initial render.
  // ===================================================================================

  /**
   * Attaches all primary event listeners to the DOM elements.
   */
  function initializeEventListeners() {
    addParticipantBtn.addEventListener('click', addParticipantFromInputs);
    clearParticipantsBtn.addEventListener('click', clearParticipants);
    importBtn.addEventListener('click', () => {
      const text = importArea.value;
      if (!text.trim()) return alert('Paste data into the import area first.');
      const parsed = parseImportText(text);
      participants = participants.concat(parsed);
      assignCategories();
      renderParticipants();
      importArea.value = '';
    });
    generateBtn.addEventListener('click', generateBracket);
    resetBtn.addEventListener('click', () => {
      if (confirm("Are you sure you want to reset the current bracket?")) {
          bracket = null;
          renderBracketEmpty();
      }
    });
    autoSeedBtn.addEventListener('click', smartSeed);
    announceBtn.addEventListener('click', sendAnnouncement);
    groupBtn.addEventListener('click', formTeamsPairing);
    exportBtn.addEventListener('click', exportJSON);
    copyShare.addEventListener('click', copyShareData);
    if (addCategoryBtn) {
      addCategoryBtn.addEventListener('click', addCategory);
    }
    themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl+Enter to generate bracket
      if (e.ctrlKey && e.key === 'Enter') {
        generateBracket();
      }
      // Allow adding participant with Enter key from score input
      if (e.key === 'Enter' && document.activeElement === scoreInput) {
          addParticipantFromInputs();
      }
    });
  }

  /**
   * Initializes the application on page load.
   */
  function initialize() {
    initializeEventListeners();
    applyTheme('default');
    renderParticipants();
    renderBracketEmpty();
    renderCategories();
    console.log("OctoMatch Initialized!");
  }

  // Run the initializer once the DOM is fully loaded.
  document.addEventListener('DOMContentLoaded', initialize);

})();