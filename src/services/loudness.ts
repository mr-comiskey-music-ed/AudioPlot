/**
 * Perceived loudness of a recording, measured the broadcast way (ITU-R BS.1770 / LUFS): K-weighting
 * (a high-frequency lift and a low-frequency roll-off, like the ear), averaged over 400 ms blocks, ignoring
 * silence and the quietest passages. Used to even out the soundcheck loops so no instrument jumps out.
 */

interface Biquad {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

/** Stage 1 of K-weighting: a gentle high-shelf lift above ~1.7 kHz. */
function shelf(sr: number): Biquad {
  const f0 = 1681.974450955533;
  const G = 3.999843853973347;
  const Q = 0.7071752369554196;
  const K = Math.tan((Math.PI * f0) / sr);
  const Vh = Math.pow(10, G / 20);
  const Vb = Math.pow(Vh, 0.4996667741545416);
  const a0 = 1 + K / Q + K * K;
  return {
    b0: (Vh + (Vb * K) / Q + K * K) / a0,
    b1: (2 * (K * K - Vh)) / a0,
    b2: (Vh - (Vb * K) / Q + K * K) / a0,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / Q + K * K) / a0,
  };
}

/** Stage 2: a high-pass at ~38 Hz. */
function highPass(sr: number): Biquad {
  const f0 = 38.13547087602444;
  const Q = 0.5003270373238773;
  const K = Math.tan((Math.PI * f0) / sr);
  const a0 = 1 + K / Q + K * K;
  return { b0: 1, b1: -2, b2: 1, a1: (2 * (K * K - 1)) / a0, a2: (1 - K / Q + K * K) / a0 };
}

function filter(input: Float32Array, c: Biquad, out: Float32Array) {
  let z1 = 0;
  let z2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x = input[i];
    const y = c.b0 * x + z1;
    z1 = c.b1 * x - c.a1 * y + z2;
    z2 = c.b2 * x - c.a2 * y;
    out[i] = y;
  }
}

const toLufs = (meanSquare: number) => (meanSquare > 0 ? -0.691 + 10 * Math.log10(meanSquare) : -Infinity);

/** Gated integrated loudness in LUFS, or -Infinity for silence. */
export function measureLoudnessLufs(buffer: AudioBuffer): number {
  const sr = buffer.sampleRate;
  const n = buffer.length;
  const block = Math.round(0.4 * sr);
  const step = Math.round(0.1 * sr);
  if (n < block) return -Infinity;

  // Per-channel running sum of squares of the K-weighted signal, so any block's mean square is two lookups
  const cumulative: Float64Array[] = [];
  const stage = new Float32Array(n);
  const weighted = new Float32Array(n);
  const s1 = shelf(sr);
  const s2 = highPass(sr);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    filter(buffer.getChannelData(c), s1, stage);
    filter(stage, s2, weighted);
    const cum = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) cum[i + 1] = cum[i] + weighted[i] * weighted[i];
    cumulative.push(cum);
  }

  const blocks: number[] = [];
  for (let start = 0; start + block <= n; start += step) {
    let ms = 0;
    for (const cum of cumulative) ms += (cum[start + block] - cum[start]) / block;
    blocks.push(ms);
  }
  const loud = blocks.filter((m) => toLufs(m) > -70); // absolute gate
  if (loud.length === 0) return -Infinity;
  const relGate = toLufs(loud.reduce((a, b) => a + b, 0) / loud.length) - 10; // relative gate
  const kept = loud.filter((m) => toLufs(m) > relGate);
  return toLufs(kept.reduce((a, b) => a + b, 0) / kept.length);
}
