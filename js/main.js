/* Chompkin AR: el juego se proyecta sobre la hoja impresa (marcadores en las esquinas + homografía). Todo original. */
(function () {
  'use strict';
  const $ = (q) => document.querySelector(q), A = window.CA_Audio, vid = $('#vid'), hcv = $('#gc'), hctx = hcv.getContext('2d'), glc = $('#gl');
  // Geometría de la hoja (unidades de hoja: 1000 x 1414). Los marcadores son cuadrados negros de 150 en las esquinas.
  const SW = 1000, SH = 1414, cs = 44, bx = 82, by = 267, GX = 38, GY = 223, GW = 924, GH = 968, SC = 1.25;
  const MARK = { 0: [[47, 47], [149, 47], [149, 149], [47, 149]], 1: [[851, 47], [953, 47], [953, 149], [851, 149]], 2: [[851, 1265], [953, 1265], [953, 1367], [851, 1367]], 3: [[47, 1265], [149, 1265], [149, 1367], [47, 1367]] };
  const gtex = document.createElement('canvas'); gtex.width = GW * SC; gtex.height = GH * SC; const ctx = gtex.getContext('2d');
  const MAP = ["###################", "#........#........#", "#o##.###.#.###.##o#", "#.................#", "#.##.#.#####.#.##.#", "#....#...#...#....#", "####.###.#.###.####", "####.#.......#.####", "####.#.##D##.#.####", "      .#   #.      ", "####.#.#   #.#.####", "####.#.#####.#.####", "####.#.......#.####", "####.###.#.###.####", "#....#...#...#....#", "#.##.#.#####.#.##.#", "#.................#", "#o##.###.#.###.##o#", "#........#........#", "###################"];
  const COLS = 19, ROWS = 20, DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const BAT_COL = ['#e0102a', '#c4009a', '#0a8f9e', '#ff7a00'], SCATTER = [[16, 1], [2, 1], [17, 18], [1, 18]];
  const DEBUG = new URLSearchParams(location.search).has('debug'), ALIGN = new URLSearchParams(location.search).has('align');
  const ch = (c, r) => MAP[r][((c % COLS) + COLS) % COLS];
  const isWall = (c, r) => r >= 0 && r < ROWS && c >= 0 && c < COLS && MAP[r][c] === '#';
  function nbrs(c, r, door) { const o = []; DIRS.forEach((d, k) => { const nc = (c + d[0] + COLS) % COLS, nr = r + d[1]; if (nr < 0 || nr >= ROWS) return; const t = MAP[nr][nc]; if (t === '#' || (t === 'D' && !door)) return; o.push({ k, c: nc, r: nr }); }); return o; }
  function bfs(tc, tr) { const d = Array.from({ length: ROWS }, () => new Array(COLS).fill(1e9)); d[tr][tc] = 0; const q = [[tc, tr]]; while (q.length) { const [c, r] = q.shift(); nbrs(c, r, true).forEach((n) => { if (d[n.r][n.c] > d[r][c] + 1) { d[n.r][n.c] = d[r][c] + 1; q.push([n.c, n.r]); } }); } return d; }
  const DIST_HOME = bfs(9, 9), DIST_OUT = bfs(9, 7);

  // ---------- estado ----------
  let W = 0, H = 0, dpr = 1, tracked = false, stream = null;
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
  function layout() { dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; hcv.width = W * dpr; hcv.height = H * dpr; hctx.setTransform(dpr, 0, 0, dpr, 0, 0); const rc = glc.getBoundingClientRect(); glc.width = Math.round((rc.width || W) * dpr); glc.height = Math.round((rc.height || H) * dpr); if (gl) gl.viewport(0, 0, glc.width, glc.height); }
  const X = (fx) => bx + (fx + 0.5) * cs, Y = (fy) => by + (fy + 0.5) * cs;
  function txt(s, x, y, size, col, align, glow) { ctx.font = size + 'px "Arcade Normal",monospace'; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle'; if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 12; } ctx.fillStyle = col; ctx.fillText(s, x, y); ctx.shadowBlur = 0; }
  function drawPump(x, y, r, d, mouth, shrink) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(d * Math.PI / 2);
    let open = shrink != null ? 0.2 + shrink * Math.PI * 0.8 : 0.08 + Math.abs(Math.sin(mouth * 3.2)) * 0.62; if (open > Math.PI) open = Math.PI;
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.05); g.addColorStop(0, '#4a4a55'); g.addColorStop(0.55, '#15151c'); g.addColorStop(1, '#000');
    ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = r * 0.45; ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, open, Math.PI * 2 - open); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = Math.max(1, r * 0.07); [-0.45, 0.45].forEach((k) => { ctx.beginPath(); ctx.ellipse(0, 0, r * Math.abs(k) * 1.6 + r * 0.08, r * 0.98, 0, -1.3, 1.3); ctx.stroke(); });
    ctx.rotate(-d * Math.PI / 2); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-r * 0.3, -r * 0.32); ctx.lineTo(-r * 0.05, -r * 0.5); ctx.lineTo(-r * 0.05, -r * 0.2); ctx.fill();
    ctx.fillStyle = '#1f7a14'; ctx.fillRect(-r * 0.1, -r * 1.18, r * 0.2, r * 0.3); ctx.restore();
  }
  function drawBat(b, x, y, r) {
    const fr = b.fright > 0, flash = fr && b.fright < 1.8 && Math.floor(t * 8) % 2 === 0, col = fr ? (flash ? '#111' : '#2a3bff') : BAT_COL[b.i], eyes = b.mode === 'eaten';
    ctx.save(); ctx.translate(x, y);
    if (!eyes) {
      const wy = Math.sin(b.flap) * r * 0.28; ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = r * 0.35;
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
  function htxt(s, x, y, size, col, align, glow) { hctx.font = size + 'px "Arcade Normal",monospace'; hctx.textAlign = align || 'left'; hctx.textBaseline = 'middle'; if (glow) { hctx.shadowColor = glow; hctx.shadowBlur = 10; } hctx.fillStyle = col; hctx.fillText(s, x, y); hctx.shadowBlur = 0; }
  function draw() {
    // 1) juego en el espacio de la hoja (textura transparente)
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, gtex.width, gtex.height); ctx.setTransform(SC, 0, 0, SC, -GX * SC, -GY * SC);
    if (ALIGN) { ctx.strokeStyle = '#ff2a2a'; ctx.lineWidth = 1.5; ctx.strokeRect(bx, by, cs * COLS, cs * ROWS); ctx.beginPath(); for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (MAP[r][c] !== '#') { ctx.moveTo(X(c) - 6, Y(r)); ctx.lineTo(X(c) + 6, Y(r)); ctx.moveTo(X(c), Y(r) - 6); ctx.lineTo(X(c), Y(r) + 6); } ctx.stroke(); }
    if (S) {
      dots.forEach((d) => {
        if (!d.on) return; const x = X(d.c), y = Y(d.r);
        if (d.p) { if (Math.floor(t * 4) % 2) return; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x, y, cs * 0.3, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, cs * 0.11, 0, 7); ctx.fill(); }
        else { ctx.fillStyle = '#000'; const q = Math.max(2, cs * 0.14); ctx.fillRect(x - q / 2, y - q / 2, q, q); }
      });
      if (S.phase === 'dying') { if (pump.dying > 0.4) { const k = Math.min(1, (pump.dying - 0.4) / 1.3), pp = posOf(pump); if (k < 1) drawPump(X(pp.x), Y(pp.y), cs * 0.42 * (1 - k * 0.2), 3, 0, k); } }
      else { const pp = posOf(pump); drawPump(X(pp.x), Y(pp.y), cs * 0.42, pump.d, pump.mouth, S.phase === 'ready' ? 0.0 : null); }
      bats.forEach((b) => { if (S.phase === 'dying' && pump.dying > 0.4) return; const bp = posOf(b); let yy = Y(bp.y); if (b.mode === 'house') yy += Math.sin(t * 5 + b.i) * cs * 0.08; drawBat(b, X(bp.x), yy, cs * 0.4); });
      pops.forEach((p) => txt(String(p.s), X(p.x), Y(p.y) - (1 - p.t) * cs * 0.6, 20, '#006e7a', 'center', 'rgba(255,255,255,.9)'));
      if (S.phase === 'ready') txt('LISTOS!', X(9), Y(11.2), 32, '#d4006a', 'center', 'rgba(255,255,255,.9)');
      if (S.phase === 'over') txt('FIN DEL JUEGO', X(9), Y(11.2), 28, '#c80000', 'center', 'rgba(255,255,255,.9)');
      if (S.phase === 'win' && Math.floor(S.pt * 5) % 2 === 0) { ctx.fillStyle = 'rgba(40,60,255,.14)'; ctx.fillRect(bx, by, cs * COLS, cs * ROWS); }
      if (S.flash > 0) { ctx.fillStyle = 'rgba(255,0,60,' + S.flash * 0.6 + ')'; ctx.fillRect(bx, by, cs * COLS, cs * ROWS); }
    }
    // 2) HUD en pantalla
    hctx.clearRect(0, 0, W, H);
    if (mode !== 'game') return;
    const hs = Math.max(10, Math.min(15, W * 0.032)), y1 = 26 + (window.visualViewport ? 0 : 0), y2 = y1 + hs * 1.7;
    if (S) {
      htxt('1UP', 14, y1, hs, '#0b1470', 'left', '#fff'); htxt(String(S.score).padStart(6, '0'), 14, y2, hs, '#0b1470', 'left', '#fff');
      htxt('RECORD', W / 2, y1, hs, '#0b1470', 'center', '#fff'); htxt(String(hi).padStart(6, '0'), W / 2, y2, hs, '#0b1470', 'center', '#fff');
      htxt('NIVEL', W - 14, y1, hs, '#0b1470', 'right', '#fff'); htxt(String(S.level), W - 14, y2, hs, '#006e7a', 'right', '#fff');
      const n = Math.min(S.lives - (S.phase === 'ready' || S.phase === 'play' ? 1 : 0), 6); for (let i = 0; i < n; i++) { hctx.save(); hctx.translate(26 + i * 30, H - 30); drawPumpOn(hctx, 11); hctx.restore(); }
      if (S.phase === 'over') { if (Math.floor(t * 2) % 2) htxt('TOCA PARA JUGAR', W / 2, H - 50, 11, '#0b1470', 'center', '#fff'); }
    }
    if (!tracked) { hctx.fillStyle = 'rgba(0,0,20,.55)'; hctx.fillRect(0, H * 0.4, W, 110); htxt('APUNTA AL LABERINTO IMPRESO', W / 2, H * 0.4 + 36, Math.min(14, W * 0.034), '#ffd400', 'center', '#ff9d00'); htxt('DEBEN VERSE LOS 4 CUADROS NEGROS', W / 2, H * 0.4 + 72, Math.min(10, W * 0.025), '#7ff6ff', 'center'); }
  }
  function drawPumpOn(c, r) { const g = c.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.05); g.addColorStop(0, '#4a4a55'); g.addColorStop(1, '#000'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0.5, Math.PI * 2 - 0.5); c.lineTo(0, 0); c.fill(); c.fillStyle = '#1f7a14'; c.fillRect(-r * 0.1, -r * 1.15, r * 0.2, r * 0.3); }

  // ---------- seguimiento de la hoja (marcadores -> homografía) y proyección WebGL ----------
  let gl = null, prog = null, tex = null, buf = null, vprog = null, vbuf = null, vtex = null, Hm = null, lastSeen = -9, det = null, busy = false;
  function glInit() {
    gl = glc.getContext('webgl', { premultipliedAlpha: true, alpha: true }) || glc.getContext('experimental-webgl'); if (!gl) return;
    const vs = 'attribute vec2 a_uv;uniform mat3 u_H;uniform vec2 u_res;uniform vec4 u_rect;varying vec2 v_uv;void main(){vec3 p=u_H*vec3(u_rect.xy+a_uv*u_rect.zw,1.);gl_Position=vec4(p.x*2./u_res.x-p.z,p.z-p.y*2./u_res.y,0.,p.z);v_uv=a_uv;}';
    const fs = 'precision mediump float;uniform sampler2D u_tex;varying vec2 v_uv;void main(){gl_FragColor=texture2D(u_tex,v_uv);}';
    const mk = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
    prog = gl.createProgram(); gl.attachShader(prog, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog); gl.useProgram(prog);
    buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_uv'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const vvs = 'attribute vec2 a_p;attribute vec2 a_t;varying vec2 v_t;void main(){gl_Position=vec4(a_p,0.,1.);v_t=a_t;}';
    vprog = gl.createProgram(); gl.attachShader(vprog, mk(gl.VERTEX_SHADER, vvs)); gl.attachShader(vprog, mk(gl.FRAGMENT_SHADER, 'precision mediump float;uniform sampler2D u_tex;varying vec2 v_t;void main(){gl_FragColor=vec4(texture2D(u_tex,v_t).rgb,1.);}')); gl.linkProgram(vprog);
    vbuf = gl.createBuffer(); vtex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, vtex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.viewport(0, 0, glc.width, glc.height);
  }
  function solve(pairs) {   // homografía por mínimos cuadrados (DLT con h33 = 1), coordenadas de hoja / 1000
    const M = Array.from({ length: 8 }, () => new Array(9).fill(0));
    pairs.forEach(([sx, sy, u, v]) => { const x = sx / 1000, y = sy / 1000, r1 = [x, y, 1, 0, 0, 0, -u * x, -u * y], r2 = [0, 0, 0, x, y, 1, -v * x, -v * y];
      for (let i = 0; i < 8; i++) { for (let j = 0; j < 8; j++) M[i][j] += r1[i] * r1[j] + r2[i] * r2[j]; M[i][8] += r1[i] * u + r2[i] * v; } });
    for (let i = 0; i < 8; i++) { let p = i; for (let k = i + 1; k < 8; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k; [M[i], M[p]] = [M[p], M[i]]; if (Math.abs(M[i][i]) < 1e-12) return null;
      for (let k = 0; k < 8; k++) if (k !== i) { const f = M[k][i] / M[i][i]; for (let j = i; j < 9; j++) M[k][j] -= f * M[i][j]; } }
    const h = M.map((r, i) => r[8] / r[i]); return [h[0] / 1000, h[1] / 1000, h[2], h[3] / 1000, h[4] / 1000, h[5], h[6] / 1000, h[7] / 1000, 1];   // sale en orden fila: pantalla = H * (hoja,1)
  }
  const small = document.createElement('canvas'), sctx = small.getContext('2d', { willReadFrequently: true });
  function detect() {
    if (busy || !det || !vid.videoWidth) return; busy = true;
    try {
      const vw = vid.videoWidth, vh = vid.videoHeight, sw = 640, sh = Math.round(vh * sw / vw); small.width = sw; small.height = sh; sctx.drawImage(vid, 0, 0, sw, sh);
      const mk = det.detect(sctx.getImageData(0, 0, sw, sh)), pairs = [];
      mk.forEach((m) => { const g = MARK[m.id]; if (!g) return; const cx = m.corners.reduce((a, c) => a + c.x, 0) / 4 + 0.5, cy = m.corners.reduce((a, c) => a + c.y, 0) / 4 + 0.5;
        m.corners.forEach((c, k) => { const x = c.x + 0.5, y = c.y + 0.5, l = Math.hypot(x - cx, y - cy) || 1, ex = x + (x - cx) / l * 0.5, ey = y + (y - cy) / l * 0.5; pairs.push([g[k][0], g[k][1], ex * vw / sw, ey * vh / sh]); }); });
      if (pairs.length >= 4) { const h = solve(pairs); if (h && isFinite(h[0])) { Hm = Hm && performance.now() / 1000 - lastSeen < 0.5 ? Hm.map((v, i) => v + (h[i] - v) * 0.65) : h; lastSeen = performance.now() / 1000; } }
    } catch (e) {}
    busy = false;
  }
  function project() {
    if (!gl) return; const cw = glc.width, ch = glc.height, vw = vid.videoWidth, vh = vid.videoHeight; if (!vw || vid.readyState < 2) return;
    const sc = Math.max(cw / vw, ch / vh), ox = (cw - vw * sc) / 2, oy = (ch - vh * sc) / 2, hw = vw * sc / cw, hh = vh * sc / ch;
    gl.disable(gl.BLEND); gl.useProgram(vprog); gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-hw, hh, 0, 0, hw, hh, 1, 0, -hw, -hh, 0, 1, hw, -hh, 1, 1]), gl.DYNAMIC_DRAW);
    const lp = gl.getAttribLocation(vprog, 'a_p'), lt = gl.getAttribLocation(vprog, 'a_t'); gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 16, 0); gl.enableVertexAttribArray(lt); gl.vertexAttribPointer(lt, 2, gl.FLOAT, false, 16, 8);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, vtex); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, vid); gl.uniform1i(gl.getUniformLocation(vprog, 'u_tex'), 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.disableVertexAttribArray(lt);
    if (!Hm || !tracked) return;
    // hoja -> pixeles de video -> pixeles del canvas (misma transformacion que el video de fondo)
    const h = Hm, r0 = [sc * h[0] + ox * h[6], sc * h[1] + ox * h[7], sc * h[2] + ox * h[8]], r1 = [sc * h[3] + oy * h[6], sc * h[4] + oy * h[7], sc * h[5] + oy * h[8]], m = [r0[0], r1[0], h[6], r0[1], r1[1], h[7], r0[2], r1[2], h[8]];
    gl.useProgram(prog); gl.enable(gl.BLEND); gl.bindBuffer(gl.ARRAY_BUFFER, buf); const la = gl.getAttribLocation(prog, 'a_uv'); gl.enableVertexAttribArray(la); gl.vertexAttribPointer(la, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gtex);
    gl.uniformMatrix3fv(gl.getUniformLocation(prog, 'u_H'), false, new Float32Array(m)); gl.uniform2f(gl.getUniformLocation(prog, 'u_res'), cw, ch); gl.uniform4f(gl.getUniformLocation(prog, 'u_rect'), GX, GY, GW, GH); gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  async function camStart() {
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); }
    catch (e) { alert('No pudimos usar la cámara. Permite el acceso y vuelve a intentar.'); return false; }
    vid.srcObject = stream; try { await vid.play(); } catch (e) {} return true;
  }

  // ---------- entrada ----------
  const KEYS = { ArrowRight: 0, ArrowDown: 1, ArrowLeft: 2, ArrowUp: 3, d: 0, s: 1, a: 2, w: 3, D: 0, S: 1, A: 2, W: 3 };
  addEventListener('keydown', (e) => { if (e.key in KEYS) { pump.nd = KEYS[e.key]; e.preventDefault(); } if ((e.key === ' ' || e.key === 'Enter') && mode === 'game' && S && S.phase === 'over') newGame(); });
  let tx = 0, ty = 0;
  document.addEventListener('pointerdown', (e) => { tx = e.clientX; ty = e.clientY; if (mode === 'game' && S && S.phase === 'over' && !e.target.closest('button')) newGame(); });
  document.addEventListener('pointermove', (e) => { if (e.buttons === 0 && e.pointerType === 'mouse') return; const dx = e.clientX - tx, dy = e.clientY - ty; if (Math.abs(dx) < 14 && Math.abs(dy) < 14) return; pump.nd = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3); tx = e.clientX; ty = e.clientY; });

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

  $('#play').onclick = async () => { wake(); if (!(await camStart())) return; $('#intro').classList.add('hidden'); try { det = new AR.Detector({ dictionaryName: 'ARUCO_4X4_1000' }); } catch (e) {} mode = 'game'; newGame(); setInterval(detect, 45); };
  document.querySelectorAll('h1').forEach((h) => { const out = []; h.childNodes.forEach((n) => { const em = n.nodeName === 'EM'; [...n.textContent].forEach((c, i) => { const sp = document.createElement('span'); sp.textContent = c; sp.className = 'ltr' + (em ? ' y' : ''); sp.style.animationDelay = (out.length + i) * 0.09 + 's'; out.push(sp); }); }); h.textContent = ''; out.forEach((x) => h.appendChild(x)); });

  glInit(); addEventListener('resize', layout); layout();
  function loop(ts) { requestAnimationFrame(loop); const n = ts / 1000; t = n; const dt = Math.min(0.05, n - last || 0.016); last = n; tracked = !!Hm && performance.now() / 1000 - lastSeen < 0.45; if (tracked) update(dt); draw(); project(); }
  requestAnimationFrame(loop);
  if (DEBUG) window.__CA = { get Hm() { return Hm; }, get tracked() { return tracked; }, get S() { return S; }, pump, get bats() { return bats; }, get dots() { return dots; }, newGame };
})();
