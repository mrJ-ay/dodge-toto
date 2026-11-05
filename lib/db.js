/* =========================================================
   DODGE TOTO (피구 토토) — Database Module (Neon Postgres)
   - ns_players: 공유 잔고 연동 (카지노, 뱅킹, 자켓, 엄복동, 증권)
   - ns_ledger: 실시간 입출금 원장 (toto_bet, toto_win)
   - toto_matches: 경기 정보 및 통계
   - toto_bets: 유저 토토 베팅 내역
   ========================================================= */
import pg from 'pg';

pg.types.setTypeParser(20, v => Number(v)); // BIGINT -> number
pg.types.setTypeParser(1700, v => parseFloat(v)); // NUMERIC -> number

let pool = null;
let dbAvailable = false;

if (process.env.DATABASE_URL) {
  try {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 12,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    pool.on('error', e => console.error('[DB] Postgres Pool Error:', e.message));
  } catch (err) {
    console.warn('[DB] Failed to init pool:', err.message);
  }
}

// 오프라인/게스트 인메모리 폴백
const mem = {
  players: new Map(),
  matches: new Map(),
  bets: [],
  ledger: []
};

export async function q(text, params = []) {
  if (!pool) throw new Error('Database pool not initialized');
  return pool.query(text, params);
}

export async function initSchema() {
  if (!pool) {
    console.log('[DB] DATABASE_URL 없음. 인메모리 모드로 동작합니다.');
    return;
  }

  try {
    await pool.query('SELECT 1');
    dbAvailable = true;
    console.log('[DB] Neon Postgres 연결 성공. 피구 토토 시스템 가동!');

    // 1. ns_players
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ns_players (
        id               TEXT PRIMARY KEY,
        name             TEXT NOT NULL,
        balance          BIGINT NOT NULL DEFAULT 1000000 CHECK (balance >= 0),
        credit           INTEGER NOT NULL DEFAULT 500,
        spins            INTEGER NOT NULL DEFAULT 0,
        bankruptcies     INTEGER NOT NULL DEFAULT 0,
        last_bankrupt_at TIMESTAMPTZ,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. ns_ledger
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ns_ledger (
        id         BIGSERIAL PRIMARY KEY,
        player_id  TEXT NOT NULL,
        delta      BIGINT NOT NULL,
        balance    BIGINT NOT NULL,
        reason     TEXT NOT NULL,
        meta       JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ns_ledger_player ON ns_ledger(player_id, id DESC);
    `);

    // 3. toto_matches
    await pool.query(`
      CREATE TABLE IF NOT EXISTS toto_matches (
        id             TEXT PRIMARY KEY,
        team_a         JSONB NOT NULL,
        team_b         JSONB NOT NULL,
        odds_a         NUMERIC(6,2) NOT NULL,
        odds_b         NUMERIC(6,2) NOT NULL,
        odds_under     NUMERIC(6,2) NOT NULL DEFAULT 1.90,
        odds_over      NUMERIC(6,2) NOT NULL DEFAULT 1.90,
        under_sec      INTEGER NOT NULL DEFAULT 50,
        status         TEXT NOT NULL DEFAULT 'open',
        winner         TEXT,
        result_details JSONB,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_toto_matches_created ON toto_matches(created_at DESC);
    `);

    // 4. toto_bets
    await pool.query(`
      CREATE TABLE IF NOT EXISTS toto_bets (
        id          BIGSERIAL PRIMARY KEY,
        player_id   TEXT NOT NULL,
        match_id    TEXT NOT NULL,
        bet_type    TEXT NOT NULL,
        bet_amount  BIGINT NOT NULL CHECK (bet_amount > 0),
        odds        NUMERIC(6,2) NOT NULL,
        payout      BIGINT NOT NULL DEFAULT 0,
        status      TEXT NOT NULL DEFAULT 'pending',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_toto_bets_player ON toto_bets(player_id, id DESC);
      CREATE INDEX IF NOT EXISTS idx_toto_bets_match ON toto_bets(match_id);
    `);

    console.log('[DB] 피구 토토 스키마 및 인덱스 준비 완료!');
  } catch (err) {
    console.error('[DB] Schema init error:', err.message);
  }
}

export function isDbAvailable() {
  return dbAvailable;
}

// -------------------------------------------------------------
// Player & Balance Helpers
// -------------------------------------------------------------
export async function getOrCreatePlayer(id, name = '선수') {
  if (pool) {
    const res = await pool.query(
      `INSERT INTO ns_players (id, name, balance)
       VALUES ($1, $2, 1000000)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name, balance`,
      [id, name]
    );
    return res.rows[0];
  }

  // Memory fallback
  if (!mem.players.has(id)) {
    mem.players.set(id, { id, name, balance: 1_000_000 });
  }
  const p = mem.players.get(id);
  p.name = name;
  return p;
}

export async function getPlayerBalance(id) {
  if (pool) {
    const res = await pool.query(`SELECT id, name, balance FROM ns_players WHERE id = $1`, [id]);
    if (res.rows.length) return res.rows[0];
  }
  return mem.players.get(id) || { id, name: '게스트', balance: 1_000_000 };
}

// -------------------------------------------------------------
// Match Helpers
// -------------------------------------------------------------
export async function saveMatch(match) {
  if (pool) {
    await pool.query(
      `INSERT INTO toto_matches (id, team_a, team_b, odds_a, odds_b, odds_under, odds_over, under_sec, status, winner, result_details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         winner = EXCLUDED.winner,
         result_details = EXCLUDED.result_details`,
      [
        match.id,
        JSON.stringify(match.teamA),
        JSON.stringify(match.teamB),
        match.oddsA,
        match.oddsB,
        match.oddsUnder || 1.90,
        match.oddsOver || 1.90,
        match.underSec || 50,
        match.status,
        match.winner || null,
        match.resultDetails ? JSON.stringify(match.resultDetails) : null
      ]
    );
  } else {
    mem.matches.set(match.id, match);
  }
}

export async function getMatch(id) {
  if (pool) {
    const res = await pool.query(`SELECT * FROM toto_matches WHERE id = $1`, [id]);
    if (res.rows.length) {
      const r = res.rows[0];
      return {
        id: r.id,
        teamA: r.team_a,
        teamB: r.team_b,
        oddsA: Number(r.odds_a),
        oddsB: Number(r.odds_b),
        oddsUnder: Number(r.odds_under),
        oddsOver: Number(r.odds_over),
        underSec: r.under_sec,
        status: r.status,
        winner: r.winner,
        resultDetails: r.result_details,
        createdAt: r.created_at
      };
    }
  }
  return mem.matches.get(id) || null;
}

// -------------------------------------------------------------
// Bet Placement (Transactional Atomic)
// -------------------------------------------------------------
export async function placeBet({ playerId, playerName, matchId, betType, betAmount, odds }) {
  if (betAmount <= 0) throw new Error('베팅 금액은 0원보다 커야 합니다.');

  if (pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. 유저 잔고 확인 (FOR UPDATE lock)
      const pRes = await client.query(
        `SELECT balance FROM ns_players WHERE id = $1 FOR UPDATE`,
        [playerId]
      );
      if (!pRes.rows.length) throw new Error('유저를 찾을 수 없습니다.');
      const currentBal = Number(pRes.rows[0].balance);
      if (currentBal < betAmount) throw new Error(`잔액이 부족합니다. (현재 잔고: ${currentBal.toLocaleString()}원)`);

      const newBal = currentBal - betAmount;

      // 2. 잔고 차감
      await client.query(
        `UPDATE ns_players SET balance = $1 WHERE id = $2`,
        [newBal, playerId]
      );

      // 3. 베팅 등록
      const bRes = await client.query(
        `INSERT INTO toto_bets (player_id, match_id, bet_type, bet_amount, odds, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         RETURNING id, player_id, match_id, bet_type, bet_amount, odds, status, created_at`,
        [playerId, matchId, betType, betAmount, odds]
      );

      // 4. 원장(ns_ledger) 기록
      await client.query(
        `INSERT INTO ns_ledger (player_id, delta, balance_after, reason, ref)
         VALUES ($1, $2, $3, 'toto_bet', $4)`,
        [
          playerId,
          -betAmount,
          newBal,
          JSON.stringify({ matchId, betType, betAmount, odds })
        ]
      );

      await client.query('COMMIT');
      return {
        bet: bRes.rows[0],
        newBalance: newBal
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // Memory fallback
  const p = await getOrCreatePlayer(playerId, playerName);
  if (p.balance < betAmount) throw new Error('잔액이 부족합니다.');
  p.balance -= betAmount;
  const bet = {
    id: mem.bets.length + 1,
    player_id: playerId,
    match_id: matchId,
    bet_type: betType,
    bet_amount: betAmount,
    odds,
    payout: 0,
    status: 'pending',
    created_at: new Date()
  };
  mem.bets.push(bet);
  return { bet, newBalance: p.balance };
}

// -------------------------------------------------------------
// Settle Match & Payout
// -------------------------------------------------------------
export async function settleMatch({ matchId, winner, durationSec, remainingA, remainingB, resultDetails }) {
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. 경기 상태 완료 처리
      await client.query(
        `UPDATE toto_matches
         SET status = 'finished', winner = $1, result_details = $2
         WHERE id = $3`,
        [winner, JSON.stringify(resultDetails), matchId]
      );

      // 2. 해당 경기의 pending 배팅 조회
      const betsRes = await client.query(
        `SELECT * FROM toto_bets WHERE match_id = $1 AND status = 'pending' FOR UPDATE`,
        [matchId]
      );

      const payouts = [];

      for (const bet of betsRes.rows) {
        let isWon = false;
        if (bet.bet_type === 'win_a' && winner === 'team_a') isWon = true;
        if (bet.bet_type === 'win_b' && winner === 'team_b') isWon = true;
        if (bet.bet_type === 'under' && durationSec <= (resultDetails.underSec || 50)) isWon = true;
        if (bet.bet_type === 'over' && durationSec > (resultDetails.underSec || 50)) isWon = true;

        const payout = isWon ? Math.floor(Number(bet.bet_amount) * Number(bet.odds)) : 0;
        const newStatus = isWon ? 'won' : 'lost';

        // 베팅 업데이트
        await client.query(
          `UPDATE toto_bets SET status = $1, payout = $2 WHERE id = $3`,
          [newStatus, payout, bet.id]
        );

        if (isWon && payout > 0) {
          // 유저 잔고 가산
          const pRes = await client.query(
            `UPDATE ns_players
             SET balance = balance + $1
             WHERE id = $2
             RETURNING balance`,
            [payout, bet.player_id]
          );
          const newBal = Number(pRes.rows[0].balance);

          // 원장 기록
          await client.query(
            `INSERT INTO ns_ledger (player_id, delta, balance_after, reason, ref)
             VALUES ($1, $2, $3, 'toto_win', $4)`,
            [
              bet.player_id,
              payout,
              newBal,
              JSON.stringify({ matchId, betId: bet.id, betType: bet.bet_type, odds: bet.odds, payout })
            ]
          );

          payouts.push({ betId: bet.id, playerId: bet.player_id, payout, newBalance: newBal });
        }
      }

      await client.query('COMMIT');
      return { success: true, payouts };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // Memory fallback
  const m = mem.matches.get(matchId);
  if (m) {
    m.status = 'finished';
    m.winner = winner;
    m.resultDetails = resultDetails;
  }
  const matchBets = mem.bets.filter(b => b.match_id === matchId && b.status === 'pending');
  const payouts = [];
  for (const bet of matchBets) {
    let isWon = false;
    if (bet.bet_type === 'win_a' && winner === 'team_a') isWon = true;
    if (bet.bet_type === 'win_b' && winner === 'team_b') isWon = true;
    if (bet.bet_type === 'under' && durationSec <= (resultDetails.underSec || 50)) isWon = true;
    if (bet.bet_type === 'over' && durationSec > (resultDetails.underSec || 50)) isWon = true;

    bet.status = isWon ? 'won' : 'lost';
    bet.payout = isWon ? Math.floor(bet.bet_amount * bet.odds) : 0;
    if (isWon && bet.payout > 0) {
      const p = mem.players.get(bet.player_id);
      if (p) {
        p.balance += bet.payout;
        payouts.push({ betId: bet.id, playerId: bet.player_id, payout: bet.payout, newBalance: p.balance });
      }
    }
  }
  return { success: true, payouts };
}

// -------------------------------------------------------------
// Recent Bets & History
// -------------------------------------------------------------
export async function getPlayerBetHistory(playerId, limit = 15) {
  if (pool) {
    const res = await pool.query(
      `SELECT b.*, m.team_a, m.team_b, m.winner as match_winner
       FROM toto_bets b
       LEFT JOIN toto_matches m ON b.match_id = m.id
       WHERE b.player_id = $1
       ORDER BY b.id DESC
       LIMIT $2`,
      [playerId, limit]
    );
    return res.rows;
  }
  return mem.bets.filter(b => b.player_id === playerId).slice(-limit).reverse();
}
