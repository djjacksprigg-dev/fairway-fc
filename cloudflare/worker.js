// Fairway FC on Cloudflare: the game is static files in ./site, served directly by Cloudflare.
// This Worker only handles /api/room (live online rooms). Each room lives in its own Durable
// Object, held in memory only: nothing is written to disk, and a room disappears once it goes quiet.

const CODE = /^[a-z0-9]{3,8}$/;
const PEER = /^[a-z0-9]{8,32}$/;
const LIVE_MS = 45_000;
const MAX_PEERS = 40;
const BAD = ["fuck","shit","cunt","nigg","fag","bitch","twat","wank","dick","cock","piss","slut","whore","rape","nazi","retard","paki","spaz","bollock","arse","prick","tits","porn","sex","kkk","hitler"];

function cleanName(s) {
  const n = String(s ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 16);
  const flat = n.toLowerCase().replace(/0/g, "o").replace(/[1!|]/g, "i").replace(/3/g, "e").replace(/[4@]/g, "a").replace(/[5$]/g, "s").replace(/7/g, "t").replace(/[^a-z]/g, "");
  return BAD.some((w) => flat.includes(w)) ? "Player" : n || "Player";
}
const int = (v, lo, hi, d = 0) => { const n = Number(v); return Number.isInteger(n) && n >= lo && n <= hi ? n : d; };
const json = (body, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });

export class Room {
  constructor(state) { this.state = state; this.peers = new Map(); }
  live() {
    const now = Date.now(), out = [];
    for (const [k, v] of this.peers) { if (now - v.ts > LIVE_MS) this.peers.delete(k); else out.push(v); }
    return out;
  }
  async fetch(req) {
    if (req.method === "GET") return json({ peers: this.live() });
    const b = await req.json();
    if (b.leave) { this.peers.delete(b.peer); return json({ status: "left" }); }
    if (!this.peers.has(b.peer) && this.live().length >= MAX_PEERS) return json({ error: "Room is full" }, 429);
    const last = b.last && typeof b.last === "object" ? { h: int(b.last.h, 0, 17), d: int(b.last.d, -4, 10) } : null;
    const o = b.opts && typeof b.opts === "object" ? b.opts : null;
    const opts = o ? { len: [3, 9, 18].includes(Number(o.len)) ? Number(o.len) : 9, theme: ["all", "world", "clubs", "people"].includes(o.theme) ? o.theme : "all", clock: Number(o.clock) === 12 ? 12 : 25 } : null;
    this.peers.set(b.peer, {
      peer: b.peer, name: cleanName(b.name), thru: int(b.thru, 0, 18), toPar: int(b.toPar, -72, 180),
      total: int(b.total, 0, 260), opts, done: !!b.done, last, ts: Date.now(),
    });
    return json({ status: "ok", peers: this.live() });
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname !== "/api/room") return env.ASSETS.fetch(req);
    let code, body;
    if (req.method === "GET") code = (url.searchParams.get("code") ?? "").toLowerCase();
    else if (req.method === "POST") {
      const text = await req.text();
      if (text.length > 4000) return json({ error: "Too big" }, 413);
      try { body = JSON.parse(text); } catch { return json({ error: "Send JSON" }, 400); }
      code = String(body?.code ?? "").toLowerCase();
      if (!PEER.test(String(body?.peer ?? ""))) return json({ error: "Bad room or player" }, 400);
    } else return json({ error: "Method not allowed" }, 405);
    if (!CODE.test(code)) return json({ error: "Bad room code" }, 400);
    const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
    const r = await stub.fetch("https://room/", body ? { method: "POST", body: JSON.stringify(body) } : {});
    const j = await r.json();
    return json(req.method === "GET" ? { code, peers: j.peers || [] } : { ...j, code }, r.status);
  },
};
