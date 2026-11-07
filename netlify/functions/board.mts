import { getStore } from "@netlify/blobs";


// Daily leaderboard.
//   d/<day>/<playerId>  one round per player per day (first round counts)
//   p/<playerId>        that player's running totals, written only on their own new round
const ID = /^[a-z0-9]{12,40}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const COURSE_PAR = 36;
const BAD = ["fuck","shit","cunt","nigg","fag","bitch","twat","wank","dick","cock","piss","slut","whore","rape","nazi","retard","paki","spaz","bollock","arse","prick","tits","porn","sex","kkk","hitler"];

function cleanName(s: unknown): string {
  const n = String(s ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 16);
  const flat = n.toLowerCase().replace(/0/g, "o").replace(/[1!|]/g, "i").replace(/3/g, "e").replace(/[4@]/g, "a").replace(/[5$]/g, "s").replace(/7/g, "t").replace(/[^a-z]/g, "");
  return BAD.some((w) => flat.includes(w)) ? "" : n;
}

// Accept the player's local date if it is within a day of the server's date (time zones).
function dayIsCurrent(day: string): boolean {
  const t = Date.parse(day + "T12:00:00Z");
  return Number.isFinite(t) && Math.abs(t - Date.now()) < 36 * 3600 * 1000;
}

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

export default async (req: Request) => {
  const store = getStore({ name: "fairway-board", consistency: "strong" });

  if (req.method === "GET") {
    const day = new URL(req.url).searchParams.get("day") ?? "";
    if (!DAY.test(day)) return json({ error: "Pass ?day=YYYY-MM-DD" }, 400);
    const [d, p] = await Promise.all([store.list({ prefix: `d/${day}/` }), store.list({ prefix: "p/" })]);
    const read = (keys: { key: string }[], max: number) =>
      Promise.all(keys.slice(0, max).map((b) => store.get(b.key, { type: "json" }).catch(() => null)));
    const [todayRows, playerRows] = await Promise.all([read(d.blobs, 400), read(p.blobs, 800)]);
    const today = todayRows.filter(Boolean)
      .map((r: any) => ({ id: r.id, name: r.name, total: r.total, toPar: r.toPar }))
      .sort((a, b) => a.toPar - b.toPar || a.total - b.total)
      .slice(0, 100);
    const all = playerRows.filter((r: any) => r && r.rounds > 0)
      .map((r: any) => ({ id: r.id, name: r.name, rounds: r.rounds, sum: r.sum, best: r.best }))
      .sort((a, b) => a.best - b.best || a.sum / a.rounds - b.sum / b.rounds)
      .slice(0, 100);
    return json({ day, today, all });
  }

  if (req.method === "POST") {
    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Send JSON" }, 400); }
    const id = String(body?.id ?? "");
    const day = String(body?.day ?? "");
    const total = Number(body?.total), toPar = Number(body?.toPar), birdies = Number(body?.birdies ?? 0);
    const name = cleanName(body?.name);
    if (!ID.test(id)) return json({ error: "Bad player id" }, 400);
    if (!DAY.test(day) || !dayIsCurrent(day)) return json({ error: "Scores can only be posted for today" }, 400);
    if (!name) return json({ error: "Pick a different name" }, 400);
    if (!Number.isInteger(total) || total < 9 || total > 72 || toPar !== total - COURSE_PAR) return json({ error: "That score doesn’t add up" }, 400);
    if (!Number.isInteger(birdies) || birdies < 0 || birdies > 9) return json({ error: "Bad birdie count" }, 400);

    const round = await store.setJSON(`d/${day}/${id}`, { id, name, total, toPar, birdies, at: Date.now() }, { onlyIfNew: true });
    if (!round.modified) return json({ status: "already" });

    const cur: any = (await store.get(`p/${id}`, { type: "json" })) ?? { rounds: 0, sum: 0, best: null };
    await store.setJSON(`p/${id}`, {
      id, name,
      rounds: (cur.rounds || 0) + 1,
      sum: (cur.sum || 0) + toPar,
      best: cur.best == null ? toPar : Math.min(cur.best, toPar),
      last: day,
    });
    return json({ status: "ok" });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config = {
  path: "/api/board",
  method: ["GET", "POST"]
};
