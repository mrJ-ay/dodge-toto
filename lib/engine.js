/* =========================================================
   DODGE TOTO (피구 토토) — Match & Algorithmic Physics Engine
   - 100% Rule-Based Physics & Behavioral Tree (No AI / LLM)
   - Authentic Korean Classic Dodgeball Rules (내야 4 + 외야 1)
   - Outfield Kill = Inner Revival System
   - Dynamic Odds & Seed-based Deterministic Simulation
   ========================================================= */

export const CLUBS = [
  {
    id: 'flame_tigers',
    name: '불꽃 타이거즈',
    symbol: '🐯',
    color: '#ff4444',
    subColor: '#ffaa00',
    desc: '화끈한 공격력과 압도적인 불꽃 강슛으로 상대를 초토화하는 전통의 강호',
    archetype: 'power',
    statBonus: { power: 15, speed: 5, catchRate: -5, dodge: 0 }
  },
  {
    id: 'gale_dolphins',
    name: '질풍 돌핀스',
    symbol: '🐬',
    color: '#00d2ff',
    subColor: '#0077ff',
    desc: '눈부신 기동력과 외야-내야 간 유기적인 패스워크로 상대를 농락하는 테크니션 군단',
    archetype: 'speed',
    statBonus: { power: -5, speed: 15, catchRate: 5, dodge: 10 }
  },
  {
    id: 'iron_rhinos',
    name: '강철 라이노스',
    symbol: '🦏',
    color: '#a0aab8',
    subColor: '#ff8800',
    desc: '철벽의 반사신경과 경이로운 캐치 성공률로 상대의 강슛을 무력화하는 방패',
    archetype: 'defense',
    statBonus: { power: 0, speed: -5, catchRate: 20, dodge: 5 }
  },
  {
    id: 'neon_vipers',
    name: '네온 바이퍼스',
    symbol: '🐍',
    color: '#00ff88',
    subColor: '#a855f7',
    desc: '예측 불허의 스네이크 궤적 변화구와 사각지대 기습으로 빈틈을 찌르는 독사들',
    archetype: 'trick',
    statBonus: { power: 8, speed: 8, catchRate: -2, dodge: 12 }
  },
  {
    id: 'white_eagles',
    name: '백호 이글스',
    symbol: '🦅',
    color: '#f8fafc',
    subColor: '#0284c7',
    desc: '완벽한 공수 밸런스와 높은 외야 킬 복귀율을 자랑하는 정석 피구의 명가',
    archetype: 'balance',
    statBonus: { power: 5, speed: 5, catchRate: 8, dodge: 8 }
  },
  {
    id: 'black_dragons',
    name: '흑룡 드래곤즈',
    symbol: '🐉',
    color: '#1e1b4b',
    subColor: '#ef4444',
    desc: '위기에 몰릴수록 필살기 게이지가 폭발하여 역전극을 만들어내는 언더독의 제왕',
    archetype: 'comeback',
    statBonus: { power: 12, speed: 4, catchRate: 4, dodge: 6 }
  }
];

const FIRST_NAMES = ['강', '민', '성', '철', '태', '준', '현', '진', '호', '영', '지', '우', '찬', '선', '용'];
const LAST_NAMES = ['호', '수', '우', '식', '배', '훈', '빈', '민', '욱', '혁', '석', '준', '환', '표', '범'];

function randomPlayerName() {
  const f = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const l = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return f + l;
}

// -------------------------------------------------------------
// Team Generator
// -------------------------------------------------------------
export function generateTeam(club, isHome = true) {
  const players = [];
  const bonus = club.statBonus || {};

  // 4 내야수 + 1 외야수
  const positions = ['inner_leader', 'inner_ace', 'inner_guard', 'inner_feeder', 'outfield_striker'];
  const titles = ['주장·올라운더', '에이스·포격수', '가드·철벽수비', '피더·패스조율', '외야 스나이퍼'];

  for (let i = 0; i < 5; i++) {
    const isOutfield = i === 4;
    const basePower = 65 + Math.floor(Math.random() * 20) + (bonus.power || 0);
    const baseSpeed = 65 + Math.floor(Math.random() * 20) + (bonus.speed || 0);
    const baseCatch = 50 + Math.floor(Math.random() * 25) + (bonus.catchRate || 0);
    const baseDodge = 55 + Math.floor(Math.random() * 25) + (bonus.dodge || 0);

    players.push({
      id: `${isHome ? 'A' : 'B'}_${i + 1}`,
      num: i + 1,
      name: randomPlayerName(),
      title: titles[i],
      role: isOutfield ? 'outer' : 'inner',
      initialRole: isOutfield ? 'outer' : 'inner',
      power: Math.min(99, Math.max(50, basePower)),
      speed: Math.min(99, Math.max(50, baseSpeed)),
      catchRate: Math.min(95, Math.max(40, baseCatch)),
      dodge: Math.min(95, Math.max(45, baseDodge)),
      special: i === 1 ? '불꽃 강슛' : (i === 4 ? '외야 저격슛' : '집중 캐치'),
      stamina: 100,
      maxStamina: 100,
      alive: true
    });
  }

  // 팀 종합 레이팅
  const avgPower = players.reduce((s, p) => s + p.power, 0) / 5;
  const avgCatch = players.reduce((s, p) => s + p.catchRate, 0) / 5;
  const avgSpeed = players.reduce((s, p) => s + p.speed, 0) / 5;
  const avgDodge = players.reduce((s, p) => s + p.dodge, 0) / 5;

  const totalRating = Math.round(avgPower * 0.35 + avgCatch * 0.30 + avgSpeed * 0.20 + avgDodge * 0.15);

  return {
    clubId: club.id,
    name: club.name,
    symbol: club.symbol,
    color: club.color,
    subColor: club.subColor,
    desc: club.desc,
    archetype: club.archetype,
    rating: totalRating,
    stats: {
      power: Math.round(avgPower),
      catchRate: Math.round(avgCatch),
      speed: Math.round(avgSpeed),
      dodge: Math.round(avgDodge)
    },
    players
  };
}

// -------------------------------------------------------------
// Match Creation & Odds Calculation
// -------------------------------------------------------------
export function createMatch() {
  // 클럽 2개 무작위 선발 (서로 다른 클럽)
  const shuffled = [...CLUBS].sort(() => Math.random() - 0.5);
  const clubA = shuffled[0];
  const clubB = shuffled[1];

  const teamA = generateTeam(clubA, true);
  const teamB = generateTeam(clubB, false);

  // 배당률 산출 (Elo-Logistic 공식)
  const diff = teamA.rating - teamB.rating; // e.g. -10 ~ +10
  const probA = 1 / (1 + Math.pow(10, -diff / 40));
  const probB = 1 - probA;

  // 하우스 마진 약 8%
  const margin = 0.92;
  const rawOddsA = margin / probA;
  const rawOddsB = margin / probB;

  const oddsA = Math.max(1.20, Math.min(3.80, Math.round(rawOddsA * 100) / 100));
  const oddsB = Math.max(1.20, Math.min(3.80, Math.round(rawOddsB * 100) / 100));

  const matchId = `match_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  return {
    id: matchId,
    teamA,
    teamB,
    oddsA,
    oddsB,
    oddsUnder: 1.90,
    oddsOver: 1.90,
    underSec: 50,
    status: 'open',
    seed: Math.floor(Math.random() * 1_000_000),
    createdAt: new Date().toISOString()
  };
}

// -------------------------------------------------------------
// Deterministic Match Simulation Engine
// - Returns full event timeline, winner, and final stats
// -------------------------------------------------------------
export function simulateMatch(match) {
  // PRNG based on seed
  let s = match.seed || 12345;
  function rng() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  }

  // Clone teams for simulation
  const teamA = JSON.parse(JSON.stringify(match.teamA));
  const teamB = JSON.parse(JSON.stringify(match.teamB));

  let innersA = teamA.players.filter(p => p.role === 'inner');
  let innersB = teamB.players.filter(p => p.role === 'inner');
  let outersA = teamA.players.filter(p => p.role === 'outer');
  let outersB = teamB.players.filter(p => p.role === 'outer');

  const events = [];
  let timeSec = 0;
  let ballTeam = rng() < 0.5 ? 'A' : 'B'; // 점프볼
  events.push({
    time: 0,
    type: 'START',
    text: `심판의 호각 소리와 함께 경기 시작! [${ballTeam === 'A' ? teamA.name : teamB.name}] 점프볼 선점!`
  });

  let passStreak = 0;
  let totalCatches = 0;
  let totalRevives = 0;

  // 최대 90초 시뮬레이션
  while (innersA.length > 0 && innersB.length > 0 && timeSec < 90) {
    const delta = 1.5 + rng() * 2.5; // 한 턴당 1.5~4.0초
    timeSec += delta;

    const currentTeam = ballTeam === 'A' ? teamA : teamB;
    const enemyTeam = ballTeam === 'A' ? teamB : teamA;
    const currentInners = ballTeam === 'A' ? innersA : innersB;
    const currentOuters = ballTeam === 'A' ? outersA : outersB;
    const enemyInners = ballTeam === 'A' ? innersB : innersA;
    const enemyOuters = ballTeam === 'A' ? outersB : outersA;

    // 공격자 선발
    const attackerPool = [...currentInners, ...currentOuters];
    const attacker = attackerPool[Math.floor(rng() * attackerPool.length)];
    const isOutfieldAttack = attacker.role === 'outer';

    // 외야수에게 패스하는 전술인지 확인 (35% 확률로 패스 연계)
    if (!isOutfieldAttack && currentOuters.length > 0 && passStreak === 0 && rng() < 0.35) {
      passStreak++;
      const targetOuter = currentOuters[0];
      events.push({
        time: Math.round(timeSec * 10) / 10,
        type: 'PASS',
        team: ballTeam,
        text: `[${currentTeam.name}] ${attacker.name} 선수가 상대 진영 뒤쪽 외야의 ${targetOuter.name} 선수에게 날카로운 패스 연결!`
      });
      continue;
    }

    passStreak = 0;

    // 타겟 선정 (적 내야수 중 하나)
    const target = enemyInners[Math.floor(rng() * enemyInners.length)];
    const isSpecialShot = rng() < 0.20; // 20% 필살 슛

    const shotPower = attacker.power * (isSpecialShot ? 1.4 : 1.0);
    const targetCatchProb = (target.catchRate / 100) * (isSpecialShot ? 0.35 : 0.85);
    const targetDodgeProb = (target.dodge / 100) * (isSpecialShot ? 0.45 : 0.85);

    const roll = rng();

    if (roll < targetCatchProb) {
      // 1. 캐치 성공!
      totalCatches++;
      ballTeam = ballTeam === 'A' ? 'B' : 'A'; // 공 소유권 전환
      events.push({
        time: Math.round(timeSec * 10) / 10,
        type: 'CATCH',
        team: ballTeam,
        text: `[${enemyTeam.name}] ${target.name} 선수의 눈부신 정면 다이빙 캐치 성공! 공격권 역전!`
      });
    } else if (roll < targetCatchProb + targetDodgeProb) {
      // 2. 아슬아슬 회피 성공!
      // 공이 바닥에 튕겨 누구에게 갈지
      ballTeam = rng() < 0.5 ? 'A' : 'B';
      events.push({
        time: Math.round(timeSec * 10) / 10,
        type: 'DODGE',
        team: ballTeam,
        text: `[${enemyTeam.name}] ${target.name} 선수가 전광석화의 슬라이딩으로 ${attacker.name}의 ${isSpecialShot ? '불꽃 슛을' : '강슛을'} 간발의 차로 회피!`
      });
    } else {
      // 3. 피격 / 아웃 발생!
      target.role = 'outer';
      if (ballTeam === 'A') {
        innersB = innersB.filter(p => p.id !== target.id);
        outersB.push(target);
      } else {
        innersA = innersA.filter(p => p.id !== target.id);
        outersA.push(target);
      }

      events.push({
        time: Math.round(timeSec * 10) / 10,
        type: 'HIT',
        team: ballTeam,
        text: `💥 [${currentTeam.name}] ${attacker.name}의 ${isSpecialShot ? '초강력 필살 슛!' : '매서운 슛!'} ${target.name} 선수 피격 아웃! 외야로 이동!`
      });

      // 외야수가 맞춘 경우 -> 외야수 내야 부활 복귀!
      if (isOutfieldAttack) {
        totalRevives++;
        attacker.role = 'inner';
        if (ballTeam === 'A') {
          outersA = outersA.filter(p => p.id !== attacker.id);
          innersA.push(attacker);
        } else {
          outersB = outersB.filter(p => p.id !== attacker.id);
          innersB.push(attacker);
        }

        events.push({
          time: Math.round(timeSec * 10) / 10,
          type: 'REVIVE',
          team: ballTeam,
          text: `🎉 외야 킬 달성! [${currentTeam.name}] ${attacker.name} 선수가 기적적으로 내야로 부활 복귀합니다!`
        });
      }

      // 아웃된 후 공은 공격팀 또는 수비팀에게 리바운드
      ballTeam = rng() < 0.6 ? ballTeam : (ballTeam === 'A' ? 'B' : 'A');
    }
  }

  // 승자 판정
  let winner = 'team_a';
  if (innersA.length === 0 && innersB.length > 0) {
    winner = 'team_b';
  } else if (innersB.length === 0 && innersA.length > 0) {
    winner = 'team_a';
  } else {
    // 타임아웃 판정 (생존 내야수 많은 팀)
    winner = innersA.length >= innersB.length ? 'team_a' : 'team_b';
  }

  const durationSec = Math.round(timeSec);
  const winningTeam = winner === 'team_a' ? teamA : teamB;

  events.push({
    time: durationSec,
    type: 'FINISH',
    winner,
    text: `경기 종료! 🏆 [${winningTeam.name}] 승리! (경기시간: ${durationSec}초, 남은 내야수: A팀 ${innersA.length}명 vs B팀 ${innersB.length}명)`
  });

  return {
    winner,
    durationSec,
    underSec: match.underSec || 50,
    isUnder: durationSec <= (match.underSec || 50),
    isOver: durationSec > (match.underSec || 50),
    remainingA: innersA.length,
    remainingB: innersB.length,
    totalCatches,
    totalRevives,
    events
  };
}
