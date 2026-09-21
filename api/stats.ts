import { list } from "@vercel/blob";
import type { IncomingMessage, ServerResponse } from "node:http";

type Hit = {
  kind?: string;
  channel?: string;
  city?: string;
  date?: string;
  dinner?: string;
  dance?: string;
  combo?: string;
  at?: string;
};

function send(res: ServerResponse, body: unknown, status = 200) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET") return send(res, { ok: false }, 405);
  const secret = process.env.DDD_IG_REFRESH_SECRET || "";
  const provided = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!secret || provided !== secret) return send(res, { ok: false }, 401);

  const token = process.env.BLOB_READ_WRITE_TOKEN || "";
  if (!token) return send(res, { ok: false }, 503);

  const combos = new Map<
    string,
    { open: number; share: number; story: number; copy: number; dm: number; native: number }
  >();
  const venues = new Map<string, { open: number; share: number }>();
  let events = 0;
  let listed = 0;
  let cursor: string | undefined;

  do {
    const page = await list({ prefix: "hits/", token, cursor, limit: 1000 });
    for (const blob of page.blobs) {
      listed += 1;
      const response = await fetch(blob.downloadUrl, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) continue;
      const hit = (await response.json()) as Hit;
      const combo = hit.combo || [hit.city, hit.date, hit.dinner, hit.dance].join("|");
      if (!combo.includes("|")) continue;
      events += 1;
      const row = combos.get(combo) || { open: 0, share: 0, story: 0, copy: 0, dm: 0, native: 0 };
      if (hit.kind === "share") {
        row.share += 1;
        if (hit.channel && hit.channel in row) {
          row[hit.channel as "story" | "copy" | "dm" | "native"] += 1;
        }
      } else {
        row.open += 1;
      }
      combos.set(combo, row);
      const [city, date, dinner, dance] = combo.split("|");
      for (const [reel, id] of [
        ["date", date],
        ["dinner", dinner],
        ["dance", dance],
      ] as const) {
        const key = `${city}|${reel}|${id}`;
        const venue = venues.get(key) || { open: 0, share: 0 };
        if (hit.kind === "share") venue.share += 1;
        else venue.open += 1;
        venues.set(key, venue);
      }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  const topCombos = [...combos.entries()]
    .map(([combo, counts]) => ({ combo, ...counts, total: counts.open + counts.share }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 50);
  const topVenues = [...venues.entries()]
    .map(([key, counts]) => {
      const [city, reel, id] = key.split("|");
      return { city, reel, id, ...counts, total: counts.open + counts.share };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 50);

  return send(res, { ok: true, events, listed, topCombos, topVenues, at: new Date().toISOString() });
}
