import { getStore } from "@netlify/blobs";


// Live rooms. Each open game posts its position every few seconds to r/<code>/<peer>;
// everyone in the room polls the list. Entries older than 45 s count as gone.
const CODE = /^[a-z0-9]{3,8}$/;
const PEER = /^[a-z0-9]{8,32}$/;
const LIVE_MS = 45_000, STALE_MS = 10 * 60_000;
const BAD = ["fuck","shit","cunt","nigg","fag","bitch","twat","wank","dick","cock","piss","slut","whore","rape","nazi","retard","paki","spaz","bollock","arse","prick","tits","porn","sex","kkk","hitler"];

function cleanName(s: unknown): string {
  const n = String(s ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 16);
  const flat = n.toLowerCase().replace(/0/g, "o").replace(/[1!|]/g, "i").replace(/3/g, "e").replace(/[4@]/g, "a").replace(/[5$]/g, "s").replace(/7/g, "t").replace(/[^a-z]/g, "");
  return BAD.some((w) => flat.includes(w)) ? "Player" : n || "Player";
}
const int = (v: unknown, lo: number, hi: number, d = 0) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= lo && n <= hi ? n : d;
};
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

export default async (req: Request) => {
  const store = getStore({ name: "fairway-rooms", consistency: "strong" });

  // everyone currently in the room (stale entries are tidied away as we go)
  const list = async (code: string) => {
    const { blobs } = await store.list({ prefix: `r/${code}/` });
    const rows = await Promise.all(blobs.slice(0, 40).map((b) => store.get(b.key, { type: "json" }).then((v) => [b.key, v] as const).catch(() => [b.key, null] as const)));
    const now = Date.now();
    const peers: any[] = [];
    for (const [key, v] of rows as any) {
      if (!v) continue;
      if (now - v.ts > STALE_MS) { store.delete(key).catch(() => {}); continue; }
      if (now - v.ts <= LIVE_MS) peers.push(v);
    }
    return peers;
  };

  if (req.method === "GET") {
    const code = (new URL(req.url).searchParams.get("code") ?? "").toLowerCase();
    if (!CODE.test(code)) return json({ error: "Bad room code" }, 400);
    return json({ code, peers: await list(code) });
  }

  if (req.method === "POST") {
    let b: any;
    try { b = await req.json(); } catch { return json({ error: "Send JSON" }, 400); }
    const code = String(b?.code ?? "").toLowerCase(), peer = String(b?.peer ?? "");
    if (!CODE.test(code) || !PEER.test(peer)) return json({ error: "Bad room or player" }, 400);
    const key = `r/${code}/${peer}`;
    if (b.leave) { await store.delete(key); return json({ status: "left" }); }
    const last = b.last && typeof b.last === "object" ? { h: int(b.last.h, 0, 17), d: int(b.last.d, -4, 10) } : null;
    const o = b.opts && typeof b.opts === "object" ? b.opts : null;
    const opts = o ? { len: [3, 9, 18].includes(Number(o.len)) ? Number(o.len) : 9, theme: ["all", "world", "clubs", "people"].includes(o.theme) ? o.theme : "all", clock: Number(o.clock) === 12 ? 12 : 25 } : null;
    await store.setJSON(key, {
      peer,
      name: cleanName(b.name),
      thru: int(b.thru, 0, 18),
      toPar: int(b.toPar, -72, 180),
      total: int(b.total, 0, 260),
      opts,
      done: !!b.done,
      last,
      ts: Date.now(),
    });
    return json({ status: "ok", code, peers: await list(code) });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config = {
  path: "/api/room",
  method: ["GET", "POST"],
  // generous: a whole classroom can share one school IP address
  rateLimit: { windowLimit: 900, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
