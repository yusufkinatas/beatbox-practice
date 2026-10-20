/* Cuts hits out of a stream. The app feeds it mic chunks; the scripts feed it whole files. Same code, same cuts. */

export type DetectorCfg = {
  triggerDb: number;     // RMS over ~3 ms that starts a hit, dBFS
  endDb: number;         // below this for endMs, the hit is over
  endMs: number;
  preMs: number;         // audio kept before the onset; the onset always sits exactly here
  maxMs: number;         // longest hit after the onset
  refractoryMs: number;
  rearmMs: number;       // quiet this long (below half the trigger) before a new hit can start, so a wobbling tail is not a new hit
};

/** x holds preMs of audio before the onset, then the hit. at: onset as an absolute sample index in the stream. */
export type Hit = { x: Float32Array; sr: number; at: number };

export const onsetIndex = (sr: number, preMs: number) => Math.round(preMs * sr / 1000);

export class HitDetector {
  private readonly ring: Float32Array;
  private w = 0;                      // samples written so far
  private readonly hop: number;
  private acc = 0;
  private sum = 0;
  private armed = true;
  private quiet = 0;
  private last = -Infinity;
  private cur: { at: number; quiet: number } | null = null;
  private readonly pre: number;
  private readonly thr: number;
  private readonly endThr: number;
  readonly sr: number;
  readonly cfg: DetectorCfg;

  constructor(sr: number, cfg: DetectorCfg) {
    this.sr = sr; this.cfg = cfg;
    this.hop = Math.max(1, Math.round(sr * 0.0029));
    this.pre = onsetIndex(sr, cfg.preMs);
    this.ring = new Float32Array(this.pre + Math.ceil((cfg.maxMs + 100) * sr / 1000) + this.hop);
    this.thr = 10 ** (cfg.triggerDb / 20);
    this.endThr = 10 ** (cfg.endDb / 20);
  }

  push(chunk: Float32Array): Hit[] {
    const out: Hit[] = [], R = this.ring.length;
    for (let i = 0; i < chunk.length; i++) {
      const s = chunk[i];
      this.ring[this.w % R] = s;
      this.w++;
      this.sum += s * s;
      if (++this.acc === this.hop) { this.step(Math.sqrt(this.sum / this.hop), out); this.acc = 0; this.sum = 0; }
    }
    return out;
  }

  /** End of input: emit the hit still being collected. */
  flush(): Hit[] {
    const out: Hit[] = [];
    if (this.cur) out.push(this.cut(this.cur.at, this.w));
    this.cur = null;
    return out;
  }

  private step(rms: number, out: Hit[]): void {
    const { cfg, sr, w } = this;
    if (this.cur) {
      this.cur.quiet = rms < this.endThr ? this.cur.quiet + this.hop : 0;
      if (this.cur.quiet >= cfg.endMs * sr / 1000 || w - this.cur.at >= cfg.maxMs * sr / 1000) {
        out.push(this.cut(this.cur.at, w));
        this.cur = null;
      }
    }
    this.quiet = rms < this.thr * 0.5 ? this.quiet + this.hop : 0;
    if (this.quiet >= cfg.rearmMs * sr / 1000) this.armed = true;
    if (this.armed && rms > this.thr && w - this.last >= cfg.refractoryMs * sr / 1000) {
      let at = w - this.hop;
      while (at < w - 1 && Math.abs(this.ring[at % this.ring.length]) <= this.thr) at++;
      if (this.cur) out.push(this.cut(this.cur.at, at));
      this.cur = { at, quiet: 0 };
      this.armed = false;
      this.last = at;
    }
  }

  /** Samples [at - pre, end), zero-padded where the stream had not started yet. */
  private cut(at: number, end: number): Hit {
    const x = new Float32Array(end - at + this.pre), R = this.ring.length;
    for (let i = 0; i < x.length; i++) {
      const j = at - this.pre + i;
      if (j >= 0 && j > this.w - R) x[i] = this.ring[j % R];
    }
    return { x, sr: this.sr, at };
  }
}

/** Every hit in a whole recording. */
export function detectAll(x: Float32Array, sr: number, cfg: DetectorCfg): Hit[] {
  const d = new HitDetector(sr, cfg), out: Hit[] = [];
  for (let i = 0; i < x.length; i += 1024) out.push(...d.push(x.subarray(i, i + 1024)));
  return out.concat(d.flush());
}
