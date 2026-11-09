import { getStore } from "@netlify/blobs";

// Once a day, delete room entries nobody has updated for an hour.
export default async () => {
  const store = getStore({ name: "fairway-rooms", consistency: "strong" });
  const { blobs } = await store.list({ prefix: "r/" });
  const cutoff = Date.now() - 60 * 60_000;
  let removed = 0;
  for (const b of blobs) {
    const v: any = await store.get(b.key, { type: "json" }).catch(() => null);
    if (!v || !v.ts || v.ts < cutoff) { await store.delete(b.key).catch(() => {}); removed++; }
  }
  console.log(`room cleanup: removed ${removed} of ${blobs.length}`);
};

export const config = { schedule: "@daily" };
