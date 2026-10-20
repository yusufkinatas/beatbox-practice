/* Mic in, playback out. Mic setup and gesture handling follow v0 (index.html); the worklet only forwards raw audio so the
   shared HitDetector cuts hits on the main thread exactly as the scripts do. */

const WORKLET = `
class Tap extends AudioWorkletProcessor {
  constructor() { super(); this.b = new Float32Array(1024); this.n = 0; }
  process(inputs, outputs) {
    const o = outputs[0] && outputs[0][0];
    if (o) o.fill(1e-6); /* -120 dBFS keeps the output from going digitally silent */
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.b[this.n++] = ch[i];
      if (this.n === this.b.length) { this.port.postMessage(this.b, [this.b.buffer]); this.b = new Float32Array(1024); this.n = 0; }
    }
    return true;
  }
}
registerProcessor('bb-tap', Tap);`;

let ctx: AudioContext | null = null, micP: Promise<boolean> | null = null, live = false;

export const audio = {
  /** Called with every 1024-sample mic chunk. */
  onChunk: (_x: Float32Array) => {},
  onState: () => {},
  state: 'off' as 'off' | 'on' | 'blocked',
  sr: 48000,
  /** Hits that start before this (performance.now) are our own playback leaking into the mic. */
  mutedUntil: 0,
};

export function ensureCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext({ latencyHint: 'interactive' });
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  return ctx;
}

/** Call from a user gesture. */
export function ensureMic(): Promise<boolean> {
  const c = ensureCtx();
  if (live) return Promise.resolve(true);
  return micP ??= (async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch {
      audio.state = 'blocked'; audio.onState(); return false;
    }
    try {
      await c.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' })));
      const src = c.createMediaStreamSource(stream), node = new AudioWorkletNode(c, 'bb-tap', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
      node.port.onmessage = e => audio.onChunk(e.data as Float32Array);
      src.connect(node); node.connect(c.destination);
      const tr = stream.getAudioTracks()[0];
      if (tr) tr.onended = () => { src.disconnect(); node.disconnect(); live = false; audio.state = 'off'; audio.onState(); };
      live = true; audio.sr = c.sampleRate; audio.state = 'on'; audio.onState();
      return true;
    } catch (e) {
      console.error('Audio input failed', e);
      stream.getTracks().forEach(t => t.stop());
      audio.state = 'blocked'; audio.onState(); return false;
    }
  })().finally(() => { micP = null; });
}

let playing: AudioBufferSourceNode | null = null;
/** Plays x and mutes the detector for its length plus a margin, so playback is never judged as a hit. */
export function play(x: Float32Array, sr: number): Promise<void> {
  const c = ensureCtx(), b = c.createBuffer(1, x.length, sr);
  b.getChannelData(0).set(x);
  try { playing?.stop(); } catch { /* already stopped */ }
  const s = c.createBufferSource();
  s.buffer = b; s.connect(c.destination); s.start();
  playing = s;
  audio.mutedUntil = performance.now() + b.duration * 1000 + 300;
  return new Promise(ok => { s.onended = () => ok(); });
}
