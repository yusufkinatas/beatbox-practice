/* Store-only zip (no compression): WAVs barely compress and this keeps the phone export dependency-free. */
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(b: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8);
  return ~c >>> 0;
}

export function zip(files: { name: string; data: Uint8Array }[]): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder(), parts: Uint8Array[] = [], central: Uint8Array[] = [];
  let off = 0;
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data);
    const head = (sig: number, extra: number) => {
      const v = new DataView(new ArrayBuffer(30 + extra + name.length));
      v.setUint32(0, sig, true);
      return v;
    };
    const l = head(0x04034b50, 0);
    l.setUint16(4, 20, true); l.setUint16(6, 0x800, true); l.setUint32(14, crc, true);
    l.setUint32(18, f.data.length, true); l.setUint32(22, f.data.length, true); l.setUint16(26, name.length, true);
    new Uint8Array(l.buffer).set(name, 30);
    const c = head(0x02014b50, 16);
    c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x800, true); c.setUint32(16, crc, true);
    c.setUint32(20, f.data.length, true); c.setUint32(24, f.data.length, true); c.setUint16(28, name.length, true);
    c.setUint32(42, off, true);
    new Uint8Array(c.buffer).set(name, 46);
    parts.push(new Uint8Array(l.buffer), f.data);
    central.push(new Uint8Array(c.buffer));
    off += l.byteLength + f.data.length;
  }
  const cdSize = central.reduce((a, c) => a + c.length, 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, off, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)], out = new Uint8Array(all.reduce((a, p) => a + p.length, 0));
  let p = 0;
  for (const a of all) { out.set(a, p); p += a.length; }
  return out;
}
