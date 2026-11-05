/* =========================================================
   DODGE TOTO (피구 토토) — Main Client Application
   - Web Audio API Sound Synthesizer (Whistle, Hits, Fanfare)
   - ONEID SSO PKCE Flow & Sister App Token Detection
   - Real-time Match Simulation Playback & Betting Settlement
   ========================================================= */

// -------------------------------------------------------------
// Web Audio Sound Synthesizer
// -------------------------------------------------------------
class SoundFX {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // 경기 시작 호각 휘슬
  playWhistle() {
    this.init();
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2400, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(2800, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(2400, ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  }

  // 공 투구 휙 소리
  playThrow() {
    this.init();
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  // 캐치 성공 둔탁한 타격음
  playCatch() {
    this.init();
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  }

  // 피격 쾅 소리
  playHit() {
    this.init();
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  }

  // 부활 천사의 챠링 팡파레
  playRevive() {
    this.init();
    const ctx = this.ctx;
    const freqs = [523.25, 659.25, 783.99, 1046.50];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;

      const t = ctx.currentTime + i * 0.08;
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.005, t + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  // 당첨 코인 챠링
  playWin() {
    this.init();
    const ctx = this.ctx;
    const notes = [587.33, 739.99, 880.00, 1174.66, 1479.98];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;

      const t = ctx.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  }
}

const sfx = new SoundFX();

// -------------------------------------------------------------
// App State
// -------------------------------------------------------------
let currentUser = null;
let currentMatch = null;
let selectedBetType = 'win_a';
let config = {};
let court = null;
let simTimerInterval = null;

// DOM Elements
const userBalanceEl = document.getElementById('user-balance');
const btnRefreshBal = document.getElementById('btn-refresh-balance');
const authBox = document.getElementById('auth-box');
const userBox = document.getElementById('user-box');
const userNameEl = document.getElementById('user-name');
const btnLogin = document.getElementById('btn-login');
const btnGuest = document.getElementById('btn-guest');
const btnLogout = document.getElementById('btn-logout');

const matchIdTag = document.getElementById('match-id-tag');
const btnNewMatch = document.getElementById('btn-new-match');
const matchStatusPill = document.getElementById('match-status-pill');

// Team A Elements
const teamASymbol = document.getElementById('team-a-symbol');
const teamAName = document.getElementById('team-a-name');
const teamADesc = document.getElementById('team-a-desc');
const teamAPower = document.getElementById('team-a-power');
const teamAPowerVal = document.getElementById('team-a-power-val');
const teamACatch = document.getElementById('team-a-catch');
const teamACatchVal = document.getElementById('team-a-catch-val');
const teamASpeed = document.getElementById('team-a-speed');
const teamASpeedVal = document.getElementById('team-a-speed-val');
const teamARoster = document.getElementById('team-a-roster');

// Team B Elements
const teamBSymbol = document.getElementById('team-b-symbol');
const teamBName = document.getElementById('team-b-name');
const teamBDesc = document.getElementById('team-b-desc');
const teamBPower = document.getElementById('team-b-power');
const teamBPowerVal = document.getElementById('team-b-power-val');
const teamBCatch = document.getElementById('team-b-catch');
const teamBCatchVal = document.getElementById('team-b-catch-val');
const teamBSpeed = document.getElementById('team-b-speed');
const teamBSpeedVal = document.getElementById('team-b-speed-val');
const teamBRoster = document.getElementById('team-b-roster');

// Odds & Bets
const vsOddsA = document.getElementById('vs-odds-a');
const vsOddsB = document.getElementById('vs-odds-b');
const optWinA = document.getElementById('opt-win-a');
const optWinB = document.getElementById('opt-win-b');
const optUnder = document.getElementById('opt-under');
const optOver = document.getElementById('opt-over');
const optTeamATitle = document.getElementById('opt-team-a-title');
const optTeamBTitle = document.getElementById('opt-team-b-title');
const optOddsA = document.getElementById('opt-odds-a');
const optOddsB = document.getElementById('opt-odds-b');
const optOddsUnder = document.getElementById('opt-odds-under');
const optOddsOver = document.getElementById('opt-odds-over');

const betAmountInput = document.getElementById('bet-amount');
const expectedPayoutEl = document.getElementById('expected-payout');
const btnStartGame = document.getElementById('btn-start-game');

// Simulation
const simClockEl = document.getElementById('sim-clock');
const liveCommentaryEl = document.getElementById('live-commentary');
const btnSkipSim = document.getElementById('btn-skip-sim');

// Modal
const resultModal = document.getElementById('result-modal');
const modalIcon = document.getElementById('modal-result-icon');
const modalTitle = document.getElementById('modal-result-title');
const modalSummary = document.getElementById('modal-match-summary');
const modalPayoutVal = document.getElementById('modal-payout-val');
const mstatDuration = document.getElementById('mstat-duration');
const mstatUnderover = document.getElementById('mstat-underover');
const mstatCatches = document.getElementById('mstat-catches');
const mstatRevives = document.getElementById('mstat-revives');
const btnModalClose = document.getElementById('btn-modal-close');

const historyTbody = document.getElementById('history-tbody');

// -------------------------------------------------------------
// Authentication Token Helpers
// -------------------------------------------------------------
function getToken() {
  return (
    localStorage.getItem('dodge_toto_token') ||
    localStorage.getItem('oneid_token') ||
    localStorage.getItem('ns_auth') ||
    sessionStorage.getItem('oneid_token')
  );
}

function setToken(token) {
  localStorage.setItem('dodge_toto_token', token);
}

function clearToken() {
  localStorage.removeItem('dodge_toto_token');
  localStorage.removeItem('oneid_token');
  localStorage.removeItem('ns_auth');
}

// -------------------------------------------------------------
// API Wrapper
// -------------------------------------------------------------
async function api(endpoint, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(endpoint, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

// -------------------------------------------------------------
// Initialization
// -------------------------------------------------------------
async function init() {
  court = new window.DodgeballCourt('dodgeCanvas');

  // Load Config
  try {
    config = await api('/api/config');
    // Setup Ecosystem URLs if needed
    if (config.bankUrl) document.getElementById('link-bank').href = config.bankUrl;
    if (config.slotsUrl) document.getElementById('link-slots').href = config.slotsUrl;
    if (config.nexusUrl) document.getElementById('link-nexus').href = config.nexusUrl;
    if (config.jarketUrl) document.getElementById('link-jarket').href = config.jarketUrl;
    if (config.atelierUrl) document.getElementById('link-atelier').href = config.atelierUrl;
  } catch (err) {
    console.warn('Config load error:', err);
  }

  // Check URL PKCE code callback
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  if (code) {
    await handleOAuthCallback(code);
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // Check existing token or guest
  await refreshUser();
  await loadCurrentMatch();
  await refreshHistory();

  setupEventListeners();
}

// -------------------------------------------------------------
// Auth & User Management
// -------------------------------------------------------------
async function refreshUser() {
  const token = getToken();
  if (!token) {
    // Show guest fallback by default for instant play
    authBox.classList.remove('hidden');
    userBox.classList.add('hidden');
    userBalanceEl.textContent = '₩ 0';
    return;
  }

  try {
    const data = await api('/api/user/me');
    currentUser = data.user;
    userNameEl.textContent = currentUser.name;
    userBalanceEl.textContent = `₩ ${Number(currentUser.balance).toLocaleString()}`;
    authBox.classList.add('hidden');
    userBox.classList.remove('hidden');
  } catch (err) {
    console.warn('User session invalid:', err.message);
    clearToken();
    authBox.classList.remove('hidden');
    userBox.classList.add('hidden');
  }
}

function startGuestLogin() {
  const guestNum = Math.floor(1000 + Math.random() * 9000);
  const guestName = `토토선수#${guestNum}`;
  const token = `guest_${guestNum}_${encodeURIComponent(guestName)}`;
  setToken(token);
  refreshUser();
}

function startOneIdLogin() {
  const oneidUrl = config.oneidUrl || 'https://oneid-icvq.onrender.com';
  const clientId = config.clientId || 'dodge-toto';
  const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);

  // Simple state
  const state = Math.random().toString(36).substring(2);
  localStorage.setItem('oauth_state', state);

  window.location.href = `${oneidUrl}/login.html?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&state=${state}`;
}

async function handleOAuthCallback(code) {
  try {
    const oneidUrl = config.oneidUrl || 'https://oneid-icvq.onrender.com';
    const clientId = config.clientId || 'dodge-toto';
    const redirectUri = window.location.origin + window.location.pathname;

    const res = await fetch(`${oneidUrl}/api/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        redirect_uri: redirectUri
      })
    });

    const data = await res.json();
    if (data.access_token) {
      setToken(data.access_token);
      await refreshUser();
    }
  } catch (err) {
    console.error('OAuth token exchange failed:', err);
  }
}

// -------------------------------------------------------------
// Match & Roster Loading
// -------------------------------------------------------------
async function loadCurrentMatch() {
  try {
    const data = await api('/api/match/current');
    currentMatch = data.match;
    renderMatch(currentMatch);
    court.loadMatch(currentMatch);
  } catch (err) {
    console.error('Failed to load match:', err);
  }
}

function renderMatch(match) {
  matchIdTag.textContent = `MATCH #${match.id.slice(-6).toUpperCase()}`;

  // Team A
  const tA = match.teamA;
  teamASymbol.textContent = tA.symbol;
  teamAName.textContent = tA.name;
  teamADesc.textContent = tA.desc;
  teamAPower.style.width = `${tA.stats.power}%`;
  teamAPowerVal.textContent = tA.stats.power;
  teamACatch.style.width = `${tA.stats.catchRate}%`;
  teamACatchVal.textContent = tA.stats.catchRate;
  teamASpeed.style.width = `${tA.stats.speed}%`;
  teamASpeedVal.textContent = tA.stats.speed;

  renderRoster(teamARoster, tA.players);

  // Team B
  const tB = match.teamB;
  teamBSymbol.textContent = tB.symbol;
  teamBName.textContent = tB.name;
  teamBDesc.textContent = tB.desc;
  teamBPower.style.width = `${tB.stats.power}%`;
  teamBPowerVal.textContent = tB.stats.power;
  teamBCatch.style.width = `${tB.stats.catchRate}%`;
  teamBCatchVal.textContent = tB.stats.catchRate;
  teamBSpeed.style.width = `${tB.stats.speed}%`;
  teamBSpeedVal.textContent = tB.stats.speed;

  renderRoster(teamBRoster, tB.players);

  // Odds
  vsOddsA.textContent = match.oddsA.toFixed(2);
  vsOddsB.textContent = match.oddsB.toFixed(2);
  optTeamATitle.textContent = tA.name;
  optTeamBTitle.textContent = tB.name;
  optOddsA.textContent = `x ${match.oddsA.toFixed(2)}`;
  optOddsB.textContent = `x ${match.oddsB.toFixed(2)}`;
  optOddsUnder.textContent = `x ${(match.oddsUnder || 1.90).toFixed(2)}`;
  optOddsOver.textContent = `x ${(match.oddsOver || 1.90).toFixed(2)}`;

  matchStatusPill.textContent = '베팅 접수 중';
  matchStatusPill.style.color = '#60a5fa';
  btnStartGame.disabled = false;

  updateExpectedPayout();
}

function renderRoster(container, players) {
  container.innerHTML = '';
  players.forEach(p => {
    const isOutfield = p.role === 'outer';
    const div = document.createElement('div');
    div.className = `roster-item ${isOutfield ? 'outfield' : ''}`;
    div.innerHTML = `
      <span>${isOutfield ? '🎯' : '🏃'}</span>
      <b>No.${p.num} ${p.name}</b>
      <small>(${p.title})</small>
    `;
    container.appendChild(div);
  });
}

// -------------------------------------------------------------
// Betting & Payout Calculation
// -------------------------------------------------------------
function getSelectedOdds() {
  if (!currentMatch) return 1.90;
  if (selectedBetType === 'win_a') return currentMatch.oddsA;
  if (selectedBetType === 'win_b') return currentMatch.oddsB;
  if (selectedBetType === 'under') return currentMatch.oddsUnder || 1.90;
  if (selectedBetType === 'over') return currentMatch.oddsOver || 1.90;
  return 1.90;
}

function updateExpectedPayout() {
  const amt = Number(betAmountInput.value) || 0;
  const odds = getSelectedOdds();
  const payout = Math.floor(amt * odds);
  expectedPayoutEl.textContent = `₩ ${payout.toLocaleString()}`;
}

// -------------------------------------------------------------
// Game Match Execution
// -------------------------------------------------------------
async function startMatch() {
  if (!currentUser) {
    startGuestLogin();
  }

  const amt = Number(betAmountInput.value) || 0;
  if (amt <= 0) {
    alert('베팅 금액을 1원 이상 입력해 주세요.');
    return;
  }

  if (currentUser.balance < amt) {
    alert(`보유 잔고가 부족합니다. (현재 잔고: ₩ ${currentUser.balance.toLocaleString()})`);
    return;
  }

  btnStartGame.disabled = true;
  matchStatusPill.textContent = '경기 진행 중 🔥';
  matchStatusPill.style.color = '#f59e0b';

  try {
    // 1. Place Bet
    const betRes = await api('/api/bet/place', {
      method: 'POST',
      body: JSON.stringify({
        matchId: currentMatch.id,
        betType: selectedBetType,
        betAmount: amt
      })
    });

    currentUser.balance = betRes.newBalance;
    userBalanceEl.textContent = `₩ ${Number(currentUser.balance).toLocaleString()}`;

    // 2. Start Match Simulation on Server
    const matchRes = await api('/api/match/start', {
      method: 'POST',
      body: JSON.stringify({ matchId: currentMatch.id })
    });

    const simulation = matchRes.simulation;
    const payouts = matchRes.payouts || [];

    // 3. Play Whistle Sound & Start Canvas Simulation
    sfx.playWhistle();

    // Start Simulation Clock
    let elapsed = 0;
    clearInterval(simTimerInterval);
    simTimerInterval = setInterval(() => {
      elapsed += 0.1 * court.speedMultiplier;
      const sec = Math.floor(elapsed);
      const ms = Math.floor((elapsed % 1) * 10);
      simClockEl.textContent = `00:${String(sec).padStart(2, '0')}.${ms}`;
    }, 100);

    court.startSimulation(
      simulation,
      (commentaryText) => {
        liveCommentaryEl.textContent = commentaryText;
        if (commentaryText.includes('피격') || commentaryText.includes('OUT')) sfx.playHit();
        else if (commentaryText.includes('캐치')) sfx.playCatch();
        else if (commentaryText.includes('부활')) sfx.playRevive();
        else if (commentaryText.includes('슛') || commentaryText.includes('패스')) sfx.playThrow();
      },
      (simResult) => {
        clearInterval(simTimerInterval);
        handleMatchCompletion(matchRes, payouts);
      }
    );
  } catch (err) {
    alert(`오류: ${err.message}`);
    btnStartGame.disabled = false;
    matchStatusPill.textContent = '베팅 접수 중';
    matchStatusPill.style.color = '#60a5fa';
  }
}

function handleMatchCompletion(matchRes, payouts) {
  const sim = matchRes.simulation;
  const match = matchRes.match;
  const isWon = payouts.length > 0 && payouts.some(p => p.payout > 0);
  const totalPayout = payouts.reduce((s, p) => s + (p.payout || 0), 0);

  // Update user balance from response
  currentUser.balance = matchRes.userBalance;
  userBalanceEl.textContent = `₩ ${Number(currentUser.balance).toLocaleString()}`;

  matchStatusPill.textContent = '경기 종료';
  matchStatusPill.style.color = '#34d399';

  // Sound FX
  if (isWon) {
    sfx.playWin();
  }

  // Populate Modal
  const winTeamName = sim.winner === 'team_a' ? match.teamA.name : match.teamB.name;
  modalIcon.textContent = isWon ? '🎉' : '💀';
  modalTitle.textContent = isWon ? '베팅 적중! 축하합니다!' : '아쉽게도 미적중 되었습니다.';
  modalSummary.textContent = `승리팀: ${winTeamName} · 총 경기시간: ${sim.durationSec}초`;

  if (isWon) {
    modalPayoutVal.textContent = `+₩ ${totalPayout.toLocaleString()}`;
    modalPayoutVal.style.color = '#34d399';
  } else {
    modalPayoutVal.textContent = '0원 (다음 경기를 노려보세요!)';
    modalPayoutVal.style.color = '#ef4444';
  }

  mstatDuration.textContent = `${sim.durationSec}초`;
  mstatUnderover.textContent = sim.isUnder ? '언더 (50초 이하)' : '오버 (50초 초과)';
  mstatCatches.textContent = `${sim.totalCatches}회`;
  mstatRevives.textContent = `${sim.totalRevives}회`;

  resultModal.classList.remove('hidden');

  refreshHistory();
}

// -------------------------------------------------------------
// History
// -------------------------------------------------------------
async function refreshHistory() {
  if (!currentUser) return;
  try {
    const data = await api('/api/bet/history');
    renderHistory(data.history || []);
  } catch (err) {
    console.warn('Failed to load history:', err);
  }
}

function renderHistory(list) {
  if (!list.length) {
    historyTbody.innerHTML = `<tr><td colspan="7" class="empty-row">베팅 내역이 없습니다. 경기에 참여해 보세요!</td></tr>`;
    return;
  }

  historyTbody.innerHTML = '';
  list.forEach(b => {
    const tr = document.createElement('tr');
    let badgeClass = 'badge-pending';
    let badgeText = '진행 중';
    if (b.status === 'won') {
      badgeClass = 'badge-won';
      badgeText = '적중 🏆';
    } else if (b.status === 'lost') {
      badgeClass = 'badge-lost';
      badgeText = '미적중';
    }

    let betTypeStr = b.bet_type;
    if (b.bet_type === 'win_a') betTypeStr = `${b.team_a?.name || '홈팀'} 승`;
    else if (b.bet_type === 'win_b') betTypeStr = `${b.team_b?.name || '원정팀'} 승`;
    else if (b.bet_type === 'under') betTypeStr = '언더 (50초 이하)';
    else if (b.bet_type === 'over') betTypeStr = '오버 (50초 초과)';

    tr.innerHTML = `
      <td>#${b.match_id ? b.match_id.slice(-6).toUpperCase() : '---'}</td>
      <td><b>${b.team_a?.name || '홈'}</b> VS <b>${b.team_b?.name || '원정'}</b></td>
      <td>${betTypeStr}</td>
      <td>₩ ${Number(b.bet_amount).toLocaleString()}</td>
      <td>x ${Number(b.odds).toFixed(2)}</td>
      <td><span class="${badgeClass}">${badgeText}</span></td>
      <td style="font-weight: 800; color: ${b.payout > 0 ? '#34d399' : 'var(--text-dim)'}">
        ${b.payout > 0 ? `+₩ ${Number(b.payout).toLocaleString()}` : '-'}
      </td>
    `;
    historyTbody.appendChild(tr);
  });
}

// -------------------------------------------------------------
// Event Listeners
// -------------------------------------------------------------
function setupEventListeners() {
  // Balance refresh
  btnRefreshBal.addEventListener('click', refreshUser);

  // Auth
  btnLogin.addEventListener('click', startOneIdLogin);
  btnGuest.addEventListener('click', startGuestLogin);
  btnLogout.addEventListener('click', () => {
    clearToken();
    currentUser = null;
    refreshUser();
  });

  // Roll New Match
  btnNewMatch.addEventListener('click', async () => {
    btnNewMatch.disabled = true;
    try {
      const data = await api('/api/match/new', { method: 'POST' });
      currentMatch = data.match;
      renderMatch(currentMatch);
      court.loadMatch(currentMatch);
    } catch (err) {
      alert(`새 경기 불러오기 실패: ${err.message}`);
    } finally {
      btnNewMatch.disabled = false;
    }
  });

  // Betting Options
  [optWinA, optWinB, optUnder, optOver].forEach(btn => {
    btn.addEventListener('click', () => {
      [optWinA, optWinB, optUnder, optOver].forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedBetType = btn.dataset.bet;
      updateExpectedPayout();
    });
  });

  // Quick Chips
  document.querySelectorAll('.chip-btn[data-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      const add = Number(btn.dataset.add);
      betAmountInput.value = (Number(betAmountInput.value) || 0) + add;
      updateExpectedPayout();
    });
  });

  document.getElementById('btn-chip-allin').addEventListener('click', () => {
    if (currentUser && currentUser.balance > 0) {
      betAmountInput.value = currentUser.balance;
      updateExpectedPayout();
    }
  });

  betAmountInput.addEventListener('input', updateExpectedPayout);

  // Start Match
  btnStartGame.addEventListener('click', startMatch);

  // Speed controls
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      court.setSpeed(Number(btn.dataset.speed));
    });
  });

  // Skip simulation
  btnSkipSim.addEventListener('click', () => {
    court.skipToEnd();
  });

  // Modal Close & Prepare Next Match
  btnModalClose.addEventListener('click', async () => {
    resultModal.classList.add('hidden');
    // Load new match
    const data = await api('/api/match/new', { method: 'POST' });
    currentMatch = data.match;
    renderMatch(currentMatch);
    court.loadMatch(currentMatch);
  });
}

// Start
document.addEventListener('DOMContentLoaded', init);
