/* Sāqiya — musique de la vidéo, composée en direct par le navigateur (Web Audio, aucun fichier, aucun droit d'auteur).
   Ambiance calme à 84 BPM : nappes La mineur – Fa – Do – Sol, basse, arpège avec écho, battement léger,
   et un « plic » de goutte d'eau à chaque changement de scène. */
(function () {
  const BPM = 84, BEAT = 60 / BPM, BAR = BEAT * 4;
  const N = (m) => 440 * Math.pow(2, (m - 69) / 12);          // note MIDI -> fréquence
  const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];   // Am, F, C, G
  let ctx = null, master = null, delay = null, noise = null, timer = null, nextTime = 0, step = 0, on = false;

  function setup() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    delay = ctx.createDelay(1); delay.delayTime.value = BEAT * 0.75;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const dl = ctx.createBiquadFilter(); dl.type = "lowpass"; dl.frequency.value = 2400;
    delay.connect(fb).connect(dl).connect(delay); delay.connect(master);
    const len = ctx.sampleRate * 0.5, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noise = buf;
  }
  function env(g, t, a, peak, r, hold = 0) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + r);
  }
  function pad(chord, t) {
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(700, t); f.frequency.linearRampToValueAtTime(1500, t + BAR * 0.6);
    const g = ctx.createGain(); env(g, t, 0.9, 0.05, 1.4, BAR - 1.2);
    f.connect(g).connect(master);
    chord.forEach((m, i) => [-6, 6].forEach((det) => {
      const o = ctx.createOscillator(); o.type = i === 0 ? "triangle" : "sawtooth";
      o.frequency.value = N(m); o.detune.value = det;
      o.connect(f); o.start(t); o.stop(t + BAR + 1.6);
    }));
  }
  function bass(m, t) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.value = N(m - 12);
    env(g, t, 0.02, 0.16, BEAT * 1.6); o.connect(g).connect(master); o.start(t); o.stop(t + BEAT * 2);
  }
  function pluck(m, t, vol = 0.07) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = "triangle"; o.frequency.value = N(m); f.type = "lowpass"; f.frequency.value = 3200;
    env(g, t, 0.005, vol, 0.45); o.connect(f).connect(g); g.connect(master); g.connect(delay);
    o.start(t); o.stop(t + 0.6);
  }
  function kick(t) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine";
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    env(g, t, 0.004, 0.35, 0.22); o.connect(g).connect(master); o.start(t); o.stop(t + 0.3);
  }
  function shaker(t, vol) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; f.type = "highpass"; f.frequency.value = 7000;
    env(g, t, 0.003, vol, 0.06); s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + 0.1);
  }
  function drop(t) {                                               // goutte d'eau : sinus qui monte vite
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine";
    o.frequency.setValueAtTime(700, t); o.frequency.exponentialRampToValueAtTime(1900, t + 0.09);
    env(g, t, 0.004, 0.12, 0.16); o.connect(g); g.connect(master); g.connect(delay); o.start(t); o.stop(t + 0.25);
  }
  function schedule() {
    while (nextTime < ctx.currentTime + 0.25) {
      const eighth = step % 8, bar = Math.floor(step / 8) % 4, chord = CHORDS[bar], t = nextTime;
      if (eighth === 0) { pad(chord, t); bass(chord[0], t); }
      if (eighth === 4) bass(chord[0] + (bar === 3 ? 2 : 0), t);
      if (eighth === 0 || eighth === 4) kick(t);
      shaker(t, eighth % 2 ? 0.025 : 0.05);
      const arp = [0, 1, 2, 1, 2, 0, 1, 2][eighth];
      pluck(chord[arp] + 12, t, eighth % 2 ? 0.045 : 0.07);
      nextTime += BEAT / 2; step++;
    }
  }
  function start() {
    setup(); if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    if (on) return;
    on = true;
    nextTime = ctx.currentTime + 0.08; step = 0;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.6);         // fondu d'entrée
    timer = setInterval(schedule, 60); schedule();
  }
  function stop() {
    if (!ctx || !on) return;
    on = false;
    master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.35);     // fondu de sortie
    clearInterval(timer);
  }
  window.SaqiyaMusic = { start, stop, drop: () => { if (ctx && on) drop(ctx.currentTime + 0.02); }, playing: () => on };
})();
