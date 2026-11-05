/* =========================================================
   DODGE TOTO (피구 토토) — 2D Canvas Dodgeball Visualizer
   - 60 FPS Real-time & Timeline-driven Dodgeball Simulation
   - Authentic Korean Classic Dodgeball Rules (내야 4 + 외야 1)
   - Visual Effects: Shadows, Throw arcs, Flame particles, Catch shockwaves
   ========================================================= */

class DodgeballCourt {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.width = this.canvas.width;
    this.height = this.canvas.height;

    // Court Constants
    this.centerX = this.width / 2; // 400
    this.courtTop = 40;
    this.courtBottom = this.height - 40;
    this.courtLeft = 60;
    this.courtRight = this.width - 60;

    // Simulation & Visual State
    this.match = null;
    this.simulation = null;
    this.isPlaying = false;
    this.isFinished = false;
    this.speedMultiplier = 1;
    this.simTime = 0; // seconds
    this.eventIndex = 0;

    // Ball
    this.ball = {
      x: this.centerX,
      y: this.height / 2,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      targetX: this.centerX,
      targetY: this.height / 2,
      holder: null,
      isSpecial: false,
      flames: []
    };

    // Players
    this.players = [];

    // Visual Particles & Floating Text
    this.particles = [];
    this.floatingTexts = [];

    // Callbacks
    this.onCommentary = null;
    this.onFinish = null;

    // Render loop
    this.lastFrameTime = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);

    // Initial Empty Court Render
    this.initDefaultEntities();
  }

  initDefaultEntities() {
    this.players = [];
    this.ball.x = this.centerX;
    this.ball.y = this.height / 2;
    this.ball.z = 0;
    this.ball.holder = null;
  }

  loadMatch(match) {
    this.match = match;
    this.simulation = null;
    this.isPlaying = false;
    this.isFinished = false;
    this.simTime = 0;
    this.eventIndex = 0;
    this.particles = [];
    this.floatingTexts = [];

    this.setupPlayers(match.teamA, match.teamB);
    this.ball.x = this.centerX;
    this.ball.y = this.height / 2;
    this.ball.z = 0;
    this.ball.holder = null;
  }

  setupPlayers(teamA, teamB) {
    this.players = [];

    // Team A (Left Inner, Right Outfield)
    teamA.players.forEach((p, idx) => {
      const isOutfield = p.role === 'outer';
      let x, y;
      if (isOutfield) {
        // 상대 진영 뒤쪽 외야
        x = this.courtRight + 30;
        y = this.courtTop + 80 + idx * 60;
      } else {
        // 아군 내야
        x = this.courtLeft + 60 + (idx % 2) * 120;
        y = this.courtTop + 80 + Math.floor(idx / 2) * 140;
      }

      this.players.push({
        id: p.id,
        team: 'A',
        num: p.num,
        name: p.name,
        role: p.role,
        color: teamA.color || '#ef4444',
        x,
        y,
        baseX: x,
        baseY: y,
        targetX: x,
        targetY: y,
        alive: true,
        stamina: 100,
        special: p.special,
        radius: 16,
        isCatching: false,
        catchCooldown: 0
      });
    });

    // Team B (Right Inner, Left Outfield)
    teamB.players.forEach((p, idx) => {
      const isOutfield = p.role === 'outer';
      let x, y;
      if (isOutfield) {
        // 상대 진영 뒤쪽 외야
        x = this.courtLeft - 30;
        y = this.courtTop + 80 + idx * 60;
      } else {
        // 아군 내야
        x = this.centerX + 70 + (idx % 2) * 120;
        y = this.courtTop + 80 + Math.floor(idx / 2) * 140;
      }

      this.players.push({
        id: p.id,
        team: 'B',
        num: p.num,
        name: p.name,
        role: p.role,
        color: teamB.color || '#06b6d4',
        x,
        y,
        baseX: x,
        baseY: y,
        targetX: x,
        targetY: y,
        alive: true,
        stamina: 100,
        special: p.special,
        radius: 16,
        isCatching: false,
        catchCooldown: 0
      });
    });
  }

  startSimulation(simulation, onCommentary, onFinish) {
    this.simulation = simulation;
    this.onCommentary = onCommentary;
    this.onFinish = onFinish;
    this.isPlaying = true;
    this.isFinished = false;
    this.simTime = 0;
    this.eventIndex = 0;
  }

  setSpeed(multiplier) {
    this.speedMultiplier = multiplier;
  }

  skipToEnd() {
    if (!this.simulation) return;
    this.simTime = this.simulation.durationSec;
    // Process all events up to end
    while (this.eventIndex < this.simulation.events.length) {
      const ev = this.simulation.events[this.eventIndex];
      this.processEvent(ev);
      this.eventIndex++;
    }
    this.finishMatch();
  }

  processEvent(ev) {
    if (this.onCommentary) {
      this.onCommentary(ev.text);
    }

    if (ev.type === 'START') {
      this.addFloatingText(this.centerX, this.height / 2, '경기 시작!', '#f59e0b', 24);
      this.addShockwave(this.centerX, this.height / 2, '#f59e0b');
    } else if (ev.type === 'PASS') {
      // Find passer and outer receiver
      const passer = this.players.find(p => p.team === ev.team && p.role === 'inner');
      const receiver = this.players.find(p => p.team === ev.team && p.role === 'outer');
      if (passer && receiver) {
        this.animateThrow(passer, receiver, false, true);
      }
    } else if (ev.type === 'CATCH') {
      const catcher = this.players.find(p => p.team === ev.team && p.role === 'inner');
      if (catcher) {
        catcher.isCatching = true;
        this.addShockwave(catcher.x, catcher.y, '#38bdf8');
        this.addFloatingText(catcher.x, catcher.y - 25, 'SUPER CATCH!', '#38bdf8', 18);
        this.ball.x = catcher.x;
        this.ball.y = catcher.y;
        this.ball.holder = catcher;
      }
    } else if (ev.type === 'DODGE') {
      // Find dodging player
      const enemyTeam = ev.team === 'A' ? 'B' : 'A';
      const dodger = this.players.find(p => p.team === enemyTeam && p.role === 'inner');
      if (dodger) {
        this.addFloatingText(dodger.x, dodger.y - 20, 'DODGE!', '#a855f7', 16);
        // Dash evasion offset
        dodger.x += (Math.random() - 0.5) * 40;
        dodger.y += (Math.random() - 0.5) * 50;
      }
    } else if (ev.type === 'HIT') {
      // Inner player hit -> moves to outer
      const victimTeam = ev.team === 'A' ? 'B' : 'A';
      const victim = this.players.find(p => p.team === victimTeam && p.role === 'inner');
      if (victim) {
        victim.role = 'outer';
        this.addHitSparks(victim.x, victim.y);
        this.addFloatingText(victim.x, victim.y - 20, 'OUT!', '#ef4444', 20);

        // Move to outer position
        victim.targetX = victim.team === 'A' ? this.courtRight + 30 : this.courtLeft - 30;
        victim.targetY = this.courtTop + 60 + Math.random() * 200;
      }
    } else if (ev.type === 'REVIVE') {
      // Outer player revived to inner
      const reviver = this.players.find(p => p.team === ev.team && p.role === 'outer');
      if (reviver) {
        reviver.role = 'inner';
        this.addShockwave(reviver.x, reviver.y, '#34d399');
        this.addFloatingText(reviver.x, reviver.y - 25, 'REVIVAL! 🌟', '#34d399', 22);

        // Return to inner position
        reviver.targetX = reviver.team === 'A' ? this.courtLeft + 100 : this.centerX + 100;
        reviver.targetY = this.courtTop + 100 + Math.random() * 150;
      }
    } else if (ev.type === 'FINISH') {
      this.finishMatch();
    }
  }

  animateThrow(from, to, isSpecial = false, isPass = false) {
    this.ball.x = from.x;
    this.ball.y = from.y;
    this.ball.targetX = to.x;
    this.ball.targetY = to.y;
    this.ball.holder = null;
    this.ball.isSpecial = isSpecial;

    if (isSpecial) {
      this.addFloatingText(from.x, from.y - 30, '🔥 불꽃 슛!', '#ff4444', 22);
      this.addShockwave(from.x, from.y, '#ff4444');
    }
  }

  finishMatch() {
    this.isPlaying = false;
    this.isFinished = true;
    if (this.onFinish) {
      this.onFinish(this.simulation);
    }
  }

  // -----------------------------------------------------------
  // Update Loop
  // -----------------------------------------------------------
  update(dt) {
    if (this.isPlaying && this.simulation) {
      this.simTime += dt * this.speedMultiplier;

      // Check upcoming events
      while (
        this.eventIndex < this.simulation.events.length &&
        this.simTime >= this.simulation.events[this.eventIndex].time
      ) {
        const ev = this.simulation.events[this.eventIndex];
        this.processEvent(ev);
        this.eventIndex++;
      }
    }

    // Update players position towards targets (smooth interpolation)
    this.players.forEach(p => {
      // Micro-roam wandering when idle
      if (Math.random() < 0.05) {
        const roamRadius = p.role === 'inner' ? 25 : 10;
        p.targetX = p.baseX + (Math.random() - 0.5) * roamRadius;
        p.targetY = p.baseY + (Math.random() - 0.5) * roamRadius;
      }

      p.x += (p.targetX - p.x) * 0.1;
      p.y += (p.targetY - p.y) * 0.1;

      // Keep inside bounds
      if (p.role === 'inner') {
        if (p.team === 'A') {
          p.x = Math.max(this.courtLeft + 15, Math.min(this.centerX - 25, p.x));
        } else {
          p.x = Math.max(this.centerX + 25, Math.min(this.courtRight - 15, p.x));
        }
        p.y = Math.max(this.courtTop + 20, Math.min(this.courtBottom - 20, p.y));
      }
    });

    // Update Ball
    if (this.ball.holder) {
      this.ball.x = this.ball.holder.x + (this.ball.holder.team === 'A' ? 12 : -12);
      this.ball.y = this.ball.holder.y;
      this.ball.z = 0;
    } else {
      // Fly towards target
      const dx = this.ball.targetX - this.ball.x;
      const dy = this.ball.targetY - this.ball.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 5) {
        const speed = this.ball.isSpecial ? 24 : 14;
        this.ball.x += (dx / dist) * Math.min(dist, speed);
        this.ball.y += (dy / dist) * Math.min(dist, speed);

        // Arc height
        this.ball.z = Math.sin((1 - dist / 300) * Math.PI) * 20;

        // Flame particles for special throws
        if (this.ball.isSpecial) {
          this.ball.flames.push({
            x: this.ball.x + (Math.random() - 0.5) * 8,
            y: this.ball.y - this.ball.z + (Math.random() - 0.5) * 8,
            radius: 8 + Math.random() * 6,
            life: 1.0,
            color: Math.random() < 0.5 ? '#ff4444' : '#f59e0b'
          });
        }
      }
    }

    // Update Flames
    for (let i = this.ball.flames.length - 1; i >= 0; i--) {
      const f = this.ball.flames[i];
      f.life -= dt * 3;
      f.radius *= 0.92;
      if (f.life <= 0) this.ball.flames.splice(i, 1);
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.life -= dt * 2;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    // Update Floating Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= dt * 30;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  // -----------------------------------------------------------
  // Render Court & Entities
  // -----------------------------------------------------------
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Court Background (Polished Hardwood Gym)
    ctx.fillStyle = '#0f1420';
    ctx.fillRect(0, 0, this.width, this.height);

    // Court Wood Planks Tint
    ctx.fillStyle = '#141a28';
    ctx.fillRect(this.courtLeft, this.courtTop, this.courtRight - this.courtLeft, this.courtBottom - this.courtTop);

    // Inner Court Zones Tint
    ctx.fillStyle = 'rgba(239, 68, 68, 0.04)'; // Team A zone
    ctx.fillRect(this.courtLeft, this.courtTop, this.centerX - this.courtLeft, this.courtBottom - this.courtTop);

    ctx.fillStyle = 'rgba(6, 182, 212, 0.04)'; // Team B zone
    ctx.fillRect(this.centerX, this.courtTop, this.courtRight - this.centerX, this.courtBottom - this.courtTop);

    // Court Lines (White/Silver Glow)
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.strokeRect(this.courtLeft, this.courtTop, this.courtRight - this.courtLeft, this.courtBottom - this.courtTop);

    // Center Division Line
    ctx.beginPath();
    ctx.moveTo(this.centerX, this.courtTop);
    ctx.lineTo(this.centerX, this.courtBottom);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Center Jump Ball Circle
    ctx.beginPath();
    ctx.arc(this.centerX, this.height / 2, 45, 0, Math.PI * 2);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Outfield Boundary Dotted Lines (외야 구획선)
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)';
    // Left outer
    ctx.strokeRect(10, 20, this.courtLeft - 15, this.height - 40);
    // Right outer
    ctx.strokeRect(this.courtRight + 5, 20, this.width - this.courtRight - 15, this.height - 40);
    ctx.setLineDash([]);

    // Outfield Labels
    ctx.font = '800 11px Pretendard';
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'center';
    ctx.fillText('B팀 외야구역', 35, 30);
    ctx.fillText('A팀 외야구역', this.width - 35, 30);

    // 2. Render Players
    this.players.forEach(p => {
      // Player Shadow
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 12, p.radius * 0.9, p.radius * 0.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fill();

      // Outer player aura
      if (p.role === 'outer') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + 3, 0, Math.PI * 2);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Player Body Circle
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = p.team === 'A' ? '#ff8888' : '#7dd3fc';
      ctx.stroke();

      // Player Number
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 12px JetBrains Mono';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.num, p.x, p.y);

      // Name & Role Tag above
      ctx.font = '600 10px Pretendard';
      ctx.fillStyle = p.role === 'outer' ? '#fbbf24' : '#cbd5e1';
      ctx.fillText(`${p.name}${p.role === 'outer' ? ' [외야]' : ''}`, p.x, p.y - 20);
    });

    // 3. Render Ball Flames
    this.ball.flames.forEach(f => {
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
      ctx.fillStyle = f.color;
      ctx.globalAlpha = f.life * 0.8;
      ctx.fill();
      ctx.globalAlpha = 1.0;
    });

    // 4. Render Ball
    // Ball Shadow on Ground
    ctx.beginPath();
    ctx.ellipse(this.ball.x, this.ball.y + 4, 10 + this.ball.z * 0.2, 5 + this.ball.z * 0.1, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0.15, 0.5 - this.ball.z * 0.015)})`;
    ctx.fill();

    // Actual Flying Ball (elevated by z)
    const ballRenderY = this.ball.y - this.ball.z;
    ctx.beginPath();
    ctx.arc(this.ball.x, ballRenderY, 9, 0, Math.PI * 2);
    ctx.fillStyle = this.ball.isSpecial ? '#ff3b30' : '#f59e0b';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Dodgeball Inner Seam Lines
    ctx.beginPath();
    ctx.arc(this.ball.x - 2, ballRenderY - 2, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fill();

    // 5. Render Particles
    this.particles.forEach(pt => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = Math.max(0, pt.life);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    });

    // 6. Render Floating Texts
    this.floatingTexts.forEach(ft => {
      ctx.font = `900 ${ft.size || 16}px Pretendard`;
      ctx.fillStyle = ft.color;
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.max(0, ft.life);
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 6;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;
    });
  }

  // -----------------------------------------------------------
  // FX Helpers
  // -----------------------------------------------------------
  addShockwave(x, y, color = '#38bdf8') {
    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 * i) / 16;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * (2.5 + Math.random() * 2),
        vy: Math.sin(angle) * (2.5 + Math.random() * 2),
        radius: 3 + Math.random() * 2,
        color,
        life: 0.8
      });
    }
  }

  addHitSparks(x, y) {
    for (let i = 0; i < 20; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        radius: 2 + Math.random() * 3,
        color: Math.random() < 0.5 ? '#ef4444' : '#f59e0b',
        life: 0.7
      });
    }
  }

  addFloatingText(x, y, text, color = '#fff', size = 16) {
    this.floatingTexts.push({
      x,
      y,
      text,
      color,
      size,
      life: 1.2
    });
  }

  // -----------------------------------------------------------
  // Main Animation Frame Loop
  // -----------------------------------------------------------
  loop(timestamp) {
    const dt = Math.min((timestamp - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = timestamp;

    this.update(dt);
    this.render();

    requestAnimationFrame(this.loop);
  }
}

window.DodgeballCourt = DodgeballCourt;
