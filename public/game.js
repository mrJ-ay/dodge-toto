/* =========================================================
   DODGE TOTO (피구 토토) — 2D Canvas Dodgeball Visualizer
   - 60 FPS Continuous Vector Physics (Zero Teleportation)
   - Real Parabolic Flight Arcs, Windup & Smooth Throws
   - Dynamic Catch, Sliding Dodge, Impact Knockback & Outfield Revival
   ========================================================= */

class DodgeballCourt {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.width = this.canvas.width;
    this.height = this.canvas.height;

    // Court Bounds
    this.centerX = this.width / 2; // 400
    this.courtTop = 40;
    this.courtBottom = this.height - 40;
    this.courtLeft = 60;
    this.courtRight = this.width - 60;

    // Simulation & State
    this.match = null;
    this.simulation = null;
    this.isPlaying = false;
    this.isFinished = false;
    this.speedMultiplier = 1;
    this.simTime = 0;
    this.eventIndex = 0;

    // Continuous Ball State
    // state: 'HELD' | 'FLYING' | 'BOUNCING'
    this.ball = {
      x: this.centerX,
      y: this.height / 2,
      z: 0,
      startX: this.centerX,
      startY: this.height / 2,
      targetX: this.centerX,
      targetY: this.height / 2,
      arcHeight: 25,
      progress: 1,
      duration: 0.5,
      state: 'HELD',
      holder: null,
      isSpecial: false,
      flames: [],
      onArrival: null
    };

    // Players
    this.players = [];

    // Particles & Floating Text
    this.particles = [];
    this.floatingTexts = [];

    // Callbacks
    this.onCommentary = null;
    this.onFinish = null;

    // Render loop
    this.lastFrameTime = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);

    this.initDefaultEntities();
  }

  initDefaultEntities() {
    this.players = [];
    this.ball.x = this.centerX;
    this.ball.y = this.height / 2;
    this.ball.z = 0;
    this.ball.state = 'HELD';
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

    // Initial ball possession at jump ball
    const jumpBallHolder = this.players.find(p => p.role === 'inner') || this.players[0];
    this.ball.holder = jumpBallHolder;
    this.ball.state = 'HELD';
    this.ball.x = jumpBallHolder ? jumpBallHolder.x : this.centerX;
    this.ball.y = jumpBallHolder ? jumpBallHolder.y : this.height / 2;
    this.ball.z = 10;
    this.ball.isSpecial = false;
    this.ball.flames = [];
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
        x = this.courtLeft + 60 + (idx % 2) * 110;
        y = this.courtTop + 80 + Math.floor(idx / 2) * 130;
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
        isWindingUp: false,
        windupTimer: 0
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
        x = this.centerX + 70 + (idx % 2) * 110;
        y = this.courtTop + 80 + Math.floor(idx / 2) * 130;
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
        isWindingUp: false,
        windupTimer: 0
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
    while (this.eventIndex < this.simulation.events.length) {
      const ev = this.simulation.events[this.eventIndex];
      this.instantResolveEvent(ev);
      this.eventIndex++;
    }
    this.finishMatch();
  }

  // -----------------------------------------------------------
  // Smooth Throw Launch (No Teleportation!)
  // -----------------------------------------------------------
  launchBall({ fromPlayer, toPlayer, isSpecial = false, duration = 0.45, arcHeight = 25, onArrival }) {
    if (!toPlayer) return;

    // Release ball from hand
    this.ball.holder = null;
    this.ball.state = 'FLYING';

    // Always start flight from the ball's current real x, y coordinates!
    this.ball.startX = (typeof this.ball.x === 'number') ? this.ball.x : (fromPlayer ? fromPlayer.x : this.centerX);
    this.ball.startY = (typeof this.ball.y === 'number') ? this.ball.y : (fromPlayer ? fromPlayer.y : this.height / 2);
    this.ball.targetX = toPlayer.x;
    this.ball.targetY = toPlayer.y;
    this.ball.progress = 0;
    this.ball.duration = Math.max(0.2, duration / this.speedMultiplier);
    this.ball.arcHeight = isSpecial ? 15 : arcHeight;
    this.ball.isSpecial = isSpecial;
    this.ball.onArrival = onArrival;

    const displayFrom = fromPlayer || { x: this.ball.startX, y: this.ball.startY };
    if (isSpecial) {
      this.addFloatingText(displayFrom.x, displayFrom.y - 25, '🔥 불꽃 슛!', '#ff4444', 20);
      this.addShockwave(displayFrom.x, displayFrom.y, '#ff4444');
    }
  }

  // Process timeline events with smooth physical actions
  processEvent(ev) {
    if (this.onCommentary) {
      this.onCommentary(ev.text);
    }

    if (ev.type === 'START') {
      const jumpWinner = this.players.find(p => p.id === ev.attackerId);
      this.addFloatingText(this.centerX, this.height / 2, '점프볼 선점!', '#f59e0b', 24);
      this.addShockwave(this.centerX, this.height / 2, '#f59e0b');
      if (jumpWinner) {
        this.launchBall({
          fromPlayer: { x: this.centerX, y: this.height / 2 },
          toPlayer: jumpWinner,
          duration: 0.45,
          arcHeight: 25,
          onArrival: () => {
            this.ball.holder = jumpWinner;
            this.ball.state = 'HELD';
          }
        });
      }
    } else if (ev.type === 'PASS') {
      const passer = this.players.find(p => p.id === ev.attackerId) || this.ball.holder;
      const receiver = this.players.find(p => p.id === ev.targetId);

      if (receiver) {
        // High lob arc from outfield to infield or infield to outfield
        this.launchBall({
          fromPlayer: passer,
          toPlayer: receiver,
          isSpecial: false,
          duration: 0.55,
          arcHeight: 45,
          onArrival: () => {
            this.ball.holder = receiver;
            this.ball.state = 'HELD';
            this.addFloatingText(receiver.x, receiver.y - 20, 'PASS!', '#38bdf8', 15);
          }
        });
      }
    } else if (ev.type === 'CATCH') {
      const thrower = this.players.find(p => p.id === ev.attackerId) || this.ball.holder;
      const catcher = this.players.find(p => p.id === ev.targetId);

      if (thrower && catcher) {
        this.launchBall({
          fromPlayer: thrower,
          toPlayer: catcher,
          isSpecial: ev.isSpecial,
          duration: ev.isSpecial ? 0.35 : 0.45,
          onArrival: () => {
            this.ball.holder = catcher;
            this.ball.state = 'HELD';
            this.addShockwave(catcher.x, catcher.y, '#38bdf8');
            this.addFloatingText(catcher.x, catcher.y - 25, 'SUPER CATCH!', '#38bdf8', 18);
          }
        });
      }
    } else if (ev.type === 'DODGE') {
      const thrower = this.players.find(p => p.id === ev.attackerId) || this.ball.holder;
      const dodger = this.players.find(p => p.id === ev.targetId);
      const rebounder = this.players.find(p => p.id === ev.rebounderId) || thrower;

      if (thrower && dodger) {
        // Target dashes sideways to evade
        const dodgeOffsetY = (Math.random() < 0.5 ? -1 : 1) * 45;
        dodger.targetY = Math.max(this.courtTop + 25, Math.min(this.courtBottom - 25, dodger.y + dodgeOffsetY));

        this.launchBall({
          fromPlayer: thrower,
          toPlayer: dodger,
          isSpecial: ev.isSpecial,
          duration: ev.isSpecial ? 0.35 : 0.45,
          onArrival: () => {
            // Dodger successfully evaded! Ball flies to rebounder
            this.addFloatingText(dodger.x, dodger.y - 20, 'DODGE!', '#a855f7', 16);
            if (rebounder) {
              this.launchBall({
                fromPlayer: { x: dodger.x, y: dodger.y },
                toPlayer: rebounder,
                isSpecial: false,
                duration: 0.4,
                arcHeight: 20,
                onArrival: () => {
                  this.ball.holder = rebounder;
                  this.ball.state = 'HELD';
                }
              });
            }
          }
        });
      }
    } else if (ev.type === 'HIT') {
      const thrower = this.players.find(p => p.id === ev.attackerId) || this.ball.holder;
      const victim = this.players.find(p => p.id === ev.targetId);
      const rebounder = this.players.find(p => p.id === ev.rebounderId);

      if (thrower && victim) {
        this.launchBall({
          fromPlayer: thrower,
          toPlayer: victim,
          isSpecial: ev.isSpecial,
          duration: ev.isSpecial ? 0.32 : 0.42,
          onArrival: () => {
            // Direct Hit!
            victim.role = 'outer';
            this.addHitSparks(victim.x, victim.y);
            this.addFloatingText(victim.x, victim.y - 25, 'OUT!', '#ef4444', 22);

            // Victim walks to outer court
            victim.targetX = victim.team === 'A' ? this.courtRight + 30 : this.courtLeft - 30;
            victim.targetY = this.courtTop + 60 + Math.random() * 200;

            // Ball rebounds to retriever
            if (rebounder) {
              this.launchBall({
                fromPlayer: { x: victim.x, y: victim.y },
                toPlayer: rebounder,
                isSpecial: false,
                duration: 0.45,
                arcHeight: 25,
                onArrival: () => {
                  this.ball.holder = rebounder;
                  this.ball.state = 'HELD';
                }
              });
            }
          }
        });
      }
    } else if (ev.type === 'REVIVE') {
      const reviver = this.players.find(p => p.id === ev.attackerId);
      if (reviver) {
        reviver.role = 'inner';
        this.addShockwave(reviver.x, reviver.y, '#34d399');
        this.addFloatingText(reviver.x, reviver.y - 25, 'REVIVAL! 🌟', '#34d399', 22);

        // Reviver dashes into inner court
        reviver.targetX = reviver.team === 'A' ? this.courtLeft + 100 : this.centerX + 100;
        reviver.targetY = this.courtTop + 80 + Math.random() * 160;
      }
    } else if (ev.type === 'FINISH') {
      this.finishMatch();
    }
  }

  // Instant state update for skip to end
  instantResolveEvent(ev) {
    if (ev.type === 'HIT') {
      const victim = this.players.find(p => p.id === ev.targetId);
      if (victim) {
        victim.role = 'outer';
        victim.x = victim.team === 'A' ? this.courtRight + 30 : this.courtLeft - 30;
      }
    } else if (ev.type === 'REVIVE') {
      const reviver = this.players.find(p => p.id === ev.attackerId);
      if (reviver) {
        reviver.role = 'inner';
        reviver.x = reviver.team === 'A' ? this.courtLeft + 100 : this.centerX + 100;
      }
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
  // Update Loop (Continuous Frame-by-Frame Physics)
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

    // 1. Update Ball Continuous Physics
    if (this.ball.state === 'HELD' && this.ball.holder) {
      // Ball stays in holder's hand
      const handOffset = this.ball.holder.team === 'A' ? 14 : -14;
      this.ball.x = this.ball.holder.x + handOffset;
      this.ball.y = this.ball.holder.y;
      this.ball.z = 10;
    } else if (this.ball.state === 'FLYING') {
      // Smooth continuous trajectory
      this.ball.progress += dt / this.ball.duration;

      if (this.ball.progress < 1.0) {
        const p = this.ball.progress;
        this.ball.x = this.ball.startX + (this.ball.targetX - this.ball.startX) * p;
        this.ball.y = this.ball.startY + (this.ball.targetY - this.ball.startY) * p;
        this.ball.z = Math.sin(p * Math.PI) * this.ball.arcHeight;

        // Flame particles for special throws
        if (this.ball.isSpecial) {
          this.ball.flames.push({
            x: this.ball.x + (Math.random() - 0.5) * 8,
            y: this.ball.y - this.ball.z + (Math.random() - 0.5) * 8,
            radius: 8 + Math.random() * 6,
            life: 0.8,
            color: Math.random() < 0.5 ? '#ff4444' : '#f59e0b'
          });
        }
      } else {
        // Arrived at destination cleanly!
        this.ball.x = this.ball.targetX;
        this.ball.y = this.ball.targetY;
        this.ball.z = 0;
        this.ball.state = 'HELD'; // Default until callback sets otherwise

        if (this.ball.onArrival) {
          const cb = this.ball.onArrival;
          this.ball.onArrival = null;
          cb();
        }
      }
    }

    // 2. Update Players Position (Smooth roaming & repositioning)
    this.players.forEach(p => {
      // Micro-roam wandering when idle
      if (Math.random() < 0.04) {
        const roamRadius = p.role === 'inner' ? 20 : 8;
        p.targetX = p.baseX + (Math.random() - 0.5) * roamRadius;
        p.targetY = p.baseY + (Math.random() - 0.5) * roamRadius;
      }

      p.x += (p.targetX - p.x) * 0.12;
      p.y += (p.targetY - p.y) * 0.12;

      // Keep within court boundaries
      if (p.role === 'inner') {
        if (p.team === 'A') {
          p.x = Math.max(this.courtLeft + 15, Math.min(this.centerX - 25, p.x));
        } else {
          p.x = Math.max(this.centerX + 25, Math.min(this.courtRight - 15, p.x));
        }
        p.y = Math.max(this.courtTop + 20, Math.min(this.courtBottom - 20, p.y));
      }
    });

    // 3. Update Flames
    for (let i = this.ball.flames.length - 1; i >= 0; i--) {
      const f = this.ball.flames[i];
      f.life -= dt * 2.5;
      f.radius *= 0.94;
      if (f.life <= 0) this.ball.flames.splice(i, 1);
    }

    // 4. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.life -= dt * 2;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    // 5. Update Floating Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= dt * 25;
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

    // 1. Hardwood Gym Court Floor
    ctx.fillStyle = '#0f1420';
    ctx.fillRect(0, 0, this.width, this.height);

    // Wood Planks Area
    ctx.fillStyle = '#141a28';
    ctx.fillRect(this.courtLeft, this.courtTop, this.courtRight - this.courtLeft, this.courtBottom - this.courtTop);

    // Inner Court Zones Tint
    ctx.fillStyle = 'rgba(239, 68, 68, 0.04)'; // Team A zone
    ctx.fillRect(this.courtLeft, this.courtTop, this.centerX - this.courtLeft, this.courtBottom - this.courtTop);

    ctx.fillStyle = 'rgba(6, 182, 212, 0.04)'; // Team B zone
    ctx.fillRect(this.centerX, this.courtTop, this.courtRight - this.centerX, this.courtBottom - this.courtTop);

    // Court Perimeter Line
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
    ctx.strokeRect(10, 20, this.courtLeft - 15, this.height - 40);
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

      // Outer Player Ring Aura
      if (p.role === 'outer') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + 3, 0, Math.PI * 2);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Ball Possession Indicator
      if (this.ball.holder === p) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + 5, 0, Math.PI * 2);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
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

      // Name & Role Tag
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
    // Ball Shadow on Floor
    const shadowAlpha = Math.max(0.15, 0.5 - this.ball.z * 0.015);
    ctx.beginPath();
    ctx.ellipse(this.ball.x, this.ball.y + 4, 10 + this.ball.z * 0.15, 5 + this.ball.z * 0.08, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
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

    // Ball Seam Highlight
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
  // Main Animation Loop
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
