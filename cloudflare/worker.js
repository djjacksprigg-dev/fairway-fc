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


// ---------- Live rooms: everyone on the same course, taking turns ----------
// One LiveRoom per room code. It keeps the lobby and an ordered log of game events (start, shots, putts, missed goes)
// in memory only and relays each new event to every connected phone over a WebSocket. Phones replay the log to agree
// on the game, so the server needs no football logic. An event is accepted only if it follows the latest one
// ("after" must equal the log length), which stops two phones acting on the same turn.
const LIVE_TYPES = new Set(["start", "shot", "putt", "miss", "leave"]);
const MAX_PLAYERS = 4, MAX_SOCKETS = 10, MAX_LOG = 3000;
export class LiveRoom {
  constructor(state) { this.state = state; this.socks = new Map(); this.lobby = []; this.log = []; }
  send(ws, m) { try { ws.send(JSON.stringify(m)); } catch {} }
  all(m) { const s = JSON.stringify(m); for (const ws of this.socks.keys()) { try { ws.send(s); } catch {} } }
  peers() { return [...new Set([...this.socks.values()].map((c) => c.peer).filter(Boolean))]; }
  async fetch(req) {
    if (req.headers.get("Upgrade") !== "websocket") return json({ error: "Expected a WebSocket" }, 426);
    if (this.socks.size >= MAX_SOCKETS) return json({ error: "Room is busy" }, 429);
    const pair = new WebSocketPair(), [client, server] = Object.values(pair);
    server.accept();
    const me = { peer: null };
    clearTimeout(this.empty);
    this.socks.set(server, me);
    server.addEventListener("message", (e) => this.onMessage(server, me, e.data));
    const gone = () => { this.socks.delete(server); if (!this.log.length && me.peer && !this.peers().includes(me.peer)) this.lobby = this.lobby.filter((p) => p.peer !== me.peer); this.all({ type: "peers", peers: this.peers(), lobby: this.lobby });
      // once everyone has gone for two minutes, forget the room completely
      if (!this.socks.size) { clearTimeout(this.empty); this.empty = setTimeout(() => { if (!this.socks.size) { this.lobby = []; this.log = []; } }, 120_000); } };
    server.addEventListener("close", gone); server.addEventListener("error", gone);
    return new Response(null, { status: 101, webSocket: client });
  }
  onMessage(ws, me, raw) {
    if (typeof raw !== "string" || raw.length > 6000) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.type === "hello") {
      const peer = String(m.peer ?? ""); if (!PEER.test(peer)) return this.send(ws, { type: "error", error: "Bad player" });
      me.peer = peer;
      const started = this.log.length > 0, inLobby = this.lobby.find((p) => p.peer === peer);
      if (!started && !inLobby) {
        if (this.lobby.length >= MAX_PLAYERS) return this.send(ws, { type: "full" });
        this.lobby.push({ peer, name: cleanName(m.name), kit: cleanKit(m.kit), opts: cleanOpts(m.opts) });
      } else if (inLobby && !started) { inLobby.name = cleanName(m.name); inLobby.kit = cleanKit(m.kit); }
      this.send(ws, { type: "state", log: this.log, lobby: this.lobby, peers: this.peers() });
      this.all({ type: "peers", peers: this.peers(), lobby: this.lobby });
      return;
    }
    if (m.type === "ev" && me.peer) {
      const ev = m.ev && typeof m.ev === "object" ? m.ev : null;
      if (!ev || !LIVE_TYPES.has(ev.t)) return;
      if (m.after !== this.log.length) return this.send(ws, { type: "nack", log: this.log.slice(Math.max(0, Number(m.after) || 0)), from: Math.max(0, Number(m.after) || 0) });
      if (ev.t === "start") {
        if (this.log.length || !this.lobby.length || this.lobby[0].peer !== me.peer) return;
        ev.players = this.lobby.map((p) => ({ peer: p.peer, name: p.name, kit: p.kit }));
        ev.opts = this.lobby[0].opts; ev.seed = String(ev.seed ?? "").slice(0, 60);
      } else if (!this.log.length || this.log.length >= MAX_LOG) return;
      const out = { ...ev, seq: this.log.length, by: me.peer, ts: Date.now() };
      this.log.push(out);
      this.all({ type: "ev", ev: out });
    }
  }
}
const KITHEX = /^#[0-9a-f]{6}$/i;
function cleanKit(k) {
  if (!k || typeof k !== "object") return null;
  const o = {}; for (const f of ["shirt", "shirt2", "shorts", "socks"]) o[f] = KITHEX.test(k[f]) ? k[f] : "#d62828";
  o.pattern = ["plain", "stripes", "hoops", "halves", "sash"].includes(k.pattern) ? k.pattern : "plain";
  o.num = Number.isInteger(k.num) && k.num >= 1 && k.num <= 99 ? k.num : 9; return o;
}
function cleanOpts(o) {
  o = o && typeof o === "object" ? o : {};
  return { len: [3, 9, 18].includes(Number(o.len)) ? Number(o.len) : 9, theme: ["all", "world", "clubs", "people"].includes(o.theme) ? o.theme : "all", clock: 12, match: false };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/api/live") {
      const code = (url.searchParams.get("code") ?? "").toLowerCase();
      if (!CODE.test(code)) return json({ error: "Bad room code" }, 400);
      return env.LIVE.get(env.LIVE.idFromName(code)).fetch(req);
    }
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
