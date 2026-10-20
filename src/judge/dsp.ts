/* Signal helpers shared by the app and the Node scripts, so live judging, training and the report compute the same numbers. */

/** Every hit is analysed at this rate. AVP is recorded at it; other rates are resampled first. */
export const SR = 44100;

export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang), hl = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < hl; j++) {
        const a = i + j, b = a + hl;
        const br = re[b] * cr - im[b] * ci, bi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - br; im[b] = im[a] - bi; re[a] += br; im[a] += bi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

/** Power spectrum (bins 0..n/2-1) of x[start, start+len) under a Hann window, zero-padded to n (a power of 2). */
export function power(x: Float32Array, start: number, len: number, n: number): Float64Array {
  const re = new Float64Array(n), im = new Float64Array(n), L = Math.min(len, n);
  for (let i = 0; i < L; i++) {
    const j = start + i;
    if (j >= 0 && j < x.length) re[i] = x[j] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (L - 1)));
  }
  fft(re, im);
  const p = new Float64Array(n / 2);
  for (let k = 0; k < n / 2; k++) p[k] = re[k] * re[k] + im[k] * im[k];
  return p;
}

/** Mean power of x[start, end), zeros outside the array. */
export function meanPow(x: Float32Array, start: number, end: number): number {
  let s = 0;
  for (let i = Math.max(0, start); i < Math.min(end, x.length); i++) s += x[i] * x[i];
  return s / Math.max(1, end - start);
}

export const db = (p: number) => 10 * Math.log10(p + 1e-12);

/** Linear interpolation. Good enough here: the features stop at 16 kHz. */
export function resample(x: Float32Array, from: number, to = SR): Float32Array {
  if (from === to) return x;
  const n = Math.floor(x.length * to / from), y = new Float32Array(n), r = from / to;
  for (let i = 0; i < n; i++) {
    const p = i * r, j = Math.floor(p), f = p - j;
    y[i] = x[j] * (1 - f) + (j + 1 < x.length ? x[j + 1] : x[j]) * f;
  }
  return y;
}

/** 4th-order low- or high-pass (two RBJ biquads, Q = 0.707). */
export function filter(x: Float32Array, sr: number, f: number, high = false): Float32Array {
  const w = 2 * Math.PI * f / sr, c = Math.cos(w), a = Math.sin(w) / (2 * Math.SQRT1_2), a0 = 1 + a;
  const b0 = (high ? 1 + c : 1 - c) / 2 / a0, b1 = (high ? -(1 + c) : 1 - c) / a0, a1 = -2 * c / a0, a2 = (1 - a) / a0;
  let y = x;
  for (let pass = 0; pass < 2; pass++) {
    const out = new Float32Array(y.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < y.length; i++) {
      const v = b0 * y[i] + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = y[i]; y2 = y1; y1 = v; out[i] = v;
    }
    y = out;
  }
  return y;
}

/** 32-bit float mono WAV, so a saved take is judged exactly as it was live. */
export function encodeWav(x: Float32Array, sr: number): Uint8Array<ArrayBuffer> {
  const v = new DataView(new ArrayBuffer(44 + x.length * 4));
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + x.length * 4, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 3, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 32, true);
  str(36, 'data'); v.setUint32(40, x.length * 4, true);
  for (let i = 0; i < x.length; i++) v.setFloat32(44 + i * 4, x[i], true);
  return new Uint8Array(v.buffer);
}

/** PCM 16/24/32-bit or float32 WAV, mixed down to mono. */
export function decodeWav(bytes: Uint8Array): { x: Float32Array; sr: number } {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o: number) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('not a WAV file');
  let fmt = 0, ch = 1, sr = 0, bits = 0, o = 12;
  while (o + 8 <= bytes.length) {
    const id = tag(o), size = v.getUint32(o + 4, true), body = o + 8;
    if (id === 'fmt ') {
      fmt = v.getUint16(body, true); ch = v.getUint16(body + 2, true); sr = v.getUint32(body + 4, true); bits = v.getUint16(body + 14, true);
      if (fmt === 0xfffe) fmt = v.getUint16(body + 24, true);
    } else if (id === 'data') {
      const bps = bits / 8, n = Math.floor(Math.min(size, bytes.length - body) / (bps * ch)), x = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        let s = 0;
        for (let c = 0; c < ch; c++) {
          const p = body + (i * ch + c) * bps;
          s += fmt === 3 ? (bits === 64 ? v.getFloat64(p, true) : v.getFloat32(p, true))
            : bits === 16 ? v.getInt16(p, true) / 32768
            : bits === 24 ? ((v.getUint8(p) | v.getUint8(p + 1) << 8 | v.getInt8(p + 2) << 16) / 8388608)
            : bits === 32 ? v.getInt32(p, true) / 2147483648
            : (v.getUint8(p) - 128) / 128;
        }
        x[i] = s / ch;
      }
      return { x, sr };
    }
    o = body + size + (size & 1);
  }
  throw new Error('WAV has no data chunk');
}
