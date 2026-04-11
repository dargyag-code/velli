// ── Vibración ──────────────────────────────────────────────────────────────

export function vibracionSutil() {
  if ('vibrate' in navigator) navigator.vibrate(30);
}

export function vibracionConfirmacion() {
  if ('vibrate' in navigator) navigator.vibrate([30, 50, 30]);
}

export function vibracionError() {
  if ('vibrate' in navigator) navigator.vibrate([100, 30, 100]);
}

// ── Audio (Web Audio API — sin archivos externos) ──────────────────────────

export function sonidoCaptura() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.1;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.stop(ctx.currentTime + 0.15);
  } catch {}
}

export function sonidoScoreAlto() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 523;
    gain.gain.value = 0.08;
    osc.start();
    setTimeout(() => { osc.frequency.value = 659; }, 100);
    setTimeout(() => { osc.frequency.value = 784; }, 200);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.stop(ctx.currentTime + 0.4);
  } catch {}
}
