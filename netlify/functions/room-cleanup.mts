import { getStore } from "@netlify/blobs";

// Once a day, delete room entries nobody has updated for an hour,
// and erase anything left from the old public leaderboard (removed Nov 2026).
export default async () => {
  const store = getStore({ name: "fairway-rooms", consistency: "strong" });
  const { blobs } = await store.list({ prefix: "r/" });
  const cutoff = Date.now() - 60 * 60_000;
  let removed = 0;
  for (const b of blobs) {
    const v: any = await store.get(b.key, { type: "json" }).catch(() => null);
    if (!v || !v.ts || v.ts < cutoff) { await store.delete(b.key).catch(() => {}); removed++; }
  }
  const old = getStore({ name: "fairway-board", consistency: "strong" });
  const { blobs: lb } = await old.list();
  for (const b of lb) await old.delete(b.key).catch(() => {});
  console.log(`cleanup: removed ${removed} of ${blobs.length} room entries, erased ${lb.length} old leaderboard entries`);
};

export const config = { schedule: "@daily" };
