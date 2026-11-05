/* =========================================================
   DODGE TOTO (피구 토토) — Express Server
   - Neon Postgres & ns_players balance integration
   - Rule-based Dodgeball Simulation & Sports Toto
   ========================================================= */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  initSchema,
  isDbAvailable,
  getOrCreatePlayer,
  getPlayerBalance,
  saveMatch,
  getMatch,
  placeBet,
  settleMatch,
  getPlayerBetHistory
} from './lib/db.js';
import { requireAuth, ONEID_URL, CLIENT_ID } from './lib/auth.js';
import { createMatch, simulateMatch, CLUBS } from './lib/engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5508;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Current active match cache
let activeMatch = null;

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'dodge-toto',
    db: isDbAvailable(),
    time: new Date().toISOString()
  });
});

// Config
app.get('/api/config', (req, res) => {
  res.json({
    oneidUrl: ONEID_URL,
    clientId: CLIENT_ID,
    slotsUrl: process.env.SLOTS_URL || 'https://vegas-slots-2izy.onrender.com',
    jarketUrl: process.env.JARKET_URL || 'https://jarket.onrender.com',
    bankUrl: process.env.BANK_URL || 'https://one-bank-lm2p.onrender.com',
    nexusUrl: process.env.NEXUS_URL || 'https://nexus-exchange-l9i8.onrender.com',
    atelierUrl: process.env.ATELIER_URL || 'https://atelier-j.vercel.app'
  });
});

// Current User & Balance
app.get('/api/user/me', requireAuth, async (req, res) => {
  try {
    const p = await getPlayerBalance(req.user.id);
    res.json({
      ok: true,
      user: {
        id: p.id,
        name: p.name,
        balance: Number(p.balance)
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Get Current Match (or create one)
app.get('/api/match/current', async (req, res) => {
  try {
    if (!activeMatch || activeMatch.status === 'finished') {
      activeMatch = createMatch();
      await saveMatch(activeMatch);
    }
    res.json({ ok: true, match: activeMatch });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Request New Matchup
app.post('/api/match/new', async (req, res) => {
  try {
    activeMatch = createMatch();
    await saveMatch(activeMatch);
    res.json({ ok: true, match: activeMatch });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Place Bet on Current Match
app.post('/api/bet/place', requireAuth, async (req, res) => {
  try {
    const { matchId, betType, betAmount } = req.body;
    if (!matchId || !betType || !betAmount) {
      return res.status(400).json({ ok: false, error: '필수 배팅 정보가 누락되었습니다.' });
    }

    if (!activeMatch || activeMatch.id !== matchId) {
      return res.status(400).json({ ok: false, error: '현재 진행 중인 경기가 아닙니다.' });
    }

    if (activeMatch.status !== 'open') {
      return res.status(400).json({ ok: false, error: '이미 시작되었거나 마감된 경기입니다.' });
    }

    let odds = 1.90;
    if (betType === 'win_a') odds = activeMatch.oddsA;
    else if (betType === 'win_b') odds = activeMatch.oddsB;
    else if (betType === 'under') odds = activeMatch.oddsUnder;
    else if (betType === 'over') odds = activeMatch.oddsOver;
    else return res.status(400).json({ ok: false, error: '유효하지 않은 배팅 유형입니다.' });

    const result = await placeBet({
      playerId: req.user.id,
      playerName: req.user.name,
      matchId,
      betType,
      betAmount: Number(betAmount),
      odds
    });

    res.json({
      ok: true,
      bet: result.bet,
      newBalance: result.newBalance
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Start Match & Settle (User-initiated On-Demand)
app.post('/api/match/start', requireAuth, async (req, res) => {
  try {
    const { matchId } = req.body;
    if (!activeMatch || activeMatch.id !== matchId) {
      return res.status(400).json({ ok: false, error: '경기를 찾을 수 없습니다.' });
    }

    if (activeMatch.status === 'finished') {
      return res.status(400).json({ ok: false, error: '이미 종료된 경기입니다.' });
    }

    activeMatch.status = 'playing';

    // Run deterministic rule-based physics simulation
    const sim = simulateMatch(activeMatch);

    // Settle bets and payouts in database
    const settlement = await settleMatch({
      matchId,
      winner: sim.winner,
      durationSec: sim.durationSec,
      remainingA: sim.remainingA,
      remainingB: sim.remainingB,
      resultDetails: {
        underSec: sim.underSec,
        isUnder: sim.isUnder,
        isOver: sim.isOver,
        remainingA: sim.remainingA,
        remainingB: sim.remainingB,
        totalCatches: sim.totalCatches,
        totalRevives: sim.totalRevives
      }
    });

    activeMatch.status = 'finished';
    activeMatch.winner = sim.winner;
    activeMatch.resultDetails = sim;

    // Fetch user's updated balance
    const updatedUser = await getPlayerBalance(req.user.id);

    res.json({
      ok: true,
      match: activeMatch,
      simulation: sim,
      payouts: settlement.payouts,
      userBalance: Number(updatedUser.balance)
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Bet History
app.get('/api/bet/history', requireAuth, async (req, res) => {
  try {
    const history = await getPlayerBetHistory(req.user.id, 20);
    res.json({ ok: true, history });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Start Server
async function start() {
  await initSchema();

  // Create initial match
  activeMatch = createMatch();
  await saveMatch(activeMatch);

  app.listen(PORT, () => {
    console.log(`[DODGE TOTO] 서버 시작: http://localhost:${PORT}`);
  });
}

start();
