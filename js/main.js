/* Chompkin Arcade: juego completo (laberinto, calabaza, murciélagos, controles, música). Todo original. */
(function () {
  'use strict';
  const $ = (q) => document.querySelector(q), A = window.CA_Audio, cv = $('#gc'), ctx = cv.getContext('2d');
  const MAP = ["###################", "#........#........#", "#o##.###.#.###.##o#", "#.................#", "#.##.#.#####.#.##.#", "#....#...#...#....#", "####.###.#.###.####", "####.#.......#.####", "####.#.##D##.#.####", "      .#   #.      ", "####.#.#   #.#.####", "####.#.#####.#.####", "####.#.......#.####", "####.###.#.###.####", "#....#...#...#....#", "#.##.#.#####.#.##.#", "#.................#", "#o##.###.#.###.##o#", "#........#........#", "###################"];
  const COLS = 19, ROWS = 20, DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const BAT_COL = ['#ff3b30', '#ff7ac8', '#25d9ff', '#ff9f1a'], SCATTER = [[16, 1], [2, 1], [17, 18], [1, 18]];
  const DEBUG = new URLSearchParams(location.search).has('debug');
  const ch = (c, r) => MAP[r][((c % COLS) + COLS) % COLS];
  const isWall = (c, r) => r >= 0 && r < ROWS && c >= 0 && c < COLS && MAP[r][c] === '#';
  function nbrs(c, r, door) { const o = []; DIRS.forEach((d, k) => { const nc = (c + d[0] + COLS) % COLS, nr = r + d[1]; if (nr < 0 || nr >= ROWS) return; const t = MAP[nr][nc]; if (t === '#' || (t === 'D' && !door)) return; o.push({ k, c: nc, r: nr }); }); return o; }
  function bfs(tc, tr) { const d = Array.from({ length: ROWS }, () => new Array(COLS).fill(1e9)); d[tr][tc] = 0; const q = [[tc, tr]]; while (q.length) { const [c, r] = q.shift(); nbrs(c, r, true).forEach((n) => { if (d[n.r][n.c] > d[r][c] + 1) { d[n.r][n.c] = d[r][c] + 1; q.push([n.c, n.r]); } }); } return d; }
  const DIST_HOME = bfs(9, 9), DIST_OUT = bfs(9, 7);

  // ---------- estado ----------
  let W = 0, H = 0, dpr = 1, cs = 20, bx = 0, by = 0, top = 60, bot = 54, wallsBlue = null, wallsWhite = null;
  let mode = 'title', S = null, hi = 0, last = 0, t = 0, pops = [];
  try { hi = +localStorage.caHi || 0; } catch (e) {}
  const pump = { c: 9, r: 12, nc: 9, nr: 12, prog: 0, moving: false, d: 2, nd: 2, mouth: 0, dying: 0 };
  let bats = [], dots = [];

  function newLevel(keepScore) {
    dots = []; for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const x = MAP[r][c]; if (x === '.' || x === 'o') dots.push({ c, r, p: x === 'o', on: true }); }
    S.left = dots.length; resetPositions();
  }
  function resetPositions() {
    Object.assign(pump, { c: 9, r: 12, nc: 9, nr: 12, prog: 0, moving: false, d: 2, nd: 2, mouth: 0, dying: 0 });
    const dl = [0, 2.5, 5.5, 8.5].map((x) => x * Math.max(0.4, 1 - 0.1 * (S.level - 1)));
    bats = [[9, 7, 'normal'], [9, 10, 'house'], [8, 10, 'house'], [10, 10, 'house']].map((p, i) => ({ i, c: p[0], r: p[1], nc: p[0], nr: p[1], prog: 0, moving: false, d: i === 0 ? 2 : 3, mode: p[2], rel: dl[i], fright: 0, flap: Math.random() * 6 }));
    S.modeT = 0; S.scatter = true; S.fright = 0; S.combo = 0;
  }
  function newGame() { S = { score: 0, lives: 3, level: 1, phase: 'ready', pt: 3.4, left: 0, extra: false, msg: '', flash: 0 }; newLevel(); pops = []; A.ready(); }

  // ---------- movimiento ----------
  const speedMul = () => Math.min(1.5, 1 + 0.05 * (S.level - 1));
  function posOf(a) { let dx = a.nc - a.c; if (dx > 1) dx = -1; else if (dx < -1) dx = 1; let fx = a.c + dx * a.prog; if (fx < -0.5) fx += COLS; if (fx > COLS - 0.5) fx -= COLS; return { x: fx, y: a.r + (a.nr - a.r) * a.prog }; }
  function reverse(a) { [a.c, a.nc] = [a.nc, a.c]; [a.r, a.nr] = [a.nr, a.r]; a.prog = 1 - a.prog; a.d = (a.d + 2) % 4; }
  function canGo(a, k, door) { const d = DIRS[k], nc = (a.c + d[0] + COLS) % COLS, nr = a.r + d[1]; if (nr < 0 || nr >= ROWS) return false; const x = MAP[nr][nc]; return x !== '#' && (x !== 'D' || door); }
  function stepPump(dt) {
    let mv = 5.3 * speedMul() * dt, p = pump;
    if (p.moving && p.nd === (p.d + 2) % 4) reverse(p);
    while (mv > 1e-6) {
      if (!p.moving) {
        if (canGo(p, p.nd, false)) p.d = p.nd; else if (!canGo(p, p.d, false)) { break; }
        const d = DIRS[p.d]; p.nc = (p.c + d[0] + COLS) % COLS; p.nr = p.r + d[1]; p.prog = 0; p.moving = true;
      }
      const s = Math.min(mv, 1 - p.prog); p.prog += s; mv -= s; p.mouth += s * 2.2;
      if (p.prog >= 1 - 1e-6) { p.c = p.nc; p.r = p.nr; p.prog = 0; p.moving = false; eat(p.c, p.r); }
    }
  }
  function eat(c, r) {
    const d = dots.find((x) => x.on && x.c === c && x.r === r); if (!d) return;
    d.on = false; S.left--; addScore(d.p ? 50 : 10); if (d.p) { A.power(); S.fright = Math.max(2.5, 7 - 0.8 * (S.level - 1)); S.combo = 0; bats.forEach((b) => { if (b.mode === 'normal') { b.fright = S.fright; if (b.moving) reverse(b); } }); } else A.chomp();
    if (S.left <= 0) { S.phase = 'win'; S.pt = 2.4; A.win(); }
  }
  function addScore(n) { const before = S.score; S.score += n; if (S.score > hi) { hi = S.score; try { localStorage.caHi = hi; } catch (e) {} } if (!S.extra && before < 10000 && S.score >= 10000) { S.extra = true; S.lives++; A.life(); } }
  function target(b) {
    const p = pump, dv = DIRS[p.d];
    if (S.scatter && b.i !== 0 || (S.scatter && b.i === 0)) return { c: SCATTER[b.i][0], r: SCATTER[b.i][1] };
    if (b.i === 0) return { c: p.c, r: p.r };
    if (b.i === 1) return { c: p.c + dv[0] * 4, r: p.r + dv[1] * 4 };
    if (b.i === 2) { const a = bats[0]; return { c: 2 * (p.c + dv[0] * 2) - a.c, r: 2 * (p.r + dv[1] * 2) - a.r }; }
    return Math.hypot(b.c - p.c, b.r - p.r) > 7 ? { c: p.c, r: p.r } : { c: SCATTER[3][0], r: SCATTER[3][1] };
  }
  function batSpeed(b) {
    if (b.mode === 'eaten') return 11; if (b.mode === 'leave' || b.mode === 'house') return 3.2;
    const tun = b.r === 9 && (b.c <= 5 || b.c >= 13); return 4.7 * speedMul() * (b.fright > 0 ? 0.55 : 1) * (tun ? 0.55 : 1);
  }
  function decide(b) {
    const door = b.mode === 'leave' || b.mode === 'eaten', back = (b.d + 2) % 4;
    let o = nbrs(b.c, b.r, door); const noback = o.filter((x) => x.k !== back); if (noback.length) o = noback;
    let pick;
    if (b.mode === 'eaten') pick = o.reduce((m, x) => (DIST_HOME[x.r][x.c] < DIST_HOME[m.r][m.c] ? x : m));
    else if (b.mode === 'leave') pick = o.reduce((m, x) => (DIST_OUT[x.r][x.c] < DIST_OUT[m.r][m.c] ? x : m));
    else if (b.fright > 0) pick = o[(Math.random() * o.length) | 0];
    else { const tg = target(b); pick = o.reduce((m, x) => ((x.c - tg.c) ** 2 + (x.r - tg.r) ** 2 + Math.random() * 0.01 < (m.c - tg.c) ** 2 + (m.r - tg.r) ** 2 ? x : m)); }
    b.d = pick.k; b.nc = pick.c; b.nr = pick.r; b.prog = 0; b.moving = true;
  }
  function stepBat(b, dt) {
    b.flap += dt * 12;
    if (b.fright > 0) { b.fright -= dt; if (b.fright <= 0) b.fright = 0; }
    if (b.mode === 'house') { b.rel -= dt; if (b.rel <= 0) { b.mode = 'leave'; } return; }
    let mv = batSpeed(b) * dt;
    while (mv > 1e-6) {
      if (!b.moving) {
        if (b.mode === 'eaten' && b.c === 9 && b.r === 9) { b.mode = 'house'; b.rel = 0.8; b.fright = 0; return; }
        if (b.mode === 'leave' && b.r <= 7) { b.mode = 'normal'; }
        decide(b);
      }
      const s = Math.min(mv, 1 - b.prog); b.prog += s; mv -= s;
      if (b.prog >= 1 - 1e-6) { b.c = b.nc; b.r = b.nr; b.prog = 0; b.moving = false; }
    }
  }

  function update(dt) {
    if (mode !== 'game' || !S) return;
    S.flash = Math.max(0, S.flash - dt);
    pops = pops.filter((p) => (p.t -= dt) > 0);
    if (S.phase === 'ready') { S.pt -= dt; bats.forEach((b) => { b.flap += dt * 12; }); if (S.pt <= 0) S.phase = 'play'; return; }
    if (S.phase === 'dying') { pump.dying += dt; if (pump.dying > 1.9) { S.lives--; if (S.lives <= 0) { S.phase = 'over'; A.over(); } else { resetPositions(); S.phase = 'ready'; S.pt = 2; } } return; }
    if (S.phase === 'win') { S.pt -= dt; if (S.pt <= 0) { S.level++; newLevel(); S.phase = 'ready'; S.pt = 2.4; A.ready(); } return; }
    if (S.phase !== 'play') return;
    if (S.fright > 0) S.fright -= dt; else { S.modeT += dt; const lim = S.scatter ? 6 : 18; if (S.modeT > lim) { S.modeT = 0; S.scatter = !S.scatter; bats.forEach((b) => { if (b.mode === 'normal' && b.moving) reverse(b); }); } }
    stepPump(dt); bats.forEach((b) => stepBat(b, dt));
    const pp = posOf(pump);
    for (const b of bats) {
      if (b.mode === 'eaten' || b.mode === 'house') continue; const bp = posOf(b);
      if (Math.hypot(bp.x - pp.x, bp.y - pp.y) < 0.62) {
        if (b.fright > 0) { b.mode = 'eaten'; b.fright = 0; S.combo++; const pts = 100 * Math.pow(2, Math.min(S.combo, 4)); addScore(pts); pops.push({ x: bp.x, y: bp.y, s: pts, t: 1 }); A.eatBat(); }
        else { S.phase = 'dying'; pump.dying = 0; S.flash = 0.3; A.die(); break; }
      }
    }
  }

  // ---------- dibujo ----------
  function layout() {
    dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    top = Math.max(58, H * 0.075); bot = Math.max(50, H * 0.07);
    cs = Math.floor(Math.min(W / COLS, (H - top - bot) / ROWS, 44)); bx = Math.round((W - cs * COLS) / 2); by = Math.round(top + (H - top - bot - cs * ROWS) / 2);
    wallsBlue = buildWalls('#3b55ff', '#a9b8ff'); wallsWhite = buildWalls('#ffffff', '#ffffff');
  }
  function buildWalls(glow, core) {
    const o = document.createElement('canvas'); o.width = cs * COLS * dpr; o.height = cs * ROWS * dpr; const c = o.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ins = 0.3 * cs, segs = [], Wl = isWall;
    for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) if (Wl(q, r)) {
      const x = q * cs, y = r * cs, n = Wl(q, r - 1), e = Wl(q + 1, r), s = Wl(q, r + 1), w = Wl(q - 1, r);
      if (!n) segs.push([x + (w ? (Wl(q - 1, r - 1) ? -ins : 0) : ins), y + ins, x + cs + (e ? (Wl(q + 1, r - 1) ? ins : 0) : -ins), y + ins]);
      if (!s) segs.push([x + (w ? (Wl(q - 1, r + 1) ? -ins : 0) : ins), y + cs - ins, x + cs + (e ? (Wl(q + 1, r + 1) ? ins : 0) : -ins), y + cs - ins]);
      if (!w) segs.push([x + ins, y + (n ? (Wl(q - 1, r - 1) ? -ins : 0) : ins), x + ins, y + cs + (s ? (Wl(q - 1, r + 1) ? ins : 0) : -ins)]);
      if (!e) segs.push([x + cs - ins, y + (n ? (Wl(q + 1, r - 1) ? -ins : 0) : ins), x + cs - ins, y + cs + (s ? (Wl(q + 1, r + 1) ? ins : 0) : -ins)]);
    }
    c.lineCap = 'round'; c.lineJoin = 'round';
    const tr = () => { c.beginPath(); segs.forEach((s) => { c.moveTo(s[0], s[1]); c.lineTo(s[2], s[3]); }); c.stroke(); };
    c.shadowColor = glow; c.shadowBlur = cs * 0.5; c.strokeStyle = glow; c.lineWidth = Math.max(2, cs * 0.14); tr();
    c.shadowBlur = 0; c.strokeStyle = core; c.lineWidth = Math.max(1, cs * 0.045); tr();
    return o;
  }
  const X = (fx) => bx + (fx + 0.5) * cs, Y = (fy) => by + (fy + 0.5) * cs;
  function txt(s, x, y, size, col, align, glow) { ctx.font = size + 'px "Arcade Normal",monospace'; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle'; if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 12; } ctx.fillStyle = col; ctx.fillText(s, x, y); ctx.shadowBlur = 0; }
  function drawPump(x, y, r, d, mouth, shrink) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(d * Math.PI / 2);
    let open = shrink != null ? 0.2 + shrink * Math.PI * 0.8 : 0.08 + Math.abs(Math.sin(mouth * 3.2)) * 0.62; if (open > Math.PI) open = Math.PI;
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.05); g.addColorStop(0, '#ffb347'); g.addColorStop(0.6, '#ff7a00'); g.addColorStop(1, '#c84b00');
    ctx.shadowColor = '#ff8a00'; ctx.shadowBlur = r * 0.7; ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, open, Math.PI * 2 - open); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(120,40,0,.55)'; ctx.lineWidth = Math.max(1, r * 0.07); [-0.45, 0.45].forEach((k) => { ctx.beginPath(); ctx.ellipse(0, 0, r * Math.abs(k) * 1.6 + r * 0.08, r * 0.98, 0, -1.3, 1.3); ctx.stroke(); });
    ctx.rotate(-d * Math.PI / 2); ctx.fillStyle = '#2a1200'; ctx.beginPath(); ctx.moveTo(-r * 0.3, -r * 0.32); ctx.lineTo(-r * 0.05, -r * 0.5); ctx.lineTo(-r * 0.05, -r * 0.2); ctx.fill();
    ctx.fillStyle = '#3d8f2a'; ctx.fillRect(-r * 0.1, -r * 1.18, r * 0.2, r * 0.3); ctx.restore();
  }
  function drawBat(b, x, y, r) {
    const fr = b.fright > 0, flash = fr && b.fright < 1.8 && Math.floor(t * 8) % 2 === 0, col = fr ? (flash ? '#ffffff' : '#2a3bff') : BAT_COL[b.i], eyes = b.mode === 'eaten';
    ctx.save(); ctx.translate(x, y);
    if (!eyes) {
      const wy = Math.sin(b.flap) * r * 0.28; ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = r * 0.6;
      ctx.beginPath(); ctx.moveTo(-r * 0.3, -r * 0.1);
      ctx.quadraticCurveTo(-r * 1.0, -r * 0.7 - wy, -r * 1.25, -r * 0.1 - wy); ctx.lineTo(-r * 1.05, r * 0.15 - wy * 0.6); ctx.lineTo(-r * 0.85, r * 0.0); ctx.lineTo(-r * 0.65, r * 0.35); ctx.lineTo(-r * 0.4, r * 0.15); ctx.lineTo(-r * 0.2, r * 0.5);
      ctx.lineTo(r * 0.2, r * 0.5); ctx.lineTo(r * 0.4, r * 0.15); ctx.lineTo(r * 0.65, r * 0.35); ctx.lineTo(r * 0.85, r * 0.0); ctx.lineTo(r * 1.05, r * 0.15 - wy * 0.6); ctx.lineTo(r * 1.25, -r * 0.1 - wy);
      ctx.quadraticCurveTo(r * 1.0, -r * 0.7 - wy, r * 0.3, -r * 0.1); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -r * 0.1, r * 0.48, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.4); ctx.lineTo(-r * 0.3, -r * 0.85); ctx.lineTo(-r * 0.05, -r * 0.5); ctx.moveTo(r * 0.4, -r * 0.4); ctx.lineTo(r * 0.3, -r * 0.85); ctx.lineTo(r * 0.05, -r * 0.5); ctx.fill(); ctx.shadowBlur = 0;
    }
    const dv = DIRS[b.d]; [-1, 1].forEach((s) => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(s * r * 0.2, -r * 0.12, r * 0.15, r * 0.19, 0, 0, 7); ctx.fill(); ctx.fillStyle = fr && !eyes ? '#ffd0d0' : '#1a2cff'; ctx.beginPath(); ctx.arc(s * r * 0.2 + dv[0] * r * 0.07, -r * 0.12 + dv[1] * r * 0.08, r * 0.08, 0, 7); ctx.fill(); });
    if (fr && !eyes) { ctx.strokeStyle = flash ? '#ff2a2a' : '#ffd0d0'; ctx.lineWidth = Math.max(1, r * 0.07); ctx.beginPath(); for (let i = 0; i <= 4; i++) ctx.lineTo(-r * 0.3 + i * r * 0.15, r * 0.2 + (i % 2 ? -r * 0.06 : r * 0.04)); ctx.stroke(); }
    ctx.restore();
  }
  function draw() {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (!S) { if (mode === 'title') drawDemoBoard(); return; }
    // HUD
    const hs = Math.max(10, Math.min(16, W * 0.034));
    txt('1UP', bx + cs * 0.4, (by - 54), hs, '#fff'); txt(String(S.score).padStart(6, '0'), bx + cs * 0.4, (by - 30), hs, '#fff');
    txt('RECORD', W / 2, (by - 54), hs, '#fff', 'center'); txt(String(hi).padStart(6, '0'), W / 2, (by - 30), hs, '#fff', 'center');
    txt('NIVEL', bx + cs * COLS - cs * 0.4, (by - 54), hs, '#fff', 'right'); txt(String(S.level), bx + cs * COLS - cs * 0.4, (by - 30), hs, '#7ff6ff', 'right');
    for (let i = 0; i < Math.min(S.lives - (S.phase === 'ready' || S.phase === 'play' ? 1 : 0), 6); i++) drawPump(bx + cs * (1 + i * 1.2), (by + cs * ROWS + 30), cs * 0.4, 2, 0, null);
    txt('DESLIZA PARA MOVER', W / 2 + cs, (by + cs * ROWS + 30), Math.max(7, Math.min(10, W * 0.022)), '#4a5cc8', 'center');
    // tablero
    const wl = S.phase === 'win' && Math.floor(S.pt * 5) % 2 === 0 ? wallsWhite : wallsBlue; ctx.drawImage(wl, bx, by, cs * COLS, cs * ROWS);
    ctx.fillStyle = '#ffb3d9'; ctx.fillRect(bx + 9 * cs + cs * 0.1, by + 8 * cs + cs * 0.42, cs * 0.8, Math.max(2, cs * 0.14));
    dots.forEach((d) => {
      if (!d.on) return; const x = X(d.c), y = Y(d.r);
      if (d.p) { if (Math.floor(t * 4) % 2) return; ctx.shadowColor = '#ffb300'; ctx.shadowBlur = cs * 0.5; ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(x, y, cs * 0.3, 0, 7); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = '#ff8a00'; ctx.beginPath(); ctx.arc(x, y, cs * 0.13, 0, 7); ctx.fill(); }
      else { ctx.fillStyle = '#ffe3c2'; const q = Math.max(2, cs * 0.14); ctx.fillRect(x - q / 2, y - q / 2, q, q); }
    });
    if (S.phase !== 'dying' || pump.dying < 0.3) { /* calabaza */ }
    if (S.phase === 'dying') { if (pump.dying > 0.4) { const k = Math.min(1, (pump.dying - 0.4) / 1.3), pp = posOf(pump); if (k < 1) drawPump(X(pp.x), Y(pp.y), cs * 0.42 * (1 - k * 0.2), 3, 0, k); } }
    else { const pp = posOf(pump); drawPump(X(pp.x), Y(pp.y), cs * 0.42, pump.d, pump.mouth, S.phase === 'ready' ? 0.0 : null); }
    if (!(S.phase === 'dying' && pump.dying > 0.4) || true) bats.forEach((b) => { if (S.phase === 'dying' && pump.dying > 0.4) return; const bp = posOf(b); let yy = Y(bp.y); if (b.mode === 'house') yy += Math.sin(t * 5 + b.i) * cs * 0.08; drawBat(b, X(bp.x), yy, cs * 0.4); });
    pops.forEach((p) => txt(String(p.s), X(p.x), Y(p.y) - (1 - p.t) * cs * 0.6, Math.max(8, cs * 0.45), '#7ff6ff', 'center', '#25d9ff'));
    if (S.phase === 'ready') txt('LISTOS!', X(9), Y(11.2), Math.max(10, cs * 0.75), '#ffd400', 'center', '#ff9d00');
    if (S.phase === 'over') { txt('FIN DEL JUEGO', X(9), Y(11.2), Math.max(10, cs * 0.75), '#ff2b2b', 'center', '#ff1a1a'); if (Math.floor(t * 2) % 2) txt('TOCA PARA JUGAR', W / 2, (by + cs * ROWS + 30), Math.max(8, cs * 0.5), '#fff', 'center'); }
    if (S.flash > 0) { ctx.fillStyle = 'rgba(255,0,60,' + S.flash + ')'; ctx.fillRect(0, 0, W, H); }
  }
  function drawDemoBoard() { if (!wallsBlue) return; ctx.globalAlpha = 0.45; ctx.drawImage(wallsBlue, bx, by, cs * COLS, cs * ROWS); ctx.globalAlpha = 1; }

  // ---------- entrada ----------
  const KEYS = { ArrowRight: 0, ArrowDown: 1, ArrowLeft: 2, ArrowUp: 3, d: 0, s: 1, a: 2, w: 3, D: 0, S: 1, A: 2, W: 3 };
  addEventListener('keydown', (e) => { if (e.key in KEYS) { pump.nd = KEYS[e.key]; e.preventDefault(); } if ((e.key === ' ' || e.key === 'Enter') && mode === 'game' && S && S.phase === 'over') newGame(); });
  let tx = 0, ty = 0;
  cv.addEventListener('pointerdown', (e) => { tx = e.clientX; ty = e.clientY; if (mode === 'game' && S && S.phase === 'over') newGame(); });
  cv.addEventListener('pointermove', (e) => { if (e.buttons === 0 && e.pointerType === 'mouse') return; const dx = e.clientX - tx, dy = e.clientY - ty; if (Math.abs(dx) < 14 && Math.abs(dy) < 14) return; pump.nd = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3); tx = e.clientX; ty = e.clientY; });

  // ---------- música: video de YouTube incrustado (oculto); respaldo = música por código ----------
  const YT_ID = 'hDB6oRx4InQ'; let yt = null, ytPlaying = false, gesture = false;
  function applyMusic() { if (!ytPlaying || !yt) return; try { A.isMuted() ? yt.mute() : yt.unMute(); yt.setVolume(100); } catch (e) {} }
  function ytMake() {
    try { yt = new YT.Player('yt', { videoId: YT_ID, width: '200', height: '200', playerVars: { controls: 0, playsinline: 1, loop: 1, playlist: YT_ID, disablekb: 1, rel: 0 }, events: {
      onReady: () => { if (gesture) yt.playVideo(); },
      onStateChange: (e) => { if (e.data === 1) { ytPlaying = true; A.setTheme('off'); applyMusic(); } },
      onError: () => { ytPlaying = false; A.setTheme('normal'); } } }); } catch (e) {}
  }
  (function () { window.onYouTubeIframeAPIReady = ytMake; const sc = document.createElement('script'); sc.src = 'https://www.youtube.com/iframe_api'; sc.async = true; sc.onerror = () => {}; document.head.appendChild(sc); })();
  function syncMute() { $('#bMute').textContent = A.isMuted() ? '🔇' : '🔊'; }
  function wake() { A.start(); gesture = true; try { if (yt && yt.getPlayerState && yt.getPlayerState() !== 1) yt.playVideo(); } catch (e) {} const tp = $('#tap'); if (tp) tp.textContent = ''; }
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => addEventListener(ev, wake, { passive: true }));
  $('#bMute').onclick = (e) => { e.stopPropagation(); A.setMuted(!A.isMuted()); syncMute(); A.start(); applyMusic(); };
  try { A.start(); } catch (e) {}

  $('#play').onclick = () => { wake(); $('#intro').classList.add('hidden'); mode = 'game'; newGame(); };
  document.querySelectorAll('h1').forEach((h) => { const out = []; h.childNodes.forEach((n) => { const em = n.nodeName === 'EM'; [...n.textContent].forEach((c, i) => { const sp = document.createElement('span'); sp.textContent = c; sp.className = 'ltr' + (em ? ' y' : ''); sp.style.animationDelay = (out.length + i) * 0.09 + 's'; out.push(sp); }); }); h.textContent = ''; out.forEach((x) => h.appendChild(x)); });

  addEventListener('resize', layout); layout();
  function loop(ts) { requestAnimationFrame(loop); const n = ts / 1000; t = n; const dt = Math.min(0.05, n - last || 0.016); last = n; update(dt); draw(); }
  requestAnimationFrame(loop);
  if (DEBUG) window.__CA = { get S() { return S; }, pump, get bats() { return bats; }, get dots() { return dots; }, newGame };
})();
