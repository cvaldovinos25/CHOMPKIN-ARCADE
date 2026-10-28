/* Chompkin Arcade: efectos de sonido (WebAudio, generados por código) + música de respaldo.
   La música principal es el video de YouTube incrustado (ver main.js); si no carga, suena esta. */
(function () {
  const A = (window.CA_Audio = {});
  let ctx = null, master = null, musicGain = null, sfxGain = null, timer = 0, step = 0, nextT = 0, muted = false, playing = false, theme = 'normal', alt = 0;
  const sf = (n) => 261.63 * Math.pow(2, n / 12);
  const LEAD = [0, null, 4, null, 7, null, 12, 7, 9, null, 5, null, 9, null, 12, null, 7, null, 11, null, 14, null, 11, 7, 9, 7, 5, 4, 2, null, 0, null];
  const BASS = []; [-12, -7, -5, -12].forEach((r) => [r, null, r + 7, null, r, null, r + 7, null].forEach((x) => BASS.push(x)));
  function note(freq, t, dur, type, vol, dest) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || sfxGain); o.start(t); o.stop(t + dur + 0.02);
  }
  function sweep(f0, f1, t, dur, type, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + dur + 0.05);
  }
  function schedule() {
    if (theme === 'off') { nextT = ctx.currentTime + 0.1; return; }
    const sd = 60 / 142 / 2;
    while (nextT < ctx.currentTime + 0.25) {
      const i = step % BASS.length;
      if (BASS[i] != null) note(sf(BASS[i]), nextT, sd * 1.6, 'triangle', 0.5, musicGain);
      if (LEAD[i] != null) note(sf(LEAD[i]), nextT, sd * 1.1, 'square', 0.13, musicGain);
      nextT += sd; step++;
    }
  }
  A.start = function () {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      ctx = new C(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.45; musicGain.connect(master); sfxGain = ctx.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
    }
    if (ctx.state === 'suspended') ctx.resume();
    if (!playing) { playing = true; nextT = ctx.currentTime + 0.1; step = 0; timer = setInterval(schedule, 40); }
  };
  A.setTheme = (n) => { theme = n; };
  A.setMuted = (m) => { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.02); };
  A.isMuted = () => muted;
  const sfx = (fn) => () => { if (ctx && !muted) fn(ctx.currentTime); };
  A.chomp = sfx((t) => { alt ^= 1; note(alt ? 520 : 390, t, 0.07, 'square', 0.22); });
  A.power = sfx((t) => { for (let i = 0; i < 6; i++) note(260 * Math.pow(1.19, i), t + i * 0.05, 0.1, 'square', 0.2); });
  A.eatBat = sfx((t) => { [392, 523, 659, 784].forEach((f, i) => note(f, t + i * 0.06, 0.12, 'square', 0.22)); });
  A.die = sfx((t) => { for (let i = 0; i < 9; i++) sweep(900 - i * 70, 300 - i * 20, t + i * 0.13, 0.13, 'square', 0.18); sweep(200, 40, t + 1.2, 0.4, 'sawtooth', 0.2); });
  A.win = sfx((t) => { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => note(f, t + i * 0.1, 0.16, 'square', 0.22)); });
  A.ready = sfx((t) => { [330, 392, 523, 392, 523, 659, 523, 659, 784].forEach((f, i) => note(f, t + i * 0.1, 0.12, 'square', 0.2)); });
  A.life = sfx((t) => { [784, 988, 1175, 1568].forEach((f, i) => note(f, t + i * 0.08, 0.14, 'square', 0.2)); });
  A.over = sfx((t) => { [392, 330, 262, 196].forEach((f, i) => note(f, t + i * 0.22, 0.25, 'triangle', 0.4)); });
})();
